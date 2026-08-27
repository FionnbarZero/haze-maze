# Plan A — Moonhollow greybox progression

## Status and purpose

Plan A is the next substantial Moonhollow gameplay upgrade. It turns the expanded room-based maze into a safe, repeatable progression loop: mine geodes for rune fragments, complete permanent runes to open sections, craft optional attack crystals, reach a dedicated Boss Dragon room, and leave through the Moon Door.

This document is a planning and implementation guide. It does not authorize code changes by itself. Each stage should receive its own cost and safety checkpoint before implementation.

## Design goal

Randomness may change where optional rewards and encounters appear, but it must never decide whether a level can be completed. A player must always be able to obtain the progression items required for the next door and the boss room.

## Implementation priority

Prove one complete safe loop before multiplying content:

```text
find the shared mining tools → three fragments → one completed rune
  → one rune door → one Boss Dragon → Moon Door exit
```

Only after that loop is safe and fun should Plan A expand to four runes and then add crafting, Water Sprites, Greater Crystals, and more elaborate balance. This ordering is the least expensive way to discover whether the core progression is enjoyable before building every variation.

## Recommended greybox decisions

- Use four section runes: Rune A, Rune B, Rune C, and Rune D.
- Each completed rune is made from exactly three matching fragments.
- All four section runes are permanent for the current run; doors check for them but never consume them.
- Create exactly one pick and one hammer for the whole party. They begin as guaranteed found objects in the reachable starting area before every required geode.
- A tool has exactly one current owner or one world location. Multiplayer replication must synchronize that ownership state without creating additional copies.
- Mining requires one Witch to carry both the pick and hammer. Witches can give or trade either tool or both tools to another Witch.
- Use one crafting altar in the antechamber before the Boss Door.
- Keep ten dangerous dragons total: nine patrol deterministically varied routes through the maze, while the central dragon remains stationary. Only the nearest eligible dragon attacks at one time.
- Use a 25% Water Sprite trigger chance and a 45-second cooldown per fountain as initial configurable values.
- Record crystal slot use, but postpone a hard inventory-slot limit until playtesting proves it adds value.
- Build Raw and Refined Crystals first. Make the Greater Crystal recipe visible, but defer its full gameplay tier until the final Plan A stage and never require it for finishing the level.
- Four completed runes require 12 mandatory fragment geodes. Treat that as the full adventure target, not the first playable milestone, and use playtesting to keep mining from overwhelming exploration and combat.
- Treat a stolen gold result as one theft roll that removes a small configurable gold bundle rather than a single coin.
- Keep all balance values in configuration rather than scattering numbers through gameplay code.

## Non-negotiable progression safety rules

1. A required fragment can only occupy a prevalidated, reachable geode socket before the door its completed rune opens.
2. Each required rune has exactly three obtainable fragments before its own door.
3. Mandatory items are not eligible for crafting, discarding, or inventory-cap rejection. Rune fragments and completed runes are never eligible for theft.
4. A generated plan must be validated before the player can enter it. Invalid plans are regenerated or corrected.
5. The Boss Door cannot open until all four completed section runes exist.
6. The Boss Dragon cannot become reachable before the Boss Door opens.
7. Random geode contents may supply optional crystals, but never replace or remove mandatory fragment contents.
8. The pick and hammer are unique shared progression tools. Ownership changes move the existing item atomically; they never copy it.
9. If a Water Sprite steals the pick or hammer, the same unique item is immediately relocated to a hidden, approved world socket in the party's currently reachable area. It cannot appear behind a locked door, inside the boss room, inside a wall, inside a geode, or anywhere that requires the missing tool to reach.
10. If no valid recovery socket exists, the Sprite cannot select that tool for theft.
11. If the owning Witch disconnects, leaves the session, or becomes unable to carry inventory, each unique tool returns to a reachable safe socket rather than disappearing with that player.

## Player progression

```text
Start
  → find the party's one pick and one hammer
  → give/trade both tools to the Witch who will mine
  → collect three Rune A fragments from safe geodes
  → complete Rune A and open Door A
  → repeat for Runes B, C, and D
  → optional crafting altar before the boss
  → Boss Door checks A + B + C + D
  → defeat Boss Dragon in dedicated room
  → Moon Door exit; Witch disappears and the run completes
```

## Shared rules

### Runes and doors

- Fragment state belongs in progression state, separate from ordinary loot inventory.
- Completing the third matching fragment automatically creates the completed rune.
- Each section door requires one named completed rune and displays its symbol.
- A partially completed rune shows fragment progress where practical, for example `2 / 3`.
- A completed rune lights its symbol on its matching door.
- The Boss Door displays all four rune symbols and lights each as it is completed.

### Geodes and mining

- Unopened geodes share one appearance so their contents stay surprising.
- A geode contains either a guaranteed rune fragment or an optional damage crystal.
- A geode selects and stores a mining requirement of 5–15 strikes when created or first mined.
- The party has exactly one pick and one hammer. They are found once and are not replicated for each Witch.
- The Witch doing the mining must currently own both tools.
- Staff/Wand equipped: normal magic can be cast, geodes cannot be mined.
- Mining Tools equipped: geodes can be struck, normal magic cannot be cast.
- Mining progress and visible geode damage update after each strike; breaking a geode reveals its stored content.

### Shared tools and multiplayer trading

- The pick and hammer each have a stable unique item ID and one authoritative state: in the world, owned by one Witch, offered in a trade, or being relocated by a Sprite.
- Witches may give or trade eligible owned objects, including the pick, hammer, berries, potions, crystals, and configurable amounts of money.
- Rune fragments and completed runes belong to protected party progression. They are not ordinary inventory objects and cannot be given, traded, stolen, discarded, or duplicated.
- Picking up, giving, trading, dropping, stealing, and recovering a tool transfer that one item atomically. No client may create a second copy.
- A direct gift requires the receiving Witch to accept it. A two-way trade completes only when both players confirm the final exchange.
- The shared ownership rules should also drive solo play so single-player and multiplayer do not maintain incompatible inventories.
- If the pick and hammer are owned by different Witches, neither can mine until the party transfers both to the same Witch.
- The multiplayer session authority must resolve simultaneous pickup or trade attempts. Only the accepted transfer changes ownership.
- If an owner leaves or disconnects, the tool becomes a world pickup at a reachable safe socket for the remaining party.
- UI should show who currently carries the pick and hammer, but a Sprite-hidden tool should not reveal its recovery location.

### Damage crystals and crafting

Crystal bonuses are personal to the Witch carrying them and must not permanently alter base damage.

```text
crystalMultiplier = 1 + sum(carriedCrystalBonuses)

effectiveAttackDamage = baseAttackDamage
  × crystalMultiplier
  × otherModifiers
```

- Raw Crystal: 1 slot, +10% damage.
- Refined Crystal: crafted from 3 Raw Crystals, 1 slot, +35% damage.
- Greater Crystal: crafted from 3 Refined Crystals, 1 slot, +120% damage.
- Carried crystal bonuses stack additively: three Raw Crystals provide +30%, while one Refined Crystal provides +35%.
- Crafting is deliberate at the altar. It consumes ingredients and creates the next crystal.
- Crystal slot counts are tracked for future balancing, but the initial Plan A implementation does not enforce a hard inventory-cap failure.
- Current crystal bonus, owned crystals, recipes, requirements, and result must be visible in the pouch/altar UI.
- If a crystal is removed from inventory, its bonus disappears immediately.

### Water Sprites and fountains

- Approaching a fountain may trigger a Water Sprite, subject to configurable chance and per-fountain cooldown.
- A triggered Sprite steals 1–3 eligible items actually owned by that Witch: money, berries, potions, Raw Crystals, Refined Crystals, Greater Crystals, the pick, or the hammer.
- If gold is selected, one theft roll removes a small configurable gold bundle rather than one coin.
- A Sprite never steals fragments, completed runes, keys, or other mandatory progression objects. The unique pick and hammer are the deliberate exception because their theft relocates rather than destroys them.
- A stolen pick or hammer immediately reappears as the same unique world item at a randomly chosen safe recovery socket in the currently reachable area. The party is told which tool was stolen but not where it reappeared.
- A tool is ineligible for theft when no validated recovery socket is available.
- A theft immediately recalculates crystal damage and shows a clear notification.

### Central dragon damage and Witch rules

All dragons must call one shared damage path; dragon color must never create accidental immunity.

```text
finalDamage = dragonBaseDamage
  × dragonTypeModifier
  × witchVulnerabilityModifier
  × otherCombatModifiers
```

Initial Witch vulnerability multipliers:

- Frost Witch: `1.0`
- Purple Witch: `1.2`
- Fire Witch: `1.4`
- Green Witch: `0.8`

The Boss Dragon uses `bossDamageMultiplier = 1.5` before the Witch vulnerability multiplier. Green Witch regenerates 5 health every 10 seconds while alive, never above maximum health. Regeneration is independent of the shared dragon-damage path.

## Prompt 0 — Architecture and safety audit

**Recommended model: Sol**

> Inspect the existing Moonhollow maze, inventory, combat, dragon, Witch, door, multiplayer-replica, and test architecture. Do not change code. Propose the smallest reusable architecture for Plan A: a seeded level plan and validator, progression state for named rune fragments and completed runes, authoritative ownership and transfer rules for unique shared tools, and shared combat rules. Identify the exact existing modules to reuse or refactor. Explain any procedural-safety risk in plain language, including tool duplication, disconnection, and unreachable Sprite relocation. Estimate token and implementation effort, offer a smaller playable version, and wait for approval before coding.

## Prompt 1 — One complete safe vertical slice

**Recommended model: Sol**

> Implement one complete Plan A vertical slice only. Reuse/refactor existing systems rather than duplicate logic. Add a seeded level-plan model with prevalidated placement sockets, a validator, and unit tests designed to support later sections. Instantiate one named rune with exactly three guaranteed fragment geodes, automatic permanent rune completion, one unique pick and one unique hammer in guaranteed reachable starting-area sockets, a consistent 5–15 strike requirement per geode, one rune-locked Boss Door, one confined Boss Dragon, and the Moon Door completion exit. The same Witch must own both tools to mine, and tool pickup must move one authoritative item without duplication. The door must not consume the rune. Do not add crystal crafting, Water Sprites, Greater Crystals, multiple section runes, or new vulnerability balance yet. Preserve unrelated gameplay, prove the full tools → fragments → rune → door → boss loop, and report changed files, validation rules, assumptions, token usage, and remaining safety risks.

## Prompt 2 — Scale the safe loop to four sections

**Recommended model: Sol**

> After the one-rune vertical slice has been playtested and approved, scale the validated model to four named section runes, 12 guaranteed fragment geodes, four rune-locked section doors, and a final Boss Door requiring all four completed runes. Show the required rune symbol and progress on each section door; show all four required symbols on the Boss Door. Doors must not consume completed runes. Keep ten dragons total: nine passive dragons randomly distributed through the maze and one aggressive Boss Dragon confined to its room. Add large seeded validation coverage and browser coverage for the complete safe route. Preserve unrelated gameplay.

## Prompt 3 — Unique shared tools and multiplayer trading

**Recommended model: Sol**

> Implement the Plan A shared-item ownership and multiplayer transfer foundation. The party has exactly one pick and one hammer, each with a stable unique item ID and one authoritative state. Add accepted gifts and mutually confirmed trades for eligible objects such as tools, berries, potions, crystals, and configurable money amounts without duplicating, losing, or partially applying items. Keep rune fragments and completed runes in protected party progression, outside the trade system. Mining requires one Witch to own both tools. Resolve simultaneous pickup and trade attempts through the multiplayer session authority. If an owner disconnects or leaves, relocate the tools to validated reachable sockets for remaining players. Use the same ownership rules in solo play. Add unit tests for pickup races, gifts, trades, rejected progression trades, split-tool ownership, disconnect recovery, reset behavior, and duplicate prevention. Do not add Water Sprite tool theft yet.

## Prompt 4 — Raw and Refined crystals and crafting

**Recommended model: Terra**

> Add optional Raw and Refined Damage Crystals and deliberate altar crafting using the shared level-plan and inventory systems. Keep required fragment geodes guaranteed and separate from optional crystal randomness. Crystal bonuses are personal, additive, and derived from current inventory: three Raw Crystals provide +30%, while one Refined Crystal crafted from them provides +35%. Crafting consumes ingredients, slot use is recorded without enforcing a hard capacity limit, and losing a crystal immediately recalculates damage. Do not implement Greater Crystal gameplay or Water Sprites yet. Mandatory rune fragments remain outside ordinary loot, crafting, discard, and capacity flows. Add focused tests and restrained pouch/altar feedback.

## Prompt 5 — Shared combat rules

**Recommended model: Sol**

> Refactor all dragon attacks through one central damage calculation. Apply configurable dragon-type, boss, and Witch-vulnerability modifiers so every dragon can damage every Witch, including Fire Witch. Add Boss Dragon 1.5× base damage and Green Witch regeneration of 5 health every 10 seconds while alive. Keep this work independent from Water Sprites. Add unit and browser tests proving no accidental immunity, correct vulnerabilities, Boss damage, and capped regeneration.

## Prompt 6 — Core UI, full validation, and regression pass

**Recommended model: Terra**

> Complete the core Plan A UI and validation without redesigning the existing visual style. Add clear but restrained feedback for fragment counts, completed runes, door symbols and reasons for locking, mining progress, equipped Wand/Staff versus Mining Tools, which Witch carries the pick and hammer, crystal bonuses, and Raw/Refined altar recipes. Run a large seeded validation sweep and the full relevant browser regression suite. Confirm that every generated Plan A level is completable, then summarize changed files, safety guarantees, failures found and corrected, and remaining greybox limitations. Do not add Water Sprites or Greater Crystal gameplay yet. Do not commit, push, or publish unless explicitly asked.

## Prompt 7 — Water Sprites and Greater Crystals

**Recommended model: Sol**

> Only after the core rune-door-boss loop, unique shared-item ownership, trading, mining, Raw/Refined crafting, shared damage, and UI have passed playtesting, add Plan A's final optional systems. Implement Greater Crystals crafted from three Refined Crystals for +120% personal damage. Add Water Sprite fountain encounters with configurable trigger chance and per-fountain cooldown. A Sprite steals 1–3 eligible items actually owned by that Witch; a gold result removes one small configurable gold bundle. Sprites never steal fragments, completed runes, keys, or other mandatory progression objects. The unique pick and hammer are the exception: stealing one atomically removes it from its owner and immediately relocates that same item to a random validated recovery socket in the currently reachable area. The party is notified which tool vanished but receives no location marker. If no safe socket exists, that tool cannot be stolen. Theft immediately recalculates crystal damage and reports exactly what was lost. Add focused tests for duplicate prevention, safe reachability, disconnect races, recovery, balance, and rendered multiplayer behavior.

## Lowest-cost playable version

The required first milestone is one safe vertical slice: one named rune, three guaranteed fragment geodes, one unique pick, one unique hammer, one rune door, and one Boss Room. Put both tools in validated reachable starting-area sockets. A Raw Crystal may be included only if it does not distract from proving the route. Do not add multiplayer trading, crafting tiers, Water Sprites, Greater Crystals, or four-section procedural generation until that loop is fun and proven safe.

## Full Plan A acceptance tests

1. A section door remains locked without its named completed rune.
2. Three matching fragments complete the correct rune; opening the door does not consume it.
3. Every required fragment is accessible before its matching door for every accepted seed.
4. Boss Door requires all four completed runes; Boss Dragon is unreachable before it opens.
5. Exactly one pick and one hammer exist; pickups, gifts, trades, resets, and multiplayer synchronization never duplicate either tool.
6. One Witch must own both tools to mine; split ownership prevents mining until the tools are transferred together.
7. Eligible objects can be gifted or traded atomically; rune fragments and completed runes cannot enter the trade system.
8. Geodes require 5–15 stored hits; tool mode correctly prevents mining or casting as appropriate.
9. Crystal bonuses, crafting ingredients, resulting crystals, and loss of crystals calculate correctly per Witch.
10. Water Sprites sometimes trigger, respect cooldowns, never steal rune progression, and safely relocate a stolen pick or hammer without duplication.
11. A Sprite-hidden tool always remains reachable before the party's current locked door, and no theft occurs when no safe recovery socket exists.
12. A tool carried by a disconnected or departed Witch safely returns to the reachable world.
13. Every dragon damages every Witch through the shared rules; vulnerabilities, Boss multiplier, and Green regeneration calculate correctly.
14. A completed run reaches the Boss Room, defeats the Boss Dragon, activates the Moon Door, and ends with the Witch disappearing.
15. Seeded validation rejects any layout that violates the progression-safety rules.
