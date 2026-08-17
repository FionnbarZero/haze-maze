import { CAMERA } from './config.js';
import { clamp, damp } from './utils.js';

export class ShoulderCamera {
  constructor(BABYLON, scene, world, mobile = false) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.blockers = new Set(world.cameraBlockers);
    this.camera = new BABYLON.UniversalCamera('third-person-shoulder-camera', new BABYLON.Vector3(0, 2, -13), scene);
    this.camera.minZ = .08;
    this.camera.maxZ = 80;
    this.camera.fov = (mobile ? CAMERA.explorationFovMobile : CAMERA.explorationFovDesktop) * Math.PI / 180;
    this.camera.inputs.clear();
    scene.activeCamera = this.camera;
    this.mobile = mobile;
    this.yaw = 0;
    this.pitch = -.08;
    this.side = Number(localStorage.getItem('moonWitchShoulder')) === -1 ? -1 : 1;
    this.actualDistance = CAMERA.explorationDistance;
    this.desiredDistance = CAMERA.explorationDistance;
    this.colliding = false;
    this.collisionMesh = '';
    this.lastTargetPosition = this.camera.position.clone();
    this.initialized = false;
  }

  updateLook(input) {
    const look = input.consumeLook();
    this.yaw += look.x;
    this.pitch = clamp(this.pitch - look.y, CAMERA.minPitch, CAMERA.maxPitch);
  }

  switchShoulder() {
    this.side *= -1;
    localStorage.setItem('moonWitchShoulder', String(this.side));
  }

  update(player, input, deltaTime, witch) {
    const aiming = input.aiming;
    const desiredBoom = aiming ? CAMERA.aimDistance : CAMERA.explorationDistance;
    const desiredShoulder = (aiming ? CAMERA.aimShoulder : CAMERA.explorationShoulder) * this.side;
    const fovDegrees = aiming ? CAMERA.aimFov : this.mobile ? CAMERA.explorationFovMobile : CAMERA.explorationFovDesktop;
    this.camera.fov = damp(this.camera.fov, fovDegrees * Math.PI / 180, aiming ? .16 : .22, deltaTime);

    const crouchOffset = player.crouched ? -.32 : 0;
    const pivot = player.position.add(new this.BABYLON.Vector3(0, CAMERA.pivotHeight + CAMERA.verticalOffset + crouchOffset, 0));
    const cosPitch = Math.cos(this.pitch);
    const lookDirection = new this.BABYLON.Vector3(Math.sin(this.yaw) * cosPitch, Math.sin(this.pitch), Math.cos(this.yaw) * cosPitch).normalize();
    const right = new this.BABYLON.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = pivot.subtract(lookDirection.scale(desiredBoom)).add(right.scale(desiredShoulder));
    const boomVector = desired.subtract(pivot);
    const boomLength = boomVector.length();
    const boomDirection = boomVector.scale(1 / Math.max(.001, boomLength));

    let permitted = boomLength;
    let collisionMesh = '';
    const up = this.BABYLON.Vector3.Up();
    const offsets = [
      this.BABYLON.Vector3.Zero(),
      right.scale(CAMERA.probeRadius),
      right.scale(-CAMERA.probeRadius),
      up.scale(CAMERA.probeRadius),
      up.scale(-CAMERA.probeRadius)
    ];
    for (const offset of offsets) {
      const ray = new this.BABYLON.Ray(pivot.add(offset), boomDirection, boomLength);
      const hit = this.scene.pickWithRay(ray, mesh => this.blockers.has(mesh), false);
      if (hit?.hit && hit.distance < permitted) {
        permitted = hit.distance;
        collisionMesh = hit.pickedMesh?.name || 'geometry';
      }
    }

    this.colliding = permitted < boomLength - .02;
    this.collisionMesh = collisionMesh;
    const targetDistance = this.colliding
      ? Math.max(CAMERA.minimumDistance, permitted - CAMERA.collisionMargin)
      : boomLength;
    const targetPosition = pivot.add(boomDirection.scale(targetDistance));
    const currentDistance = this.initialized ? this.BABYLON.Vector3.Distance(this.camera.position, pivot) : targetDistance;
    const movingInward = targetDistance < currentDistance;
    const response = this.colliding || movingInward ? CAMERA.collisionResponse : CAMERA.recoveryResponse;
    const alpha = 1 - Math.exp(-Math.min(.05, deltaTime) / response);
    if (!this.initialized) {
      this.camera.position.copyFrom(targetPosition);
      this.initialized = true;
    } else {
      this.camera.position = this.BABYLON.Vector3.Lerp(this.camera.position, targetPosition, alpha);
    }
    this.actualDistance = this.BABYLON.Vector3.Distance(this.camera.position, pivot);
    this.desiredDistance = boomLength;
    this.camera.setTarget(this.camera.position.add(lookDirection.scale(20)));
    this.lastTargetPosition.copyFrom(targetPosition);

    const visibility = this.actualDistance < 1.15 ? clamp(.35 + (this.actualDistance - CAMERA.minimumDistance) / .3 * .65, .35, 1) : 1;
    witch.setVisibility(visibility);
  }

  getAimRay(length = 30) {
    return this.camera.getForwardRay(length);
  }

  snapshot(aiming = false) {
    return {
      side: this.side === 1 ? 'right' : 'left',
      mode: aiming ? 'aim' : 'explore',
      yaw: this.yaw,
      pitch: this.pitch,
      actualDistance: this.actualDistance,
      desiredDistance: this.desiredDistance,
      colliding: this.colliding,
      collisionMesh: this.collisionMesh,
      fov: this.camera.fov * 180 / Math.PI
    };
  }
}
