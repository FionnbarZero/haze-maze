# Level 1 third-person technical proof

This directory contains the isolated Babylon.js ES-module architecture used by the homepage and the direct proof entry point at `third-person.html`. The former hybrid raycaster/WebGL game remains preserved at `legacy.html`.

## Modules

- `main.js` composes the scene, assigns the selected local Witch, keeps the optional simulated remote Witch behind `?party=simulated`, and exposes a purpose-built browser smoke-test hook.
- `character-selection.js` owns the system-voiced Coven leader briefing, synchronized captions, automatic transition into the two-step four-Witch choice, named opening actions, confirmation state, and gamepad-ready action boundary.
- `world.js` delegates to the expanded world renderer; `expanded-world.js` builds the 28 × 52 stone maze, scenery, two rune doors, Moon Door exit, route state, and collision registry. `maze-layout.js` produces repeatable variable room openings and dragon placements from a seed.
- `controller.js` owns the substepped camera-relative capsule, wall and actor separation, buffered jumping, landing, crouching, ground probing, standing-clearance checks, and smooth cast-facing requests.
- `camera.js` owns exploration/aim framing, aim-preserving shoulder switching, smoothing, multi-ray wall collision, side compression, recovery, and occlusion handling.
- `input.js` maps keyboard, mouse, and independent touch pointers to named gameplay actions.
- `witch.js` and `dragon.js` build deliberately temporary primitive actors and procedural motion. The Witch builder accepts named palettes so every color witch can share one presentation and animation contract.
- `remote-player.js` consumes snapshot-shaped teammate state and smooths it independently from local input. Its temporary 10 Hz Green Witch feed can later be replaced by LAN messages without changing the replica.
- `green-witch.js` owns the Green Witch's health and two unlocked ability templates: two-arm Vine Trap control and smart-targeted Restore healing.
- `combat.js` resolves authoritative direct or conservative assisted crosshair intent across multiple dragons, validates wall obstruction from the staff orb, drives cast-facing, and implements Purple storm magic, Frost control and damage, Fire offense and creature-blocking protection, player health, and hostile-dragon strikes.
- `inventory.js` builds the greybox berry bushes, treasure chest, geodes, four found runes, potion pickups, and clickable field-pouch inventory, then applies their effects through the combat system.
- `debug.js` reports FPS, frame-time samples, camera state, capsule state, collision, target, gate, animation, and mesh count.
- `config.js` centralizes specification-derived tuning values; `utils.js` and `targeting.js` contain shared movement and targeting math.

## Technical route

The authoritative route records eight checkpoints:

1. Cross the Moon Gate after confirming a Witch.
2. Search the southern rooms and recover two runes.
3. Open and cross the first rune door.
4. Explore the deeper northern rooms.
5. Recover the complete four-rune set.
6. Open the final Moon Door.
7. Step into its moonlit portal.
8. Disappear through the portal to complete the route.

Both doors are real colliders while locked. The first two runes are placed in southern rooms so the player can open the inner door; the remaining two are distributed beyond it. Dragons do not hold required progression items. All ten are containable, but a seeded 10% hostile subset—exactly one dragon in this population—can initiate attacks. This keeps exploration populated without turning every encounter into forced combat.

The Purple Witch's pouch now owns equippable field gear as well as provisions. Her Moon staff starts in hand and can be stored or re-equipped from the pouch; spellcasting requires it. A crystal geode pick and geode hammer are hidden separately in the maze and can each replace the staff in her right hand. Finding both tools permits each of four glowing rocks to yield one magical geode, with every geode permanently increasing lightning damage by 10% for that route.

Optional greybox rewards continue to exercise the emerging inventory and economy loop. A central chest opens on approach and awards 50 gold. Four amber Storm potions can be collected and deliberately used from the pouch to double lightning damage for 15 seconds; four blue Aegis potions prime the next protective globe to last twice its normal duration. Twelve golden-berry bushes and eight inset fountains distribute landmarks and provisions throughout the rooms.

## Controls

The opening accepts Enter or a mouse/trackpad click on **Hear the Coven briefing** to permit computer audio. A dedicated Coven leader speaks the briefing through the browser's system voice while a compact caption follows each line; its speech session is explicitly released before character selection so no narration audio remains active in gameplay. Left/Right and A/D then navigate all four Witches, Enter selects and confirms in separate steps, and Escape steps back. Desktop gameplay uses WASD or arrow keys to move, Shift to sprint, Space to jump, C or Control to crouch, V to switch shoulder, P to open the pouch, the mouse to look, right mouse to aim, number keys to select the local Witch's spells, and O to cast. Purple starts with Lightning and retains all three storm-proof spells for regression testing; her staff must be equipped to cast. Green starts with Vine Trap, with Restore available in the two-spell technical template. Frost starts with control-focused Freeze and a damaging Ice Lance. Fire starts with a damaging Fireball and a five-second Fire Ring that repels the dragon and prevents creature damage while active. A left click only captures the pointer for mouse-look. Losing pointer lock, browser focus, or page visibility clears held input. Solo is the default and shows only the selected Witch. The optional `?party=simulated` test mode preserves the snapshot-driven Green teammate for Purple, Frost, and Fire; when Green is local, Purple is the simulated teammate.

On coarse-pointer landscape screens, up to three immediate-cast spell slots remain on the left, movement remains on the right, and the center look zone supports an independent pointer so movement, looking, and casting can occur together. Jump, crouch, and shoulder buttons sit beside the movement stick. Portrait play is blocked.

## Configuration and diagnostics

`config.js` contains the camera, controller, input, combat, world, and performance tuning values, plus the physical-key-to-named-action bindings. The on-screen diagnostics display FPS and 1% low, average and p95 frame time, frame spikes, boom and shoulder distance, player and capsule state, collision/occlusion, dragon and gate state, mesh and triangle counts, draw calls, active materials, textures, estimated decoded texture memory, render resolution, JavaScript heap where supported, and cold-load milestones.

The browser smoke-test hook at `window.__HMW_THIRD_PERSON_PROOF__` supports deterministic inspection and route automation. It is proof instrumentation, not a production game API.

## Regression checks

Run the dependency-free unit suites with `node --test tests/maze-layout.test.mjs tests/targeting.test.mjs tests/character-selection-audio.test.mjs tests/remote-player.test.mjs`. They cover expanded-maze size and population invariants, seeded variation, the exact hostile-dragon ratio, both rune thresholds, targeting math, opening-audio lifecycle, and teammate snapshot behavior.

`tests/third-person-expanded-maze-smoke.mjs` is the authoritative rendered route regression. It verifies the 3× floor area, 4× scenery/resource populations, ten-dragon distribution, passive-versus-hostile contact behavior, first-door and final-door rune thresholds, runtime stability, and the Witch's disappearance through the Moon Door.

`tests/third-person-targeting-smoke.mjs` exercises the rendered proof through Chrome DevTools Protocol. Start the repository on port 8766, launch a Chromium browser with remote debugging on port 9223, then run `node tests/third-person-targeting-smoke.mjs`. The optional `HMW_GAME_URL` and `HMW_CDP_ENDPOINT` environment variables select different local endpoints. The browser regression verifies close-range damage, normal-range damage, off-center character rotation, wall rejection, staff-origin evidence, and dragon separation.

`tests/third-person-dragon-defeat-smoke.mjs` and `tests/third-person-purple-progression-smoke.mjs` retain historical two-guardian-route coverage for reference while their still-relevant combat and equipment checks are migrated into the expanded route suites.

`tests/third-person-green-witch-smoke.mjs` verifies the simulated LAN snapshot stream and interpolation, distinct Green Witch presentation and nameplate, two unlocked ability templates, two-arm Vine Trap visuals and dragon restraint, self and friend Restore modes, smart wounded-friend selection, party HUD feedback, and runtime stability.

`tests/third-person-elemental-witches-smoke.mjs` verifies all four selection cards, deliberate Frost confirmation, solo Frost and Fire presentation, their exact two-spell loadouts, non-damaging Freeze, damaging Ice Lance and Fireball attacks, Fire Ring damage immunity and creature repulsion, HUD feedback, and runtime stability.

`tests/third-person-character-selection-smoke.mjs` verifies that the dedicated Coven leader replaces the playable Witch previews during the exact briefing, the selection waits for narration completion, the leader gives way to all four choice previews, mouse and keyboard selection preserve the deliberately separate confirmation step, solo play shows one local Witch, Green's starting ability works, and the player controls the Moon Gate crossing. `?narration=instant` makes the spoken sequence deterministic for automation without changing the ordinary player flow.

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

This proof intentionally does not contain final character, hair, clothing, dragon, animation, material, or maze art. Purple, Green, Frost, and Fire use shared placeholder Witch geometry, distinct palettes, and lightweight technical spell effects. All current ability templates are unlocked for testing; XP acquisition and spell locking, real networking, persistence, stores, broader progression, maps, and the remaining levels stay outside this greybox until their foundations are proven.

Serve the repository over HTTP and open `/third-person.html`. Babylon.js is loaded from its official CDN for this experiment; a future production migration should pin and self-host the approved engine build. Performance collected from headless software WebGL is useful for regression comparison only and cannot qualify desktop or mobile hardware targets.
