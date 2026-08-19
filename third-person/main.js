import { createWorld } from './world.js?v=20260818-witchselect-v1';
import { createPlaceholderWitch } from './witch.js?v=20260818-witchselect-v1';
import { createPlaceholderDragon } from './dragon.js?v=20260818-witchselect-v1';
import { ProofInput } from './input.js?v=20260818-witchselect-v1';
import { CharacterController } from './controller.js?v=20260818-witchselect-v1';
import { ShoulderCamera } from './camera.js?v=20260818-witchselect-v1';
import { LightningCombat } from './combat.js?v=20260818-witchselect-v1';
import { PouchInventory } from './inventory.js?v=20260818-witchselect-v1';
import { DebugTelemetry } from './debug.js?v=20260818-witchselect-v1';
import { AdaptiveQualityController, initialHardwareScaling, resolveQualityRequest } from './quality.js?v=20260818-witchselect-v1';
import { MobileQualificationRecorder } from './qualification.js?v=20260818-witchselect-v1';
import { RemotePlayerReplica, SimulatedTeammateFeed } from './remote-player.js?v=20260818-witchselect-v1';
import { GreenWitchAbilities } from './green-witch.js?v=20260818-witchselect-v1';
import { CharacterSelectionFlow, PLAYABLE_WITCHES } from './character-selection.js?v=20260818-witchselect-v1';

const moduleStartedAt = performance.now();
const qualityRequest = resolveQualityRequest();
const loading = document.querySelector('#loading');
const loadingCopy = document.querySelector('#loading-copy');

function showFatalError(error) {
  loadingCopy.textContent = `The technical proof could not start: ${error.message}`;
  loading.querySelector('strong').textContent = 'Renderer unavailable';
  loading.querySelector('span').style.animation = 'none';
  loading.querySelector('span').style.borderColor = '#ff759f';
  console.error(error);
}

try {
  if (!window.BABYLON) throw new Error('Babylon.js did not load from the experimental CDN');
  const BABYLON = window.BABYLON;
  const canvas = document.querySelector('#render-canvas');
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    adaptToDeviceRatio: true,
    powerPreference: 'high-performance'
  });
  engine.setHardwareScalingLevel(initialHardwareScaling(qualityRequest));
  const qualityController = new AdaptiveQualityController(engine, qualityRequest);

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromHexString('#0a0718ff');
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = .022;
  scene.fogColor = BABYLON.Color3.FromHexString('#17102a');
  scene.imageProcessingConfiguration.contrast = 1.12;
  scene.imageProcessingConfiguration.exposure = 1.02;

  const ambient = new BABYLON.HemisphericLight('moon-ambient', new BABYLON.Vector3(0, 1, 0), scene);
  ambient.diffuse = BABYLON.Color3.FromHexString('#a894d1');
  ambient.groundColor = BABYLON.Color3.FromHexString('#21172d');
  ambient.intensity = .72;
  const moonLight = new BABYLON.DirectionalLight('moon-key', new BABYLON.Vector3(.35, -1, .45), scene);
  moonLight.position.set(-8, 13, -5);
  moonLight.diffuse = BABYLON.Color3.FromHexString('#d9d2ff');
  moonLight.intensity = 1.35;
  const shadowGenerator = new BABYLON.ShadowGenerator(qualityRequest.profile?.shadowMapSize || 1024, moonLight);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.bias = .0005;
  const sceneInstrumentation = new BABYLON.SceneInstrumentation(scene);

  const world = createWorld(BABYLON, scene, shadowGenerator);
  const purpleWitch = createPlaceholderWitch(BABYLON, scene, shadowGenerator, { label: 'Purple Witch' });
  const dragon = createPlaceholderDragon(BABYLON, scene, shadowGenerator, world.dragonPosition);
  const controller = new CharacterController(BABYLON, world);
  const greenWitch = createPlaceholderWitch(BABYLON, scene, shadowGenerator, {
    id: 'green-witch',
    label: 'Green Witch',
    palette: {
      primary: '#1f5b35',
      primaryLight: '#388455',
      accent: '#76b95d',
      hair: '#453724',
      hairEmissive: '#0f160b',
      leather: '#324128',
      wood: '#58492c',
      orb: '#e4ffd5',
      orbEmissive: '#42ad58',
      orbCast: '#c8ff9e',
      orbLight: '#7dff91',
      label: '#c5ffd0'
    }
  });
  const initialPlayerState = controller.snapshot();
  const greenReplica = new RemotePlayerReplica(BABYLON, greenWitch, {
    sequence: 0,
    sentAt: performance.now() / 1000,
    position: { x: 1.15, y: 0, z: -9.85 },
    facingYaw: initialPlayerState.facingYaw,
    speed: 0,
    grounded: true,
    crouched: false,
    state: 'IDLE'
  });
  const greenSimulation = new SimulatedTeammateFeed(greenReplica, initialPlayerState);
  let selectedCharacter = 'purple';
  let localWitch = purpleWitch;
  let remoteWitch = greenWitch;
  controller.addDynamicObstacle(dragon);
  const mobile = matchMedia('(pointer:coarse)').matches;
  const shoulderCamera = new ShoulderCamera(BABYLON, scene, world, mobile);
  shoulderCamera.addBlockers(dragon.meshes);
  const input = new ProofInput(canvas);
  const combat = new LightningCombat(BABYLON, scene, shoulderCamera, purpleWitch, dragon, controller);
  const greenAbilities = new GreenWitchAbilities(BABYLON, scene, greenWitch, purpleWitch, dragon, combat);
  const inventory = new PouchInventory(BABYLON, scene, shadowGenerator, controller, combat);
  const telemetry = new DebugTelemetry(engine, scene, sceneInstrumentation, moduleStartedAt);
  const toast = document.querySelector('#toast');
  const routePanel = document.querySelector('.route-panel');
  const routeObjective = document.querySelector('#route-objective');
  const routeProgress = document.querySelector('#route-progress');
  let toastTimer = 0;
  let completed = false;
  let qualification = null;
  let openingFlow = null;

  const showMessage = message => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1500);
  };
  const greenSpellName = spell => spell === 'restore' || spell === 'frost' ? 'restore' : 'vineTrap';
  const selectActiveSpell = spell => selectedCharacter === 'green'
    ? greenAbilities.selectSpell(greenSpellName(spell))
    : combat.selectSpell(spell);
  const castActiveSpell = spell => {
    const now = performance.now() / 1000;
    if (selectedCharacter !== 'green') return combat.cast(now, spell);
    if (spell) greenAbilities.selectSpell(greenSpellName(spell), false);
    return greenAbilities.castSelected(now);
  };
  input.onCast = castActiveSpell;
  input.onSelectSpell = selectActiveSpell;
  input.onShoulder = () => {
    shoulderCamera.switchShoulder();
    showMessage(`${shoulderCamera.side === 1 ? 'Right' : 'Left'} shoulder selected`);
  };
  input.onPouch = () => inventory.toggle();
  input.onMessage = showMessage;
  combat.onMessage = showMessage;
  inventory.onMessage = showMessage;
  greenAbilities.onMessage = showMessage;
  inventory.onOpenChange = open => input.setModalOpen(open);
  input.onGreenVine = () => greenAbilities.castVineTrap(performance.now() / 1000);
  input.onGreenRestore = () => greenAbilities.castSmartRestore(performance.now() / 1000);
  document.querySelector('#green-vine-demo').addEventListener('click', () => input.onGreenVine());
  document.querySelector('#green-restore-demo').addEventListener('click', () => input.onGreenRestore());

  const playerNameCopy = document.querySelector('#player-character-name');
  const teammateNameCopy = document.querySelector('#teammate-character-name');
  const playerVitals = document.querySelector('#player-vitals');
  const teammatePanel = document.querySelector('#green-witch-party');
  const greenPartyActions = document.querySelector('#green-party-actions');
  const pouchCharacterName = document.querySelector('#pouch-character-name');
  const touchSpellButtons = [...document.querySelectorAll('.spell-rack button[data-spell]')];
  const spellRackPresentation = {
    purple: [
      { id: 'lightning', symbol: 'ϟ', label: 'Lightning' },
      { id: 'frost', symbol: '❄', label: 'Frost' },
      { id: 'aegis', symbol: '◯', label: 'Aegis' }
    ],
    green: [
      { id: 'vineTrap', symbol: '⌁', label: 'Vine Trap' },
      { id: 'restore', symbol: '+', label: 'Restore' }
    ]
  };

  const updateCharacterInterface = () => {
    const local = PLAYABLE_WITCHES[selectedCharacter];
    const remoteCharacterId = selectedCharacter === 'purple' ? 'green' : 'purple';
    const remote = PLAYABLE_WITCHES[remoteCharacterId];
    playerNameCopy.textContent = local.name;
    teammateNameCopy.textContent = remote.name;
    pouchCharacterName.textContent = local.name;
    playerVitals.setAttribute('aria-label', `${local.name} health and protection`);
    teammatePanel.setAttribute('aria-label', `Simulated ${remote.name} teammate`);
    playerVitals.classList.toggle('is-green', selectedCharacter === 'green');
    teammatePanel.classList.toggle('is-purple', remoteCharacterId === 'purple');
    greenPartyActions.hidden = selectedCharacter === 'green';
    const entries = spellRackPresentation[selectedCharacter];
    for (const [index, button] of touchSpellButtons.entries()) {
      const entry = entries[index];
      button.hidden = !entry;
      button.disabled = !entry;
      if (!entry) continue;
      button.dataset.spell = entry.id;
      button.querySelector('b').textContent = entry.symbol;
      button.querySelector('span').textContent = entry.label;
      button.classList.toggle('is-selected', index === 0);
    }
    if (selectedCharacter === 'purple') combat.updateSpellSelection(false);
    else greenAbilities.updateSpellSelection(false);
  };

  const selectLocalCharacter = characterId => {
    if (!PLAYABLE_WITCHES[characterId]) return false;
    selectedCharacter = characterId;
    localWitch = characterId === 'green' ? greenWitch : purpleWitch;
    remoteWitch = characterId === 'green' ? purpleWitch : greenWitch;
    purpleWitch.root.scaling.set(1, 1, 1);
    greenWitch.root.scaling.set(1, 1, 1);
    purpleWitch.setPresentationOffset();
    greenWitch.setPresentationOffset();
    purpleWitch.setNameplateVisible(remoteWitch === purpleWitch);
    greenWitch.setNameplateVisible(remoteWitch === greenWitch);
    greenReplica.setPresentation(remoteWitch);
    greenSimulation.reset(controller.snapshot());
    combat.setWitch(localWitch, PLAYABLE_WITCHES[characterId].name);
    combat.setSpellcastingEnabled(characterId === 'purple');
    greenAbilities.setMode({ locallyControlled: characterId === 'green', friendWitch: purpleWitch });
    updateCharacterInterface();
    return true;
  };

  const updateRouteHud = worldState => {
    const checkpointKeys = ['arch', 'jump', 'crouch', 'arena', 'dragon', 'exit'];
    const completedCheckpoints = checkpointKeys.filter(key => worldState.route[key]).length;
    routeObjective.textContent = worldState.objective;
    routeProgress.textContent = `${completedCheckpoints} / ${checkpointKeys.length} checkpoints`;
    routePanel.classList.toggle('is-complete', worldState.complete);
  };
  updateRouteHud(world.snapshot());

  const startProof = (characterId = 'purple') => {
    if (!selectLocalCharacter(characterId)) return false;
    openingFlow?.complete(characterId);
    document.querySelector('#start-overlay').classList.add('is-hidden');
    document.querySelector('#hud').classList.add('is-active');
    input.start();
    qualification?.recordEvent('gameplay-start');
    showMessage('Cross the Moon Gate · find the corner chest and arena potions · P opens the pouch');
    return true;
  };

  openingFlow = new CharacterSelectionFlow({
    onConfirm: characterId => startProof(characterId),
    onPreviewChange: (selectedId, focusedId, step) => {
      if (step === 'COMPLETE') return;
      purpleWitch.setNameplateVisible(true);
      greenWitch.setNameplateVisible(true);
      const emphasized = selectedId || focusedId || null;
      const hasEmphasis = Boolean(emphasized);
      const previewScale = characterId => emphasized === characterId ? 1.24 : hasEmphasis ? .88 : 1;
      purpleWitch.root.scaling.setAll(previewScale('purple'));
      greenWitch.root.scaling.setAll(previewScale('green'));
      purpleWitch.setPresentationOffset(emphasized === 'purple' ? 3.15 : 0, 0, emphasized === 'purple' ? .3 : 0);
      greenWitch.setPresentationOffset(emphasized === 'green' ? 2 : 0, 0, emphasized === 'green' ? .3 : 0);
    }
  });

  const resetTechnicalRoute = () => {
    completed = false;
    input.clearHeldInput();
    input.setCrouched(false);
    input.active = true;
    input.updateBlockedState();
    world.reset();
    dragon.reset();
    combat.reset();
    inventory.reset();
    controller.reset();
    greenAbilities.reset();
    greenSimulation.reset(controller.snapshot());
    updateCharacterInterface();
    shoulderCamera.setLook(0, 0);
    shoulderCamera.snapNextUpdate();
    updateRouteHud(world.snapshot());
    showMessage('Qualification route reset · begin at the Moon Gate');
  };
  combat.onPlayerDefeated = () => setTimeout(resetTechnicalRoute, 850);

  const snapshotProof = () => ({
    ready: scene.isReady(),
    active: input.active,
    opening: openingFlow?.snapshot() || null,
    characterSelection: {
      selectedCharacter: openingFlow?.completed ? selectedCharacter : openingFlow?.selectedCharacter || null,
      localCharacter: input.active ? selectedCharacter : null,
      remoteCharacter: input.active ? selectedCharacter === 'purple' ? 'green' : 'purple' : null,
      localName: input.active ? PLAYABLE_WITCHES[selectedCharacter].name : null,
      remoteName: input.active ? PLAYABLE_WITCHES[selectedCharacter === 'purple' ? 'green' : 'purple'].name : null,
      previewName: !input.active && openingFlow?.selectedCharacter
        ? PLAYABLE_WITCHES[openingFlow.selectedCharacter].name
        : null
    },
    input: {
      pointerLocked: input.pointerLocked,
      aiming: input.aiming,
      sprinting: input.sprinting,
      blocked: input.blocked,
      movement: input.movementAxes(),
      heldActions: input.heldActionNames(),
      pendingActions: input.pendingActionNames(),
      modalOpen: input.modalOpen,
      coarsePointer: matchMedia('(pointer:coarse)').matches
    },
    player: controller.snapshot(),
    camera: shoulderCamera.snapshot(input.aiming),
    witch: localWitch.snapshot(),
    purpleWitch: { presentation: purpleWitch.snapshot() },
    greenWitch: {
      replica: greenReplica.snapshot(),
      simulation: greenSimulation.snapshot(),
      presentation: greenWitch.snapshot(),
      abilities: greenAbilities.snapshot()
    },
    teammate: {
      character: selectedCharacter === 'purple' ? 'green' : 'purple',
      replica: greenReplica.snapshot(),
      simulation: greenSimulation.snapshot(),
      presentation: remoteWitch.snapshot()
    },
    dragon: dragon.snapshot(),
    combat: combat.snapshot(),
    inventory: inventory.snapshot(),
    world: world.snapshot(),
    performance: telemetry.snapshot(),
    quality: qualityController.snapshot(),
    meshCount: scene.meshes.length,
    engine: `Babylon.js WebGL ${engine.webGLVersion}`
  });

  qualification = new MobileQualificationRecorder({
    canvas,
    telemetry,
    qualityController,
    getState: snapshotProof,
    resetRoute: resetTechnicalRoute
  });

  let lastTime = performance.now();
  engine.runRenderLoop(() => {
    const nowMilliseconds = performance.now();
    const now = nowMilliseconds / 1000;
    const measuredDeltaTime = Math.max(.001, (nowMilliseconds - lastTime) / 1000);
    const deltaTime = Math.min(.05, measuredDeltaTime);
    lastTime = nowMilliseconds;
    shoulderCamera.updateLook(input);
    controller.update(input, shoulderCamera.yaw, deltaTime);
    shoulderCamera.update(controller, input, deltaTime, localWitch);
    localWitch.update(controller, input, deltaTime, now);
    const currentPlayerState = controller.snapshot();
    greenSimulation.update(now, currentPlayerState);
    greenReplica.update(deltaTime, now);
    dragon.update(now, deltaTime);
    combat.update();
    greenAbilities.update(now, selectedCharacter === 'green' ? shoulderCamera : null);
    inventory.update(now, deltaTime);
    const routeEvents = world.update(controller, dragon, deltaTime);
    const worldState = world.snapshot();
    for (const event of routeEvents) showMessage(event.message);
    if (worldState.complete && !completed) {
      completed = true;
      input.active = false;
      input.clearHeldInput();
      document.exitPointerLock?.();
    }
    updateRouteHud(worldState);
    scene.render();
    telemetry.markFirstRenderedFrame();
    qualityController.update(nowMilliseconds);
    const playerState = controller.snapshot();
    const cameraState = shoulderCamera.snapshot(input.aiming);
    const combatState = combat.snapshot();
    const dragonState = dragon.snapshot();
    const witchState = localWitch.snapshot();
    telemetry.update(
      now,
      measuredDeltaTime,
      playerState,
      cameraState,
      combatState,
      dragonState,
      worldState,
      witchState
    );
    qualification?.update(nowMilliseconds, {
      player: playerState,
      camera: cameraState,
      combat: combatState,
      dragon: dragonState,
      witch: witchState,
      world: worldState
    });
  });

  const resize = () => engine.resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', resize);
  addEventListener('blur', () => telemetry.recordLifecycle('blur'));
  addEventListener('focus', () => telemetry.recordLifecycle('focus'));
  document.addEventListener('visibilitychange', () => telemetry.recordLifecycle(document.hidden ? 'hidden' : 'visible'));
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    telemetry.recordLifecycle('contextLost');
    input.clearHeldInput();
    showMessage('WebGL context lost · waiting for recovery');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    telemetry.recordLifecycle('contextRestored');
    showMessage('WebGL context restored');
  });

  scene.executeWhenReady(() => {
    telemetry.markReady();
    loading.classList.add('is-hidden');
    loading.setAttribute('aria-hidden', 'true');
  });

  window.__HMW_THIRD_PERSON_PROOF__ = Object.freeze({
    start: startProof,
    snapshot: snapshotProof,
    showCharacterSelection: () => openingFlow.showSelection(),
    selectCharacter: characterId => openingFlow.select(characterId),
    confirmCharacterSelection: () => openingFlow.confirm(),
    setMovement: (x, y, sprint = false) => {
      input.move.x = Math.max(-1, Math.min(1, x));
      input.move.y = Math.max(-1, Math.min(1, y));
      if (sprint) input.keys.add('ShiftLeft'); else input.keys.delete('ShiftLeft');
    },
    stopMovement: () => { input.move.x = 0; input.move.y = 0; input.keys.delete('ShiftLeft'); },
    look: (yawDelta, pitchDelta = 0) => { input.lookDelta.x += yawDelta; input.lookDelta.y += pitchDelta; },
    setLook: (yaw, pitch) => shoulderCamera.setLook(yaw, pitch),
    setAim: value => { input.aiming = Boolean(value); },
    jump: () => input.actions.add('jump'),
    crouch: () => input.toggleCrouch(),
    setCrouched: value => input.setCrouched(value),
    switchShoulder: () => shoulderCamera.switchShoulder(),
    selectSpell: selectActiveSpell,
    castSpell: castActiveSpell,
    castLightning: () => combat.cast(performance.now() / 1000, 'lightning'),
    castFrost: () => combat.cast(performance.now() / 1000, 'frost'),
    castAegis: () => combat.cast(performance.now() / 1000, 'aegis'),
    castGreenVine: () => greenAbilities.castVineTrap(performance.now() / 1000),
    castGreenRestore: (target = 'smart') => target === 'smart'
      ? greenAbilities.castSmartRestore(performance.now() / 1000)
      : greenAbilities.castRestore(performance.now() / 1000, target === 'friend'),
    setGreenRestoreFriendTargeted: value => greenAbilities.setFriendTargeted(value),
    damageGreenWitch: amount => greenAbilities.receiveDamage(amount),
    resetGreenWitch: () => greenAbilities.reset(),
    setGreenSimulationEnabled: value => greenSimulation.setEnabled(value),
    receiveGreenSnapshot: snapshot => greenReplica.receiveSnapshot(snapshot),
    receiveDragonDamage: amount => combat.receiveDragonDamage(amount),
    togglePouch: () => inventory.toggle(),
    useHealthBerry: () => inventory.useHealthBerry(),
    useLightningPotion: () => inventory.useLightningPotion(),
    useAegisPotion: () => inventory.useAegisPotion(),
    teleport: (x, y, z) => { controller.teleport(x, y, z); shoulderCamera.snapNextUpdate(); },
    resetRoute: resetTechnicalRoute,
    resetPerformance: () => telemetry.reset(),
    dispose: () => {
      engine.stopRenderLoop();
      openingFlow.dispose();
      qualification?.dispose();
      sceneInstrumentation.dispose();
      scene.dispose();
      engine.dispose();
    }
  });
  window.__HMW_MOBILE_QUALIFICATION__ = Object.freeze({
    enabled: qualification.enabled,
    start: () => qualification.start(),
    end: () => qualification.end(),
    resetRoute: () => qualification.resetRoute(),
    snapshot: () => qualification.snapshot()
  });
} catch (error) {
  showFatalError(error);
}
