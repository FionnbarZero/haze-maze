import { WORLD } from './config.js?v=20260818-rewards-v1';
import { hexColor3 } from './utils.js';

export function createWorld(BABYLON, scene, shadowGenerator) {
  const colliders = [];
  const cameraBlockers = [];
  const aimSurfaces = [];
  const animatedScenery = [];
  const skySparkles = [];

  const brickMaterial = new BABYLON.StandardMaterial('temporary-brick-material', scene);
  brickMaterial.diffuseTexture = new BABYLON.Texture('assets/ancient-brick-wall-v2.jpg', scene, true, false);
  brickMaterial.diffuseTexture.uScale = 2.2;
  brickMaterial.diffuseTexture.vScale = 1.15;
  brickMaterial.diffuseColor = hexColor3(BABYLON, '#aa926f');
  brickMaterial.specularColor = hexColor3(BABYLON, '#3e323c');
  brickMaterial.roughness = .88;

  const floorMaterial = new BABYLON.StandardMaterial('temporary-floor-material', scene);
  floorMaterial.diffuseTexture = new BABYLON.Texture('assets/sunken-stone-wall-v2.jpg', scene, true, false);
  floorMaterial.diffuseTexture.uScale = 5;
  floorMaterial.diffuseTexture.vScale = 8;
  floorMaterial.diffuseTexture.level = .68;
  floorMaterial.diffuseColor = hexColor3(BABYLON, '#403247');
  floorMaterial.specularColor = hexColor3(BABYLON, '#29202b');
  floorMaterial.roughness = .95;

  const obstacleMaterial = new BABYLON.StandardMaterial('temporary-obstacle-material', scene);
  obstacleMaterial.diffuseColor = hexColor3(BABYLON, '#6e4e80');
  obstacleMaterial.emissiveColor = hexColor3(BABYLON, '#2a163d');

  const goldMaterial = new BABYLON.StandardMaterial('temporary-gold-material', scene);
  goldMaterial.diffuseColor = hexColor3(BABYLON, '#c99b50');
  goldMaterial.emissiveColor = hexColor3(BABYLON, '#4a2a0a');

  const gateMaterial = new BABYLON.StandardMaterial('temporary-gate-barrier-material', scene);
  gateMaterial.diffuseColor = hexColor3(BABYLON, '#8550bf');
  gateMaterial.emissiveColor = hexColor3(BABYLON, '#9650dd');
  gateMaterial.alpha = .82;

  const secondGateMaterial = new BABYLON.StandardMaterial('proof-second-gate-material', scene);
  secondGateMaterial.diffuseColor = hexColor3(BABYLON, '#6a456f');
  secondGateMaterial.emissiveColor = hexColor3(BABYLON, '#3f214e');
  secondGateMaterial.alpha = .78;

  const moonMaterial = new BABYLON.StandardMaterial('temporary-moon-material', scene);
  moonMaterial.diffuseColor = hexColor3(BABYLON, '#e2c8ff');
  moonMaterial.emissiveColor = hexColor3(BABYLON, '#7247a8');

  const treeBarkMaterial = new BABYLON.StandardMaterial('proof-tree-bark-material', scene);
  treeBarkMaterial.diffuseColor = hexColor3(BABYLON, '#5a4a39');
  treeBarkMaterial.specularColor = hexColor3(BABYLON, '#24180f');

  const treeLeafMaterial = new BABYLON.StandardMaterial('proof-tree-leaf-material', scene);
  treeLeafMaterial.diffuseColor = hexColor3(BABYLON, '#5ca76f');
  treeLeafMaterial.emissiveColor = hexColor3(BABYLON, '#224c2a');

  const creatureScaleMaterial = new BABYLON.StandardMaterial('proof-creature-scale-material', scene);
  creatureScaleMaterial.diffuseColor = hexColor3(BABYLON, '#7a4a5d');
  creatureScaleMaterial.specularColor = hexColor3(BABYLON, '#28161f');

  const creatureEyeMaterial = new BABYLON.StandardMaterial('proof-creature-eye-material', scene);
  creatureEyeMaterial.diffuseColor = hexColor3(BABYLON, '#f8e9ff');
  creatureEyeMaterial.emissiveColor = hexColor3(BABYLON, '#ffccff');

  const fountainStoneMaterial = new BABYLON.StandardMaterial('proof-fountain-stone-material', scene);
  fountainStoneMaterial.diffuseColor = hexColor3(BABYLON, '#6a5a70');
  fountainStoneMaterial.specularColor = hexColor3(BABYLON, '#2a2431');

  const waterMaterial = new BABYLON.StandardMaterial('proof-water-material', scene);
  waterMaterial.diffuseColor = hexColor3(BABYLON, '#4a719d');
  waterMaterial.emissiveColor = hexColor3(BABYLON, '#24537c');
  waterMaterial.alpha = .62;
  waterMaterial.specularColor = hexColor3(BABYLON, '#94d4ff');
  waterMaterial.roughness = .17;
  waterMaterial.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;

  const sparkleMaterial = new BABYLON.StandardMaterial('proof-sparkle-material', scene);
  sparkleMaterial.diffuseColor = hexColor3(BABYLON, '#ffd6ff');
  sparkleMaterial.emissiveColor = hexColor3(BABYLON, '#ffffff');
  sparkleMaterial.specularColor = hexColor3(BABYLON, '#ffffff');
  sparkleMaterial.disableLighting = true;

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

  function removeCollider(collider) {
    const index = colliders.indexOf(collider);
    if (index >= 0) colliders.splice(index, 1);
  }

  function restoreCollider(collider) {
    if (!colliders.includes(collider)) colliders.push(collider);
  }

  function addDecorationMesh(mesh, options = {}) {
    mesh.receiveShadows = Boolean(options.receiveShadows);
    registerMesh(mesh, {
      kind: options.kind || 'scenery',
      cameraObstacle: false,
      aimSurface: false
    });
    if (options.castsShadow) shadowGenerator.addShadowCaster(mesh);
    return mesh;
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

  function addCylinder(name, position, dimensions, options = {}) {
    const mesh = BABYLON.MeshBuilder.CreateCylinder(name, {
      height: dimensions.height,
      diameterTop: dimensions.diameterTop ?? dimensions.diameter,
      diameterBottom: dimensions.diameterBottom ?? dimensions.diameter,
      tessellation: dimensions.tessellation ?? 16
    }, scene);
    mesh.position.copyFrom(position);
    mesh.material = options.material || options.colorMaterial;
    addDecorationMesh(mesh, options);
    if (options.parent) mesh.parent = options.parent;
    return mesh;
  }

  function addSphere(name, position, dimensions, options = {}) {
    const mesh = BABYLON.MeshBuilder.CreateSphere(name, {
      diameter: dimensions.diameter,
      segments: dimensions.segments ?? 10
    }, scene);
    mesh.position.copyFrom(position);
    mesh.material = options.material || options.colorMaterial;
    addDecorationMesh(mesh, options);
    if (options.parent) mesh.parent = options.parent;
    return mesh;
  }

  function addTree(name, position, options = {}) {
    const scale = options.scale ?? 1;
    const tree = new BABYLON.TransformNode(name, scene);
    tree.position.copyFrom(position);
    const trunkHeight = (1.1 + Math.random() * .5) * scale;
    const trunk = BABYLON.MeshBuilder.CreateCylinder(
      `${name}-trunk`,
      {
        height: trunkHeight,
        diameterTop: .24 * scale,
        diameterBottom: .33 * scale,
        tessellation: 12
      },
      scene
    );
    trunk.parent = tree;
    trunk.position.y = trunkHeight / 2;
    trunk.material = treeBarkMaterial;
    addDecorationMesh(trunk, { kind: 'scenery-tree', castsShadow: true });

    for (let i = 0; i < 3; i += 1) {
      const canopy = BABYLON.MeshBuilder.CreateSphere(
        `${name}-canopy-${i}`,
        { diameter: .9 * scale + i * .12 * scale, segments: 14 },
        scene
      );
      canopy.parent = tree;
      canopy.position.y = trunkHeight * .75 + i * .18 * scale;
      canopy.material = treeLeafMaterial;
      canopy.scaling.set(1 + (i * .15), 1.05 + (i * .1), 1 + (i * .16));
      addDecorationMesh(canopy, { kind: 'scenery-tree' });
    }

    tree.rotation.y = options.rotationY ?? (Math.random() * Math.PI * 2);
    animatedScenery.push({
      kind: 'tree-sway',
      root: tree,
      phase: Math.random() * Math.PI * 2,
      sway: .04 + Math.random() * .02,
      speed: 0.5 + Math.random() * 0.4
    });

    return tree;
  }

  function addFantasyCreature(name, position, options = {}) {
    const creature = new BABYLON.TransformNode(name, scene);
    creature.position.copyFrom(position);
    creature.rotation.y = options.rotationY ?? (Math.random() * Math.PI * 2);

    const body = addSphere(
      `${name}-body`,
      new BABYLON.Vector3(0, .35, 0),
      { diameter: 1 * (options.scale ?? 1), segments: 12 },
      { material: creatureScaleMaterial, castsShadow: true }
    );
    body.parent = creature;

    const head = addSphere(
      `${name}-head`,
      new BABYLON.Vector3(0, .8 * (options.scale ?? 1), .12 * (options.scale ?? 1)),
      { diameter: .48 * (options.scale ?? 1), segments: 10 },
      { material: creatureScaleMaterial, castsShadow: true }
    );
    head.parent = creature;

    const hornA = addCylinder(
      `${name}-horn-a`,
      new BABYLON.Vector3(.22, .98, .19),
      { height: .2 * (options.scale ?? 1), diameter: .11 * (options.scale ?? 1) },
      { material: creatureEyeMaterial, castsShadow: true }
    );
    hornA.rotation.z = .24;
    hornA.parent = creature;

    const hornB = addCylinder(
      `${name}-horn-b`,
      new BABYLON.Vector3(-.22, .98, .19),
      { height: .2 * (options.scale ?? 1), diameter: .11 * (options.scale ?? 1) },
      { material: creatureEyeMaterial, castsShadow: true }
    );
    hornB.rotation.z = -.24;
    hornB.parent = creature;

    for (let i = 0; i < 4; i += 1) {
      const foot = addSphere(
        `${name}-foot-${i}`,
        new BABYLON.Vector3(
          -0.2 + i * 0.13,
          0.2,
          (i % 2) * 0.08
        ),
        { diameter: .18 * (options.scale ?? 1), segments: 8 },
        { material: creatureScaleMaterial }
      );
      foot.parent = creature;
      foot.position.y = 0.05;
    }

    const eyeGlow = addSphere(
      `${name}-eye-glow`,
      new BABYLON.Vector3(.12, .74, .42),
      { diameter: .1 * (options.scale ?? 1), segments: 8 },
      { material: creatureEyeMaterial }
    );
    eyeGlow.parent = creature;

    animatedScenery.push({
      kind: 'creature',
      root: creature,
      phase: Math.random() * Math.PI * 2,
      bob: .06 + Math.random() * .05,
      speed: .9 + Math.random() * .6,
      baseY: 0
    });

    return creature;
  }

  function addInsetFountain(name, position, options = {}) {
    const fountain = new BABYLON.TransformNode(name, scene);
    fountain.position.copyFrom(position);
    fountain.position.z -= .28;

    const basin = BABYLON.MeshBuilder.CreateCylinder(
      `${name}-basin`,
      {
        height: .32,
        diameterTop: 1.45,
        diameterBottom: 1.65,
        tessellation: 26
      },
      scene
    );
    basin.material = fountainStoneMaterial;
    basin.parent = fountain;
    basin.position.y = .16;
    addDecorationMesh(basin, { castsShadow: true });

    const innerBasin = BABYLON.MeshBuilder.CreateCylinder(
      `${name}-inner-basin`,
      {
        height: .16,
        diameterTop: 1.1,
        diameterBottom: 1.1,
        tessellation: 24
      },
      scene
    );
    innerBasin.material = waterMaterial;
    innerBasin.parent = fountain;
    innerBasin.position.y = .32;
    addDecorationMesh(innerBasin, { castsShadow: false });

    const rim = BABYLON.MeshBuilder.CreateTorus(
      `${name}-rim`,
      {
        diameter: 1.56,
        thickness: .07,
        tessellation: 24
      },
      scene
    );
    rim.parent = fountain;
    rim.rotation.x = Math.PI / 2;
    rim.position.y = .37;
    rim.material = treeBarkMaterial;
    addDecorationMesh(rim, { castsShadow: true });

    const jetBase = BABYLON.MeshBuilder.CreateCylinder(
      `${name}-jet-base`,
      {
        height: .12,
        diameter: .12,
        tessellation: 16
      },
      scene
    );
    jetBase.material = waterMaterial;
    jetBase.parent = fountain;
    jetBase.position.y = .48;
    addDecorationMesh(jetBase, { castsShadow: true });

    const jets = [];
    for (let i = 0; i < 3; i += 1) {
      const jet = BABYLON.MeshBuilder.CreateCylinder(
        `${name}-jet-${i}`,
        {
          height: .4,
          diameterTop: .03,
          diameterBottom: .09,
          tessellation: 8
        },
        scene
      );
      jet.material = waterMaterial;
      jet.parent = fountain;
      jet.position.set(-0.12 + i * 0.12, .52, 0.06);
      addDecorationMesh(jet, { castsShadow: false });
      jets.push(jet);
    }

    animatedScenery.push({
      kind: 'fountain',
      jets,
      phase: Math.random() * Math.PI * 2,
      flow: .9 + Math.random() * .7
    });

    return fountain;
  }

  function addWaterPool(name, position) {
    const pool = BABYLON.MeshBuilder.CreateDisc(
      `${name}-pool`,
      {
        radius: 1.65,
        tessellation: 48
      },
      scene
    );
    pool.rotation.x = Math.PI / 2;
    pool.position.set(position.x, 0.01, position.z);
    pool.material = fountainStoneMaterial;
    addDecorationMesh(pool, { kind: 'pool', castsShadow: false });

    const surface = BABYLON.MeshBuilder.CreateDisc(
      `${name}-water`,
      {
        radius: 1.42,
        tessellation: 48
      },
      scene
    );
    surface.rotation.x = Math.PI / 2;
    surface.position.set(position.x, 0.014, position.z);
    surface.material = waterMaterial;
    addDecorationMesh(surface, { kind: 'pool-water', castsShadow: false });

    const ring = BABYLON.MeshBuilder.CreateTorus(
      `${name}-ring`,
      {
        diameter: 2.96,
        thickness: .02,
        tessellation: 30
      },
      scene
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(position.x, 0.013, position.z);
    ring.material = moonMaterial;
    addDecorationMesh(ring, { kind: 'pool-ring', castsShadow: false });

    animatedScenery.push({
      kind: 'pool-ripple',
      base: surface,
      ring,
      phase: Math.random() * Math.PI * 2
    });
  }

  function addSkySparkles() {
    for (let i = 0; i < 72; i += 1) {
      const sparkle = BABYLON.MeshBuilder.CreateSphere(`proof-sky-sparkle-${i}`, {
        diameter: .03 + (Math.random() * .03),
        segments: 8
      }, scene);
      sparkle.material = sparkleMaterial;
      sparkle.position.set(
        (Math.random() - .5) * WORLD.floorWidth * 0.92,
        WORLD.wallHeight + 2 + Math.random() * 7,
        (Math.random() - .5) * WORLD.floorDepth * 0.92
      );
      sparkle.isPickable = false;
      sparkle.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      sparkle.visibility = 0;
      skySparkles.push({
        mesh: sparkle,
        baseY: sparkle.position.y,
        baseScale: sparkle.scaling.x,
        phase: Math.random() * Math.PI * 2,
        twinkle: 1.1 + Math.random() * 2.1,
        drift: 0.08 + Math.random() * 0.16
      });
    }
  }

  const treeClusters = [
    [-7, 0, -2.1, 0.9],
    [-6.2, 0, -6.4, 0.8],
    [6.6, 0, -4.3, 0.85],
    [7, 0, -1.9, 0.95]
  ];
  for (let i = 0; i < treeClusters.length; i += 1) {
    const [x, y, z, scale] = treeClusters[i];
    addTree(`proof-tree-${i}`, new BABYLON.Vector3(x, y, z), {
      scale,
      rotationY: 0
    });
  }

  const creaturePositions = [
    { name: 'sky-fox', position: new BABYLON.Vector3(-3.35, 0, 1.4), scale: 0.4, rotationY: 1.3 },
    { name: 'moon-marten', position: new BABYLON.Vector3(2.95, 0, 6.45), scale: 0.38, rotationY: -0.8 },
    { name: 'ember-hare', position: new BABYLON.Vector3(4.75, 0, -1.4), scale: 0.43, rotationY: 2.2 }
  ];
  for (const creature of creaturePositions) {
    addFantasyCreature(creature.name, creature.position, {
      scale: creature.scale,
      rotationY: creature.rotationY
    });
  }

  addInsetFountain('proof-fountain-west', new BABYLON.Vector3(-4.62, 0, 14.46));
  addInsetFountain('proof-fountain-east', new BABYLON.Vector3(4.62, 0, 14.46));
  addWaterPool('proof-water-pool', new BABYLON.Vector3(0, 0, 11.35));
  addSkySparkles();

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

  const secondDragonRoomWest = addBox(
    'proof-second-room-wall-west',
    new BABYLON.Vector3(-2.3, wallY, 11.95),
    new BABYLON.Vector3(.45, WORLD.wallHeight, 5.4),
    { material: brickMaterial, kind: 'second-room-wall', castsShadow: true }
  );
  const secondDragonRoomEast = addBox(
    'proof-second-room-wall-east',
    new BABYLON.Vector3(2.3, wallY, 11.95),
    new BABYLON.Vector3(.45, WORLD.wallHeight, 5.4),
    { material: brickMaterial, kind: 'second-room-wall', castsShadow: true }
  );
  const secondDragonRoomDoor = addBox(
    'proof-second-room-door',
    new BABYLON.Vector3(0, 1.4, 10.88),
    new BABYLON.Vector3(4, 2.8, .55),
    { material: secondGateMaterial, kind: 'second-room-gate', castsShadow: true }
  );
  const secondRoomDoorBarrier = secondDragonRoomDoor.collider;
  const secondRoomDoorMesh = secondDragonRoomDoor.mesh;

  const route = {
    arch: false,
    jump: false,
    crouch: false,
    arena: false,
    secondRoom: false,
    firstDragon: false,
    dragon: false,
    exit: false,
    jumpObserved: false,
    crouchObserved: false
  };
  let gateState = 'LOCKED';
  let gateProgress = 0;
  let dragonPhase = 1;
  let secondDragonStarted = false;
  const firstDragonPosition = new BABYLON.Vector3(0, 0, 9);
  const secondDragonPosition = new BABYLON.Vector3(0, 0, 12.6);
  const secondDragonPatrol = [
    new BABYLON.Vector3(-1.05, 0, 11.88),
    new BABYLON.Vector3(1.05, 0, 11.88),
    new BABYLON.Vector3(1.35, 0, 12.78),
    new BABYLON.Vector3(-1.35, 0, 12.78)
  ];

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
    dragonPosition: firstDragonPosition,
    openSecondRoomDoor() {
      if (secondDragonStarted && route.secondRoom) return false;
      route.secondRoom = true;
      secondDragonStarted = true;
      secondRoomDoorMesh.setEnabled(false);
      removeCollider(secondRoomDoorBarrier);
      return true;
    },
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
      secondDragonStarted = false;
      dragonPhase = 1;
      secondRoomDoorMesh.setEnabled(true);
      secondRoomDoorMesh.material.alpha = .78;
      if (secondRoomDoorBarrier) restoreCollider(secondRoomDoorBarrier);
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
      if (dragonPhase === 1 && !route.firstDragon && !dragon.alive) {
        markRoute('firstDragon', 'First guardian contained · second chamber opened', events);
        dragon.setSpawnPosition(secondDragonPosition);
        dragon.setPatrol(secondDragonPatrol, 1.05, 1);
        dragon.reset();
        this.openSecondRoomDoor();
        dragonPhase = 2;
        events.push({ type: 'dragon-phase', message: 'Second guardian awakens' });
      }

      if (dragonPhase === 2 && route.firstDragon && !route.dragon && !dragon.alive) {
        markRoute('dragon', 'Second guardian contained · exit unlocking', events);
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

      const now = performance.now() * .001;
      for (const item of animatedScenery) {
        if (item.kind === 'tree-sway') {
          item.root.rotation.z = Math.sin(now * item.speed + item.phase) * item.sway;
          item.root.rotation.x = Math.sin(now * item.speed * 0.6 + item.phase) * item.sway * .4;
        }
        if (item.kind === 'creature') {
          item.root.position.y = item.baseY + Math.sin(now * item.speed + item.phase) * item.bob;
          item.root.rotation.y = item.phase + Math.sin(now * item.speed * 0.6 + item.phase) * .15;
        }
        if (item.kind === 'fountain') {
          for (const jet of item.jets) {
            const pulse = (Math.sin(now * item.flow + item.phase) + 1) / 2;
            jet.scaling.y = .18 + pulse * .7;
            jet.position.y = .52 + pulse * .05;
          }
        }
        if (item.kind === 'pool-ripple') {
          item.base.rotation.y = Math.sin(now * .45 + item.phase) * .06;
          item.ring.rotation.z = Math.sin(now * .35 + item.phase + 1) * .06;
        }
      }

      for (const sparkle of skySparkles) {
        const pulse = (Math.sin(now * sparkle.twinkle + sparkle.phase) + 1) / 2;
        sparkle.mesh.visibility = .1 + pulse * .5;
        sparkle.mesh.position.y = sparkle.baseY + Math.sin(now * sparkle.drift + sparkle.phase) * .35;
        sparkle.mesh.scaling.set(
          sparkle.baseScale * (1 + pulse * .25),
          sparkle.baseScale * (1 + pulse * .25),
          sparkle.baseScale * (1 + pulse * .25)
        );
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
      if (!route.firstDragon) return 'Aim and contain the first dragon';
      if (!route.secondRoom) return 'Open the second chamber gate';
      if (!route.dragon) return 'Defeat the moving second guardian';
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
