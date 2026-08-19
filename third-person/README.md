# Level 1 third-person technical proof

This directory contains the isolated Babylon.js ES-module architecture used by the homepage and the direct proof entry point at `third-person.html`. The former hybrid raycaster/WebGL game remains preserved at `legacy.html`.

## Modules

- `main.js` composes the scene, assigns the selected local Witch, keeps the optional simulated remote Witch behind `?party=simulated`, and exposes a purpose-built browser smoke-test hook.
- `character-selection.js` owns the Coven briefing, two-step Purple/Green Witch choice, named opening actions, confirmation state, and gamepad-ready action boundary.
- `world.js` builds the temporary brick route, entrance Moon Gate, required traversal obstacles, dragon arena, technical exit barrier, route checkpoints, and collision registry.
- `controller.js` owns the substepped camera-relative capsule, wall and actor separation, buffered jumping, landing, crouching, ground probing, standing-clearance checks, and smooth cast-facing requests.
- `camera.js` owns exploration/aim framing, aim-preserving shoulder switching, smoothing, multi-ray wall collision, side compression, recovery, and occlusion handling.
- `input.js` maps keyboard, mouse, and independent touch pointers to named gameplay actions.
- `witch.js` and `dragon.js` build deliberately temporary primitive actors and procedural motion. The Witch builder accepts named palettes so every color witch can share one presentation and animation contract.
- `remote-player.js` consumes snapshot-shaped teammate state and smooths it independently from local input. Its temporary 10 Hz Green Witch feed can later be replaced by LAN messages without changing the replica.
- `green-witch.js` owns the Green Witch's health and two unlocked ability templates: two-arm Vine Trap control and smart-targeted Restore healing.
- `combat.js` resolves authoritative direct or conservative assisted crosshair intent, validates wall obstruction from the staff orb, drives cast-facing, and implements lightning damage, frost freezing, the protective Aegis globe, player health, and the training dragon's close-range strike.
- `inventory.js` builds the greybox berry bushes, corner treasure chest, gold reward, potion pickups, and clickable field-pouch inventory, then applies their effects through the combat system.
- `debug.js` reports FPS, frame-time samples, camera state, capsule state, collision, target, gate, animation, and mesh count.
- `config.js` centralizes specification-derived tuning values; `utils.js` and `targeting.js` contain shared movement and targeting math.

## Technical route

The authoritative route contains six checkpoints:

1. Cross the Moon Gate after confirming a Witch.
2. Jump over the rune relic.
3. Crouch beneath the low lintel.
4. Enter the combat arena.
5. Use the three-spell combat proof and defeat the training dragon with four lightning hits.
6. Pass through the animated exit gate.

The exit barrier is a real collider while locked. Dragon defeat removes that collider, raises the gate, and enables the final checkpoint.

Optional greybox rewards exercise the emerging inventory and economy loop without gating the route. A chest in the arena's northwest corner opens on approach and awards 50 gold. The amber Storm potion can be collected and deliberately used from the pouch to double lightning damage for 15 seconds. The blue Aegis potion primes the next protective globe to last twice its normal duration. Golden berries remain collectible healing items.

## Controls

The opening accepts mouse/trackpad clicks or the named keyboard actions Left/Right and A/D to navigate, Enter to select and then confirm, and Escape to step back. Desktop gameplay uses WASD or arrow keys to move, Shift to sprint, Space to jump, C or Control to crouch, V to switch shoulder, P to open the pouch, the mouse to look, right mouse to aim, number keys to select the local Witch's spells, and O to cast. Purple starts with Lightning in the selection copy and retains all three proof spells for regression testing. Green starts with Vine Trap; Restore is presented as the next XP unlock while remaining available in the two-spell technical template. A left click now only captures the pointer for mouse-look. Losing pointer lock, browser focus, or page visibility clears held input. Solo is the default and shows only the selected Witch. The optional `?party=simulated` test mode preserves the snapshot-driven teammate; when Green is simulated, its panel also exposes `G` for Vine Trap and `H` for Smart Restore.

On coarse-pointer landscape screens, all three immediate-cast spell buttons remain on the left, movement remains on the right, and the center look zone supports an independent pointer so movement, looking, and casting can occur together. Jump, crouch, and shoulder buttons sit beside the movement stick. Portrait play is blocked.

## Configuration and diagnostics

`config.js` contains the camera, controller, input, combat, world, and performance tuning values, plus the physical-key-to-named-action bindings. The on-screen diagnostics display FPS and 1% low, average and p95 frame time, frame spikes, boom and shoulder distance, player and capsule state, collision/occlusion, dragon and gate state, mesh and triangle counts, draw calls, active materials, textures, estimated decoded texture memory, render resolution, JavaScript heap where supported, and cold-load milestones.

The browser smoke-test hook at `window.__HMW_THIRD_PERSON_PROOF__` supports deterministic inspection and route automation. It is proof instrumentation, not a production game API.

## Targeting regression checks

Run the dependency-free targeting math suite with `node --test tests/targeting.test.mjs`. It covers close and normal range, modest off-center assistance, misses, wall precedence, and cast-facing direction.

`tests/third-person-targeting-smoke.mjs` exercises the rendered proof through Chrome DevTools Protocol. Start the repository on port 8766, launch a Chromium browser with remote debugging on port 9223, then run `node tests/third-person-targeting-smoke.mjs`. The optional `HMW_GAME_URL` and `HMW_CDP_ENDPOINT` environment variables select different local endpoints. The browser regression verifies close-range damage, normal-range damage, off-center character rotation, wall rejection, staff-origin evidence, and dragon separation.

`tests/third-person-dragon-defeat-smoke.mjs` verifies repeated O-key casts can reduce the training dragon to zero health, complete its defeat state exactly once, update the health HUD, and unlock the exit gate. It also covers route reset, frost followed by lightning, and resumed combat after pointer-lock interruption using the same optional URL and DevTools endpoint variables.

`tests/third-person-green-witch-smoke.mjs` verifies the simulated LAN snapshot stream and interpolation, distinct Green Witch presentation and nameplate, two unlocked ability templates, two-arm Vine Trap visuals and dragon restraint, self and friend Restore modes, smart wounded-friend selection, party HUD feedback, and runtime stability.

`tests/third-person-character-selection-smoke.mjs` verifies the exact Coven briefing and tagline, mouse and keyboard selection, the deliberately separate confirmation step, one visible local Witch in default solo play, Green's local starting ability, and the player-controlled Moon Gate crossing.

`tests/third-person-spells-smoke.mjs` uses the same local endpoints to verify O-key lightning damage, visible health feedback, Frost status and wall rejection, Aegis visibility and damage absorption, unshielded player damage, berry healing, pouch behavior, chest gold, both potion effects, spell selection, and the preserved spells-left/movement-right landscape-mobile layout.

`tests/third-person-input-smoke.mjs` verifies that opening the pouch, losing focus or pointer lock, and resetting the route discard queued one-shot actions while ordinary jumping and crouching still resume normally.

## Physical-device qualification

Add `qualification=1` and a quality preset to the URL to enable the field-test recorder without changing the ordinary proof:

- `third-person.html?qualification=1&quality=low`
- `third-person.html?qualification=1&quality=balanced`
- `third-person.html?qualification=1&quality=high`

The presets dynamically adjust internal resolution within the provisional low (0.70–0.85× CSS), balanced (0.85–1.0× CSS), and high (1.0–1.25× CSS) ranges. The recorder accepts exact device and environmental metadata, records one-second telemetry and route/combat/lifecycle events, supports qualification-only route resets, and exports JSON, CSV, or a copyable phone-readable summary. Browser heap data is identified as JavaScript-only; unsupported memory, battery, and temperature measurements are explicitly reported as unavailable rather than inferred.

An authorized HTTPS staging URL is preferred because clipboard and browser diagnostics vary in insecure contexts. For a same-network setup, run `python3 -m http.server 8766 --bind 0.0.0.0` from the repository root, find the Mac's LAN address, and open `http://LAN_ADDRESS:8766/third-person.html?qualification=1&quality=low` on the phone. The development machine and phone must be on the same Wi-Fi network, the firewall must permit the connection, and each exported file should be retained with its device/run label. Plain HTTP is a fallback only; the recorder includes a legacy copy fallback when the Clipboard API is unavailable.

## Scope boundary

This proof intentionally does not contain final character, hair, clothing, dragon, animation, material, or maze art. The Purple Witch spells, Green Witch ability templates, and collectible rewards use lightweight technical effects. Both Green Witch spells are unlocked for testing; XP acquisition and spell locking, real networking, persistence, stores, broader progression, maps, and the remaining levels stay outside this greybox until their foundations are proven.

Serve the repository over HTTP and open `/third-person.html`. Babylon.js is loaded from its official CDN for this experiment; a future production migration should pin and self-host the approved engine build. Performance collected from headless software WebGL is useful for regression comparison only and cannot qualify desktop or mobile hardware targets.
