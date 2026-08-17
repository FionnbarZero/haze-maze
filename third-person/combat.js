import { COMBAT } from './config.js';

export class LightningCombat {
  constructor(BABYLON, scene, camera, witch, dragon) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.camera = camera;
    this.witch = witch;
    this.dragon = dragon;
    this.cooldownUntil = 0;
    this.targeted = false;
    this.lastCast = null;
    this.onMessage = () => {};
    this.crosshair = document.querySelector('#crosshair');
    this.targetCard = document.querySelector('#target-card');
    this.healthFill = document.querySelector('#target-health-fill');
    this.healthCopy = document.querySelector('#target-health-copy');
  }

  update() {
    const ray = this.camera.getAimRay(COMBAT.lightningRange);
    const hit = this.scene.pickWithRay(ray, mesh => mesh.metadata?.aimSurface === true, false);
    this.targeted = Boolean(hit?.hit && hit.pickedMesh?.metadata?.combatTarget?.alive);
    this.crosshair.classList.toggle('is-targeting', this.targeted);
    this.targetCard.classList.toggle('is-visible', this.targeted || this.dragon.health < this.dragon.maximumHealth);
    this.targetCard.setAttribute('aria-hidden', String(!(this.targeted || this.dragon.health < this.dragon.maximumHealth)));
    this.healthFill.style.transform = `scaleX(${this.dragon.health / this.dragon.maximumHealth})`;
    this.healthCopy.textContent = `${this.dragon.health} / ${this.dragon.maximumHealth}`;
  }

  cast(time) {
    if (time < this.cooldownUntil) {
      this.onMessage('Lightning is gathering strength');
      return false;
    }
    this.cooldownUntil = time + COMBAT.lightningCooldown;
    this.witch.setCast(time);

    const cameraRay = this.camera.getAimRay(COMBAT.lightningRange);
    const cameraHit = this.scene.pickWithRay(cameraRay, mesh => mesh.metadata?.aimSurface === true, false);
    const intendedPoint = cameraHit?.hit
      ? cameraHit.pickedPoint.clone()
      : cameraRay.origin.add(cameraRay.direction.scale(COMBAT.lightningRange));
    const origin = this.witch.getOrbPosition();
    const orbVector = intendedPoint.subtract(origin);
    const orbDistance = orbVector.length();
    const orbRay = new this.BABYLON.Ray(origin, orbVector.scale(1 / Math.max(.001, orbDistance)), orbDistance);
    const actualHit = this.scene.pickWithRay(orbRay, mesh => mesh.metadata?.aimSurface === true, false);
    const impactPoint = actualHit?.hit ? actualHit.pickedPoint.clone() : intendedPoint;
    const target = actualHit?.pickedMesh?.metadata?.combatTarget;

    this.lastCast = {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      impact: { x: impactPoint.x, y: impactPoint.y, z: impactPoint.z },
      intendedTarget: cameraHit?.pickedMesh?.name || null,
      actualTarget: actualHit?.pickedMesh?.name || null,
      obstructed: Boolean(cameraHit?.pickedMesh?.metadata?.combatTarget && actualHit?.pickedMesh?.metadata?.kind !== 'dragon')
    };
    this.createLightning(origin, impactPoint);
    if (target?.alive) {
      target.damage(COMBAT.lightningDamage, time);
      this.onMessage(target.alive ? `Lightning hit · ${target.health} health remains` : 'Training dragon contained');
    } else if (cameraHit?.pickedMesh?.metadata?.combatTarget && actualHit?.pickedMesh?.metadata?.kind !== 'dragon') {
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
    }, 170);
  }
}
