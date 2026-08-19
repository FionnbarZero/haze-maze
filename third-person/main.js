import { createWorld } from './world.js?v=20260818-rewards-v1';
import { createPlaceholderWitch } from './witch.js?v=20260818-rewards-v1';
import { createPlaceholderDragon } from './dragon.js?v=20260818-rewards-v1';
import { ProofInput } from './input.js?v=20260818-inputqueue-v1';
import { CharacterController } from './controller.js?v=20260818-inputqueue-v1';
import { ShoulderCamera } from './camera.js?v=20260818-rewards-v1';
import { LightningCombat } from './combat.js?v=20260818-rewards-v1';
import { PouchInventory } from './inventory.js?v=20260818-rewards-v1';
import { DebugTelemetry } from './debug.js?v=20260818-rewards-v1';
import { AdaptiveQualityController, initialHardwareScaling, resolveQualityRequest } from './quality.js?v=20260818-rewards-v1';
import { MobileQualificationRecorder } from './qualification.js?v=20260818-rewards-v1';

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
  const witch = createPlaceholderWitch(BABYLON, scene, shadowGenerator);
  const dragon = createPlaceholderDragon(BABYLON, scene, shadowGenerator, world.dragonPosition);
  const controller = new CharacterController(BABYLON, world);
  controller.addDynamicObstacle(dragon);
  const mobile = matchMedia('(pointer:coarse)').matches;
  const shoulderCamera = new ShoulderCamera(BABYLON, scene, world, mobile);
  shoulderCamera.addBlockers(dragon.meshes);
  const input = new ProofInput(canvas);
  const combat = new LightningCombat(BABYLON, scene, shoulderCamera, witch, dragon, controller);
  const inventory = new PouchInventory(BABYLON, scene, shadowGenerator, controller, combat);
  const telemetry = new DebugTelemetry(engine, scene, sceneInstrumentation, moduleStartedAt);
  const toast = document.querySelector('#toast');
  const routePanel = document.querySelector('.route-panel');
  const routeObjective = document.querySelector('#route-objective');
  const routeProgress = document.querySelector('#route-progress');
  let toastTimer = 0;
  let completed = false;
  let qualification = null;

  const showMessage = message => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1500);
  };
  input.onCast = spell => combat.cast(performance.now() / 1000, spell);
  input.onSelectSpell = spell => combat.selectSpell(spell);
  input.onShoulder = () => {
    shoulderCamera.switchShoulder();
    showMessage(`${shoulderCamera.side === 1 ? 'Right' : 'Left'} shoulder selected`);
  };
  input.onPouch = () => inventory.toggle();
  input.onMessage = showMessage;
  combat.onMessage = showMessage;
  inventory.onMessage = showMessage;
  inventory.onOpenChange = open => input.setModalOpen(open);

  const updateRouteHud = worldState => {
    const checkpointKeys = ['arch', 'jump', 'crouch', 'arena', 'dragon', 'exit'];
    const completedCheckpoints = checkpointKeys.filter(key => worldState.route[key]).length;
    routeObjective.textContent = worldState.objective;
    routeProgress.textContent = `${completedCheckpoints} / ${checkpointKeys.length} checkpoints`;
    routePanel.classList.toggle('is-complete', worldState.complete);
  };
  updateRouteHud(world.snapshot());

  const startProof = () => {
    document.querySelector('#start-overlay').classList.add('is-hidden');
    document.querySelector('#hud').classList.add('is-active');
    input.start();
    qualification?.recordEvent('gameplay-start');
    showMessage('Cross the Moon Arch · find the corner chest and arena potions · P opens the pouch');
  };
  document.querySelector('#start-proof').addEventListener('click', startProof);

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
    shoulderCamera.setLook(0, 0);
    shoulderCamera.snapNextUpdate();
    updateRouteHud(world.snapshot());
    showMessage('Qualification route reset · begin at the Moon Arch');
  };
  combat.onPlayerDefeated = () => setTimeout(resetTechnicalRoute, 850);

  const snapshotProof = () => ({
    ready: scene.isReady(),
    active: input.active,
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
    witch: witch.snapshot(),
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
    shoulderCamera.update(controller, input, deltaTime, witch);
    witch.update(controller, input, deltaTime, now);
    dragon.update(now, deltaTime);
    combat.update();
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
    const witchState = witch.snapshot();
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
    selectSpell: spell => combat.selectSpell(spell),
    castSpell: spell => combat.cast(performance.now() / 1000, spell),
    castLightning: () => combat.cast(performance.now() / 1000, 'lightning'),
    castFrost: () => combat.cast(performance.now() / 1000, 'frost'),
    castAegis: () => combat.cast(performance.now() / 1000, 'aegis'),
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
