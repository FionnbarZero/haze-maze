# Story & Collaboration Framework (Live Notes)

Last updated: 2026-08-19

This document captures our current design direction so future sessions can continue without re-deriving decisions.

## Persistent design choice

- Multiplayer direction: **BG3-style shared campaign** rather than DAI-style sidecar multiplayer.
- Meaning: players can join the **same story run** and operate on shared world state.
- Not supported (for now): fully separate co-op mode with isolated story progression.

## Collaboration-first character model

- Players can act alone and contribute meaningfully.
- Full power comes from collaboration:
  - **Solo lane:** personal tasks and baseline combat utility.
  - **Pair lane:** stronger options, stronger narrative and mechanical progress.
  - **Team lane:** major gates that reward coordinated multi-role play.
- No one is unusable when solo, but solo progress is intentionally less optimal.
- Limited collaboration = slower or partial progress (not hard lockout unless explicitly designed as a hard gate).

## Core progression idea

- Roles (ex: Fire Witch, etc.) can have key capabilities:
  - Some quests may be role-specific (ex: retrieving a fire-attributed artifact).
  - Story can still require team sync later (ritual/stabilization/boss phase) so role identity still matters.
- Character growth should keep late joiners useful:
  - New entrants get useful baseline utility immediately.
  - They scale toward full team usefulness over short integration steps.
  - Avoid “new character is dramatically below everyone else” starts.

## Information architecture

- Shared data across party (by default): map, active quest journal, discovered clues, recipes.
- Private channels: romances / intimacy / certain secret investigations should remain personal.
- Team decisions can be shared, voted on, or negotiated; some scenes remain opt-in private.

## Narrative expectations

- Mystery-first, twist-heavy game: unknown villain, clues discovered gradually.
- The world should reward exploration and investigation, not only combat throughput.
- Story should be robust enough for multi-player reasoning:
  - players see the same public state,
  - but can hold different interpretations/private context.

## Open questions to continue iterating

- How many core roles should exist in the baseline party?
- Which systems are hard team requirements vs soft-team benefits?
- What is the risk model when collaboration fails (narrative consequence, resource consequence, difficulty spike, or all three)?
- How should romance/private information interact with cooperative mission-critical choices?
- Which class/role combinations create the first “aha” team synergies players remember?

## Working baseline for future sessions

Use this as default context unless explicitly changed:
1. Keep multiplayer as one shared story context.
2. Keep characters meaningful alone, stronger together.
3. Keep progress gating designed around collaboration, but tolerantly avoid dead-end locks.
4. Keep romances/private beats optional and isolated from core objective clarity.
5. Expand gradually from a strong vertical slice and codify consequences as patterns repeat.
