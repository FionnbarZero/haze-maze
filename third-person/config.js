export const CAMERA = Object.freeze({
  explorationDistance: 3.6,
  explorationShoulder: 0.62,
  explorationFovDesktop: 60,
  explorationFovMobile: 64,
  aimDistance: 3.05,
  aimShoulder: 0.72,
  aimFov: 54,
  pivotHeight: 1.45,
  verticalOffset: 0.25,
  minPitch: -50 * Math.PI / 180,
  maxPitch: 35 * Math.PI / 180,
  probeRadius: 0.22,
  collisionMargin: 0.1,
  minimumDistance: 0.85,
  positionResponse: 0.09,
  collisionResponse: 0.03,
  recoveryResponse: 0.18,
  shoulderResponse: 0.08,
  crouchPivotResponse: 0.14,
  occludedVisibility: 0.42,
  proximityFadeDistance: 1.15
});

export const PLAYER = Object.freeze({
  maximumHealth: 100,
  standingHeight: 1.75,
  crouchingHeight: 1.15,
  radius: 0.32,
  walkSpeed: 3,
  sprintSpeed: 4.5,
  crouchSpeed: 1.75,
  gravity: 18,
  jumpVelocity: 6.25,
  turnResponse: 0.1,
  aimTurnResponse: 0.065,
  castTurnResponse: 0.055,
  castFacingDuration: 0.52,
  backpedalMultiplier: 0.78,
  maximumSweepStep: 0.055,
  groundProbe: 0.08,
  jumpBuffer: 0.12,
  coyoteTime: 0.08,
  landingDuration: 0.18,
  start: Object.freeze({ x: 0, y: 0, z: -10.5 })
});

export const INPUT = Object.freeze({
  mouseSensitivity: 0.00225,
  touchHorizontalSensitivity: 0.006,
  touchVerticalSensitivity: 0.006,
  invertVertical: false,
  joystickDeadZone: 0.13,
  touchSprintThreshold: 0.88
});

export const DESKTOP_ACTIONS = Object.freeze({
  KeyW: 'moveForward',
  ArrowUp: 'moveForward',
  KeyS: 'moveBackward',
  ArrowDown: 'moveBackward',
  KeyA: 'moveLeft',
  ArrowLeft: 'moveLeft',
  KeyD: 'moveRight',
  ArrowRight: 'moveRight',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'jump',
  KeyC: 'crouch',
  ControlLeft: 'crouch',
  ControlRight: 'crouch',
  KeyV: 'shoulderSwitch',
  KeyP: 'pouch',
  Digit1: 'selectLightning',
  Digit2: 'selectFrost',
  Digit3: 'selectAegis'
});

export const POUCH = Object.freeze({
  healthBerryRestore: 30,
  pickupRadius: 1.05,
  chestPickupRadius: 1.35,
  berryBushes: Object.freeze([
    Object.freeze({ id: 'corridor', x: -1.62, y: 0, z: 2.1 }),
    Object.freeze({ id: 'arena-west', x: -4.65, y: 0, z: 8.15 }),
    Object.freeze({ id: 'arena-east', x: 4.65, y: 0, z: 12.05 })
  ]),
  goldChest: Object.freeze({ id: 'arena-northwest', x: -6.35, y: 0, z: 13.15, gold: 50 }),
  powerups: Object.freeze([
    Object.freeze({ id: 'storm-tonic', type: 'lightning', x: 5.8, y: 0, z: 5.05 }),
    Object.freeze({ id: 'aegis-tonic', type: 'aegis', x: -5.85, y: 0, z: 10.45 })
  ])
});

export const COMBAT = Object.freeze({
  spellRange: 30,
  lightningRange: 30,
  lightningDamage: 25,
  lightningPotionDamageMultiplier: 2,
  lightningPotionDuration: 15,
  lightningCooldown: 0.38,
  lightningEffectDuration: 0.22,
  frostCooldown: 4.5,
  frostDuration: 3.5,
  frostEffectDuration: 0.34,
  aegisCooldown: 8,
  aegisDuration: 5,
  aegisPotionDurationMultiplier: 2,
  dragonAttackRange: 2.75,
  dragonAttackWindup: 0.9,
  dragonAttackInterval: 1.8,
  dragonAttackDamage: 15,
  dragonAttackAnimationDuration: 0.46,
  staffRayTerminalTolerance: 0.12,
  aimAssistRadius: 1.18,
  aimAssistWallTolerance: 0.08,
  dragonAimHeight: 1.12,
  dragonCollisionRadius: 1.12,
  dragonCollisionHeight: 2.25,
  dragonHealth: 100,
  dragonDefeatDuration: 0.9
});

export const WORLD = Object.freeze({
  floorWidth: 16,
  floorDepth: 30,
  wallHeight: 3.4,
  wallThickness: 0.5,
  gateZ: 14.45,
  exitZ: 14.72,
  gateOpenHeight: 4.2,
  gateOpenResponse: 0.55
});

export const PERFORMANCE = Object.freeze({
  maximumSimulationDelta: 0.05,
  telemetrySamples: 36000,
  telemetryDomInterval: 0.12,
  renderScaleDivisor: 1.6,
  frameSpikeThresholdMs: 50
});

export const QUALITY_TIERS = Object.freeze({
  low: Object.freeze({
    label: 'Low',
    minimumScale: 0.7,
    maximumScale: 0.85,
    initialScale: 0.8,
    targetFps: 30,
    shadowMapSize: 512
  }),
  balanced: Object.freeze({
    label: 'Balanced',
    minimumScale: 0.85,
    maximumScale: 1,
    initialScale: 0.92,
    targetFps: 60,
    shadowMapSize: 1024
  }),
  high: Object.freeze({
    label: 'High',
    minimumScale: 1,
    maximumScale: 1.25,
    initialScale: 1.1,
    targetFps: 60,
    shadowMapSize: 1024
  })
});
