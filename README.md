# Haze Maze

An original, mobile-first enchanted maze FPS built with modern browser APIs and no dependencies.

## Play

Open `index.html` directly, or run a local server:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- Desktop: WASD to move, mouse or arrow keys to look, click/1 for lightning, 2 for freeze, 3 for shield, Space to jump, C or Control to crouch, M for the map, and P for the pouch.
- Touch landscape: right joystick to move, drag the center to look, use the spell buttons on the left, and use the Jump/Crouch buttons beside the joystick.

Complete ten distinct maze levels, starting with the variable, realistically textured Brick Labyrinth. Every level now uses a photoreal wall material, including flowering moon hedges, amethyst rock, damp cloister stone, living fungal briars, frost crystal, cinderstone, silver-veined masonry, and starlight crystal. Deterministic moss, luminous sigils, magical vines, spores, fractures, and ember veins vary from wall to wall. Stable wall-face coordinates and extra close-range texture tiling preserve the material structure instead of magnifying a single wall image as the player approaches. Contain every animated dragon in a level to open its golden gate. Every dragon grants 10 mastery; reaching 100 upgrades lightning damage and freeze duration. Golden magic berries are collected into the interactive pouch and restore 30 health when selected. Opening the pouch reveals a realistic, compartmented leather field bag with photoreal golden berries, storm crystals, frost runes, and phoenix feathers that can be selected directly. Jump over fallen rune relics and crouch beneath moon arches. The map button in the top-left—or M on a keyboard—opens a transparent live maze overlay showing dragons, berries, obstacles, the gate, your facing direction, and a “You are here” marker.

The action-wizard uses a transparent soft-edged character cutout with independent body sway, hair follow-through, jump/crouch motion, and an extended casting-arm pose.
