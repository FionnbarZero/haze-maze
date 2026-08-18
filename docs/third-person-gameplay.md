# Third-Person Over-the-Shoulder Gameplay

- Status: Accepted
- Decision date: 2026-08-17
- Implementation state: Level 1 Babylon.js technical proof implemented beside the legacy prototype; production migration not yet accepted

## Decision

Moonhollow Quest is a third-person, over-the-shoulder action spellcasting game. The female Moon Witch is the visible player character during exploration and combat. The camera, character controller, aiming model, animations, spells, collision, and future level geometry must be designed around that perspective.

The game is no longer described or designed as a first-person shooter. It may retain fast crosshair-driven spellcasting, but the player fantasy is controlling and watching the Moon Witch move through the maze with her staff in her right hand.

This decision does not convert the legacy prototype to a full 3D engine. The existing build remains the playable migration baseline until a Babylon.js Level 1 vertical slice satisfies the acceptance criteria in this document. An isolated technical proof now validates the core camera, traversal, input, and lightning-combat architecture without replacing that baseline.

## Experience goals

The third-person implementation must make the following qualities legible at normal gameplay distance:

- The Witch is a person occupying the maze, not a screen-space illustration.
- Her direction, weight, gait, jump, crouch, casting intent, and reactions are readable from her whole body.
- Her right hand visibly grips the staff, and the staff orb is the source of offensive spell effects.
- Camera motion feels controlled in narrow maze corridors and never passes through walls.
- A centered crosshair remains a dependable statement of where a spell will land.
- Desktop and landscape-mobile controls express the same gameplay intentions.
- The Witch, dragon, spell, and environment share one camera, lighting model, depth buffer, and collision world.

## Current prototype boundary

The current build is a hybrid prototype rather than the target implementation:

- `game.js` renders the maze through a Canvas 2D raycaster using the player position and yaw as a first-person camera.
- The player moves on a two-dimensional grid with circle collision. Jump and crouch change scalar state and camera offset rather than moving a 3D capsule through 3D geometry.
- Dragons, berries, and obstacles are projected billboard images. Crosshair targeting uses screen angle, distance, and line of sight.
- `witch-3d.js` renders a procedural WebGL Witch on a separate transparent canvas with a fixed screen-space camera.
- The Witch and maze do not share world coordinates, camera projection, lighting, collision, occlusion, or depth.

The visible character, locomotion intent, staff pose, spell rules, maze logic, HUD concepts, map, pouch, and desktop/mobile action mappings are valuable design references. The separate rendering systems are not the production architecture.

## Level 1 technical-proof checkpoint

`third-person.html` and the ES modules in `third-person/` form an isolated Babylon.js technical proof. They do not modify or replace the legacy entry point at `index.html`.

The proof currently demonstrates:

- one shared Babylon.js scene and depth buffer for a modular brick passage, Moon Arch, traversal obstacles, placeholder Witch, placeholder dragon, animated exit gate, and lightning;
- an authoritative six-checkpoint route from the Moon Arch through required jump and crouch obstacles, the combat arena, dragon defeat, and the unlocked exit;
- a substepped capsule controller with camera-relative locomotion, normalized diagonals, sprint, buffered jump, coyote time, landing state, crouch clearance, ground probing, and wall sliding;
- exploration and precision cameras with configurable framing, shoulder switching that anchors the current aim point, wall and side probes, fast inward correction, slower recovery, occlusion detection, and proximity fade;
- a deliberately primitive full-body Witch with procedural locomotion states and a staff parented to `RightHand_StaffSocket`;
- camera-ray intent plus an independently validated staff-orb ray, world obstruction, authoritative dragon health, defeat state, and gate unlock;
- named desktop and independent landscape-touch inputs, safe pointer-lock recovery, portrait input blocking, safe-area-aware HUD placement, and runtime diagnostics.

The proof deliberately does not claim final character or creature rigs, authored animation clips, production art, pickups, map, pouch, settings UI, real-device performance qualification, or all criteria listed below. It now includes lightweight technical implementations of lightning damage, frost freezing, Aegis protection, player health, and dragon strikes; these validate gameplay rules rather than final effects or animation. Its purpose is to retire architectural risk before production asset work begins.

## Camera specification

All distances below assume a roughly 1.7-meter-tall character and are initial tuning values, not immutable constants. They must live in camera configuration rather than animation or level code.

### Exploration camera

The default camera uses the Witch's right shoulder. This places her primarily in the lower-left portion of the frame and keeps her right hand, staff, and casting line visible nearer the crosshair.

| Property | Initial target |
| --- | --- |
| Character pivot | Upper torso, approximately 1.45 m above the capsule base |
| Boom distance | 3.6 m behind the pivot |
| Shoulder offset | 0.62 m to camera-right |
| Vertical offset | 0.25 m above the pivot |
| Vertical field of view | 60° desktop; 64° landscape mobile |
| Pitch range | 50° downward to 35° upward |
| Yaw range | Unrestricted |
| Look sensitivity | Configurable independently for mouse and touch |

At rest and during ordinary locomotion, the intended framing shows the Witch from her boots through the top of her hair with a small lower-screen safety margin. The framing may tighten temporarily during camera collision or precision aiming, but it must not become a first-person view.

### Precision-aim camera

Holding the desktop aim input or the equivalent optional mobile focus input eases the camera to a 3.05 m boom, 0.72 m shoulder offset, and 54° field of view. Precision aim is not required to cast; it provides finer target selection and a clearer staff-to-target line.

The transition takes approximately 160 ms with an ease-in/ease-out curve. Releasing aim returns to exploration framing in approximately 220 ms. The crosshair does not jump during the transition.

### Follow behavior

- Mouse or touch look controls camera yaw and pitch directly.
- Position follow uses a critically damped spring with an initial response time near 90 ms.
- Rotation follow uses an initial response time near 65 ms while aiming and 120 ms while exploring.
- Sudden player teleportation or level transitions snap the camera safely instead of interpolating through walls.
- Jumping adds no artificial vertical camera bob. The pivot follows the character with a small dead zone so the landing remains readable without becoming uncomfortable.
- Crouching eases the pivot downward with the character over approximately 140 ms.
- Optional camera shake is additive, short, and independently reducible or disabled.

### Camera collision and occlusion

Each frame, the camera system sphere-casts from the current character pivot toward the desired camera position.

- Initial camera probe radius: 0.22 m.
- Wall clearance margin: at least 0.10 m.
- Collision correction moves inward immediately, within roughly 30 ms.
- Returning to the desired boom is slower, initially 180 ms, to prevent popping at corners.
- The camera never clips through walls, gates, large props, dragons, or the Moon Arch.
- The camera may shorten to approximately 0.85 m in exceptional tight spaces, but primary corridors should be authored wide enough that this is uncommon.
- Shoulder offset reduces before boom distance when a side wall crowds the camera.
- If geometry still hides the Witch at the minimum boom, the Witch uses a subtle dithered transparency rather than allowing the camera inside her body.
- Wall surfaces retain true geometric scale at every distance; collision does not magnify or replace wall textures.

Primary Level 1 corridors should target at least 2.4 m of clear width, with deliberate wider combat pockets. Narrow traversal spaces must be tested explicitly rather than relying on emergency camera compression.

### Shoulder switching

Right shoulder is the default. A manual shoulder-switch action mirrors the horizontal offset without changing the crosshair or spell aim point. Automatic shoulder assistance may temporarily reduce or mirror the offset near a blocking wall, but it must not repeatedly switch sides without player intent.

The most recently selected shoulder is saved. Shoulder switching must be available through a remappable desktop action and an optional mobile HUD control.

## Character locomotion and facing

Movement is camera-relative on the horizontal plane.

- Forward input moves toward the camera's planar forward direction.
- Strafe input moves along the camera's planar right direction.
- Diagonal input is normalized so it is not faster.
- Exploration locomotion rotates the Witch toward her movement direction using speed-dependent turn smoothing.
- Precision aim, casting, and target focus rotate her upper body and then her root toward the camera aim direction. Movement becomes strafing locomotion when necessary.
- Releasing aim returns to movement-facing locomotion without snapping.
- Backpedaling is permitted while aiming but is slower than forward movement.

The production character uses a standing capsule approximately 1.75 m high and 0.32 m in radius. Crouching transitions to an approximately 1.15 m capsule only after checking that there is room to stand again. Initial controller targets are a 0.28 m step offset, a 45° maximum walkable slope, stable ground probing, and swept collision to prevent tunneling.

Locomotion should be in-place and driven by the character controller for predictable browser and network-independent behavior. Animation speed scales within authored limits to match actual ground speed. Short authored displacement may be used for non-locomotion actions only when the controller remains authoritative.

## Character visibility and presentation

- The Witch is rendered inside the world scene with the same camera and depth buffer as the maze.
- Her whole body remains visible during ordinary walk, run, sprint, jump, landing, and crouch traversal.
- The staff, hands, boots, robe silhouette, hair, and cape remain readable against bright and dark environments.
- Nearby walls correctly occlude her, but camera collision should minimize prolonged occlusion.
- Hair, cape, skirt, limbs, staff, pouch, and environment require authored collision or deformation limits so they do not pass visibly through one another.
- A temporary dither fade may handle unavoidable camera proximity. The character must not disappear entirely during normal play.
- The character's shadow and contact lighting establish that her feet are grounded.

## Staff, aiming, and spell trajectories

The production Witch is a rigged GLB character. The staff attaches to a named socket on the right-hand skeleton, provisionally `RightHand_StaffSocket`. The staff transform is inherited from the hand and never maintained as a separate screen-space object.

Casting uses this sequence:

1. Cast input validates state, cooldown, and spell resources.
2. A camera ray from the crosshair determines the intended aim point against world geometry or a valid target.
3. Optional aim assistance adjusts only to an eligible visible target within its configured cone.
4. The Witch turns toward the aim solution within the allowed animation range.
5. Upper-body aim and right-arm inverse kinematics align the wrist and staff orb toward the aim point.
6. An animation event marks the release frame.
7. The spell originates at the staff orb and travels or beams toward the resolved aim point.
8. A near-origin obstruction check prevents the spell from passing through a wall between the staff and aim point.

The camera ray decides intent, while the staff orb decides the visible origin. This preserves accurate crosshair aiming without making the spell appear to emerge from the camera.

Spell-specific behavior:

- Lightning is a fast ray or short-lived beam with branching visual streams from the orb to the resolved hit point. Damage comes from the gameplay query, not individual decorative branches.
- Frost is a visible projectile or beam that applies the frozen status on a confirmed hit. The dragon animation pauses or transitions into a frozen pose and its material changes to the authored ice treatment.
- Aegis Orb is self-targeted and creates a world-space protective globe centered around the Witch's controller, following her while active.

Casting supports limited locomotion through an upper-body animation layer. More powerful casts may reduce movement speed but should not silently stop the player unless explicitly designed as a committed action.

## Target selection and health feedback

- The crosshair corresponds to a 3D ray from the active camera.
- Large or fast targets may use a small sphere cast to improve usability.
- A target must be within spell range, inside the permitted aim-assist cone, and unobstructed by world geometry.
- Aim assistance never selects through a wall and favors crosshair proximity before distance.
- Mobile aim assistance begins with a configurable 6° acquisition cone and weaker 10° friction region. Both require playtesting.
- Desktop mouse defaults to minimal aim assistance, with an accessibility option to increase it.
- The selected target receives restrained feedback through the existing crosshair state and health bar rather than an opaque full-screen lock-on effect.
- Damage, freeze, shield absorption, and death are authoritative gameplay events shared by animation, sound, particles, and UI.

## Desktop controls

| Action | Default input | Behavior |
| --- | --- | --- |
| Move | WASD | Camera-relative movement |
| Camera | Mouse | Yaw and pitch while the game owns pointer lock |
| Sprint | Shift | Sprint while moving forward and not crouched |
| Jump | Space | Buffered grounded jump |
| Crouch | C or Control | Toggle or hold, configurable |
| Cast selected spell | Left mouse | Cast toward the crosshair |
| Precision aim | Right mouse | Ease to precision camera while held |
| Select spell | 1, 2, 3 | Select lightning, frost, or shield |
| Quick cast | Optional remappable actions | Preserve direct-cast accessibility if enabled |
| Shoulder switch | V | Mirror the shoulder offset |
| Map | M | Toggle the transparent map overlay |
| Pouch | P | Open the inventory pouch |
| Pause | Escape | Pause or close the topmost overlay |

Q/E and arrow-key turning may remain as optional digital-camera aliases for accessibility, but they are not the primary third-person control model. Losing pointer lock, browser focus, or visibility clears held input. Clicking the game view reacquires pointer lock without an unhandled promise rejection.

## Landscape-mobile controls

The established side layout remains a product requirement:

- Spell controls remain on the left.
- The movement joystick remains on the right.
- The open center region controls camera yaw and pitch through dragging.
- Jump and crouch remain adjacent to the movement joystick without overlapping its capture area.
- The map and pouch remain reachable without crossing the active combat controls.
- Spell buttons cast immediately and also become the selected spell for subsequent contextual input.
- Touch look and movement support independent simultaneous pointers.
- Touch sensitivity, vertical sensitivity, aim assistance, and joystick dead zone are configurable.
- Safe-area insets and multiple landscape aspect ratios are tested explicitly.

Portrait orientation is unsupported for active play. The orientation overlay must pause or block gameplay input rather than merely covering the scene.

## Accessibility and comfort settings

The vertical slice should establish the settings architecture for:

- Horizontal and vertical sensitivity
- Inverted vertical look
- Field-of-view adjustment within safe camera limits
- Shoulder preference and shoulder-switch remapping
- Hold/toggle choices for aim, sprint, and crouch
- Controller and keyboard remapping when those input systems are introduced
- Aim-assist strength
- Crosshair size, opacity, and contrast
- Camera shake strength or off
- Reduced camera motion
- Subtitle and text scaling readiness
- Color-independent freeze, damage, targeting, and shield feedback

## Animation state requirements

The character animation graph must support smooth transitions and layered casting.

### Base locomotion

- Idle variations with breathing and grounded weight shift
- Walk and run blend spaces covering forward, backward, and lateral movement
- Sprint forward
- Start, stop, and direction-change transitions
- In-place 90° and 180° turns for low-speed direction changes
- Crouch enter, crouch idle, crouch locomotion, and crouch exit

### Airborne movement

- Jump anticipation
- Takeoff
- Rising loop
- Apex/fall transition
- Falling loop
- Light and heavy landings selected by vertical speed

### Combat and reactions

- Upper-body aim poses across useful yaw and pitch ranges
- Distinct lightning, frost, and shield casts
- Cast release events synchronized with the staff orb
- Moving casts blended over locomotion
- Hit reactions by broad direction
- Frozen reaction where applicable to enemies
- Defeat and recovery or respawn transitions

Hair and cape use authored secondary bones or a lightweight spring system with collision proxies around the head, shoulders, back, staff, and upper robe. Full real-time cloth simulation is not required for the first vertical slice. Animation transitions must preserve staff grip and prevent hands, limbs, hair, cape, and skirt from visibly crossing one another during common actions.

## Systems to retain, adapt, or replace

| System | Direction | Notes |
| --- | --- | --- |
| Deterministic maze generation and level themes | Retain and adapt | Convert grid output into modular 3D geometry and navigation data |
| Spell identities, cooldown concepts, freeze, and shield rules | Retain and adapt | Move targeting and effects into 3D queries and world-space presentation |
| Dragon health, mastery, gate condition, berries, map, and pouch | Retain and adapt | Separate configuration and state from the current renderer |
| HUD information architecture | Retain and adapt | Preserve concepts while adding settings and third-person prompts |
| Desktop and mobile input intentions | Retain and adapt | Route through named actions rather than direct DOM-to-state coupling |
| Canvas raycaster | Replace | Babylon.js camera, meshes, materials, lighting, and depth become authoritative |
| Billboard dragons, pickups, and obstacles | Replace | Use rigged or static 3D assets with shared world collision and depth |
| Screen-space WebGL Witch overlay | Replace | Use one skinned GLB character inside the Babylon scene |
| Fixed character-overlay camera | Replace | Use the world-space shoulder camera defined above |
| Screen-angle target selection | Replace | Use camera ray/sphere casts and visibility checks |
| Scalar jump/crouch and 2D collision | Replace | Use a swept 3D character capsule with standing/crouched shapes |
| Direct line-of-sight dragon pursuit | Replace in later gameplay work | Use grid A* or navigation with an enemy state machine |

## Babylon.js Level 1 vertical-slice acceptance criteria

The vertical slice is accepted only when all of the following are demonstrated in the realistic brick Level 1 environment.

### Scene and camera

- The maze, Witch, dragon, pickups, gate, Moon Arch, and spells occupy one Babylon.js scene and depth buffer.
- Exploration and precision camera values are configurable and begin near this specification's targets.
- The camera never visibly enters Level 1 walls during a complete traversal.
- Wall proximity reduces shoulder offset and boom distance smoothly without texture magnification.
- Manual shoulder switching preserves the crosshair aim point.
- The Witch remains readable and substantially full-body during ordinary exploration.

### Character and traversal

- A rigged Witch GLB uses a capsule controller and camera-relative movement.
- Idle, multidirectional walk/run, sprint, jump, fall, land, crouch, aim, and three cast animations transition without obvious snapping.
- The right hand maintains a credible staff grip through locomotion and all casts.
- Jump and crouch are required by at least one authored Level 1 traversal obstacle each.
- Hair, cape, skirt, limbs, pouch, and staff have no persistent visible intersections during the acceptance route.

### Combat

- One rigged dragon can be acquired, damaged by lightning, frozen by frost, blocked by Aegis Orb, and defeated.
- Crosshair intent and staff-origin effects resolve to the same valid target or world hit point.
- Walls block targeting and spells from both camera and staff origins.
- The dragon health bar, freeze state, hit reaction, and death animation match authoritative gameplay state.
- Defeating the required dragon unlocks and animates the exit gate.

### Input and usability

- Desktop mouse look, WASD movement, pointer-lock loss/recovery, aiming, casting, jumping, crouching, map, pouch, and shoulder switching work through named actions.
- Landscape-mobile spells-left/movement-right layout supports simultaneous movement, look, and casting.
- No invisible touch layer intercepts desktop mouse input.
- A representative narrow viewport with a fine pointer keeps touch-only controls inert.
- Sensitivity, inverted look, camera shake, aim assist, and shoulder preference persist locally.

### Performance and quality

- Representative desktop hardware sustains 60 frames per second in the acceptance encounter.
- Supported mobile targets sustain at least 30 frames per second, with 60 as the preferred target.
- The initial vertical-slice download target is no more than 35 MB compressed, subject to asset-quality review.
- Mesh, texture, animation, and particle budgets are recorded from real target devices rather than assumed.
- There are no uncaught startup, pointer-lock, asset-loading, or context-loss errors during the smoke-test route.

## Risks and unresolved implementation choices

The perspective decision is final, but these implementation details require prototypes or art tests:

- Whether Babylon's built-in collision approach or a dedicated physics integration best serves the capsule controller
- Final exploration distance, field of view, and pitch limits after maze-scale playtesting
- Whether precision aim is necessary on touch or aim assistance alone is sufficient
- The minimum corridor width that balances maze tension with camera stability
- Final rig topology, hair-card approach, cape bones, and secondary-motion budget
- Dragon navigation choice: generated grid A* versus baked navigation data
- Exact mobile performance tier and downloadable asset budget
- Whether quick-cast keys coexist with select-then-left-click spell controls by default

These are tuning and implementation decisions. They do not reopen the adopted third-person perspective.

## Migration rule

Do not remove the playable prototype until the Level 1 vertical slice meets the functional camera, control, traversal, and combat acceptance criteria. New production systems should be built in modules beside the prototype, with portable rules moved only after their replacement has a testable consumer.
