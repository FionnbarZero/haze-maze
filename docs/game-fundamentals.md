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

In *Moonhollow Quest*, the player becomes the Moon Witch, a staff-wielding adventurer moving through the ruins and hidden corridors of Moon Hollow. Progress comes from understanding each maze, solving magical and environmental problems, uncovering layered lore, and completing objectives that open the way forward.

The game should combine the immediacy of an action game with the discovery, character encounters, economy, and long-term growth of a narrative RPG. Combat is important, but exploration and problem-solving should be equally meaningful ways to make progress.

The setting is built as a collaborative campaign arc rather than a sequence of isolated runs. The antagonist is currently unknown by design. Information should appear in stages through clues, testimonies, and partial truths so players feel long-term mystery and discovery pressure.

## Player fantasy

The player should feel like a capable but still-developing Witch who:

- physically inhabits a mysterious magical world;
- learns the history and secrets of each maze;
- uses a staff and a growing command of magic to overcome danger;
- solves magical and environmental problems rather than fighting everything;
- discovers valuables, mines crystals, trades intelligently, and prepares for future challenges;
- forms relationships with recurring characters through story encounters;
- becomes visibly and mechanically more powerful over the course of the adventure;
- can rely on coven-mate strengths for better outcomes, while still contributing in solo moments.

The player should understand that party synergy gives access to better options, but not all objectives should become completely impossible without another character present.

## Design pillars

### Magical exploration

Every maze is a place to understand, not simply a corridor to escape. Landmarks, changing materials, magical effects, sound, lighting, rooms, and the map should help the player form a mental picture of the space. Optional paths reward curiosity without making the required route needlessly confusing.

The level design should also support mystery reading: evidence that suggests more than one interpretation, environmental inconsistencies, and clues that reward revisiting earlier rooms after learning new lore.

### Purposeful obstacles

Locked passages communicate what kind of solution they require. A passage may open after a puzzle, a recovered quest item, a character interaction, a learned spell, or a completed encounter. Progress should feel earned through observation and mastery rather than arbitrary key hunting.

Some obstacles are intentionally keyed to role strengths (for example: heat-only relics, resonance-only locks, or movement-only bypasses) so the group may temporarily specialize rather than each witch being equal at everything.

### Expressive spellcasting

The Witch's staff is the center of interaction and combat. Spells must be responsive, readable, useful outside combat where appropriate, and visibly originate from the staff orb. The crosshair is a dependable promise about the intended target, while walls and solid obstacles continue to block spells.

### Narrative discovery

Story is delivered through exploration, environmental details, found objects, conversations, and cinematic sequences. Important rooms can transition into animated encounters between the Moon Witch and other characters. These scenes should reveal character, change objectives, or create consequences rather than interrupt play without purpose.

Story design should intentionally include:

- delayed reveals,
- ambiguous witness accounts,
- evidence that appears contradictory until later scenes,
- and at least one reveal-beat with meaningful emotional impact each chapter.

Romance and intimate character beats should be optional, with private beats represented as personal rather than loud public spectacle unless the chapter specifically justifies exposure.

### Meaningful progression

Health, inventory, gold, crystals, experience, spell knowledge, and story progress form one understandable growth system. Rewards should give the player new choices or make previously difficult situations more manageable without eliminating the need for skill.

Growth should feel incremental and reliable: new party members and mechanics increase options, but they should not invalidate previously mastered early gameplay.

## Core game loop

The repeating player loop is:

1. Enter a maze region with a clear story objective.
2. Explore corridors and rooms while building a mental and visible map.
3. Gather berries, gold, saleable discoveries, and mineable crystals.
4. Meet characters, find clues, and accept or advance tasks.
5. Solve puzzles or use the appropriate spell to open blocked routes.
6. Prepare for and survive a major encounter (dragon, guardian, beast, or other threat).
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
- **Guardian arenas:** Deliberately wider spaces that support readable movement, camera behavior, defensive play, and multiple spell strategies. The threat type can remain a placeholder (dragon, wyrm, construct, etc.) until narrative locking is complete.
- **Resource rooms:** Optional spaces containing gold, berries, mineable crystals, or saleable discoveries, usually protected by navigation risk or a small challenge.
- **Store or sanctuary rooms:** Safe spaces for trading, preparation, story reflection, and checkpointing.
- **Secret rooms:** Optional discoveries that reward careful exploration without blocking the main story.

The map records explored paths, the Witch's current position, known stores, and discovered objective locations. It should not reveal undiscovered secrets or puzzle solutions.

## Objectives, quests, and cinematic sequences

Every required task needs a visible objective, a clear completion condition, and feedback when the world changes. The active objective should be available in a compact HUD form, with fuller details in a journal or map overlay.

A typical room objective might be:

1. Meet a character who explains a problem.
2. Search a connected maze branch for a named item.
3. Overcome a puzzle, spell gate, or guardian that blocks it.
4. Return the item or use it at a specific location.
5. Resolve a cinematic interaction and open the next route.

Cinematic sequences may be real-time in-engine scenes or authored video when necessary. They must pause danger and gameplay input, support subtitles, be skippable after beginning, and leave the player with an explicit updated objective. Important story information should remain reviewable in the journal.

The initial scope should favor a clear main story with optional character tasks. Deep branching narrative and permanently missable story paths should wait until the core quest and save systems have been proven.

## Collaboration and campaign structure

The game is built around a shared campaign context with synchronized world state:

- One story run is shared rather than splitting into isolated solo campaign branches.
- Collaboration should open better routes and stronger tactical choices.
- Solo progression must remain meaningful and viable, but some chapter objectives can prefer specific roles.
- Failure to collaborate should limit throughput (risk, time-to-completion, tactical options), not create permanent dead ends unless absolutely intended.
- At least one late-reveal or betrayal beat should be expected in later chapters to support mystery pacing.

## Staff-based spell system

The initial spell set establishes three distinct tactical roles:

- **Lightning:** Direct damage. It travels from the staff orb to the unobstructed crosshair target and can become more damaging through progression.
- **Frost:** Control. It temporarily freezes a creature, changes the target to a readable ice-blue state, and creates time to reposition, heal, or solve a combat interaction.
- **Protective globe:** Defense. It surrounds and follows the Witch, absorbing or reducing incoming danger for a limited period.

Spells use configurable cooldowns, duration, damage, protection, and upgrade values. They should interact with selected maze mechanisms where that use is clearly communicated. A combat upgrade must not silently change puzzle behavior and make an earlier puzzle impossible to understand.

Future spells should add a genuinely new combat or exploration decision rather than duplicate an existing spell with a different color.

Party balance should create meaning through asymmetric strength:

- one witch may be better in certain environments or tasks,
- no witch is completely irrelevant outside collaboration,
- and key progression should reward either solo competence or team execution, depending on chapter intent.

## Major creature encounters

Major creature encounters are major encounters and narrative pressure points, not disposable corridor obstacles. The creature type can be a placeholder in early planning (dragon, wyrm, golem, void-beast, etc.) while the chapter lore resolves.

Each encounter should have:

- a readable introduction and enough room for the third-person camera;
- telegraphed attacks and fair recovery windows;
- useful roles for offensive, control, and defensive spells;
- collision that prevents the Witch and creature from overlapping;
- visible health and status feedback;
- reactions to damage, freezing, protection, and defeat;
- a clear effect on the maze, such as opening a gate or revealing an objective item;
- an experience and material reward appropriate to its importance.

A major creature may create or summon smaller threats when that behavior expresses its identity and creates a meaningful battlefield role. Spawned creatures must use bounded, telegraphed waves and a readable active-enemy cap rather than uncontrolled endless spawning. If containment is the encounter objective, every spawned creature needs visible weaken, stagger, and contained states; all character roles must have a baseline way to complete containment, while control and protection specialists perform it more safely or efficiently.

The provisional progression rule remains 10 experience points for each defeated major encounter and a spell-power improvement at 100 points. This value is a balance starting point and should be tested against the intended length and number of encounters.

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
| Experience | Major encounters, major objectives, selected discoveries | Permanent character and spell progression |

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
- a major guardian or equivalent climax where appropriate;
- a resolution that changes the world and points toward the next chapter.

The Moon Witch should have a defined personality and relationships rather than serving as a silent camera. Dialogue, animation, and player actions should consistently communicate her motives. The exact degree of dialogue choice, branching outcomes, companions, and moral consequence remains a separate narrative-design decision.

For the current collaboration-first direction, see [Story & Collaboration Framework](story-collaboration-framework.md).

## Chapter 1 story loop (discussion draft)

- Working title: **The Hollow Summons**
- Design status: **Not yet approved for implementation**
- Provisional critical-path playtime: **45 minutes**
- Purpose: Establish the emotional mystery, teach the first complete exploration/combat/restoration loop, and prove that collaboration improves outcomes without making solo play useless.
- Detailed working design: [Chapter 1 — The Hollow Summons](chapter-1-the-hollow-summons.md)

The 45-minute target is a scope and pacing tool for the first complete version, not a permanent maximum. Initial playtests should measure a focused first-time run rather than a developer speed-run. Optional discoveries, relationship scenes, alternate interpretations, and revisits may extend the chapter later without lengthening its required critical path.

### Provisional time budget

| Chapter segment | Target |
| --- | ---: |
| Coven House introduction and briefing | 5 minutes |
| Moon Gate crossing | 4 minutes |
| Garden Maze investigation and route-rune progression | 9 minutes |
| Rootbound Crossing collaboration lesson | 6 minutes |
| Briarheart and Briarling containment encounter | 12 minutes |
| West Tower discovery and moon-seal restoration | 6 minutes |
| Visible resolution, return, and Chapter 2 hook | 3 minutes |
| **Total critical path** | **45 minutes** |

### Working terms required by the loop

- **Moonhollow:** An abandoned magical settlement whose homes, gardens, libraries, and defensive paths have been sealed behind a boundary ward since a magical disaster one generation ago.
- **Sentinel Tower:** Part watchtower, part magical lighthouse, and part district stabilizer. Each tower detects disturbances, keeps nearby maze paths in their intended configuration, and projects one connected section of the boundary ward.
- **Moon-seal:** A large circular moonstone lens permanently mounted inside a Sentinel Tower. It is not a collectible key. A distorted seal causes its tower to flicker, its district to shift, and its section of the ward to tear.
- **Ward and Rift:** The ward is the connected boundary projected by the towers. A Rift is a local tear in that boundary; the story does not yet assume that every hostile creature came through it.

### Current playable loop

1. **Coven House — establish the personal reason to go:** Introduce Purple Witch and Green Witch, the nearby settlements endangered by Moonhollow's spreading maze, and the missing Keeper who mentored both witches. Their shared objective is to bring the Keeper home; their different instincts create tension over whether corrupted magic should be destroyed or healed.
2. **Briefing — state one clear mission:** The Coven Leader plays the Keeper's interrupted warning. The West Sentinel Tower has failed. The witches must enter Moonhollow, find the Keeper, and restore the tower before the local Rift reaches inhabited land. The Coven Leader withholds part of the message, creating suspicion without proving guilt.
3. **Moon Gate — cross the threshold:** The witches pass through the only stable entrance and see the immediate consequence of the distorted tower: the Garden Maze is moving outside its intended boundaries and the route home is becoming unstable.
4. **Garden Maze — explore, mine, and investigate:** Players navigate the outer district, mine three guaranteed route-rune fragments from safe geodes, and find physical evidence that the Keeper reached the tower alive. Each fragment also supplies a distinct clue: a personal trail mark, evidence that the Keeper prepared rather than fled, and a damaged command pattern. The completed route-rune opens the Sunken Gate. Different role strengths create safer or more revealing approaches, but both witches can continue alone.
5. **Rootbound Crossing — learn collaboration before the climax:** The witches use containment circles to clear dangerous magical growth from the route. In co-op, one Witch restrains or protects while the other channels the circle; solo players do both in sequence with more generous timing. This teaches the containment language without becoming a second major combat encounter.
6. **Sunken Court — contain Briarheart's outbreak:** Briarheart blocks the tower and releases finite, telegraphed waves of Briarlings. Active Briarlings protect or restore Briarheart, so every one must be weakened, staggered, and contained before the boss's corruption becomes vulnerable again. Green specializes in restraint and recovery; Purple specializes in pressure, interruption, and protection. Solo play uses the same rules with fewer simultaneous threats and longer recovery windows.
7. **Battle revelation — overturn the briefing's assumption:** Containment reveals that the Briarlings are pieces of Briarheart and that Briarheart is a native guardian, not an invader from the Rift. The black splinter corrupting it carries an authenticated High Coven command pattern, turning an apparent monster attack into evidence of deliberate sabotage.
8. **West Sentinel Tower — change the rescue mystery:** The tower is empty, but the Keeper left supplies, traces, and a message intentionally. She was not abducted. She received the false command, recognized the sabotage, and entered the deeper maze voluntarily to follow its source.
9. **Moon-seal restoration — complete the collaborative objective:** The witches remove the corruption, align the fixed seal's physical rings, and attune its magical channels. A group can hold complementary channels simultaneously; a solo witch can charge them sequentially while facing greater pressure.
10. **Visible resolution and hook — prove the action mattered:** The West Tower relights, its warning beam resumes, the local Rift closes, the Garden Maze settles into stable paths, and the route home opens. Back at the Coven House, the witches bring evidence of authorized sabotage: the Keeper is alive somewhere deeper in Moonhollow and does not know whom inside the Coven she can trust.

### Plan A expression in Chapter 1

Chapter 1 teaches a deliberately small, story-driven portion of Plan A. The
route-rune is a portable attunement pattern that opens an old maze gate; it is
not a moon-seal fragment. The moon-seal remains the fixed lens inside the West
Sentinel Tower.

- Required: one named route-rune made from three guaranteed, safely placed geode fragments; one Sunken Gate; Mining Tools supplied as field equipment.
- Optional: Raw Damage Crystals found in side geodes, used as preparation for Briarheart.
- Deferred from the required Chapter 1 path: multiple crafting tiers, Water Sprite thefts, and the full four-rune Plan A chain.
- Guardian system: Briarheart is the Chapter 1 guardian. The Plan A Boss Dragon is a greybox actor/system placeholder, not Chapter 1 lore.
- Exit: Restoring the West Tower activates the Moon Door, which ends the chapter when the Witch leaves through it.

### Story logic commitments from this chapter

- No permanent dead ends if separated from partner at any point; penalties should be in risk, visibility, or efficiency.
- The twist must change the objective framing, not just add lore flavor.
- At least one evidence item should point in a false direction, later contradicted by another scene.
- The chapter should teach the rules needed for the campaign without requiring combat skill perfection.
- Sentinel Towers and moon-seals must produce visible world changes rather than functioning as unexplained lore or collectible keys.

### Chapter 1 revision gate before implementation

Do not treat this loop as content-locked until the following foundations are deliberately chosen:

1. **Moonhollow truth:** Decide what Moonhollow was before the disaster, what the public believes happened, what actually happened, and why the High Coven sealed rather than destroyed or reclaimed it.
2. **Emotional center:** Define the Keeper's distinct relationship with each playable witch through at least one remembered act, one unresolved wound, and one reason each witch might doubt her.
3. **Antagonist logic:** Decide what the hidden antagonist wants from Moonhollow, why they cannot obtain it directly, why they act now, and how sabotaging the West Tower advances their plan even if the witches succeed.
4. **Character conflict:** Give Purple and Green compatible external goals but meaningfully different beliefs about power, mercy, authority, and the Keeper. Their disagreement must affect player decisions rather than existing only in biography text.
5. **Mystery chain:** For every clue, record its immediate interpretation, plausible alternate interpretation, actual truth, who planted or left it, and the later scene that pays it off. Red herrings must come from believable motives rather than arbitrary deception.
6. **Collaboration proof:** Specify one memorable cooperative action in exploration, containment, and seal restoration. Define the mechanically consistent solo version and the benefit gained through coordination.
7. **Chapter consequence:** Decide what materially changes because of player action, what outcome can vary, what persists into Chapter 2, and what new question creates the desire to continue.
8. **Scope boundary:** Validate the provisional 45-minute critical path, required scenes, optional discoveries, number of encounter waves, number of new mechanics, and explicit features deferred beyond the greybox.

Before code implementation, rewrite the loop as scene cards. Every required beat must identify:

- the player's immediate goal;
- the action the player performs rather than merely watches;
- the new information or relationship change earned by that action;
- the obstacle or decision that creates tension;
- the visible world or story consequence;
- and the question that pulls the player into the next beat.

Read the cards aloud with at least two people taking the witches' roles. A beat that cannot be explained clearly, does not follow from the previous beat with “therefore” or “but,” or leaves players unable to state why they care should be revised on paper before it becomes a coded objective.

## Chapter 2 story loop (working draft)

- Working title: **The Broken Routes**
- Design status: **Working narrative framework; not approved for implementation**
- Provisional critical-path playtime: **45 minutes**
- Central question: If the Coven's own network can lie, what evidence can the witches trust?

The relit West Tower catches a brief reply from the Keeper that points deeper
into Moonhollow, then an authorized command erases the signal. Purple and Green
enter a newly opened district to reach the next waystation before the trail
disappears. Restoring the West Tower has made the route accessible, raising the
uneasy possibility that the saboteur wanted it reopened.

### Provisional Chapter 2 sequence

1. **Coven House — the new signal (5 minutes):** The party decodes the Keeper's partial reply and is sent to the next waystation before the evidence disappears.
2. **Moon Gate — a newly opened route (5 minutes):** The restored West Tower has revealed a previously sealed district, proving both the value and risk of restoration.
3. **Broken Conservatory — explore and form a route-rune (8 minutes):** The witches mine three guaranteed fragments, each paired with a Keeper clue, and use the completed rune to open the main ward gate.
4. **Reflection Garden — solve a cooperative route puzzle (7 minutes):** The party aligns water channels, mirrors, or magical roots to form a crossing. Co-op permits parallel action; solo uses a longer sequential timing window. A side space can hold optional crystals, altar access, and a fountain risk.
5. **Collapsed Relay Court — guardian encounter (10 minutes):** A corrupted Route Warden controls several arena waystones. The witches reclaim the waystones while surviving its attacks; reclaimed stones create safe ground and weaken the guardian.
6. **East Waystation — evidence changes meaning (6 minutes):** The Keeper has passed through. A command ledger appears to implicate the Coven Leader, until a second clue proves the order was issued while she was publicly elsewhere. The signature is real, but its source is not straightforward.
7. **Return and hook (4 minutes):** The next trace points toward a district tied to Moonhollow's original disaster. The saboteur is following a deliberate path toward the Hollow's center.

### Plan A expression in Chapter 2

- Required: one three-fragment route-rune and one gate.
- Optional: geodes, crystals, crafting access, fountains, and Water Sprite encounters.
- Guardian: the Route Warden uses the same reusable dedicated-guardian arena framework as Briarheart, but its waystone-reclamation objective keeps the encounter mechanically distinct.
- Chapter outcome: The party leaves through a Moon Door or stabilized return route after the waystation is cleared.

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
7. Use lightning, frost, and the protective globe during a major encounter.
8. Defeat the encounter, receive experience, and recover the objective item.
9. Complete a short cinematic resolution and unlock the exit.
10. Finish the level, reload, and confirm that all permanent progress was saved correctly.

Proxy art is sufficient for this slice. It should be comfortable, stable, and completable on representative Windows and Mac desktop hardware before final Witch, major-encounter cinematic, spell, store, or environment assets enter production. Mobile qualification does not currently gate desktop asset or feature development.

## Fundamental success criteria

The foundation is ready for broader content production when:

- a new player understands the immediate objective and can navigate without developer help;
- movement, camera control, interaction, and all three spells remain dependable with desktop keyboard and mouse;
- every required gate explains its condition and opens consistently;
- the complete quest, economy, combat, and level-completion loop survives saving and reloading;
- no quest item can be lost or sold in a way that blocks progress;
- major-encounter combat is readable at close and medium range and cannot be bypassed through collision or wall-targeting errors;
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
- In Chapter 1, should the first twist be player-led (finding the lie themselves) or delivery-led (forced reveal cutscene), and why?
- Which route to Chapter 1 exit should be “rewarded” (solo, co-op, or equal by design)?
- What early clues should stay ambiguous versus confirmed, and how should the villain identity reveal be paced?
- Which chapter beats are guaranteed twists or reversals without causing replay-frustration?
- Which characters or paths should feel private/sensitive in the short term and only become public later?
- What balance points prevent companion dependence from becoming an invisible hard gate?
