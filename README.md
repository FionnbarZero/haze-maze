# Moonhollow Quest

An original, desktop-first enchanted maze action game built with modern browser APIs.

The homepage runs the third-person Babylon.js version, with an over-the-shoulder camera and the selected Witch visible during exploration and combat. The former hybrid raycaster/WebGL game remains available at `legacy.html`; see the [third-person gameplay decision and specification](docs/third-person-gameplay.md) for the target camera, controls, animation, aiming, and Level 1 vertical-slice requirements.

Design direction has moved toward a collaborative, shared-campaign model (BG3-style); see [Story & Collaboration Framework](docs/story-collaboration-framework.md).

Beginning a new hunt opens on a Coven leader in the live Babylon scene. Press Enter or choose **Hear the Coven briefing** to let her deliver the summons through the computer's system voice, with a compact line-by-line caption. Purple, Green, Frost, and Fire Witch choice cards appear automatically after her final line. After confirmation, the chosen Witch becomes the sole local player and arrives before the Moon Gate; the route begins only when the player walks through it. Add `?party=simulated` to retain the optional snapshot-driven teammate proof.

## Platform direction

Moonhollow Quest now prioritizes Windows and Mac desktop browsers, keyboard and mouse controls, desktop-quality graphics, and the complete desktop gameplay experience. Gamepad support is a future target.

The existing landscape-mobile controls, responsive presentation, diagnostic instrumentation, and device-test records remain preserved as a compatibility prototype. Further mobile optimization, touch-control refinement, qualification, and mobile-specific feature work are deferred; phone limitations no longer set the quality or design ceiling for desktop development.

## Play

Open `index.html` directly, or run a local server:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

### Babylon.js game

The homepage at `http://localhost:8000/` serves the Babylon.js game. The previous game is preserved at `http://localhost:8000/legacy.html`, while `http://localhost:8000/third-person.html` remains available as a direct alias for the Babylon.js version. Babylon.js loads from its official CDN, so the game requires an internet connection.

Opening controls: press Enter or click the briefing button to permit computer audio and hear the Coven leader. When she finishes, click a character card, or use Left/Right or A/D and Enter; a separate confirmation starts the game, and Escape returns to the previous opening state. Proof controls are WASD or arrow keys to move, mouse to look, Shift to sprint, Space to jump, C or Control to crouch, V to switch shoulders, right mouse to aim, number keys to select the chosen Witch's spells, and O or left click to cast. On landscape touch devices, the preserved spell controls remain on the left, movement remains on the right, and the center region controls the camera.

## Controls

- Desktop: WASD or Up/Down to move, mouse to look, Left/Right or Q/E to turn, Shift to sprint, click/1 for lightning, 2 for freeze, 3 for shield, Space to jump, C or Control to crouch, M for the map, and P for the pouch.
- Touch landscape: right joystick to move, drag the center to look, use the spell buttons on the left, and use the Jump/Crouch buttons beside the joystick.

Complete ten distinct maze levels, starting with the variable, realistically textured Brick Labyrinth. Every level now uses a photoreal wall material, including flowering moon hedges, amethyst rock, damp cloister stone, living fungal briars, frost crystal, cinderstone, silver-veined masonry, and starlight crystal. Deterministic moss, luminous sigils, magical vines, spores, fractures, and ember veins vary from wall to wall. Stable wall-face coordinates and extra close-range texture tiling preserve the material structure instead of magnifying a single wall image as the player approaches. Contain every animated dragon in a level to open its golden gate. Every dragon grants 10 mastery; reaching 100 upgrades lightning damage and freeze duration. Golden magic berries are collected into the interactive pouch and restore 30 health when selected. Opening the pouch reveals a realistic, compartmented leather field bag with photoreal golden berries, storm crystals, frost runes, and phoenix feathers that can be selected directly. Jump over fallen rune relics and crouch beneath moon arches. The map button in the top-left—or M on a keyboard—opens a transparent live maze overlay showing dragons, berries, obstacles, the gate, your facing direction, and a “You are here” marker.

The action-wizard is a real-time WebGL Moon Witch assembled from lit 3D geometry and a hierarchical skeleton rather than layered character artwork. Her hips, knees, ankles, anatomical shoulder links, elbows, articulated hands and fingers, head, cape, six staggered scalp-following crown layers, and 240 individually varied auburn-to-copper curls respond directly to gameplay movement with a restrained opposing-limb walk cycle, airborne leg tuck, properly folded crouch, body weight shift, and spring-delayed layered hair and fabric motion. Her fuller hair volume rises above the crown, frames a shaped ear and jeweled earring on the right, and uses garment-clearance shaping to drape in front of the cape instead of intersecting it. Her procedural cloth-and-leather outfit has an asymmetrically raised skirt over one thigh, fitted high boots, a trimmed and lined side-swept cape, corset, gathered sleeves, bracers, a rounded flap-and-clasp belt pouch, pink sash, and celestial embroidery bound directly to the garment surfaces. The highlighted wooden crystal staff is anchored visibly beside her calculated right-hand position, contains animated magic inside its glowing orb, and aims forward with her arm whenever she casts. The shared animated rig now supports both color-Witch previews and the player-controlled Moon Gate entrance.
