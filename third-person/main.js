import { createWorld } from './world.js';
import { createPlaceholderWitch } from './witch.js';
import { createPlaceholderDragon } from './dragon.js';
import { ProofInput } from './input.js';
import { CharacterController } from './controller.js';
import { ShoulderCamera } from './camera.js';
import { LightningCombat } from './combat.js';
import { DebugTelemetry } from './debug.js';

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
  engine.setHardwareScalingLevel(Math.max(1, (devicePixelRatio || 1) / 1.6));

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
  const shadowGenerator = new BABYLON.ShadowGenerator(1024, moonLight);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.bias = .0005;

  const world = createWorld(BABYLON, scene, shadowGenerator);
  const witch = createPlaceholderWitch(BABYLON, scene, shadowGenerator);
  const dragon = createPlaceholderDragon(BABYLON, scene, shadowGenerator, world.dragonPosition);
  const controller = new CharacterController(BABYLON, world);
  const mobile = matchMedia('(pointer:coarse)').matches;
  const shoulderCamera = new ShoulderCamera(BABYLON, scene, world, mobile);
  const input = new ProofInput(canvas);
  const combat = new LightningCombat(BABYLON, scene, shoulderCamera, witch, dragon);
  const telemetry = new DebugTelemetry(engine);
  const toast = document.querySelector('#toast');
  let toastTimer = 0;

  const showMessage = message => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1500);
  };
  input.onCast = () => combat.cast(performance.now() / 1000);
  input.onShoulder = () => {
    shoulderCamera.switchShoulder();
    showMessage(`${shoulderCamera.side === 1 ? 'Right' : 'Left'} shoulder selected`);
  };
  input.onMessage = showMessage;
  combat.onMessage = showMessage;

  const startProof = () => {
    document.querySelector('#start-overlay').classList.add('is-hidden');
    document.querySelector('#hud').classList.add('is-active');
    input.start();
    showMessage('Walk through the Moon Arch · jump the relic · crouch beneath the lintel');
  };
  document.querySelector('#start-proof').addEventListener('click', startProof);

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
    witch.update(controller, deltaTime, now);
    dragon.update(now, deltaTime);
    combat.update();
    telemetry.update(now, measuredDeltaTime, controller.snapshot(), shoulderCamera.snapshot(input.aiming));
    scene.render();
  });

  const resize = () => engine.resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', resize);

  scene.executeWhenReady(() => {
    loading.classList.add('is-hidden');
    loading.setAttribute('aria-hidden', 'true');
  });

  window.__HMW_THIRD_PERSON_PROOF__ = Object.freeze({
    start: startProof,
    snapshot: () => ({
      ready: scene.isReady(),
      active: input.active,
      input: {
        pointerLocked: input.pointerLocked,
        aiming: input.aiming,
        movement: input.movementAxes(),
        coarsePointer: matchMedia('(pointer:coarse)').matches
      },
      player: controller.snapshot(),
      camera: shoulderCamera.snapshot(input.aiming),
      dragon: { health: dragon.health, alive: dragon.alive },
      combat: {
        targeted: combat.targeted,
        lastCast: combat.lastCast,
        activeLightningStreams: scene.meshes.filter(mesh => mesh.name.startsWith('lightning-stream-')).length
      },
      performance: telemetry.snapshot(),
      meshCount: scene.meshes.length,
      engine: `Babylon.js WebGL ${engine.webGLVersion}`
    }),
    setMovement: (x, y, sprint = false) => {
      input.move.x = Math.max(-1, Math.min(1, x));
      input.move.y = Math.max(-1, Math.min(1, y));
      if (sprint) input.keys.add('ShiftLeft'); else input.keys.delete('ShiftLeft');
    },
    stopMovement: () => { input.move.x = 0; input.move.y = 0; input.keys.delete('ShiftLeft'); },
    look: (yawDelta, pitchDelta = 0) => { input.lookDelta.x += yawDelta; input.lookDelta.y += pitchDelta; },
    jump: () => input.actions.add('jump'),
    crouch: () => input.toggleCrouch(),
    switchShoulder: () => shoulderCamera.switchShoulder(),
    castLightning: () => combat.cast(performance.now() / 1000),
    teleport: (x, y, z) => { controller.position.set(x, y, z); controller.velocityY = 0; },
    dispose: () => { engine.stopRenderLoop(); scene.dispose(); engine.dispose(); }
  });
} catch (error) {
  showFatalError(error);
}
