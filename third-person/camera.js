import { CAMERA } from './config.js?v=20260820-all-dragon-danger-v1';
import { clamp, damp } from './utils.js';

const SHOULDER_STORAGE_KEY = 'moonWitchShoulder';

function storedShoulderSide() {
  try {
    return Number(globalThis.localStorage?.getItem(SHOULDER_STORAGE_KEY)) === -1 ? -1 : 1;
  } catch {
    return 1;
  }
}

function storeShoulderSide(side) {
  try {
    globalThis.localStorage?.setItem(SHOULDER_STORAGE_KEY, String(side));
  } catch {}
}

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
    this.side = storedShoulderSide();
    this.actualDistance = CAMERA.explorationDistance;
    this.desiredDistance = CAMERA.explorationDistance;
    this.actualBoom = CAMERA.explorationDistance;
    this.desiredBoom = CAMERA.explorationDistance;
    this.effectiveShoulder = CAMERA.explorationShoulder * this.side;
    this.colliding = false;
    this.sideColliding = false;
    this.occluded = false;
    this.collisionMesh = '';
    this.crouchPivotOffset = 0;
    this.initialized = false;
    this.forceSnap = false;
    this.lastPlayerPosition = null;
    this.shoulderAimAnchor = null;
  }

  addBlockers(meshes) {
    // Creatures may overlap the boom in close combat. Treating their individual
    // meshes as camera walls collapses the camera into the Witch and triggers a
    // distracting transparency fade. World geometry remains a true blocker.
    for (const mesh of meshes) {
      if (mesh.metadata?.kind === 'dragon') continue;
      this.blockers.add(mesh);
    }
  }

  updateLook(input) {
    const look = input.consumeLook();
    if (Math.abs(look.x) > .00001 || Math.abs(look.y) > .00001) this.shoulderAimAnchor = null;
    this.yaw += look.x;
    this.pitch = clamp(this.pitch - look.y, CAMERA.minPitch, CAMERA.maxPitch);
  }

  setLook(yaw, pitch) {
    this.shoulderAimAnchor = null;
    this.yaw = yaw;
    this.pitch = clamp(pitch, CAMERA.minPitch, CAMERA.maxPitch);
    this.snapNextUpdate();
  }

  switchShoulder() {
    const ray = this.getAimRay(30);
    const hit = this.scene.pickWithRay(ray, mesh => mesh.metadata?.aimSurface === true, false);
    this.shoulderAimAnchor = hit?.hit
      ? hit.pickedPoint.clone()
      : ray.origin.add(ray.direction.scale(30));
    this.side *= -1;
    storeShoulderSide(this.side);
  }

  snapNextUpdate() {
    this.forceSnap = true;
  }

  nearestBlocker(origin, direction, length, offsets) {
    let permitted = length;
    let collisionMesh = '';
    for (const offset of offsets) {
      const ray = new this.BABYLON.Ray(origin.add(offset), direction, length);
      const hit = this.scene.pickWithRay(ray, mesh => this.blockers.has(mesh), false);
      if (hit?.hit && hit.distance < permitted) {
        permitted = hit.distance;
        collisionMesh = hit.pickedMesh?.name || 'geometry';
      }
    }
    return { permitted, collisionMesh };
  }

  update(player, input, deltaTime, witch) {
    if (this.lastPlayerPosition && this.BABYLON.Vector3.DistanceSquared(this.lastPlayerPosition, player.position) > 6.25) this.forceSnap = true;
    if (!this.lastPlayerPosition) this.lastPlayerPosition = player.position.clone();
    else this.lastPlayerPosition.copyFrom(player.position);

    const aiming = input.aiming;
    const desiredBoom = aiming ? CAMERA.aimDistance : CAMERA.explorationDistance;
    const desiredShoulderMagnitude = aiming ? CAMERA.aimShoulder : CAMERA.explorationShoulder;
    const desiredShoulder = desiredShoulderMagnitude * this.side;
    const fovDegrees = aiming ? CAMERA.aimFov : this.mobile ? CAMERA.explorationFovMobile : CAMERA.explorationFovDesktop;
    this.camera.fov = damp(this.camera.fov, fovDegrees * Math.PI / 180, aiming ? .16 : .22, deltaTime);
    this.crouchPivotOffset = damp(this.crouchPivotOffset, player.crouched ? -.32 : 0, CAMERA.crouchPivotResponse, deltaTime);

    const pivot = player.position.add(new this.BABYLON.Vector3(0, CAMERA.pivotHeight + CAMERA.verticalOffset + this.crouchPivotOffset, 0));
    const cosPitch = Math.cos(this.pitch);
    const lookDirection = new this.BABYLON.Vector3(Math.sin(this.yaw) * cosPitch, Math.sin(this.pitch), Math.cos(this.yaw) * cosPitch).normalize();
    const right = new this.BABYLON.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const up = this.BABYLON.Vector3.Up();
    const basePosition = pivot.subtract(lookDirection.scale(desiredBoom));

    const shoulderDirection = right.scale(Math.sign(desiredShoulder) || 1);
    const shoulderOffsets = [
      this.BABYLON.Vector3.Zero(),
      up.scale(CAMERA.probeRadius),
      up.scale(-CAMERA.probeRadius),
      lookDirection.scale(CAMERA.probeRadius),
      lookDirection.scale(-CAMERA.probeRadius)
    ];
    const sideHit = this.nearestBlocker(basePosition, shoulderDirection, Math.abs(desiredShoulder), shoulderOffsets);
    this.sideColliding = sideHit.permitted < Math.abs(desiredShoulder) - .02;
    const targetShoulderMagnitude = this.sideColliding
      ? Math.max(0, sideHit.permitted - CAMERA.collisionMargin)
      : Math.abs(desiredShoulder);
    const targetShoulder = targetShoulderMagnitude * (Math.sign(desiredShoulder) || 1);
    this.effectiveShoulder = this.forceSnap
      ? targetShoulder
      : damp(this.effectiveShoulder, targetShoulder, this.sideColliding ? CAMERA.collisionResponse : CAMERA.shoulderResponse, deltaTime);

    const desired = basePosition.add(right.scale(this.effectiveShoulder));
    const boomVector = desired.subtract(pivot);
    const combinedLength = boomVector.length();
    const boomDirection = boomVector.scale(1 / Math.max(.001, combinedLength));
    const boomOffsets = [
      this.BABYLON.Vector3.Zero(),
      right.scale(CAMERA.probeRadius),
      right.scale(-CAMERA.probeRadius),
      up.scale(CAMERA.probeRadius),
      up.scale(-CAMERA.probeRadius)
    ];
    const boomHit = this.nearestBlocker(pivot, boomDirection, combinedLength, boomOffsets);
    this.colliding = boomHit.permitted < combinedLength - .02;
    this.collisionMesh = boomHit.collisionMesh || (this.sideColliding ? sideHit.collisionMesh : '');
    const targetDistance = this.colliding
      ? Math.max(CAMERA.minimumDistance, boomHit.permitted - CAMERA.collisionMargin)
      : combinedLength;
    const targetPosition = pivot.add(boomDirection.scale(targetDistance));
    const currentDistance = this.initialized ? this.BABYLON.Vector3.Distance(this.camera.position, pivot) : targetDistance;
    const movingInward = targetDistance < currentDistance;
    const recovering = !this.colliding && currentDistance < targetDistance - .08;
    const response = movingInward || this.colliding
      ? CAMERA.collisionResponse
      : recovering
        ? CAMERA.recoveryResponse
        : CAMERA.positionResponse;
    const alpha = 1 - Math.exp(-Math.min(.05, deltaTime) / response);
    if (!this.initialized || this.forceSnap) {
      this.camera.position.copyFrom(targetPosition);
      this.initialized = true;
      this.forceSnap = false;
    } else {
      this.camera.position = this.BABYLON.Vector3.Lerp(this.camera.position, targetPosition, alpha);
    }

    this.actualDistance = this.BABYLON.Vector3.Distance(this.camera.position, pivot);
    this.desiredDistance = combinedLength;
    this.actualBoom = Math.max(0, this.BABYLON.Vector3.Dot(pivot.subtract(this.camera.position), lookDirection));
    this.desiredBoom = desiredBoom;
    let viewDirection = lookDirection;
    if (this.shoulderAimAnchor) {
      const anchorVector = this.shoulderAimAnchor.subtract(this.camera.position);
      if (anchorVector.lengthSquared() > .001) {
        viewDirection = anchorVector.normalize();
        this.yaw = Math.atan2(viewDirection.x, viewDirection.z);
        this.pitch = clamp(Math.asin(viewDirection.y), CAMERA.minPitch, CAMERA.maxPitch);
      }
      if (Math.abs(this.effectiveShoulder - targetShoulder) < .015) this.shoulderAimAnchor = null;
    }
    this.camera.setTarget(this.camera.position.add(viewDirection.scale(20)));

    const cameraToPivot = pivot.subtract(this.camera.position);
    const occlusionDistance = cameraToPivot.length();
    const occlusionRay = new this.BABYLON.Ray(
      this.camera.position,
      cameraToPivot.scale(1 / Math.max(.001, occlusionDistance)),
      occlusionDistance
    );
    const occlusionHit = this.scene.pickWithRay(occlusionRay, mesh => this.blockers.has(mesh), false);
    this.occluded = Boolean(occlusionHit?.hit && occlusionHit.distance < occlusionDistance - .12);
    let visibility = this.actualDistance < CAMERA.proximityFadeDistance
      ? clamp(.35 + (this.actualDistance - CAMERA.minimumDistance) / .3 * .65, .35, 1)
      : 1;
    if (this.occluded) visibility = Math.min(visibility, CAMERA.occludedVisibility);
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
      actualBoom: this.actualBoom,
      desiredBoom: this.desiredBoom,
      shoulderOffset: this.effectiveShoulder,
      colliding: this.colliding,
      sideColliding: this.sideColliding,
      occluded: this.occluded,
      collisionMesh: this.collisionMesh,
      fov: this.camera.fov * 180 / Math.PI,
      shoulderAimAnchored: Boolean(this.shoulderAimAnchor),
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z }
    };
  }
}
