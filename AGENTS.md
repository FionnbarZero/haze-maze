# Tech

Modern HTML/JS only. Don't worry about backwards compatibility to old browsers.

Design for Windows and Mac desktop browsers first. Prioritize keyboard and mouse
controls, desktop-quality presentation, and the complete desktop experience.
Keep new input architecture ready for future gamepad support.

Mobile-phone development is paused. Preserve the existing landscape-touch
controls, responsive code, instrumentation, and test records, but do not add
mobile-specific features, optimization, or device qualification unless the user
explicitly resumes that work. Keep shared systems reasonably portable without
allowing mobile limitations to constrain desktop design.

# Planning and cost

Before implementing a medium or large gameplay idea, provide a short cost
checkpoint with a rough token range, estimated implementation effort, and the
main sources of uncertainty. Also offer a smaller playable version and a staged
path when either would materially reduce cost. Treat token estimates as ranges,
not guarantees.

When responding to a proposed implementation prompt, recommend the most
appropriate Codex model up front: Luna for clear, isolated, repeatable work;
Terra for normal multi-file implementation; Sol for high-risk architecture,
procedural/progression safety, or complex integration. State when a task is
safe to delegate to Luna and when it needs Terra or Sol.

Explicitly flag ideas that could compromise procedural or progression safety,
make a generated level impossible to finish, create destructive inventory
states, or force costly architectural rework later. Explain the risk in plain
language and recommend the least expensive safe design. Unless the user has
already asked to proceed despite the estimate, confirm the preferred scope
before beginning a substantial implementation.

# Source control

Before editing, confirm the intended worktree and branch, then refresh the remote
base explicitly:

```sh
git fetch origin
node scripts/repository-safety-preflight.mjs --expect-branch codex/your-task-branch --base origin/master
```

Replace the example task branch with the branch you intend to edit. Treat the
preflight as advisory: read every warning and resolve unexpected branch,
dirty-worktree, or divergence results before continuing. It performs no fetches or
repository changes and intentionally exits successfully when it reports warnings.
Never switch, reset, clean, delete, or commit another worktree while completing a
task. Preserve rescue branches and unrelated WIP unless the user explicitly puts
them in scope.

When committing code, include a list of all prompts between now and the last commit, e.g.:

```

Commit title

- changed feature 1
- changed feature 2

Prompts:

> Prompt 1
> Prompt 2

```
