import { COMBAT } from './config.js?v=20260818-targeting-v2';
import { blockerPrecedesTarget, raySphereEntryDistance } from './targeting.js?v=20260818-targeting-v2';

export class LightningCombat {
  constructor(BABYLON, scene, camera, witch, dragon, controller) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.camera = camera;
    this.witch = witch;
    this.dragon = dragon;
    this.controller = controller;
    this.cooldownUntil = 0;
    this.lastTime = 0;
    this.targeted = false;
    this.candidateTargeted = false;
    this.assisted = false;
    this.aimState = 'NONE';
    this.lastCast = null;
    this.onMessage = () => {};
    this.crosshair = document.querySelector('#crosshair');
    this.crosshairLabel = this.crosshair.querySelector('i');
    this.targetCard = document.querySelector('#target-card');
    this.healthFill = document.querySelector('#target-health-fill');
    this.healthCopy = document.querySelector('#target-health-copy');
  }

  pickAimSurface(ray, predicate = () => true) {
    return this.scene.pickWithRay(
      ray,
      mesh => mesh.metadata?.aimSurface === true && predicate(mesh),
      false
    );
  }

  resolveAim() {
    const cameraRay = this.camera.getAimRay(COMBAT.lightningRange);
    const cameraHit = this.pickAimSurface(cameraRay);
    const directTarget = cameraHit?.pickedMesh?.metadata?.combatTarget;
    if (directTarget?.alive) {
      return {
        cameraRay,
        cameraHit,
        target: directTarget,
        intendedPoint: cameraHit.pickedPoint.clone(),
        targetEntryDistance: cameraHit.distance,
        mode: 'DIRECT'
      };
    }

    if (this.dragon.alive) {
      const aimPoint = this.dragon.getAimPoint();
      const targetEntryDistance = raySphereEntryDistance(
        cameraRay.origin,
        cameraRay.direction,
        aimPoint,
        this.dragon.aimRadius,
        COMBAT.lightningRange
      );
      const firstSurfaceDistance = cameraHit?.hit ? cameraHit.distance : Infinity;
      const assisted = targetEntryDistance !== null
        && !blockerPrecedesTarget(firstSurfaceDistance, targetEntryDistance, COMBAT.aimAssistWallTolerance);
      if (assisted) {
        return {
          cameraRay,
          cameraHit,
          target: this.dragon,
          intendedPoint: aimPoint,
          targetEntryDistance,
          mode: 'ASSISTED'
        };
      }
    }

    return {
      cameraRay,
      cameraHit,
      target: null,
      intendedPoint: cameraHit?.hit
        ? cameraHit.pickedPoint.clone()
        : cameraRay.origin.add(cameraRay.direction.scale(COMBAT.lightningRange)),
      targetEntryDistance: null,
      mode: 'WORLD'
    };
  }

  resolveStaffPath(solution) {
    const origin = this.witch.getOrbPosition();
    const orbVector = solution.intendedPoint.subtract(origin);
    const orbDistance = orbVector.length();
    const direction = orbVector.scale(1 / Math.max(.001, orbDistance));

    if (solution.target) {
      const blockerLength = Math.max(0, orbDistance - COMBAT.staffRayTerminalTolerance);
      const blockerRay = new this.BABYLON.Ray(origin, direction, blockerLength);
      const blockerHit = this.pickAimSurface(
        blockerRay,
        mesh => mesh.metadata?.combatTarget !== solution.target
      );
      if (blockerHit?.hit && blockerPrecedesTarget(
        blockerHit.distance,
        orbDistance,
        COMBAT.staffRayTerminalTolerance
      )) {
        return {
          origin,
          impactPoint: blockerHit.pickedPoint.clone(),
          actualHit: blockerHit,
          obstructed: true
        };
      }

      const targetRay = new this.BABYLON.Ray(
        origin,
        direction,
        orbDistance + solution.target.aimRadius + COMBAT.staffRayTerminalTolerance
      );
      const targetHit = this.pickAimSurface(
        targetRay,
        mesh => mesh.metadata?.combatTarget === solution.target
      );
      return {
        origin,
        impactPoint: targetHit?.hit ? targetHit.pickedPoint.clone() : solution.intendedPoint,
        actualHit: targetHit,
        obstructed: false
      };
    }

    const orbRay = new this.BABYLON.Ray(
      origin,
      direction,
      orbDistance + COMBAT.staffRayTerminalTolerance
    );
    const actualHit = this.pickAimSurface(orbRay);
    return {
      origin,
      impactPoint: actualHit?.hit ? actualHit.pickedPoint.clone() : solution.intendedPoint,
      actualHit,
      obstructed: false
    };
  }

  update() {
    this.lastTime = performance.now() / 1000;
    const solution = this.resolveAim();
    const path = solution.target ? this.resolveStaffPath(solution) : null;
    this.candidateTargeted = Boolean(solution.target);
    this.targeted = Boolean(solution.target && !path?.obstructed);
    this.assisted = this.targeted && solution.mode === 'ASSISTED';
    this.aimState = path?.obstructed
      ? 'OBSTRUCTED'
      : this.assisted
        ? 'ASSISTED'
        : this.targeted
          ? 'DIRECT'
          : 'NONE';
    this.crosshair.classList.toggle('is-targeting', this.targeted);
    this.crosshair.classList.toggle('is-assisted', this.assisted);
    this.crosshair.classList.toggle('is-obstructed', this.aimState === 'OBSTRUCTED');
    this.crosshairLabel.dataset.stateLabel = this.targeted ? 'HIT' : this.aimState === 'OBSTRUCTED' ? 'BLOCKED' : '';
    const showTarget = this.candidateTargeted || this.dragon.health < this.dragon.maximumHealth;
    this.targetCard.classList.toggle('is-visible', showTarget);
    this.targetCard.setAttribute('aria-hidden', String(!showTarget));
    this.healthFill.style.transform = `scaleX(${this.dragon.health / this.dragon.maximumHealth})`;
    this.healthCopy.textContent = this.dragon.alive
      ? `${this.dragon.health} / ${this.dragon.maximumHealth}`
      : 'CONTAINED';
  }

  cast(time) {
    if (time < this.cooldownUntil) {
      this.onMessage('Lightning is gathering strength');
      return false;
    }
    this.cooldownUntil = time + COMBAT.lightningCooldown;
    this.witch.setCast(time);

    const solution = this.resolveAim();
    const path = this.resolveStaffPath(solution);
    const intendedTarget = solution.target;
    const obstructed = Boolean(intendedTarget && path.obstructed);
    this.controller.requestCastFacing(
      intendedTarget ? intendedTarget.getAimPoint() : solution.intendedPoint
    );

    this.lastCast = {
      origin: { x: path.origin.x, y: path.origin.y, z: path.origin.z },
      impact: { x: path.impactPoint.x, y: path.impactPoint.y, z: path.impactPoint.z },
      intendedTarget: intendedTarget
        ? solution.mode === 'DIRECT' ? solution.cameraHit?.pickedMesh?.name : 'dragon-aim-volume'
        : solution.cameraHit?.pickedMesh?.name || null,
      actualTarget: path.actualHit?.pickedMesh?.name || (intendedTarget && !obstructed ? 'dragon-aim-point' : null),
      intendedKind: intendedTarget ? 'dragon' : solution.cameraHit?.pickedMesh?.metadata?.kind || null,
      actualKind: path.actualHit?.pickedMesh?.metadata?.kind || null,
      obstructed,
      aimMode: solution.mode,
      targetEntryDistance: solution.targetEntryDistance,
      resolution: intendedTarget && !obstructed
        ? solution.mode === 'ASSISTED' ? 'TARGET_ASSISTED' : 'TARGET'
        : obstructed
          ? 'OBSTRUCTED'
          : 'WORLD'
    };
    this.createLightning(path.origin, path.impactPoint);
    if (intendedTarget && !obstructed && intendedTarget.alive) {
      intendedTarget.damage(COMBAT.lightningDamage, time);
      this.onMessage(intendedTarget.alive ? `Lightning hit · ${intendedTarget.health} health remains` : 'Training dragon contained');
    } else if (obstructed) {
      this.onMessage('The staff is obstructed by the maze');
    } else {
      this.onMessage('Lightning struck the brickwork');
    }
    return true;
  }

  createLightning(origin, impact) {
    const direction = impact.subtract(origin);
    const distance = direction.length();
    if (distance < .01) return;
    direction.normalize();
    let right = this.BABYLON.Vector3.Cross(direction, this.BABYLON.Vector3.Up());
    if (right.lengthSquared() < .01) right = this.BABYLON.Vector3.Right();
    right.normalize();
    const up = this.BABYLON.Vector3.Cross(right, direction).normalize();
    const lines = [];
    for (let stream = 0; stream < 4; stream += 1) {
      const points = [];
      const sections = Math.max(7, Math.ceil(distance * 2.4));
      for (let index = 0; index <= sections; index += 1) {
        const t = index / sections;
        const envelope = Math.sin(t * Math.PI);
        const phase = stream * 2.17 + index * 1.91;
        const offset = right.scale(Math.sin(phase) * .08 * envelope)
          .add(up.scale(Math.cos(phase * 1.37) * .065 * envelope));
        points.push(this.BABYLON.Vector3.Lerp(origin, impact, t).add(offset));
      }
      const line = this.BABYLON.MeshBuilder.CreateLines(`lightning-stream-${stream}`, { points }, this.scene);
      line.color = stream === 0
        ? this.BABYLON.Color3.FromHexString('#f4ecff')
        : this.BABYLON.Color3.FromHexString('#a978ff');
      line.alpha = stream === 0 ? 1 : .72;
      line.isPickable = false;
      lines.push(line);
    }
    const impactLight = new this.BABYLON.PointLight('lightning-impact-light', impact, this.scene);
    impactLight.diffuse = this.BABYLON.Color3.FromHexString('#b989ff');
    impactLight.intensity = 3.2;
    impactLight.range = 7;
    setTimeout(() => {
      for (const line of lines) line.dispose();
      impactLight.dispose();
    }, COMBAT.lightningEffectDuration * 1000);
  }

  reset() {
    this.cooldownUntil = 0;
    this.lastTime = 0;
    this.targeted = false;
    this.candidateTargeted = false;
    this.assisted = false;
    this.aimState = 'NONE';
    this.lastCast = null;
    this.crosshair.classList.remove('is-targeting');
    this.crosshair.classList.remove('is-assisted');
    this.crosshair.classList.remove('is-obstructed');
    this.crosshairLabel.dataset.stateLabel = '';
    this.targetCard.classList.remove('is-visible');
    this.targetCard.setAttribute('aria-hidden', 'true');
    this.healthFill.style.transform = 'scaleX(1)';
    this.healthCopy.textContent = `${this.dragon.maximumHealth} / ${this.dragon.maximumHealth}`;
  }

  snapshot() {
    return {
      targeted: this.targeted,
      candidateTargeted: this.candidateTargeted,
      assisted: this.assisted,
      aimState: this.aimState,
      cooldownRemaining: Math.max(0, this.cooldownUntil - this.lastTime),
      lastCast: this.lastCast,
      activeLightningStreams: this.scene.meshes.filter(mesh => mesh.name.startsWith('lightning-stream-')).length
    };
  }
}
