import { COMBAT } from './config.js?v=20260818-targeting-v2';

export function createPlaceholderDragon(BABYLON, scene, shadowGenerator, position) {
  const root = new BABYLON.TransformNode('placeholder-dragon-root', scene);
  root.position.copyFrom(position);
  root.rotation.y = Math.PI;
  const spawnPosition = position.clone();
  const meshes = [];
  const material = new BABYLON.StandardMaterial('temporary-dragon-material', scene);
  material.diffuseColor = BABYLON.Color3.FromHexString('#49306f');
  material.emissiveColor = BABYLON.Color3.FromHexString('#12081f');
  material.specularColor = BABYLON.Color3.FromHexString('#7c5aa4');
  const eyeMaterial = new BABYLON.StandardMaterial('temporary-dragon-eye', scene);
  eyeMaterial.diffuseColor = BABYLON.Color3.FromHexString('#ffd37b');
  eyeMaterial.emissiveColor = BABYLON.Color3.FromHexString('#ff7b2e');

  const actor = {
    root,
    meshes,
    health: COMBAT.dragonHealth,
    maximumHealth: COMBAT.dragonHealth,
    alive: true,
    collisionName: 'TRAINING DRAGON',
    collisionRadius: COMBAT.dragonCollisionRadius,
    collisionHeight: COMBAT.dragonCollisionHeight,
    aimRadius: COMBAT.aimAssistRadius,
    hitUntil: 0,
    defeatedAt: 0,
    deathProgress: 0,
    state: 'IDLE',
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
    reset() {
      this.health = this.maximumHealth;
      this.alive = true;
      this.hitUntil = 0;
      this.defeatedAt = 0;
      this.deathProgress = 0;
      this.state = 'IDLE';
      root.position.copyFrom(spawnPosition);
      root.rotation.set(0, Math.PI, 0);
      root.scaling.setAll(1);
      root.setEnabled(true);
      material.emissiveColor = BABYLON.Color3.FromHexString('#12081f');
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
      } else {
        this.state = time < this.hitUntil ? 'HIT' : 'IDLE';
      }
      material.emissiveColor = time < this.hitUntil
        ? BABYLON.Color3.FromHexString('#9f3e83')
        : BABYLON.Color3.FromHexString('#12081f');
      wingLeft.rotation.z = -.35 + Math.sin(time * 2.7) * .18;
      wingRight.rotation.z = .35 - Math.sin(time * 2.7) * .18;
      tailNodes.forEach((node, index) => { node.rotation.y = Math.sin(time * 2 + index * .7) * (.12 + index * .04); });
    },
    snapshot() {
      return {
        health: this.health,
        maximumHealth: this.maximumHealth,
        alive: this.alive,
        state: this.state,
        deathProgress: this.deathProgress,
        enabled: root.isEnabled(),
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

  const body = addMesh(BABYLON.MeshBuilder.CreateSphere('dragon-body', { diameter: 1.5, segments: 18 }, scene), root, new BABYLON.Vector3(0, .82, 0));
  body.scaling.set(1.05, .72, 1.38);
  const chest = addMesh(BABYLON.MeshBuilder.CreateSphere('dragon-chest', { diameter: 1.08, segments: 16 }, scene), root, new BABYLON.Vector3(0, 1.25, .68));
  chest.scaling.set(.82, 1, .9);
  const head = addMesh(BABYLON.MeshBuilder.CreateSphere('dragon-head', { diameter: .82, segments: 16 }, scene), root, new BABYLON.Vector3(0, 1.62, 1.2));
  head.scaling.set(.82, .72, 1.05);
  for (const side of [-1, 1]) {
    const eye = addMesh(BABYLON.MeshBuilder.CreateSphere(`dragon-eye-${side}`, { diameter: .11, segments: 10 }, scene), root, new BABYLON.Vector3(side * .22, 1.72, 1.58), eyeMaterial);
    eye.scaling.z = .55;
    const horn = addMesh(BABYLON.MeshBuilder.CreateCylinder(`dragon-horn-${side}`, { height: .52, diameterTop: 0, diameterBottom: .13, tessellation: 10 }, scene), root, new BABYLON.Vector3(side * .28, 1.98, 1.1));
    horn.rotation.z = side * .34;
    for (const z of [.35, -.35]) {
      const leg = addMesh(BABYLON.MeshBuilder.CreateCapsule(`dragon-leg-${side}-${z}`, { height: .72, radius: .14, tessellation: 10 }, scene), root, new BABYLON.Vector3(side * .5, .36, z));
      leg.rotation.z = side * .12;
    }
  }

  const wingLeft = new BABYLON.TransformNode('dragon-wing-left', scene);
  const wingRight = new BABYLON.TransformNode('dragon-wing-right', scene);
  wingLeft.parent = root; wingRight.parent = root;
  wingLeft.position.set(-.55, 1.2, -.05); wingRight.position.set(.55, 1.2, -.05);
  const wingMeshLeft = addMesh(BABYLON.MeshBuilder.CreateBox('dragon-wing-mesh-left', { width: 1.35, height: .08, depth: .82 }, scene), wingLeft, new BABYLON.Vector3(-.55, 0, 0));
  const wingMeshRight = addMesh(BABYLON.MeshBuilder.CreateBox('dragon-wing-mesh-right', { width: 1.35, height: .08, depth: .82 }, scene), wingRight, new BABYLON.Vector3(.55, 0, 0));
  wingMeshLeft.rotation.y = -.22; wingMeshRight.rotation.y = .22;

  const tailNodes = [];
  let parent = root;
  for (let index = 0; index < 5; index += 1) {
    const node = new BABYLON.TransformNode(`dragon-tail-node-${index}`, scene);
    node.parent = parent;
    node.position.set(0, index ? 0 : .82, index ? -.48 : -.7);
    const segment = addMesh(BABYLON.MeshBuilder.CreateCapsule(`dragon-tail-${index}`, { height: .62 - index * .07, radius: .18 - index * .022, tessellation: 10 }, scene), node, new BABYLON.Vector3(0, 0, -.22));
    segment.rotation.x = Math.PI / 2;
    tailNodes.push(node);
    parent = node;
  }

  return actor;
}
