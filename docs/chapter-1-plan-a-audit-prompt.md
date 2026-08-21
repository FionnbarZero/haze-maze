# Chapter 1 + Plan A architecture audit prompt

- Recommended model: **Sol**
- Purpose: Read-only architecture and progression-safety audit before Chapter 1 implementation
- Status: Ready to run

## Copy-ready prompt

Perform a read-only architecture and progression-safety audit for the first playable Chapter 1 vertical slice of Moonhollow.

Do not modify any files. Do not implement code, install dependencies, commit, push, publish, or open a pull request.

Use the current third-person Babylon.js prototype as the target game. Ignore the legacy prototype except where existing code is explicitly shared. Preserve all current desktop gameplay that is outside this scope. Mobile development remains paused: preserve existing mobile code and tests, but do not plan new mobile work.

Keep the final report focused and under approximately 2,000 words. Reference exact file paths, functions, and existing systems. Do not repeat the story documents verbatim.

### Read first

Read and reconcile:

- `AGENTS.md`
- `docs/game-fundamentals.md`
- `docs/chapter-1-the-hollow-summons.md`
- `docs/plan-a-greybox-progression.md`
- `docs/story-collaboration-framework.md`
- the current third-person maze, world-generation, door, geode, inventory, equipment, Witch, combat, dragon, UI, checkpoint/reset, and test code

If the documents and existing code disagree, identify the disagreement. Treat the current Chapter 1 scope below as the desired destination, but recommend the least expensive safe migration from the existing prototype.

### Audit objective

Design the smallest maintainable architecture needed to build a playable Chapter 1 greybox inside Plan A's gameplay framework.

This is a vertical slice, not the full four-rune Plan A implementation.

Chapter 1 initially includes:

- one named route-rune;
- exactly three matching rune fragments;
- exactly three guaranteed required-fragment geodes;
- one rune-locked Sunken Gate;
- Mining Tools available from the start;
- optional Raw Damage Crystals;
- one Rootbound Crossing containment lesson;
- one Briarheart guardian encounter with finite Briarling waves;
- one West Sentinel Tower restoration;
- and one Moon Door chapter exit.

Defer these systems unless existing architecture requires a small foundation now:

- the full four-rune progression chain;
- Refined and Greater Crystal crafting;
- Water Sprite theft;
- a hard inventory-slot limit;
- final art, cinematics, voice acting, romance, and multiplayer networking.

The architecture should remain compatible with future collaborative play, but this first implementation does not add networking. Interactions should belong to an acting Witch or party state rather than assuming that only one permanent global player can exist.

### Required Chapter 1 progression

The intended critical route is:

Coven House briefing or temporary opening story card
→ character selection / Moon Gate
→ Garden Maze
→ mine three guaranteed route-rune fragments
→ automatically complete the named route-rune
→ open the Sunken Gate without consuming the rune
→ complete the Rootbound Crossing containment lesson
→ enter the Sunken Court
→ fight Briarheart and contain its finite Briarling waves
→ enter the West Sentinel Tower
→ restore its fixed moon-seal
→ activate the Moon Door
→ leave through the Moon Door and complete Chapter 1

If the Coven House does not exist in the current prototype, treat it as a temporary opening story card or deferred hub scene. Do not propose building a complete campaign hub during the first vertical slice.

### Lore boundaries

Keep these concepts separate in code, UI, and terminology:

- A route-rune is a portable magical attunement pattern used to open an old maze gate.
- A completed route-rune is permanent for the chapter and is not consumed when its gate opens.
- A moon-seal is the large fixed moonstone lens inside a Sentinel Tower.
- A route-rune is never a moon-seal fragment.
- Briarheart is a corrupted native guardian, not a dragon.
- Existing dragon geometry or behavior may temporarily represent Briarheart in the greybox, but new architecture must use generic guardian and encounter terminology.
- The Boss Dragon described by the broader Plan A document is not additional required Chapter 1 lore or an additional Chapter 1 boss.

### Required geodes and Keeper clues

Each of the three required geodes must contain one matching route-rune fragment and deliver one distinct Keeper clue:

1. The Keeper's personal trail mark, proving she entered this route.
2. Evidence that she stopped and prepared deliberately rather than fleeing in panic.
3. A damaged command pattern suggesting that the tower failure was caused by an authorized instruction rather than a random monster attack.

The audit should recommend the least expensive way to associate these authored clues with guaranteed fragment geodes without coupling all future geodes to story content.

Optional geodes may contain Raw Damage Crystals. Optional randomness must never replace, hide, or remove a required fragment.

### Progression-safety requirements

The Chapter 1 level must never become impossible to finish.

Determine how the implementation should guarantee that:

- all three required-fragment geodes are reachable before the Sunken Gate;
- no required fragment can appear behind the gate it unlocks;
- every accepted level contains exactly three obtainable matching fragments;
- the third fragment automatically completes the correct route-rune;
- opening the Sunken Gate does not consume the completed rune;
- required fragments and completed runes cannot be stolen, crafted, discarded, lost, or rejected by an inventory limit;
- optional random contents cannot replace required contents;
- the Rootbound Crossing, Sunken Court, and West Tower become reachable in the intended order;
- Briarheart cannot leave its encounter area;
- the West Tower cannot be completed before the guardian encounter is resolved;
- the Moon Door cannot activate before moon-seal restoration;
- death, restart, or encounter reset returns all required systems to a valid state;
- either playable Witch can complete the required solo route;
- and future co-op separation cannot create a permanent dead end.

Prefer selecting placements from prevalidated, reachable sockets inside authored progression regions. Do not recommend unrestricted object placement followed by attempted repair unless the existing architecture makes that unavoidable.

Explain procedural-safety risks in plain language.

### Rootbound Crossing

The Rootbound Crossing is a short mechanical lesson, not a second major battle.

Its purpose is to teach the containment interaction before Briarheart:

- weaken or restrain a corrupted growth;
- hold it in a valid state;
- channel a nearby containment circle;
- visibly secure or cleanse the target;
- and open the route forward.

The solo version performs these actions sequentially with generous timing. Future cooperative play may allow one Witch to restrain or protect while another channels.

Recommend how this lesson can reuse the same containment-state rules as the Briarling encounter.

### Briarheart encounter

The first greybox version should contain:

- one guardian actor;
- two finite Briarling waves;
- no more than three active Briarlings at once;
- readable spawn warnings;
- weaken, stagger, containment, and recovery states;
- active Briarlings that shield or slowly restore Briarheart;
- guardian vulnerability windows after every active Briarling is contained;
- a final exposed-corruption state;
- solo tuning through fewer simultaneous threats or longer recovery windows;
- complete death and encounter-reset behavior;
- and a clear completion event that unlocks access to the West Tower.

Recommend how to generalize the current dragon-specific combat assumptions into a reusable encounter controller without rewriting unrelated combat.

### West Sentinel Tower and moon-seal

The moon-seal should use a small, explicit state flow:

Distorted
→ corruption removed
→ physical rings aligned
→ magical attunement completed
→ Lit

When the seal becomes Lit:

- the West Tower visibly relights;
- its warning beam resumes;
- the local Rift closes or visibly stabilizes;
- the Garden Maze settles;
- the Moon Door activates;
- and the Chapter 1 completion route becomes available.

Co-op may eventually attune complementary channels simultaneously. The first solo implementation may complete them sequentially. Recommend a state design that supports both without implementing multiplayer now.

### Required audit report

Return the report using exactly these sections:

#### 1. Current architecture

- Identify the exact relevant files, functions, and responsibilities.
- Mark each important system as reuse, refactor, replace, or defer.
- Identify existing loose-rune counts, count-based doors, automatic mining, dragon-specific assumptions, duplicated state, or reset hazards.
- State which current gameplay must be preserved.

#### 2. Proposed Chapter 1 level plan

- Define the required zones and their progression order.
- Identify safe regions or placement sockets for the three required geodes.
- Separate required content from optional content.
- Show where each Keeper clue is earned.
- Explain how the Sunken Gate, Sunken Court, West Tower, and Moon Door remain ordered and inaccessible at the correct times.

#### 3. Minimal state and module design

Propose the smallest sources of truth and module responsibilities for:

- seeded level planning and validation;
- named rune fragments and completed runes;
- geode contents and stored mining progress;
- equipped Wand/Staff versus Mining Tools;
- Keeper clue completion;
- Rootbound Crossing containment;
- guardian and spawned-enemy encounter state;
- moon-seal restoration;
- chapter completion;
- and reset/checkpoint behavior.

Prefer configuration and pure validation functions where practical. Avoid duplicate progression state in UI, inventory, doors, and world objects.

#### 4. Reuse and migration plan

- Explain how to migrate from the current prototype to the vertical slice without breaking unrelated gameplay.
- Identify temporary compatibility adapters if they are less expensive than an immediate rewrite.
- Identify old systems that should remain temporarily but must not become the permanent source of truth.
- Keep guardian logic generic even if existing dragon assets remain as temporary visuals.

#### 5. Testing and procedural safety

List the minimum useful unit and browser tests, including:

- exactly three matching fragments complete the route-rune;
- all required fragments are reachable before the Sunken Gate;
- the gate remains locked without the completed rune;
- opening the gate does not consume the rune;
- optional randomness cannot eliminate required fragments;
- incorrect tool mode prevents mining or casting as appropriate;
- containment states and finite Briarling waves reset correctly;
- Briarheart remains confined;
- the West Tower remains gated until the encounter is complete;
- the Moon Door remains inactive until the moon-seal is Lit;
- both currently playable Witches can finish;
- and a complete seeded Chapter 1 route succeeds from start to exit.

Include a seeded validation sweep, but recommend a practical seed count for this greybox rather than an unnecessarily expensive exhaustive run.

#### 6. Staged implementation plan

Divide the work into small stages that are individually playable and testable.

For every stage provide:

- the exact scope;
- the recommended Codex model: Luna, Terra, or Sol;
- a rough task-token range;
- an engineering-effort range;
- the main uncertainty;
- the progression-safety risk;
- and the visible playable result.

The first stage should be the least expensive stage that creates a safe foundation. Do not combine the entire 45-minute chapter into one implementation task.

#### 7. Conflicts and decisions

List only decisions that genuinely require story or design approval before implementation.

For each one include:

- the conflicting options;
- the practical consequence;
- your recommendation;
- and whether coding can safely begin before the decision is finalized.

Do not manufacture questions when a safe, reversible default is available.

#### 8. Next implementation prompt

End with one copy-ready prompt for the first coding stage only.

That implementation prompt must:

- preserve unrelated gameplay;
- reuse or refactor existing systems instead of duplicating them;
- include focused automated tests;
- identify assumptions;
- report files changed;
- avoid final art and deferred systems;
- and not commit, push, or publish without explicit permission.

Do not implement anything during this audit. Do not silently expand the scope.
