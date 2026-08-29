import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessRepository,
  collectRepositoryFacts,
  formatReport,
  parseArguments,
  runPreflight
} from '../scripts/repository-safety-preflight.mjs';

const cleanFacts = {
  root: '/work/hazemaze',
  invocationDirectory: '/work/hazemaze',
  branch: 'codex/repository-safety',
  status: { count: 0, sample: [] },
  head: '123456789abc',
  baseExists: true,
  baseCommit: '123456789abc',
  ahead: 0,
  behind: 0
};

test('arguments support separate and inline values without dependencies', () => {
  assert.deepEqual(
    parseArguments(['--expect-branch', 'codex/safe', '--base=origin/main']),
    { expectedBranch: 'codex/safe', base: 'origin/main', help: false }
  );
  assert.throws(() => parseArguments(['--expect-branch']), /Missing value/);
  assert.throws(() => parseArguments(['--unknown']), /Unknown argument/);
});

test('a clean expected branch at its base has no warnings', () => {
  const options = { expectedBranch: 'codex/repository-safety', base: 'origin/master' };
  const assessment = assessRepository(cleanFacts, options);
  assert.deepEqual(assessment.warnings, []);
  assert.deepEqual(assessment.notes, ['HEAD exactly matches origin/master.']);
  assert.match(formatReport(cleanFacts, options, assessment), /No repository-safety warnings found/);
});

test('dirty, unexpected, and behind states produce concise warnings', () => {
  const facts = {
    ...cleanFacts,
    branch: 'rescue/chapter1-wip',
    status: { count: 2, sample: [' M game.js', '?? notes.txt'] },
    head: 'aaaaaaaaaaaa',
    behind: 3
  };
  const options = { expectedBranch: 'codex/repository-safety', base: 'origin/master' };
  const assessment = assessRepository(facts, options);
  const report = formatReport(facts, options, assessment);

  assert.equal(assessment.warnings.length, 3);
  assert.match(report, /Expected branch codex\/repository-safety/);
  assert.match(report, /2 changed or untracked path/);
  assert.match(report, /behind origin\/master by 3 commit/);
  assert.match(report, /This advisory report still exits successfully/);
});

test('missing bases and detached HEADs are advisory warnings', () => {
  const facts = {
    ...cleanFacts,
    branch: null,
    baseExists: false,
    baseCommit: null
  };
  const assessment = assessRepository(facts, { expectedBranch: null, base: 'origin/master' });
  assert.equal(assessment.warnings.length, 2);
  assert.match(assessment.warnings[0], /detached/);
  assert.match(assessment.warnings[1], /fetch it explicitly/);
});

test('repository facts are collected through an injectable git runner', () => {
  const responses = new Map([
    ['rev-parse --show-toplevel', { ok: true, stdout: '/work/hazemaze', stderr: '' }],
    ['symbolic-ref --quiet --short HEAD', { ok: true, stdout: 'codex/safe', stderr: '' }],
    ['status --porcelain=v1 --untracked-files=all', { ok: true, stdout: ' M AGENTS.md', stderr: '' }],
    ['rev-parse --short=12 HEAD', { ok: true, stdout: 'aaaaaaaaaaaa', stderr: '' }],
    ['rev-parse --verify --quiet origin/master^{commit}', { ok: true, stdout: 'bbbbbbbbbbbbbbbb', stderr: '' }],
    ['rev-list --left-right --count origin/master...HEAD', { ok: true, stdout: '2\t1', stderr: '' }]
  ]);
  const git = args => responses.get(args.join(' ')) ?? { ok: false, stdout: '', stderr: 'unexpected command' };

  assert.deepEqual(collectRepositoryFacts({ cwd: '/work/hazemaze', git }), {
    root: '/work/hazemaze',
    invocationDirectory: '/work/hazemaze',
    branch: 'codex/safe',
    status: { count: 1, sample: [' M AGENTS.md'] },
    head: 'aaaaaaaaaaaa',
    baseExists: true,
    baseCommit: 'bbbbbbbbbbbb',
    ahead: 1,
    behind: 2
  });
});

test('advisory findings leave the preflight exit status successful', () => {
  let output = '';
  const responses = new Map([
    ['rev-parse --show-toplevel', { ok: true, stdout: '/work/hazemaze', stderr: '' }],
    ['symbolic-ref --quiet --short HEAD', { ok: true, stdout: 'wrong-branch', stderr: '' }],
    ['status --porcelain=v1 --untracked-files=all', { ok: true, stdout: '?? scratch.txt', stderr: '' }],
    ['rev-parse --short=12 HEAD', { ok: true, stdout: 'aaaaaaaaaaaa', stderr: '' }],
    ['rev-parse --verify --quiet origin/master^{commit}', { ok: true, stdout: 'bbbbbbbbbbbb', stderr: '' }],
    ['rev-list --left-right --count origin/master...HEAD', { ok: true, stdout: '1 0', stderr: '' }]
  ]);
  const git = args => responses.get(args.join(' ')) ?? { ok: false, stdout: '', stderr: 'unexpected command' };
  const status = runPreflight({
    argv: ['--expect-branch', 'codex/repository-safety'],
    cwd: '/work/hazemaze',
    git,
    write: value => { output += value; },
    writeError: () => {}
  });

  assert.equal(status, 0);
  assert.match(output, /Warnings:/);
  assert.match(output, /still exits successfully/);
});
