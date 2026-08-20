# Integrated Chapter 1 plan

- Status: Approved reference for discussion and staged implementation
- Scope: Chapter 1 greybox integrated with Plan A safe progression
- Target: Current third-person Babylon.js prototype
- Model: **Sol** for progression, encounter, and reset architecture; **Terra** for contained integration and presentation; **Luna** only for isolated work after the state contracts exist

This document is the shared reference for the smallest safe Chapter 1 gameplay
integration. It does not replace the broader Plan A or Chapter 1 narrative.

## Scope

Chapter 1 includes one named `route-rune-west`; exactly three guaranteed,
matching fragment geodes; Mining Tools from the beginning; optional Raw Damage
Crystal geodes; one Sunken Gate; a Rootbound Crossing lesson; Briarheart with
two finite Briarling waves; West Sentinel Tower moon-seal restoration; and one
Moon Door exit.

Deferred: the full four-rune chain, crafting, Water Sprites, inventory caps,
multiplayer networking, final art/cinematics/voice, and a full campaign hub.

## Critical route

```text
Coven briefing / temporary opening card
  -> character selection and Moon Gate
  -> Garden Maze
  -> mine three required route-rune fragments
  -> automatically complete route-rune-west
  -> open Sunken Gate without consuming the rune
  -> Rootbound Crossing containment lesson
  -> Sunken Court and Briarheart encounter
  -> West Sentinel Tower
  -> restore fixed moon-seal
  -> activate Moon Door
  -> Chapter 1 complete
```

Each required geode contains one fragment and one Keeper clue: her trail mark,
evidence of deliberate preparation, then a damaged authorized command pattern.

## Progression-safety rules

- A seeded level plan selects mandatory content only from prevalidated sockets
  in authored zones.
- Every accepted plan has exactly three reachable `route-rune-west` fragments
  before the Sunken Gate; none can appear behind it.
- The third fragment automatically makes a permanent named rune; the gate
  checks it and never consumes it.
- Fragments, completed runes, and Keeper clues are protected chapter
  progression, not ordinary inventory. They cannot be stolen, crafted,
  discarded, capped, or lost.
- Optional geodes use separate sockets and cannot replace required contents.
- Rootbound Crossing, Sunken Court, West Tower, and Moon Door unlock strictly
  in that order. Briarheart stays inside its arena.
- Death, encounter reset, and restart return required systems to a valid
  checkpointed state. Future co-op separation must not create a dead end.

## Current prototype integration

Reuse:

- `third-person/maze-layout.js` for deterministic layout generation.
- `third-person/expanded-world.js` for rendering, colliders, and door visuals.
- `third-person/dragon.js` for the current targetable actor shape.
- `third-person/combat.js` for casting, aiming, and spell effects.
- Existing desktop controls, Witch selection, ordinary loot, and simulated-party
  presentation.

Refactor:

- `third-person/inventory.js`: it currently owns loose-rune counts, tools,
  geode results, and Purple-only equipment; it should become UI/ordinary-loot
  presentation backed by structured chapter state.
- `third-person/expanded-world.js`: replace integer rune-count door checks with
  named progression flags for Chapter 1.
- `third-person/main.js`: add one reset/checkpoint coordinator for plan state,
  interactions, encounters, and rendering.

Existing dragon geometry may temporarily render Briarheart, but all new state,
UI, messages, and encounters use generic guardian terminology. Legacy loose
runes and count-based doors may remain behind a legacy route configuration only;
they are not a second source of truth in Chapter 1.

## Minimal state and modules

- `chapter-level-plan.js`: seeded plans, authored zones/sockets, pure
  reachability validation.
- `chapter-progression.js`: named fragments, completed runes, Keeper clues,
  gate/encounter/seal flags, checkpoints.
- `chapter-interactions.js`: deterministic 5–15 strike geodes, tool mode, and
  containment interaction resolution.
- `chapter-encounter.js`: `idle -> warning -> wave -> vulnerability -> exposed
  -> complete/reset`.

Tool ownership is actor-aware now: `{ id, ownerId | worldSocketId, mode }`.
For this slice, grant the unique pick and hammer to the local Witch at start;
defer trade UI. Mining requires both tool IDs plus `mode: "mining-tools"`.
Staff mode permits casting; mining mode blocks it.

The moon-seal state is:

```text
Distorted -> corruption removed -> rings aligned -> attuned -> Lit
```

## Test contract

- Run a deterministic 250-seed plan-validation sweep.
- Prove every accepted seed has exactly three reachable fragments before the
  Sunken Gate and optional contents cannot replace them.
- Prove the third fragment completes the named rune and opening the gate does
  not consume it.
- Prove tool modes block the wrong action.
- Prove Rootbound/Briarling reset correctness and Briarheart confinement.
- Prove Tower access requires encounter completion and Moon Door requires a Lit
  moon-seal.
- Browser-test Purple and Green completing a seeded route from start to exit.

## Staged implementation

| Stage | Scope | Model | Estimate | Playable result |
| --- | --- | --- | --- | --- |
| 1 | Seeded Chapter 1 plan, validator, progression, tests | Sol | 8k–14k tokens; 1–2 sessions | Safe planned route in debug/snapshots |
| 2 | Start tools, strike geodes, clues, rune, Sunken Gate | Sol | 12k–20k; 2–3 sessions | Mine three fragments and open the gate |
| 3 | Rootbound, Briarheart, finite Briarlings, checkpoints | Sol | 15k–26k; 2–4 sessions | Complete the guardian encounter |
| 4 | Tower, moon-seal, stabilized maze, Moon Door | Terra | 10k–18k; 1–2 sessions | Restore tower and finish chapter |
| 5 | Full-route smoke tests and fixes | Luna/Terra | 6k–12k; 1–2 sessions | Verified vertical slice |

Total estimate: 51k–90k tokens across 5–11 focused sessions. The main
uncertainty is safely generalizing dragon-specific combat and equipment.

## Agreed defaults

- Keep Purple, Green, Frost, and Fire selectable; make all required Chapter 1
  interactions role-neutral so every Witch can finish solo.
- Mining Tools begin owned by the local Witch; preserve actor ownership but
  defer trading and networking.
- Keep whole-route reset until the encounter stage, then add a Sunken Gate
  checkpoint.

## Next implementation prompt: Stage 1

> Implement only Chapter 1 Stage 1: the safe route foundation. Do not implement
> geode meshes, mining, gates, combat changes, Rootbound Crossing, Briarheart,
> Tower visuals, crafting, Water Sprites, networking, final art, or commits.
>
> In the third-person prototype, add a small seeded Chapter 1 level-plan module
> and pure validator that use authored progression zones and prevalidated
> placement sockets. The plan must define exactly three required Garden Maze
> geode placements before the Sunken Gate, each containing one
> `route-rune-west` fragment and one distinct Keeper clue; optional placements
> must be separate from mandatory content. Add a structured chapter-progression
> module for named fragments, automatic rune completion after exactly three
> matching fragments, protected completed runes, and explicit future-facing
> gate/encounter/seal flags. Do not make UI, inventory, or doors a second
> progression source.
>
> Add focused Node tests, including a deterministic 250-seed validation sweep
> proving every accepted plan has exactly three reachable required fragments
> before its gate and that optional placement cannot replace them. Preserve
> unrelated gameplay and all existing tests. Report assumptions, files changed,
> and test results. Do not commit, push, or publish.
