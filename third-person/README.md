# Level 1 third-person technical proof

This directory is an isolated Babylon.js ES-module experiment for the Level 1 acceptance criteria in [`docs/third-person-gameplay.md`](../docs/third-person-gameplay.md). The legacy game remains rooted at `index.html`; `third-person.html` is the proof entry point.

## Modules

- `main.js` composes the scene and exposes a purpose-built browser smoke-test hook.
- `world.js` builds the temporary brick route, required traversal obstacles, Moon Arch, dragon arena, animated gate, route checkpoints, and collision registry.
- `controller.js` owns the substepped camera-relative capsule, wall and actor separation, buffered jumping, landing, crouching, ground probing, standing-clearance checks, and smooth cast-facing requests.
- `camera.js` owns exploration/aim framing, aim-preserving shoulder switching, smoothing, multi-ray wall collision, side compression, recovery, and occlusion handling.
- `input.js` maps keyboard, mouse, and independent touch pointers to named gameplay actions.
- `witch.js` and `dragon.js` build deliberately temporary primitive actors and procedural motion.
- `combat.js` resolves authoritative direct or conservative assisted crosshair intent, validates wall obstruction from the staff orb, drives cast-facing, and renders lightning.
- `debug.js` reports FPS, frame-time samples, camera state, capsule state, collision, target, gate, animation, and mesh count.
- `config.js` centralizes specification-derived tuning values; `utils.js` and `targeting.js` contain shared movement and targeting math.

## Technical route

The authoritative route contains six checkpoints:

1. Cross the Moon Arch.
2. Jump over the rune relic.
3. Crouch beneath the low lintel.
4. Enter the combat arena.
5. Defeat the training dragon with four lightning hits.
6. Pass through the animated exit gate.

The exit barrier is a real collider while locked. Dragon defeat removes that collider, raises the gate, and enables the final checkpoint.

## Controls

Desktop uses WASD or arrow keys to move, Shift to sprint, Space to jump, C or Control to crouch, V to switch shoulder, the mouse to look, right mouse to aim, and left mouse to cast lightning. Losing pointer lock, browser focus, or page visibility clears held input.

On coarse-pointer landscape screens, lightning remains on the left, movement remains on the right, and the center look zone supports an independent pointer so movement, looking, and casting can occur together. Jump, crouch, and shoulder buttons sit beside the movement stick. Portrait play is blocked.

## Configuration and diagnostics

`config.js` contains the camera, controller, input, combat, world, and performance tuning values, plus the physical-key-to-named-action bindings. The on-screen diagnostics display FPS and 1% low, average and p95 frame time, frame spikes, boom and shoulder distance, player and capsule state, collision/occlusion, dragon and gate state, mesh and triangle counts, draw calls, active materials, textures, estimated decoded texture memory, render resolution, JavaScript heap where supported, and cold-load milestones.

The browser smoke-test hook at `window.__HMW_THIRD_PERSON_PROOF__` supports deterministic inspection and route automation. It is proof instrumentation, not a production game API.

## Targeting regression checks

Run the dependency-free targeting math suite with `node --test tests/targeting.test.mjs`. It covers close and normal range, modest off-center assistance, misses, wall precedence, and cast-facing direction.

`tests/third-person-targeting-smoke.mjs` exercises the rendered proof through Chrome DevTools Protocol. Start the repository on port 8766, launch a Chromium browser with remote debugging on port 9223, then run `node tests/third-person-targeting-smoke.mjs`. The optional `HMW_GAME_URL` and `HMW_CDP_ENDPOINT` environment variables select different local endpoints. The browser regression verifies close-range damage, normal-range damage, off-center character rotation, wall rejection, staff-origin evidence, and dragon separation.

## Physical-device qualification

Add `qualification=1` and a quality preset to the URL to enable the field-test recorder without changing the ordinary proof:

- `third-person.html?qualification=1&quality=low`
- `third-person.html?qualification=1&quality=balanced`
- `third-person.html?qualification=1&quality=high`

The presets dynamically adjust internal resolution within the provisional low (0.70–0.85× CSS), balanced (0.85–1.0× CSS), and high (1.0–1.25× CSS) ranges. The recorder accepts exact device and environmental metadata, records one-second telemetry and route/combat/lifecycle events, supports qualification-only route resets, and exports JSON, CSV, or a copyable phone-readable summary. Browser heap data is identified as JavaScript-only; unsupported memory, battery, and temperature measurements are explicitly reported as unavailable rather than inferred.

An authorized HTTPS staging URL is preferred because clipboard and browser diagnostics vary in insecure contexts. For a same-network setup, run `python3 -m http.server 8766 --bind 0.0.0.0` from the repository root, find the Mac's LAN address, and open `http://LAN_ADDRESS:8766/third-person.html?qualification=1&quality=low` on the phone. The development machine and phone must be on the same Wi-Fi network, the firewall must permit the connection, and each exported file should be retained with its device/run label. Plain HTTP is a fallback only; the recorder includes a legacy copy fallback when the Clipboard API is unavailable.

## Scope boundary

This proof intentionally does not contain final character, hair, clothing, dragon, animation, material, or maze art. Frost, the protective globe, enemies, progression, inventory, maps, and the remaining levels stay in the legacy prototype until the 3D foundation meets its acceptance criteria.

Serve the repository over HTTP and open `/third-person.html`. Babylon.js is loaded from its official CDN for this experiment; a future production migration should pin and self-host the approved engine build. Performance collected from headless software WebGL is useful for regression comparison only and cannot qualify desktop or mobile hardware targets.
