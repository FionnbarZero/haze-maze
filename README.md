# Hunt of the Moon Witch

An original, mobile-first enchanted maze action game built with modern browser APIs and no dependencies.

The production direction is formally a third-person, over-the-shoulder spellcasting game with the Moon Witch visible during exploration and combat. The current hybrid raycaster/WebGL prototype remains the playable migration baseline; see the [third-person gameplay decision and specification](docs/third-person-gameplay.md) for the target camera, controls, animation, aiming, and Level 1 vertical-slice requirements.

Beginning a new hunt plays a short cinematic transition in which the Moon Witch walks through a glowing stone Moon Arch before control passes to the player.

## Play

Open `index.html` directly, or run a local server:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

### Isolated third-person technical proof

With the same local server running, visit `http://localhost:8000/third-person.html`. This separate Babylon.js experiment validates the planned over-the-shoulder camera, traversal, collision, touch layout, and staff-origin lightning without replacing the playable prototype at `index.html`. It loads Babylon.js from the official experimental CDN, so this proof requires an internet connection.

Proof controls: WASD or arrow keys to move, mouse to look, Shift to sprint, Space to jump, C or Control to crouch, V to switch shoulders, right mouse to aim, and left click to cast lightning. On landscape touch devices, spells remain on the left, movement remains on the right, and the center region controls the camera.

## Controls

- Desktop: WASD or Up/Down to move, mouse to look, Left/Right or Q/E to turn, Shift to sprint, click/1 for lightning, 2 for freeze, 3 for shield, Space to jump, C or Control to crouch, M for the map, and P for the pouch.
- Touch landscape: right joystick to move, drag the center to look, use the spell buttons on the left, and use the Jump/Crouch buttons beside the joystick.

Complete ten distinct maze levels, starting with the variable, realistically textured Brick Labyrinth. Every level now uses a photoreal wall material, including flowering moon hedges, amethyst rock, damp cloister stone, living fungal briars, frost crystal, cinderstone, silver-veined masonry, and starlight crystal. Deterministic moss, luminous sigils, magical vines, spores, fractures, and ember veins vary from wall to wall. Stable wall-face coordinates and extra close-range texture tiling preserve the material structure instead of magnifying a single wall image as the player approaches. Contain every animated dragon in a level to open its golden gate. Every dragon grants 10 mastery; reaching 100 upgrades lightning damage and freeze duration. Golden magic berries are collected into the interactive pouch and restore 30 health when selected. Opening the pouch reveals a realistic, compartmented leather field bag with photoreal golden berries, storm crystals, frost runes, and phoenix feathers that can be selected directly. Jump over fallen rune relics and crouch beneath moon arches. The map button in the top-left—or M on a keyboard—opens a transparent live maze overlay showing dragons, berries, obstacles, the gate, your facing direction, and a “You are here” marker.

The action-wizard is a real-time WebGL Moon Witch assembled from lit 3D geometry and a hierarchical skeleton rather than layered character artwork. Her hips, knees, ankles, anatomical shoulder links, elbows, articulated hands and fingers, head, cape, six staggered scalp-following crown layers, and 240 individually varied auburn-to-copper curls respond directly to gameplay movement with a restrained opposing-limb walk cycle, airborne leg tuck, properly folded crouch, body weight shift, and spring-delayed layered hair and fabric motion. Her fuller hair volume rises above the crown, frames a shaped ear and jeweled earring on the right, and uses garment-clearance shaping to drape in front of the cape instead of intersecting it. Her procedural cloth-and-leather outfit has an asymmetrically raised skirt over one thigh, fitted high boots, a trimmed and lined side-swept cape, corset, gathered sleeves, bracers, a rounded flap-and-clasp belt pouch, pink sash, and celestial embroidery bound directly to the garment surfaces. The highlighted wooden crystal staff is anchored visibly beside her calculated right-hand position, contains animated magic inside its glowing orb, and aims forward with her arm whenever she casts. The same animated 3D rig walks through the Moon Arch introduction.
