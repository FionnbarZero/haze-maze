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
  mouseSensitivity: 0.00225,
  touchSensitivity: 0.006
});

export const PLAYER = Object.freeze({
  standingHeight: 1.75,
  crouchingHeight: 1.15,
  radius: 0.32,
  walkSpeed: 3,
  sprintSpeed: 4.5,
  crouchSpeed: 1.75,
  gravity: 18,
  jumpVelocity: 6.25,
  turnResponse: 0.1,
  start: Object.freeze({ x: 0, y: 0, z: -10.5 })
});

export const COMBAT = Object.freeze({
  lightningRange: 30,
  lightningDamage: 25,
  lightningCooldown: 0.38,
  dragonHealth: 100
});

export const WORLD = Object.freeze({
  floorWidth: 16,
  floorDepth: 30,
  wallHeight: 3.4,
  wallThickness: 0.5
});
