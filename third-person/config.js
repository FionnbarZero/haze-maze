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
  start: Object.freeze({ x: 0, y: 0, z: -24.2 })
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
  KeyO: 'cast',
  Digit1: 'selectLightning',
  Digit2: 'selectFrost',
  Digit3: 'selectAegis',
  KeyG: 'greenVineDemo',
  KeyH: 'greenRestoreDemo'
});

export const GREEN_WITCH = Object.freeze({
  maximumHealth: 100,
  snapshotInterval: 0.1,
  interpolationResponse: 0.12,
  companionSideOffset: 1.15,
  companionForwardOffset: 0.65,
  vineTrapCooldown: 6,
  vineTrapDuration: 3.5,
  vineTrapRange: 7.5,
  restoreCooldown: 5,
  restoreAmount: 30,
  restoreRange: 8
});

export const POUCH = Object.freeze({
  healthBerryRestore: 30,
  pickupRadius: 1.05,
  chestPickupRadius: 1.35,
  geodeMineRadius: 1.42,
  geodePowerPerCrystal: .1,
  firstDoorRunes: 2,
  requiredRunes: 4,
  berryBushes: Object.freeze([
    Object.freeze({ id: 'berry-southwest-a', x: -9, y: 0, z: -22 }),
    Object.freeze({ id: 'berry-southeast-a', x: 9, y: 0, z: -22 }),
    Object.freeze({ id: 'berry-southwest-b', x: -9, y: 0, z: -13 }),
    Object.freeze({ id: 'berry-southeast-b', x: 9, y: 0, z: -13 }),
    Object.freeze({ id: 'berry-midwest-a', x: -9, y: 0, z: -1 }),
    Object.freeze({ id: 'berry-mideast-a', x: 9, y: 0, z: -1 }),
    Object.freeze({ id: 'berry-midwest-b', x: -9, y: 0, z: 9 }),
    Object.freeze({ id: 'berry-mideast-b', x: 9, y: 0, z: 9 }),
    Object.freeze({ id: 'berry-northwest-a', x: -9, y: 0, z: 18 }),
    Object.freeze({ id: 'berry-northeast-a', x: 9, y: 0, z: 18 }),
    Object.freeze({ id: 'berry-northwest-b', x: -9, y: 0, z: 23 }),
    Object.freeze({ id: 'berry-northeast-b', x: 9, y: 0, z: 23 })
  ]),
  goldChest: Object.freeze({ id: 'moon-vault', x: 0, y: 0, z: 12, gold: 50 }),
  powerups: Object.freeze([
    Object.freeze({ id: 'storm-tonic-southwest', type: 'lightning', x: -8.8, y: 0, z: -18 }),
    Object.freeze({ id: 'aegis-tonic-southeast', type: 'aegis', x: 8.8, y: 0, z: -18 }),
    Object.freeze({ id: 'storm-tonic-south-mid', type: 'lightning', x: -8.8, y: 0, z: -9 }),
    Object.freeze({ id: 'aegis-tonic-south-mid', type: 'aegis', x: 8.8, y: 0, z: -9 }),
    Object.freeze({ id: 'storm-tonic-north-mid', type: 'lightning', x: -8.8, y: 0, z: 9 }),
    Object.freeze({ id: 'aegis-tonic-north-mid', type: 'aegis', x: 8.8, y: 0, z: 9 }),
    Object.freeze({ id: 'storm-tonic-north', type: 'lightning', x: -8.8, y: 0, z: 18 }),
    Object.freeze({ id: 'aegis-tonic-north', type: 'aegis', x: 8.8, y: 0, z: 18 })
  ]),
  equipmentPickups: Object.freeze([
    Object.freeze({ id: 'crystal-geode-pick', type: 'geodePick', x: -1.6, y: 0, z: -20 }),
    Object.freeze({ id: 'geode-hammer', type: 'geodeHammer', x: 1.6, y: 0, z: -10 })
  ]),
  geodeRocks: Object.freeze([
    Object.freeze({ id: 'southwest-crystal-rock', x: -10.8, y: 0, z: -12.5 }),
    Object.freeze({ id: 'southeast-crystal-rock', x: 10.8, y: 0, z: -1 }),
    Object.freeze({ id: 'northwest-crystal-rock', x: -10.8, y: 0, z: 10 }),
    Object.freeze({ id: 'northeast-crystal-rock', x: 10.8, y: 0, z: 20.5 })
  ]),
  runes: Object.freeze([
    Object.freeze({ id: 'southwest-rune', source: 'southwestRoom', x: -8.7, y: 0, z: -21, available: true }),
    Object.freeze({ id: 'southeast-rune', source: 'southeastRoom', x: 8.7, y: 0, z: -10.5, available: true }),
    Object.freeze({ id: 'northwest-rune', source: 'northwestRoom', x: -8.7, y: 0, z: 9.5, available: true }),
    Object.freeze({ id: 'northeast-rune', source: 'northeastRoom', x: 8.7, y: 0, z: 20.5, available: true })
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
  iceLanceDamage: 30,
  iceLanceCooldown: 0.72,
  iceLanceEffectDuration: 0.3,
  fireballDamage: 28,
  fireballCooldown: 0.82,
  fireballEffectDuration: 0.38,
  fireRingCooldown: 9,
  fireRingDuration: 5,
  fireRingRadius: 1.58,
  aegisCooldown: 8,
  aegisDuration: 5,
  aegisPotionDurationMultiplier: 2,
  dragonAttackRange: 2.35,
  dragonAttackWindup: 1.35,
  dragonAttackInterval: 3.5,
  dragonAttackDamage: 10,
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

const DRAGON_PLACEMENT_SAFETY_MARGIN = .15;

export const WORLD = Object.freeze({
  floorWidth: 28,
  floorDepth: 52,
  wallHeight: 3.4,
  wallThickness: 0.5,
  entranceZ: -24.2,
  firstDoorZ: -5,
  gateZ: 25.45,
  exitZ: 25.72,
  gateOpenHeight: 4.2,
  gateOpenResponse: 0.55,
  exitDuration: 1.15,
  dragonCount: 10,
  aggressiveDragonRatio: 1,
  dragonPlacementSafetyMargin: DRAGON_PLACEMENT_SAFETY_MARGIN,
  chapterGeodeDragonSafetyMargin: DRAGON_PLACEMENT_SAFETY_MARGIN,
  chapterGeodeDragonClearance: COMBAT.dragonAttackRange
    + POUCH.geodeMineRadius
    + DRAGON_PLACEMENT_SAFETY_MARGIN,
  defaultMazeSeed: 'moonhollow-expanded-v1'
});

export const PERFORMANCE = Object.freeze({
  maximumSimulationDelta: 0.05,
  maximumSimulationCatchUp: 0.35,
  maximumSimulationSteps: 8,
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
