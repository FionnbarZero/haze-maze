# Moonhollow Quest — Game Fundamentals

- Status: Draft for discussion
- Genre: Third-person fantasy action-adventure RPG
- Primary platform: Windows and Mac desktop browsers
- Secondary platform: Landscape mobile browsers (development paused; existing prototype preserved)
- Perspective: Third-person over the Moon Witch's shoulder

## Platform direction

Moonhollow Quest is now designed and developed for desktop computers first. Keyboard and mouse are the primary control scheme, desktop hardware establishes the visual and performance ceiling, and future gamepad support should be considered in the input architecture. The complete narrative, exploration, puzzle, economy, progression, and combat experience should be proven on Windows and Mac desktop browsers before platform expansion.

The existing landscape-mobile build remains a useful compatibility prototype and body of test evidence. Its touch controls, responsive code, safe-area handling, instrumentation, and qualification records must be preserved, but new mobile-specific features and optimization are paused. Shared systems should remain portable when that does not compromise the desktop experience; phone screen size, touch ergonomics, and mobile rendering limits no longer constrain desktop gameplay or visual design.

## High concept

In *Moonhollow Quest*, the player becomes the Moon Witch, a staff-wielding adventurer exploring enchanted mazes that connect story locations, puzzle chambers, resource pockets, shops, and dragon lairs. Progress comes from understanding each maze, helping or confronting its inhabitants, gathering valuable materials, improving magical abilities, and completing objectives that open the way forward.

The game should combine the immediacy of an action game with the discovery, character encounters, economy, and long-term growth of a narrative RPG. Combat is important, but exploration and problem-solving should be equally meaningful ways to make progress.

## Player fantasy

The player should feel like a capable but still-developing Witch who:

- physically inhabits a mysterious magical world;
- learns the history and secrets of each maze;
- uses a staff and a growing command of magic to overcome danger;
- solves magical and environmental problems rather than fighting everything;
- discovers valuables, mines crystals, trades intelligently, and prepares for future challenges;
- forms relationships with recurring characters through story encounters;
- becomes visibly and mechanically more powerful over the course of the adventure.

## Design pillars

### Magical exploration

Every maze is a place to understand, not simply a corridor to escape. Landmarks, changing materials, magical effects, sound, lighting, rooms, and the map should help the player form a mental picture of the space. Optional paths reward curiosity without making the required route needlessly confusing.

### Purposeful obstacles

Locked passages communicate what kind of solution they require. A passage may open after a puzzle, a recovered quest item, a character interaction, a learned spell, or a completed encounter. Progress should feel earned through observation and mastery rather than arbitrary key hunting.

### Expressive spellcasting

The Witch's staff is the center of interaction and combat. Spells must be responsive, readable, useful outside combat where appropriate, and visibly originate from the staff orb. The crosshair is a dependable promise about the intended target, while walls and solid obstacles continue to block spells.

### Narrative discovery

Story is delivered through exploration, environmental details, found objects, conversations, and cinematic sequences. Important rooms can transition into animated encounters between the Moon Witch and other characters. These scenes should reveal character, change objectives, or create consequences rather than interrupt play without purpose.

### Meaningful progression

Health, inventory, gold, crystals, experience, spell knowledge, and story progress form one understandable growth system. Rewards should give the player new choices or make previously difficult situations more manageable without eliminating the need for skill.

## Core game loop

The repeating player loop is:

1. Enter a maze region with a clear story objective.
2. Explore corridors and rooms while building a mental and visible map.
3. Gather berries, gold, saleable discoveries, and mineable crystals.
4. Meet characters, find clues, and accept or advance tasks.
5. Solve puzzles or use the appropriate spell to open blocked routes.
6. Prepare for and survive a dragon encounter or another major challenge.
7. Collect the reward, gain experience, and unlock the next route.
8. Visit a store or sanctuary to buy, sell, prepare, and review the next objective.
9. Reach the level exit, save progress, and continue the story.

Not every loop must contain every activity. Variety should come from changing the order, emphasis, and consequences while keeping the underlying rules consistent.

## Maze and room structure

Each level is an authored network of corridors, landmarks, shortcuts, gates, and rooms. Procedural tools may assist layout creation, but objectives, story moments, puzzles, combat spaces, and navigational landmarks should be intentionally placed.

Room types include:

- **Objective rooms:** The player must locate an item, clue, character, or mechanism needed to continue.
- **Puzzle rooms:** Observation, movement, object interaction, or a known spell reveals the solution.
- **Spell-gated rooms:** A specific learned spell changes the room or opens a route. The required magical language must be visually consistent throughout the game.
- **Character rooms:** Conversations or animated cinematic sequences advance the narrative and may alter objectives.
- **Dragon arenas:** Deliberately wider spaces that support readable movement, camera behavior, defensive play, and multiple spell strategies.
- **Resource rooms:** Optional spaces containing gold, berries, mineable crystals, or saleable discoveries, usually protected by navigation risk or a small challenge.
- **Store or sanctuary rooms:** Safe spaces for trading, preparation, story reflection, and checkpointing.
- **Secret rooms:** Optional discoveries that reward careful exploration without blocking the main story.

The map records explored paths, the Witch's current position, known stores, and discovered objective locations. It should not reveal undiscovered secrets or puzzle solutions.

## Objectives, quests, and cinematic sequences

Every required task needs a visible objective, a clear completion condition, and feedback when the world changes. The active objective should be available in a compact HUD form, with fuller details in a journal or map overlay.

A typical room objective might be:

1. Meet a character who explains a problem.
2. Search a connected maze branch for a named item.
3. Overcome a puzzle, spell gate, or dragon guarding it.
4. Return the item or use it at a specific location.
5. Resolve a cinematic interaction and open the next route.

Cinematic sequences may be real-time in-engine scenes or authored video when necessary. They must pause danger and gameplay input, support subtitles, be skippable after beginning, and leave the player with an explicit updated objective. Important story information should remain reviewable in the journal.

The initial scope should favor a clear main story with optional character tasks. Deep branching narrative and permanently missable story paths should wait until the core quest and save systems have been proven.

## Staff-based spell system

The initial spell set establishes three distinct tactical roles:

- **Lightning:** Direct damage. It travels from the staff orb to the unobstructed crosshair target and can become more damaging through progression.
- **Frost:** Control. It temporarily freezes a dragon, changes the creature to a readable ice-blue state, and creates time to reposition, heal, or solve a combat interaction.
- **Protective globe:** Defense. It surrounds and follows the Witch, absorbing or reducing incoming danger for a limited period.

Spells use configurable cooldowns, duration, damage, protection, and upgrade values. They should interact with selected maze mechanisms where that use is clearly communicated. A combat upgrade must not silently change puzzle behavior and make an earlier puzzle impossible to understand.

Future spells should add a genuinely new combat or exploration decision rather than duplicate an existing spell with a different color.

## Dragon encounters

Dragons are major encounters and narrative creatures, not disposable corridor obstacles. Each encounter should have:

- a readable introduction and enough room for the third-person camera;
- telegraphed attacks and fair recovery windows;
- useful roles for offensive, control, and defensive spells;
- collision that prevents the Witch and dragon from overlapping;
- visible health and status feedback;
- reactions to damage, freezing, protection, and defeat;
- a clear effect on the maze, such as opening a gate or revealing an objective item;
- an experience and material reward appropriate to its importance.

The provisional progression rule remains 10 experience points for each defeated beast and a spell-power improvement at 100 points. This value is a balance starting point and should be tested against the intended length and number of encounters.

## Health and recovery

The Witch has persistent health during active exploration. Damage sources must be readable and avoid unavoidable combinations in narrow spaces.

Golden magical berries restore health. Collected berries enter the pouch unless used immediately through an explicit interaction. The player opens the pouch and selects a berry to consume it. Healing should never trigger accidentally while navigating or casting.

If health reaches zero, the Witch returns to the most recent safe checkpoint. Completed story objectives, unique quest items, and permanent upgrades remain saved; the current encounter resets. Any additional death penalty should remain light until playtesting proves that one is needed.

## Resources and economy

The game uses several resources with separate purposes:

| Resource | Primary sources | Primary use |
| --- | --- | --- |
| Health | Golden berries, selected magical items | Surviving exploration and combat |
| Gold | Maze pickups, tasks, selling items and crystals | Buying goods and services |
| Crystals | Mineable nodes, discoveries, encounter rewards | Valuable sale goods; possible later magical uses |
| Found items | Exploration, secrets, tasks, defeated threats | Quest completion, collection, or sale when not protected |
| Experience | Dragon encounters, major objectives, selected discoveries | Permanent character and spell progression |

Quest items are clearly marked and cannot be sold while required by an active or unresolved quest. The game must distinguish valuable sale goods from objects whose purpose has not yet been discovered.

Mining is a brief, readable interaction at a crystal node rather than passive background income. Nodes can require access, a tool, or an appropriate spell, but the first version should select one consistent rule. Valuable nodes may create a decision between taking a risky optional path now or returning better prepared later.

## Stores and trading

Stores are in-world locations operated by characters. They provide preparation and narrative context rather than functioning as an unexplained menu.

The player can:

- buy healing, utility items, map information, and selected magical goods;
- sell eligible discoveries and mined crystals;
- compare prices and item effects before confirming a transaction;
- see the current gold total and resulting balance clearly;
- repurchase an accidentally sold ordinary item during the same store visit when practical.

Store inventories may change with story progress, location, or completed character tasks. Essential main-story progress must never depend on an item the player could permanently sell or become unable to afford. “Store” means an in-game gold economy; real-money purchases are outside the current design.

## Inventory and pouch

The pouch is the primary inventory interface. It visually resembles an opened physical fantasy pouch while remaining fast and legible at normal desktop viewing distances.

Items are grouped by purpose: healing, power-ups, quest items, valuables, and tools. Selecting an item shows its name, effect, sale status, and available actions. Usable items require a deliberate selection; quest items and passive valuables cannot be consumed accidentally.

Inventory limits should not be added until they support a clear gameplay purpose. Early versions should avoid forcing players to discard story discoveries because of capacity.

## Progression

Progression operates on four connected tracks:

- **Story progression:** Completed objectives change characters, rooms, and available maze routes.
- **Spell progression:** New spell uses and stronger effects open combat and exploration options.
- **Character progression:** Experience improves survivability or magical capability at understandable milestones.
- **Economic progression:** Gold and valuable discoveries improve preparation, convenience, and choice.

Progression should open possibilities rather than merely increase every number. Earlier maze areas may contain optional gates the player can revisit after learning a suitable spell, but required backtracking should remain limited and clearly signposted.

## Narrative structure

Each level functions as a story chapter with:

- an arrival and immediate question;
- characters or environmental clues that establish the local conflict;
- a task that requires exploration and discovery;
- a revelation, decision, or confrontation;
- a dragon or equivalent climax where appropriate;
- a resolution that changes the world and points toward the next chapter.

The Moon Witch should have a defined personality and relationships rather than serving as a silent camera. Dialogue, animation, and player actions should consistently communicate her motives. The exact degree of dialogue choice, branching outcomes, companions, and moral consequence remains a separate narrative-design decision.

For the current collaboration-first direction, see [Story & Collaboration Framework](story-collaboration-framework.md).

## Controls and presentation

Desktop keyboard and mouse are the primary control standard:

- WASD provides camera-relative movement and the mouse provides precise camera and crosshair control;
- named actions cover sprint, jump, crouch, interaction, aiming, casting, spell selection, shoulder switching, map, pouch, and pause;
- pointer-lock entry, exit, focus loss, and recovery behave predictably;
- cinematics, stores, the pouch, map, dialogue, and pause release gameplay input safely;
- interfaces remain readable across common desktop resolutions and window sizes;
- new input systems remain action-based so future gamepad support does not require rewriting gameplay rules.

The preserved landscape-mobile interface continues to place spells on the left, movement on the right, and touch look in the center. It is not a current production acceptance target, and mobile ergonomics or performance must not reduce the completeness of the desktop game.

## Deferred mobile backlog

The following work remains deliberately deferred until mobile development is formally resumed:

- further touch-control tuning, including joystick dead zones, sensitivity, simultaneous touches, handedness, and thumb fatigue;
- phone-specific interface refinement, touch-target sizing, finger occlusion, portrait blocking, and safe-area or notch layout;
- qualification across supported iPhone and Android tiers, browsers, aspect ratios, orientation changes, interruptions, and context recovery;
- mobile render-quality tiers, dynamic resolution, download budgets, memory limits, thermal behavior, battery impact, and sustained performance;
- mobile accessibility, control remapping, aim assistance, and gameplay-parity review;
- production release criteria and a minimum supported mobile-device specification.

Existing mobile code, instrumentation, and test records must remain intact while this backlog is paused.

## Game state and saving

The game separates three kinds of state:

- **Permanent profile state:** Experience, learned spells, upgrades, gold, inventory, completed quests, major choices, and settings.
- **Level state:** Open gates, completed room objectives, collected unique items, defeated major encounters, discovered map areas, and used crystal nodes.
- **Temporary encounter state:** Current health, cooldowns, active protection, frozen enemies, and ordinary encounter positioning.

Progress saves after major objectives, store transactions, permanent rewards, and level completion. Checkpoints restore a coherent level state rather than saving the player inside a broken cinematic, active transaction, or partially reset encounter.

## First complete vertical slice

Before building ten levels or commissioning final assets, Level 1 should prove a short version of the entire game:

1. Enter through the Moon Arch and receive a story objective.
2. Explore a readable brick maze and reveal it on the map.
3. Meet a character in an objective room and begin a find-and-return task.
4. Collect a golden berry, gold, a saleable item, and one mineable crystal.
5. Use the pouch and complete one purchase and one sale at a store.
6. Solve one environmental puzzle and open one spell-gated passage.
7. Use lightning, frost, and the protective globe during a dragon encounter.
8. Defeat the dragon, receive experience, and recover the objective item.
9. Complete a short cinematic resolution and unlock the exit.
10. Finish the level, reload, and confirm that all permanent progress was saved correctly.

Proxy art is sufficient for this slice. It should be comfortable, stable, and completable on representative Windows and Mac desktop hardware before final Witch, dragon, cinematic, spell, store, or environment assets enter production. Mobile qualification does not currently gate desktop asset or feature development.

## Fundamental success criteria

The foundation is ready for broader content production when:

- a new player understands the immediate objective and can navigate without developer help;
- movement, camera control, interaction, and all three spells remain dependable with desktop keyboard and mouse;
- every required gate explains its condition and opens consistently;
- the complete quest, economy, combat, and level-completion loop survives saving and reloading;
- no quest item can be lost or sold in a way that blocks progress;
- dragon combat is readable at close and medium range and cannot be bypassed through collision or wall-targeting errors;
- the vertical slice meets the agreed desktop performance and stability targets;
- additional levels can be assembled from reusable room, quest, gate, item, store, encounter, and save-system definitions rather than copied custom code.

## Open design decisions

The following choices should be resolved through short design discussions and prototype tests:

- Is the story primarily linear, or can choices change later levels and endings?
- Are stores found inside every maze, only in sanctuary hubs, or both?
- Do crystals exist only to be sold, or do they later power upgrades and spell crafting?
- Does mining use the staff, a purchased tool, a learned spell, or a timing interaction?
- Which non-dragon characters can become allies, rivals, merchants, or quest givers?
- Can the player revisit completed mazes, and how much optional backtracking is desirable?
- Which spell interactions are universal enough for players to learn and predict across all levels?
- How long should one level, one play session, and the complete game be?
- What happens after the 100-point spell-power milestone, and how many progression tiers are needed?
- How much inventory management supports the fantasy before it becomes friction during desktop play?
