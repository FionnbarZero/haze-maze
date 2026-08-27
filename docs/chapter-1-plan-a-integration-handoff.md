# Chapter 1 + Plan A integration handoff

- Saved: 2026-08-20
- Status: Read-only integration review paused; no gameplay code changed
- Resume model: **Sol**
- Final audit prompt: [Chapter 1 + Plan A architecture audit prompt](chapter-1-plan-a-audit-prompt.md)

## Three prompts being preserved

> okay, let's beging building Chapter 1, within the contect of Plan A. What do you propose as the first prompt? Please save these 2 chapter narratives in the game fundamentals doc.

> can you give me only the prompt you want me to use, but refine it and clarify it further?

> Thank you. Now consider this code along with The current game structure in the greybox prototype. What problems do you see with integrations?

## Working scope to resume

Chapter 1 uses a small story-driven expression of Plan A:

- one named route-rune;
- three guaranteed fragment geodes before one Sunken Gate;
- Mining Tools from the start;
- optional Raw Damage Crystals;
- a Rootbound Crossing containment lesson;
- Briarheart plus two finite Briarling waves;
- West Sentinel Tower moon-seal restoration;
- and a Moon Door exit.

The full four-rune chain, advanced crafting, Water Sprite theft, final art, and multiplayer networking are deferred.

## Integration findings already identified

These are preliminary findings from the current greybox inspection and should be verified and prioritized when the review resumes:

1. The maze seed currently randomizes room-wall openings and dragon positions, but collectible definitions are fixed in `third-person/config.js`. There is no generated level plan tying walls, gates, required items, and reachability together.
2. Existing tests verify that objects stay inside the floor and appear on both sides of a Z boundary; they do not prove that every required pickup is reachable for every generated seed.
3. The current progression source is a total integer rune count. Four loose runes automatically open two count-based doors at totals of two and four. There are no named fragments, automatic three-fragment completion, or non-loot progression state.
4. Current runes are visible proximity pickups independent of geodes. Converting them into geode contents requires a real content/reveal state rather than moving the old pickup objects unchanged.
5. Mining currently happens automatically when Purple approaches a geode after owning two separately equipped tools. A rock breaks in one action and permanently increases Purple lightning damage. This conflicts with Mining Tools from the start, deliberate 5–15 strike mining, surprise contents, all-Witch access, and personal inventory-based crystals.
6. Equipment display and held-item behavior are bound specifically to Purple Witch. Other Witches bypass the staff-equipment casting check and cannot use the current mining pickup flow. Chapter 1 requires one actor-owned tool-mode rule that works for every selected Witch.
7. The Moon Door currently opens from rune count alone and immediately completes the route. Chapter 1 requires guardian completion, West Tower access, moon-seal restoration, and only then Moon Door activation.
8. The current hostile actor is dragon-specific throughout naming, metadata, combat messages, targeting, and tests. It supports multiple target actors, damage, freeze, restraint, attack, patrol, and reset, which can be reused, but there is no generic encounter controller, spawn-wave ownership, stagger/contain state, boss shield, or vulnerability window.
9. Green Witch abilities and the shared combat object hold direct dragon collections and dragon-specific target state. Briarlings and Briarheart need a generic combat-target interface or compatibility adapter to avoid copying combat logic.
10. Chapter defeat now returns the Witch to the Moon Gate after a short delay while preserving mining, clues, protected progression, permanent rewards, identity, and unrelated actor state. A later encounter stage still needs a Sunken Gate checkpoint and encounter-local reset policy for Briarheart and the tower route.
11. The opening briefing currently says creatures crossed the Rift and orders the witches to destroy them. Chapter 1 intentionally overturns that assumption, but it does not yet mention the missing Keeper, West Tower, or rescue objective. Its wording must become deliberate setup rather than accidental contradiction.
12. The current route HUD, pouch UI, smoke tests, and maze-layout unit tests encode four runes, two doors, ten dragons, and the direct Moon Door exit. They will fail during migration unless replaced in deliberate stages or temporarily supported by an adapter.
13. Four Witches are currently selectable, while the Chapter 1 story is written around Purple and Green. This does not block architecture work, but narrative acceptance must decide whether Frost and Fire remain playable with generalized Chapter 1 interactions or are temporarily excluded from the story slice.
14. Simulated-party presentation exists, but real shared multiplayer state does not. Chapter 1 systems should be actor-aware and party-aware without adding networking during this slice.
15. No Rootbound Crossing, Sunken Court encounter boundary, West Sentinel Tower, fixed moon-seal, Keeper clues, or chapter-completion state machine exists yet.

## Safest resume point

Continue the read-only integration review. Rank the findings by severity and dependency, identify reusable code precisely, and recommend the least expensive migration sequence. Do not implement until the audit produces and the user approves the first coding-stage prompt.

## Local document state

`docs/game-fundamentals.md` contains the newly saved 45-minute Chapter 1 and Chapter 2 narratives and their Plan A expressions. At the time of this handoff, documentation changes are local and should be checked with `git status` before committing.
