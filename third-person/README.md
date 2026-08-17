# Third-person technical proof

This directory is an isolated Babylon.js ES-module experiment for the Level 1 acceptance criteria in [`docs/third-person-gameplay.md`](../docs/third-person-gameplay.md). The legacy game remains rooted at `index.html`; `third-person.html` is the proof entry point.

## Modules

- `main.js` composes the scene and exposes a read-only-oriented browser smoke-test hook.
- `world.js` builds the temporary brick maze, traversal obstacles, Moon Arch, and collision registry.
- `controller.js` owns camera-relative capsule movement, sliding, jumping, crouching, and clearance checks.
- `camera.js` owns the smoothed right/left shoulder camera, aim framing, and multi-ray camera collision.
- `input.js` maps keyboard, mouse, and independent touch pointers to named gameplay actions.
- `witch.js` and `dragon.js` build deliberately temporary primitive actors and procedural motion.
- `combat.js` resolves crosshair intent, validates the path from the staff orb, and renders lightning.
- `debug.js` reports current and sampled performance plus camera, player, and collision state.
- `config.js` centralizes specification-derived tuning values; `utils.js` contains shared math.

## Scope

This proof intentionally does not contain final character, hair, clothing, dragon, animation, material, or maze art. Frost, the protective globe, enemies, progression, inventory, maps, and the remaining levels stay in the legacy prototype until the 3D foundation meets its acceptance criteria.

Serve the repository over HTTP and open `/third-person.html`. Babylon.js is loaded from its official CDN for this experiment; a future production migration should pin and self-host the approved engine build.
