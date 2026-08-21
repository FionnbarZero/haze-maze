import { COMBAT } from './config.js?v=20260820-all-dragon-danger-v1';
import { circleIntersectsBox, verticalRangesOverlap } from './utils.js';

export function createPlaceholderDragon(BABYLON, scene, shadowGenerator, position, options = {}) {
  const id = options.id || 'dragon-0';
  const named = suffix => `${id}-${suffix}`;
  const passivePalette = Object.freeze({
    diffuse: '#49306f',
    emissive: '#12081f',
    specular: '#7c5aa4',
    eyeDiffuse: '#ffd37b',
    eyeEmissive: '#ff7b2e'
  });
  const aggressivePalette = Object.freeze({
    diffuse: '#75342f',
    emissive: '#2c0907',
    specular: '#bd6955',
    eyeDiffuse: '#fff1a0',
    eyeEmissive: '#ff351c'
  });
  let basePalette = options.aggressive ? aggressivePalette : passivePalette;
  const root = new BABYLON.TransformNode(named('root'), scene);
  root.position.copyFrom(position);
  root.rotation.y = Math.PI;
  const spawnPosition = position.clone();
  const meshes = [];
  let patrolEnabled = false;
  let patrolPoints = [];
  let patrolIndex = 0;
  let patrolSpeed = 1.2;
  let patrolWaitUntil = 0;
  let patrolWaitDuration = 0.9;
  let navigationColliders = [];
  const material = new BABYLON.StandardMaterial(named('material'), scene);
  material.diffuseColor = BABYLON.Color3.FromHexString(basePalette.diffuse);
  material.emissiveColor = BABYLON.Color3.FromHexString(basePalette.emissive);
  material.specularColor = BABYLON.Color3.FromHexString(basePalette.specular);
  const eyeMaterial = new BABYLON.StandardMaterial(named('eye-material'), scene);
  eyeMaterial.diffuseColor = BABYLON.Color3.FromHexString(basePalette.eyeDiffuse);
  eyeMaterial.emissiveColor = BABYLON.Color3.FromHexString(basePalette.eyeEmissive);

  const actor = {
    id,
    aggressive: Boolean(options.aggressive),
    root,
    meshes,
    health: COMBAT.dragonHealth,
    maximumHealth: COMBAT.dragonHealth,
    alive: true,
    collisionName: options.aggressive ? 'AGGRESSIVE DRAGON' : 'PASSIVE DRAGON',
    collisionRadius: COMBAT.dragonCollisionRadius,
    collisionHeight: COMBAT.dragonCollisionHeight,
    aimRadius: COMBAT.aimAssistRadius,
    hitUntil: 0,
    frozenUntil: 0,
    restrainedUntil: 0,
    attackUntil: 0,
    defeatedAt: 0,
    deathProgress: 0,
    state: 'IDLE',
    setPatrol(pathPoints = [], speed = 1.2, pauseDuration = 0.9) {
      if (!Array.isArray(pathPoints) || pathPoints.length < 2) {
        patrolEnabled = false;
        patrolPoints = [];
        patrolIndex = 0;
        patrolWaitUntil = 0;
        return;
      }
      patrolEnabled = true;
      patrolSpeed = Math.max(.4, Number(speed) || 1.2);
      patrolWaitDuration = Math.max(.2, Number(pauseDuration) || 0.9);
      patrolPoints = pathPoints.map(position => position.clone ? position.clone() : new BABYLON.Vector3(position.x, position.y, position.z));
      patrolIndex = 0;
      patrolWaitUntil = 0;
    },
    clearPatrol() {
      patrolEnabled = false;
      patrolPoints = [];
      patrolIndex = 0;
      patrolWaitUntil = 0;
    },
    setNavigationColliders(colliders = []) {
      navigationColliders = Array.isArray(colliders) ? colliders : [];
    },
    setAggressive(value) {
      this.aggressive = Boolean(value);
      this.collisionName = this.aggressive ? 'AGGRESSIVE DRAGON' : 'PASSIVE DRAGON';
      basePalette = this.aggressive ? aggressivePalette : passivePalette;
      eyeMaterial.diffuseColor = BABYLON.Color3.FromHexString(basePalette.eyeDiffuse);
      eyeMaterial.emissiveColor = BABYLON.Color3.FromHexString(basePalette.eyeEmissive);
    },
    setSpawnPosition(position) {
      const nextSpawn = position instanceof BABYLON.Vector3 ? position : new BABYLON.Vector3(position.x, position.y, position.z);
      spawnPosition.copyFrom(nextSpawn);
      root.position.copyFrom(nextSpawn);
    },
    teleport(position) {
      const nextPosition = position instanceof BABYLON.Vector3 ? position : new BABYLON.Vector3(position.x, position.y, position.z);
      root.position.copyFrom(nextPosition);
      patrolWaitUntil = 0;
    },
    canOccupy(x, z) {
      return navigationColliders.every(collider => {
        if (!verticalRangesOverlap(root.position.y, this.collisionHeight, collider)) return true;
        return !circleIntersectsBox(x, z, this.collisionRadius, collider);
      });
    },
    moveWithCollision(direction, distance) {
      const deltaX = direction.x * distance;
      const deltaZ = direction.z * distance;
      if (this.canOccupy(root.position.x + deltaX, root.position.z + deltaZ)) {
        root.position.x += deltaX;
        root.position.z += deltaZ;
        return true;
      }
      let moved = false;
      if (this.canOccupy(root.position.x + deltaX, root.position.z)) {
        root.position.x += deltaX;
        moved = true;
      }
      if (this.canOccupy(root.position.x, root.position.z + deltaZ)) {
        root.position.z += deltaZ;
        moved = true;
      }
      return moved;
    },
    getAimPoint() {
      return root.position.add(new BABYLON.Vector3(0, COMBAT.dragonAimHeight, 0));
    },
    damage(amount, time) {
      if (!this.alive) return false;
      this.health = Math.max(0, this.health - amount);
      this.hitUntil = time + .16;
      if (this.health === 0) {
        this.alive = false;
        this.defeatedAt = time;
        this.state = 'DEFEAT';
      }
      return true;
    },
    freeze(time, duration = COMBAT.frostDuration) {
      if (!this.alive) return false;
      this.frozenUntil = Math.max(this.frozenUntil, time + duration);
      this.state = 'FROZEN';
      return true;
    },
    restrain(time, duration) {
      if (!this.alive) return false;
      this.restrainedUntil = Math.max(this.restrainedUntil, time + duration);
      this.state = 'VINEBOUND';
      return true;
    },
    isFrozen(time) {
      return this.alive && time < this.frozenUntil;
    },
    isRestrained(time) {
      return this.alive && time < this.restrainedUntil;
    },
    attack(time) {
      if (!this.aggressive || !this.alive || this.isFrozen(time) || this.isRestrained(time)) return false;
      this.attackUntil = time + COMBAT.dragonAttackAnimationDuration;
      this.state = 'ATTACK';
      return true;
    },
    reset() {
      this.health = this.maximumHealth;
      this.alive = true;
      this.hitUntil = 0;
      this.frozenUntil = 0;
      this.restrainedUntil = 0;
      this.attackUntil = 0;
      this.defeatedAt = 0;
      this.deathProgress = 0;
      this.state = 'IDLE';
      root.position.copyFrom(spawnPosition);
      root.rotation.set(0, Math.PI, 0);
      root.scaling.setAll(1);
      root.setEnabled(true);
      material.emissiveColor = BABYLON.Color3.FromHexString(basePalette.emissive);
      material.diffuseColor = BABYLON.Color3.FromHexString(basePalette.diffuse);
      material.specularColor = BABYLON.Color3.FromHexString(basePalette.specular);
      patrolIndex = 0;
      patrolWaitUntil = 0;
    },
    update(time, deltaTime) {
      if (!this.alive) {
        this.deathProgress = Math.min(1, (time - this.defeatedAt) / COMBAT.dragonDefeatDuration);
        root.rotation.z = this.deathProgress * 1.32;
        root.position.y = Math.max(-.25, -.25 * this.deathProgress);
        root.scaling.setAll(1 - this.deathProgress * .22);
        if (this.deathProgress >= 1 && root.isEnabled()) {
          root.setEnabled(false);
          this.state = 'DEFEATED';
        }
      } else if (this.isRestrained(time)) {
        this.state = 'VINEBOUND';
      } else if (this.isFrozen(time)) {
        this.state = 'FROZEN';
      } else if (time < this.attackUntil) {
        this.state = 'ATTACK';
      } else {
        this.state = time < this.hitUntil ? 'HIT' : 'IDLE';
      }

      if (this.alive && patrolEnabled && !this.isFrozen(time) && !this.isRestrained(time)) {
        const now = time;
        if (now < patrolWaitUntil) {
          this.state = 'PATROL_WAIT';
        } else {
          const target = patrolPoints[patrolIndex];
          if (target) {
            const toTarget = target.subtract(root.position);
            const toTargetXZ = toTarget.clone();
            toTargetXZ.y = 0;
            const distance = toTargetXZ.length();
            if (distance <= .1) {
              patrolIndex = (patrolIndex + 1) % patrolPoints.length;
              patrolWaitUntil = now + patrolWaitDuration;
            } else {
              const moveDistance = Math.min(distance, patrolSpeed * deltaTime);
              const direction = toTargetXZ.normalize();
              const moved = this.moveWithCollision(direction, moveDistance);
              if (moved) root.rotation.y = Math.atan2(direction.x, direction.z);
              else {
                patrolIndex = (patrolIndex + 1) % patrolPoints.length;
                patrolWaitUntil = now + patrolWaitDuration;
              }
              root.position.y = spawnPosition.y;
            }
          }
        }
      } else if (!patrolEnabled && this.state !== 'DEFEAT') {
        root.rotation.x = 0;
      }

      const frozen = this.isFrozen(time);
      const restrained = this.isRestrained(time);
      material.diffuseColor = restrained
        ? BABYLON.Color3.FromHexString('#356a45')
        : frozen
        ? BABYLON.Color3.FromHexString('#72b8df')
        : BABYLON.Color3.FromHexString(basePalette.diffuse);
      material.specularColor = restrained
        ? BABYLON.Color3.FromHexString('#b9f4b6')
        : frozen
        ? BABYLON.Color3.FromHexString('#d8f7ff')
        : BABYLON.Color3.FromHexString(basePalette.specular);
      material.emissiveColor = restrained
        ? BABYLON.Color3.FromHexString('#123d20')
        : frozen
        ? BABYLON.Color3.FromHexString('#174f77')
        : time < this.hitUntil
          ? BABYLON.Color3.FromHexString('#9f3e83')
          : BABYLON.Color3.FromHexString(basePalette.emissive);
      if (this.alive && !frozen && !restrained) {
        const attacking = time < this.attackUntil ? 1 : 0;
        wingLeft.rotation.z = -.35 + Math.sin(time * 2.7) * .18 - attacking * .28;
        wingRight.rotation.z = .35 - Math.sin(time * 2.7) * .18 + attacking * .28;
        tailNodes.forEach((node, index) => { node.rotation.y = Math.sin(time * 2 + index * .7) * (.12 + index * .04); });
      }
    },
    snapshot() {
      return {
        id: this.id,
        aggressive: this.aggressive,
        health: this.health,
        maximumHealth: this.maximumHealth,
        alive: this.alive,
        state: this.state,
        frozen: this.isFrozen(performance.now() / 1000),
        frozenRemaining: Math.max(0, this.frozenUntil - performance.now() / 1000),
        restrained: this.isRestrained(performance.now() / 1000),
        restrainedRemaining: Math.max(0, this.restrainedUntil - performance.now() / 1000),
        deathProgress: this.deathProgress,
        enabled: root.isEnabled(),
        position: { x: root.position.x, y: root.position.y, z: root.position.z },
        aimPoint: this.getAimPoint().asArray(),
        collisionRadius: this.collisionRadius
      };
    }
  };

  const addMesh = (mesh, parent, localPosition, meshMaterial = material) => {
    mesh.parent = parent;
    mesh.position.copyFrom(localPosition);
    mesh.material = meshMaterial;
    mesh.isPickable = true;
    mesh.metadata = { combatTarget: actor, aimSurface: true, cameraObstacle: true, kind: 'dragon' };
    meshes.push(mesh);
    shadowGenerator.addShadowCaster(mesh);
    return mesh;
  };

  const body = addMesh(BABYLON.MeshBuilder.CreateSphere(named('body'), { diameter: 1.5, segments: 18 }, scene), root, new BABYLON.Vector3(0, .82, 0));
  body.scaling.set(1.05, .72, 1.38);
  const chest = addMesh(BABYLON.MeshBuilder.CreateSphere(named('chest'), { diameter: 1.08, segments: 16 }, scene), root, new BABYLON.Vector3(0, 1.25, .68));
  chest.scaling.set(.82, 1, .9);
  const head = addMesh(BABYLON.MeshBuilder.CreateSphere(named('head'), { diameter: .82, segments: 16 }, scene), root, new BABYLON.Vector3(0, 1.62, 1.2));
  head.scaling.set(.82, .72, 1.05);
  for (const side of [-1, 1]) {
    const eye = addMesh(BABYLON.MeshBuilder.CreateSphere(named(`eye-${side}`), { diameter: .11, segments: 10 }, scene), root, new BABYLON.Vector3(side * .22, 1.72, 1.58), eyeMaterial);
    eye.scaling.z = .55;
    const horn = addMesh(BABYLON.MeshBuilder.CreateCylinder(named(`horn-${side}`), { height: .52, diameterTop: 0, diameterBottom: .13, tessellation: 10 }, scene), root, new BABYLON.Vector3(side * .28, 1.98, 1.1));
    horn.rotation.z = side * .34;
    for (const z of [.35, -.35]) {
      const leg = addMesh(BABYLON.MeshBuilder.CreateCapsule(named(`leg-${side}-${z}`), { height: .72, radius: .14, tessellation: 10 }, scene), root, new BABYLON.Vector3(side * .5, .36, z));
      leg.rotation.z = side * .12;
    }
  }

  const wingLeft = new BABYLON.TransformNode(named('wing-left'), scene);
  const wingRight = new BABYLON.TransformNode(named('wing-right'), scene);
  wingLeft.parent = root; wingRight.parent = root;
  wingLeft.position.set(-.55, 1.2, -.05); wingRight.position.set(.55, 1.2, -.05);
  const wingMeshLeft = addMesh(BABYLON.MeshBuilder.CreateBox(named('wing-mesh-left'), { width: 1.35, height: .08, depth: .82 }, scene), wingLeft, new BABYLON.Vector3(-.55, 0, 0));
  const wingMeshRight = addMesh(BABYLON.MeshBuilder.CreateBox(named('wing-mesh-right'), { width: 1.35, height: .08, depth: .82 }, scene), wingRight, new BABYLON.Vector3(.55, 0, 0));
  wingMeshLeft.rotation.y = -.22; wingMeshRight.rotation.y = .22;

  const tailNodes = [];
  let parent = root;
  for (let index = 0; index < 5; index += 1) {
    const node = new BABYLON.TransformNode(named(`tail-node-${index}`), scene);
    node.parent = parent;
    node.position.set(0, index ? 0 : .82, index ? -.48 : -.7);
    const segment = addMesh(BABYLON.MeshBuilder.CreateCapsule(named(`tail-${index}`), { height: .62 - index * .07, radius: .18 - index * .022, tessellation: 10 }, scene), node, new BABYLON.Vector3(0, 0, -.22));
    segment.rotation.x = Math.PI / 2;
    tailNodes.push(node);
    parent = node;
  }

  actor.setNavigationColliders(options.navigationColliders);
  return actor;
}
