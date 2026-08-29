#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE = 'origin/master';

export function parseArguments(argv) {
  const options = { base: DEFAULT_BASE, expectedBranch: null, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    const [name, inlineValue] = argument.split('=', 2);
    if (name !== '--base' && name !== '--expect-branch') {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (!value || (!inlineValue && value.startsWith('--'))) {
      throw new Error(`Missing value for ${name}`);
    }
    if (inlineValue === undefined) index += 1;

    if (name === '--base') options.base = value;
    if (name === '--expect-branch') options.expectedBranch = value;
  }

  return options;
}

export function parseWorktreeStatus(output) {
  if (!output) return { count: 0, sample: [] };
  const entries = output.split('\n').filter(Boolean);
  return {
    count: entries.length,
    sample: entries.slice(0, 5)
  };
}

export function assessRepository(facts, options) {
  const warnings = [];
  const notes = [];

  if (!facts.branch) {
    warnings.push('HEAD is detached; create or switch to the intended task branch before editing.');
  } else if (options.expectedBranch && facts.branch !== options.expectedBranch) {
    warnings.push(`Expected branch ${options.expectedBranch}, but this worktree is on ${facts.branch}.`);
  }

  if (facts.status.count > 0) {
    warnings.push(`The worktree has ${facts.status.count} changed or untracked path(s).`);
  }

  if (!facts.baseExists) {
    warnings.push(`Base ${options.base} is unavailable; fetch it explicitly before relying on this report.`);
  } else {
    if (facts.behind > 0) {
      warnings.push(`HEAD is behind ${options.base} by ${facts.behind} commit(s).`);
    }
    if (facts.ahead > 0) {
      notes.push(`HEAD is ahead of ${options.base} by ${facts.ahead} commit(s).`);
    }
    if (facts.ahead === 0 && facts.behind === 0) {
      notes.push(`HEAD exactly matches ${options.base}.`);
    }
  }

  if (facts.invocationDirectory !== facts.root) {
    notes.push(`Command was run below the repository root: ${facts.invocationDirectory}`);
  }

  return { warnings, notes };
}

function defaultGitRunner(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout.trimEnd(),
    stderr: result.stderr.trimEnd()
  };
}

function requireGit(git, args, cwd, description) {
  const result = git(args, cwd);
  if (!result.ok) {
    const detail = result.stderr || result.stdout || 'git returned no diagnostic';
    throw new Error(`Could not ${description}: ${detail}`);
  }
  return result.stdout;
}

export function collectRepositoryFacts({ cwd = process.cwd(), git = defaultGitRunner, base = DEFAULT_BASE } = {}) {
  const root = requireGit(git, ['rev-parse', '--show-toplevel'], cwd, 'find the repository root');
  const branchResult = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], root);
  const status = parseWorktreeStatus(requireGit(
    git,
    ['status', '--porcelain=v1', '--untracked-files=all'],
    root,
    'read worktree status'
  ));
  const head = requireGit(git, ['rev-parse', '--short=12', 'HEAD'], root, 'read HEAD');
  const baseResult = git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], root);

  let baseCommit = null;
  let ahead = 0;
  let behind = 0;
  if (baseResult.ok) {
    baseCommit = baseResult.stdout.slice(0, 12);
    const counts = requireGit(
      git,
      ['rev-list', '--left-right', '--count', `${base}...HEAD`],
      root,
      `compare HEAD with ${base}`
    ).split(/\s+/).map(Number);
    [behind, ahead] = counts;
  }

  return {
    root,
    invocationDirectory: cwd,
    branch: branchResult.ok ? branchResult.stdout : null,
    status,
    head,
    baseExists: baseResult.ok,
    baseCommit,
    ahead,
    behind
  };
}

export function formatReport(facts, options, assessment) {
  const branch = facts.branch ?? '(detached HEAD)';
  const base = facts.baseExists ? `${options.base} (${facts.baseCommit})` : `${options.base} (unavailable)`;
  const cleanliness = facts.status.count === 0
    ? 'clean'
    : `${facts.status.count} changed or untracked path(s)`;
  const lines = [
    'Repository safety preflight (advisory; no repository changes made)',
    `Root:   ${facts.root}`,
    `Branch: ${branch}`,
    `HEAD:   ${facts.head}`,
    `Base:   ${base}`,
    `Status: ${cleanliness}`
  ];

  if (facts.status.sample.length > 0) {
    lines.push('Changed paths:');
    lines.push(...facts.status.sample.map(entry => `  ${entry}`));
    if (facts.status.count > facts.status.sample.length) {
      lines.push(`  ...and ${facts.status.count - facts.status.sample.length} more`);
    }
  }

  if (assessment.notes.length > 0) {
    lines.push('Notes:');
    lines.push(...assessment.notes.map(note => `  - ${note}`));
  }

  if (assessment.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push(...assessment.warnings.map(warning => `  - ${warning}`));
    lines.push('Review these warnings before editing. This advisory report still exits successfully.');
  } else {
    lines.push('No repository-safety warnings found.');
  }

  return `${lines.join('\n')}\n`;
}

export function usage() {
  return `Usage: node scripts/repository-safety-preflight.mjs [options]

Options:
  --expect-branch <name>  Warn unless the current branch has this exact name
  --base <revision>       Compare HEAD with this local revision (default: ${DEFAULT_BASE})
  -h, --help              Show this help

This command is read-only and does not fetch. Refresh the base explicitly first.
Repository findings are advisory and do not cause a nonzero exit status.
`;
}

export function runPreflight({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  git = defaultGitRunner,
  write = value => process.stdout.write(value),
  writeError = value => process.stderr.write(value)
} = {}) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    writeError(`${error.message}\n\n${usage()}`);
    return 2;
  }

  if (options.help) {
    write(usage());
    return 0;
  }

  try {
    const facts = collectRepositoryFacts({ cwd, git, base: options.base });
    const assessment = assessRepository(facts, options);
    write(formatReport(facts, options, assessment));
    return 0;
  } catch (error) {
    writeError(`Repository safety preflight could not run: ${error.message}\n`);
    return 2;
  }
}

const isCommandLineEntry = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLineEntry) process.exitCode = runPreflight();
