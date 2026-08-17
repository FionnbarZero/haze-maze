import { WORLD } from './config.js';
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

  const moonMaterial = new BABYLON.StandardMaterial('temporary-moon-material', scene);
  moonMaterial.diffuseColor = hexColor3(BABYLON, '#caa7ff');
  moonMaterial.emissiveColor = hexColor3(BABYLON, '#573386');

  const floor = BABYLON.MeshBuilder.CreateGround('proof-floor', { width: WORLD.floorWidth, height: WORLD.floorDepth, subdivisions: 2 }, scene);
  floor.material = floorMaterial;
  floor.receiveShadows = true;
  floor.isPickable = true;
  floor.metadata = { aimSurface: true, kind: 'floor' };
  aimSurfaces.push(floor);

  function addBox(name, position, dimensions, options = {}) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, { width: dimensions.x, height: dimensions.y, depth: dimensions.z }, scene);
    mesh.position.copyFrom(position);
    mesh.material = options.material || brickMaterial;
    mesh.receiveShadows = true;
    mesh.isPickable = true;
    mesh.metadata = {
      kind: options.kind || 'wall',
      cameraObstacle: options.cameraObstacle !== false,
      aimSurface: options.aimSurface !== false
    };
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
    if (mesh.metadata.cameraObstacle) cameraBlockers.push(mesh);
    if (mesh.metadata.aimSurface) aimSurfaces.push(mesh);
    return { mesh, collider };
  }

  const halfWidth = WORLD.floorWidth / 2;
  const halfDepth = WORLD.floorDepth / 2;
  const wallY = WORLD.wallHeight / 2;
  addBox('outer-wall-west', new BABYLON.Vector3(-halfWidth + WORLD.wallThickness / 2, wallY, 0), new BABYLON.Vector3(WORLD.wallThickness, WORLD.wallHeight, WORLD.floorDepth));
  addBox('outer-wall-east', new BABYLON.Vector3(halfWidth - WORLD.wallThickness / 2, wallY, 0), new BABYLON.Vector3(WORLD.wallThickness, WORLD.wallHeight, WORLD.floorDepth));
  addBox('outer-wall-south', new BABYLON.Vector3(0, wallY, -halfDepth + WORLD.wallThickness / 2), new BABYLON.Vector3(WORLD.floorWidth, WORLD.wallHeight, WORLD.wallThickness));
  addBox('outer-wall-north', new BABYLON.Vector3(0, wallY, halfDepth - WORLD.wallThickness / 2), new BABYLON.Vector3(WORLD.floorWidth, WORLD.wallHeight, WORLD.wallThickness));

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
  shadowGenerator.addShadowCaster(archRing);
  for (const side of [-1, 1]) {
    const pillar = BABYLON.MeshBuilder.CreateBox(`moon-arch-pillar-${side}`, { width: .42, height: 1.65, depth: .46 }, scene);
    pillar.parent = arch;
    pillar.position.set(side * 1.42, .82, 0);
    pillar.material = brickMaterial;
    shadowGenerator.addShadowCaster(pillar);
  }

  const moon = BABYLON.MeshBuilder.CreateSphere('distant-moon', { diameter: 5, segments: 24 }, scene);
  moon.position.set(-8, 12, 17);
  moon.material = moonMaterial;
  moon.isPickable = false;

  const gateLeft = addBox('proof-gate-left', new BABYLON.Vector3(-2.2, 1.45, 13.7), new BABYLON.Vector3(.4, 2.9, .55), { material: goldMaterial, kind: 'gate' }).mesh;
  const gateRight = addBox('proof-gate-right', new BABYLON.Vector3(2.2, 1.45, 13.7), new BABYLON.Vector3(.4, 2.9, .55), { material: goldMaterial, kind: 'gate' }).mesh;
  const gateTop = addBox('proof-gate-top', new BABYLON.Vector3(0, 2.7, 13.7), new BABYLON.Vector3(4.7, .4, .55), { material: goldMaterial, kind: 'gate' }).mesh;
  void gateLeft; void gateRight; void gateTop;

  return {
    floor,
    colliders,
    cameraBlockers,
    aimSurfaces,
    startPosition: new BABYLON.Vector3(0, 0, -10.5),
    dragonPosition: new BABYLON.Vector3(0, 0, 9)
  };
}
