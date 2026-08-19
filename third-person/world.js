import { WORLD } from './config.js?v=20260818-rewards-v1';
import { hexColor3 } from './utils.js';

export function createWorld(BABYLON, scene, shadowGenerator) {
  const colliders = [];
  const cameraBlockers = [];
  const aimSurfaces = [];

  const brickMaterial = new BABYLON.StandardMaterial('temporary-brick-material', scene);
  brickMaterial.diffuseTexture = new BABYLON.Texture('assets/ancient-brick-wall-v2.jpg', scene, true, false);
  brickMaterial.diffuseTexture.uScale = 2.2;
  brickMaterial.diffuseTexture.vScale = 1.15;
  brickMaterial.diffuseColor = hexColor3(BABYLON, '#8e625d');
  brickMaterial.specularColor = hexColor3(BABYLON, '#342a32');
  brickMaterial.roughness = .88;

  const floorMaterial = new BABYLON.StandardMaterial('temporary-floor-material', scene);
  floorMaterial.diffuseColor = hexColor3(BABYLON, '#282431');
  floorMaterial.specularColor = hexColor3(BABYLON, '#19131f');

  const obstacleMaterial = new BABYLON.StandardMaterial('temporary-obstacle-material', scene);
  obstacleMaterial.diffuseColor = hexColor3(BABYLON, '#5c416b');
  obstacleMaterial.emissiveColor = hexColor3(BABYLON, '#160c22');

  const goldMaterial = new BABYLON.StandardMaterial('temporary-gold-material', scene);
  goldMaterial.diffuseColor = hexColor3(BABYLON, '#b9853d');
  goldMaterial.emissiveColor = hexColor3(BABYLON, '#2e1905');

  const gateMaterial = new BABYLON.StandardMaterial('temporary-gate-barrier-material', scene);
  gateMaterial.diffuseColor = hexColor3(BABYLON, '#6e3ba2');
  gateMaterial.emissiveColor = hexColor3(BABYLON, '#7c38c0');
  gateMaterial.alpha = .82;

  const moonMaterial = new BABYLON.StandardMaterial('temporary-moon-material', scene);
  moonMaterial.diffuseColor = hexColor3(BABYLON, '#caa7ff');
  moonMaterial.emissiveColor = hexColor3(BABYLON, '#573386');

  const floor = BABYLON.MeshBuilder.CreateGround('proof-floor', { width: WORLD.floorWidth, height: WORLD.floorDepth, subdivisions: 2 }, scene);
  floor.material = floorMaterial;
  floor.receiveShadows = true;
  floor.isPickable = true;
  floor.metadata = { aimSurface: true, kind: 'floor' };
  aimSurfaces.push(floor);

  function registerMesh(mesh, options = {}) {
    mesh.isPickable = true;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      kind: options.kind || mesh.metadata?.kind || 'world-prop',
      cameraObstacle: options.cameraObstacle !== false,
      aimSurface: options.aimSurface !== false
    };
    if (mesh.metadata.cameraObstacle) cameraBlockers.push(mesh);
    if (mesh.metadata.aimSurface) aimSurfaces.push(mesh);
  }

  function addBox(name, position, dimensions, options = {}) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, { width: dimensions.x, height: dimensions.y, depth: dimensions.z }, scene);
    mesh.position.copyFrom(position);
    mesh.material = options.material || brickMaterial;
    mesh.receiveShadows = true;
    registerMesh(mesh, { kind: options.kind || 'wall', ...options });
    if (options.castsShadow) shadowGenerator.addShadowCaster(mesh);
    const half = dimensions.scale(.5);
    const collider = {
      name,
      mesh,
      min: position.subtract(half),
      max: position.add(half),
      kind: mesh.metadata.kind
    };
    if (options.collision !== false) colliders.push(collider);
    return { mesh, collider };
  }

  function removeCollider(collider) {
    const index = colliders.indexOf(collider);
    if (index >= 0) colliders.splice(index, 1);
  }

  function restoreCollider(collider) {
    if (!colliders.includes(collider)) colliders.push(collider);
  }

  const halfWidth = WORLD.floorWidth / 2;
  const halfDepth = WORLD.floorDepth / 2;
  const wallY = WORLD.wallHeight / 2;
  addBox('outer-wall-west', new BABYLON.Vector3(-halfWidth + WORLD.wallThickness / 2, wallY, 0), new BABYLON.Vector3(WORLD.wallThickness, WORLD.wallHeight, WORLD.floorDepth));
  addBox('outer-wall-east', new BABYLON.Vector3(halfWidth - WORLD.wallThickness / 2, wallY, 0), new BABYLON.Vector3(WORLD.wallThickness, WORLD.wallHeight, WORLD.floorDepth));
  addBox('outer-wall-south', new BABYLON.Vector3(0, wallY, -halfDepth + WORLD.wallThickness / 2), new BABYLON.Vector3(WORLD.floorWidth, WORLD.wallHeight, WORLD.wallThickness));
  addBox('outer-wall-north-west', new BABYLON.Vector3(-5.075, wallY, halfDepth - WORLD.wallThickness / 2), new BABYLON.Vector3(5.35, WORLD.wallHeight, WORLD.wallThickness));
  addBox('outer-wall-north-east', new BABYLON.Vector3(5.075, wallY, halfDepth - WORLD.wallThickness / 2), new BABYLON.Vector3(5.35, WORLD.wallHeight, WORLD.wallThickness));

  for (const x of [-2.5, 2.5]) {
    addBox(`jump-corridor-${x}`, new BABYLON.Vector3(x, wallY, -6), new BABYLON.Vector3(.5, WORLD.wallHeight, 7));
    addBox(`crouch-corridor-${x}`, new BABYLON.Vector3(x, wallY, .25), new BABYLON.Vector3(.5, WORLD.wallHeight, 5.5));
  }

  addBox('jump-relic', new BABYLON.Vector3(0, .28, -5.25), new BABYLON.Vector3(4.5, .56, .72), { material: obstacleMaterial, kind: 'jump-obstacle', castsShadow: true });
  addBox('crouch-lintel', new BABYLON.Vector3(0, 1.82, .1), new BABYLON.Vector3(4.5, .94, .72), { material: obstacleMaterial, kind: 'crouch-obstacle', castsShadow: true });

  addBox('arena-baffle-west', new BABYLON.Vector3(-5.45, wallY, 6.2), new BABYLON.Vector3(4.6, WORLD.wallHeight, .5));
  addBox('arena-baffle-east', new BABYLON.Vector3(5.45, wallY, 10.5), new BABYLON.Vector3(4.6, WORLD.wallHeight, .5));

  const arch = new BABYLON.TransformNode('temporary-moon-arch', scene);
  arch.position.set(0, 0, -9);
  const archRing = BABYLON.MeshBuilder.CreateTorus('moon-arch-ring', { diameter: 3.15, thickness: .28, tessellation: 48 }, scene);
  archRing.parent = arch;
  archRing.position.y = 1.58;
  archRing.rotation.x = Math.PI / 2;
  archRing.material = moonMaterial;
  registerMesh(archRing, { kind: 'moon-arch' });
  shadowGenerator.addShadowCaster(archRing);
  for (const side of [-1, 1]) {
    addBox(
      `moon-arch-pillar-${side}`,
      new BABYLON.Vector3(side * 1.42, .82, -9),
      new BABYLON.Vector3(.42, 1.65, .46),
      { material: brickMaterial, kind: 'moon-arch', castsShadow: true }
    );
  }

  const moon = BABYLON.MeshBuilder.CreateSphere('distant-moon', { diameter: 5, segments: 24 }, scene);
  moon.position.set(-8, 12, 17);
  moon.material = moonMaterial;
  moon.isPickable = false;

  addBox('proof-gate-left', new BABYLON.Vector3(-2.2, 1.45, WORLD.gateZ), new BABYLON.Vector3(.4, 2.9, .55), { material: goldMaterial, kind: 'gate-frame' });
  addBox('proof-gate-right', new BABYLON.Vector3(2.2, 1.45, WORLD.gateZ), new BABYLON.Vector3(.4, 2.9, .55), { material: goldMaterial, kind: 'gate-frame' });
  addBox('proof-gate-top', new BABYLON.Vector3(0, 2.7, WORLD.gateZ), new BABYLON.Vector3(4.7, .4, .55), { material: goldMaterial, kind: 'gate-frame' });
  const gateBarrierResult = addBox(
    'proof-gate-barrier',
    new BABYLON.Vector3(0, 1.4, WORLD.gateZ),
    new BABYLON.Vector3(4, 2.8, .24),
    { material: gateMaterial, kind: 'locked-gate', castsShadow: true }
  );
  const gateBarrier = gateBarrierResult.mesh;
  const gateCollider = gateBarrierResult.collider;

  const exitGlow = BABYLON.MeshBuilder.CreateGround('proof-exit-glow', { width: 3.8, height: .7 }, scene);
  exitGlow.position.set(0, .012, 14.65);
  exitGlow.material = moonMaterial;
  exitGlow.isPickable = false;

  const route = {
    arch: false,
    jump: false,
    crouch: false,
    arena: false,
    dragon: false,
    exit: false,
    jumpObserved: false,
    crouchObserved: false
  };
  let gateState = 'LOCKED';
  let gateProgress = 0;

  const markRoute = (key, message, events) => {
    if (route[key]) return;
    route[key] = true;
    events.push({ type: key, message });
  };

  const world = {
    floor,
    colliders,
    cameraBlockers,
    aimSurfaces,
    gateBarrier,
    startPosition: new BABYLON.Vector3(0, 0, -10.5),
    dragonPosition: new BABYLON.Vector3(0, 0, 9),
    unlockGate() {
      if (gateState !== 'LOCKED') return false;
      gateState = 'OPENING';
      removeCollider(gateCollider);
      return true;
    },
    reset() {
      for (const key of Object.keys(route)) route[key] = false;
      gateState = 'LOCKED';
      gateProgress = 0;
      gateBarrier.position.y = 1.4;
      gateBarrier.setEnabled(true);
      gateMaterial.alpha = .82;
      restoreCollider(gateCollider);
      exitGlow.visibility = .15;
    },
    update(player, dragon, deltaTime) {
      const events = [];
      if (player.position.z > -8.55) markRoute('arch', 'Moon Gate crossed · the Hollow lies ahead', events);
      if (player.position.z > -5.8 && player.position.z < -4.7 && player.position.y > .42) route.jumpObserved = true;
      if (route.arch && route.jumpObserved && player.position.z > -4.55) markRoute('jump', 'Rune relic cleared', events);
      if (Math.abs(player.position.z - .1) < .78 && player.crouched) route.crouchObserved = true;
      if (route.jump && route.crouchObserved && player.position.z > .8) markRoute('crouch', 'Low lintel cleared', events);
      if (route.crouch && player.position.z > 4.2) markRoute('arena', 'Dragon arena reached', events);
      if (!dragon.alive) {
        markRoute('dragon', 'Training dragon contained · exit unlocking', events);
        if (this.unlockGate()) events.push({ type: 'gate', message: 'Arena exit opening' });
      }
      if (gateState === 'OPENING') {
        gateProgress = Math.min(1, gateProgress + deltaTime / WORLD.gateOpenResponse);
        const eased = 1 - (1 - gateProgress) ** 3;
        gateBarrier.position.y = 1.4 + eased * WORLD.gateOpenHeight;
        gateMaterial.alpha = .82 * (1 - gateProgress);
        if (gateProgress >= 1) {
          gateState = 'OPEN';
          gateBarrier.setEnabled(false);
          events.push({ type: 'gate-open', message: 'Arena exit open · leave the training route' });
        }
      }
      if (gateState === 'OPEN' && player.position.z >= WORLD.exitZ) markRoute('exit', 'Level 1 technical route complete', events);
      exitGlow.visibility = gateState === 'OPEN' ? .75 + Math.sin(performance.now() * .004) * .2 : .15;
      return events;
    },
    nextObjective() {
      if (!route.arch) return 'Cross the Moon Gate';
      if (!route.jump) return 'Jump over the rune relic';
      if (!route.crouch) return 'Crouch beneath the low lintel';
      if (!route.arena) return 'Enter the dragon arena';
      if (!route.dragon) return 'Aim and contain the training dragon';
      if (gateState !== 'OPEN') return 'Wait for the arena exit';
      if (!route.exit) return 'Pass through the open exit';
      return 'Technical route complete';
    },
    snapshot() {
      return {
        route: { ...route },
        gate: { state: gateState, progress: gateProgress },
        objective: this.nextObjective(),
        complete: route.exit
      };
    }
  };

  return world;
}
