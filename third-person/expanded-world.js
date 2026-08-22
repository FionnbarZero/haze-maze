import { PLAYER, POUCH, WORLD } from './config.js?v=20260822-safer-dragons-v2';
import { createMazeLayout, createSeededRandom } from './maze-layout.js?v=20260822-safer-dragons-v1';
import { createChapterOneLevelPlan } from './chapter-level-plan.js?v=20260820-chapter-one-v2';
import { hexColor3 } from './utils.js';

export function createWorld(BABYLON, scene, shadowGenerator, options = {}) {
  const colliders = [];
  const cameraBlockers = [];
  const aimSurfaces = [];
  const animatedScenery = [];
  const skySparkles = [];
  const generatedSeed = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const mazeSeed = options.seed || `${WORLD.defaultMazeSeed}:${generatedSeed}`;
  const routeMode = options.routeMode === 'chapter1' ? 'chapter1' : 'legacy';
  const layoutOptions = {
    seed: mazeSeed,
    width: WORLD.floorWidth,
    depth: WORLD.floorDepth,
    wallThickness: WORLD.wallThickness
  };
  const planningLayout = createMazeLayout(layoutOptions);
  const levelPlan = routeMode === 'chapter1'
    ? createChapterOneLevelPlan({ seed: mazeSeed, layout: planningLayout })
    : null;
  const layout = levelPlan
    ? createMazeLayout({
      ...layoutOptions,
      protectedPositions: [...levelPlan.requiredGeodes, ...levelPlan.optionalGeodes]
        .map(geode => geode.position),
      protectedRadius: WORLD.chapterGeodeDragonClearance
    })
    : planningLayout;
  const random = createSeededRandom(`${mazeSeed}:render`);

  const material = (name, diffuse, emissive = '#000000', alpha = 1) => {
    const result = new BABYLON.StandardMaterial(name, scene);
    result.diffuseColor = hexColor3(BABYLON, diffuse);
    result.emissiveColor = hexColor3(BABYLON, emissive);
    result.specularColor = hexColor3(BABYLON, '#3c3444');
    result.alpha = alpha;
    return result;
  };

  const brickMaterial = material('expanded-maze-brick-material', '#aa926f');
  brickMaterial.diffuseTexture = new BABYLON.Texture('assets/ancient-brick-wall-v2.jpg', scene, true, false);
  brickMaterial.diffuseTexture.uScale = 2.2;
  brickMaterial.diffuseTexture.vScale = 1.15;
  brickMaterial.roughness = .88;

  const floorMaterial = material('expanded-maze-floor-material', '#403247');
  floorMaterial.diffuseTexture = new BABYLON.Texture('assets/sunken-stone-wall-v2.jpg', scene, true, false);
  floorMaterial.diffuseTexture.uScale = 9;
  floorMaterial.diffuseTexture.vScale = 14;
  floorMaterial.diffuseTexture.level = .68;
  floorMaterial.roughness = .95;

  const runeDoorMaterial = material('first-rune-door-material', '#76448e', '#5b237b', .82);
  const traversalMaterial = material('expanded-traversal-obstacle-material', '#76518e', '#47245f', .86);
  const finalDoorMaterial = material('final-moon-door-material', '#9b62d3', '#a96aff', .84);
  const portalMaterial = material('moon-door-portal-material', '#d8b9ff', '#8e4ddb', .72);
  portalMaterial.disableLighting = true;
  portalMaterial.backFaceCulling = false;
  const moonMaterial = material('expanded-moon-material', '#e2c8ff', '#7247a8');
  const treeBarkMaterial = material('expanded-tree-bark-material', '#5a4a39');
  const treeLeafMaterial = material('expanded-tree-leaf-material', '#5ca76f', '#224c2a');
  const creatureMaterial = material('expanded-creature-material', '#7a4a5d');
  const creatureEyeMaterial = material('expanded-creature-eye-material', '#f8e9ff', '#ffccff');
  const fountainStoneMaterial = material('expanded-fountain-stone-material', '#6a5a70');
  const waterMaterial = material('expanded-water-material', '#4a719d', '#24537c', .62);
  waterMaterial.specularColor = hexColor3(BABYLON, '#94d4ff');
  waterMaterial.backFaceCulling = false;
  const sparkleMaterial = material('expanded-sparkle-material', '#ffd6ff', '#ffffff');
  sparkleMaterial.disableLighting = true;

  const floor = BABYLON.MeshBuilder.CreateGround('expanded-maze-floor', {
    width: WORLD.floorWidth,
    height: WORLD.floorDepth,
    subdivisions: 4
  }, scene);
  floor.material = floorMaterial;
  floor.receiveShadows = true;
  floor.isPickable = true;
  floor.metadata = { aimSurface: true, kind: 'floor' };
  aimSurfaces.push(floor);

  const registerMesh = (mesh, options = {}) => {
    mesh.isPickable = options.pickable !== false;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      kind: options.kind || 'world-prop',
      cameraObstacle: options.cameraObstacle !== false,
      aimSurface: options.aimSurface !== false
    };
    if (mesh.metadata.cameraObstacle) cameraBlockers.push(mesh);
    if (mesh.metadata.aimSurface) aimSurfaces.push(mesh);
    if (options.castsShadow) shadowGenerator.addShadowCaster(mesh);
    return mesh;
  };

  const addBox = (name, position, dimensions, options = {}) => {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, {
      width: dimensions.x,
      height: dimensions.y,
      depth: dimensions.z
    }, scene);
    mesh.position.copyFrom(position);
    mesh.material = options.material || brickMaterial;
    mesh.receiveShadows = true;
    registerMesh(mesh, { kind: options.kind || 'wall', castsShadow: options.castsShadow, ...options });
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
  };

  const removeCollider = collider => {
    const index = colliders.indexOf(collider);
    if (index >= 0) colliders.splice(index, 1);
  };
  const restoreCollider = collider => {
    if (collider && !colliders.includes(collider)) colliders.push(collider);
  };

  const addTree = definition => {
    const root = new BABYLON.TransformNode(`expanded-${definition.id}`, scene);
    root.position.set(definition.x, 0, definition.z);
    root.rotation.y = random() * Math.PI * 2;
    const trunkHeight = (1.15 + random() * .42) * definition.scale;
    const trunk = BABYLON.MeshBuilder.CreateCylinder(`${definition.id}-trunk`, {
      height: trunkHeight,
      diameterTop: .22 * definition.scale,
      diameterBottom: .34 * definition.scale,
      tessellation: 10
    }, scene);
    trunk.parent = root;
    trunk.position.y = trunkHeight / 2;
    trunk.material = treeBarkMaterial;
    registerMesh(trunk, { kind: 'scenery-tree', cameraObstacle: false, aimSurface: false, castsShadow: true });
    for (let index = 0; index < 3; index += 1) {
      const canopy = BABYLON.MeshBuilder.CreateSphere(`${definition.id}-canopy-${index}`, {
        diameter: (.9 + index * .13) * definition.scale,
        segments: 12
      }, scene);
      canopy.parent = root;
      canopy.position.y = trunkHeight * .75 + index * .18;
      canopy.scaling.set(1 + index * .12, 1.05 + index * .08, 1 + index * .14);
      canopy.material = treeLeafMaterial;
      registerMesh(canopy, { kind: 'scenery-tree', cameraObstacle: false, aimSurface: false, pickable: false });
    }
    animatedScenery.push({
      kind: 'tree',
      root,
      phase: random() * Math.PI * 2,
      speed: .45 + random() * .35,
      sway: .035 + random() * .02
    });
  };

  const addCreature = definition => {
    const root = new BABYLON.TransformNode(`expanded-${definition.id}`, scene);
    root.position.set(definition.x, 0, definition.z);
    root.rotation.y = definition.rotationY;
    const body = BABYLON.MeshBuilder.CreateSphere(`${definition.id}-body`, { diameter: definition.scale, segments: 10 }, scene);
    body.parent = root;
    body.position.y = .34;
    body.scaling.set(1.25, .72, 1.45);
    body.material = creatureMaterial;
    registerMesh(body, { kind: 'fantasy-animal', cameraObstacle: false, aimSurface: false, castsShadow: true });
    const head = BABYLON.MeshBuilder.CreateSphere(`${definition.id}-head`, { diameter: definition.scale * .58, segments: 10 }, scene);
    head.parent = root;
    head.position.set(0, .62, definition.scale * .5);
    head.material = creatureMaterial;
    registerMesh(head, { kind: 'fantasy-animal', cameraObstacle: false, aimSurface: false, pickable: false });
    for (const side of [-1, 1]) {
      const eye = BABYLON.MeshBuilder.CreateSphere(`${definition.id}-eye-${side}`, { diameter: .07, segments: 8 }, scene);
      eye.parent = root;
      eye.position.set(side * .11, .68, definition.scale * .78);
      eye.material = creatureEyeMaterial;
      registerMesh(eye, { kind: 'fantasy-animal', cameraObstacle: false, aimSurface: false, pickable: false });
    }
    animatedScenery.push({
      kind: 'creature',
      root,
      baseY: 0,
      phase: random() * Math.PI * 2,
      speed: .8 + random() * .65,
      bob: .045 + random() * .04
    });
  };

  const addFountain = definition => {
    const root = new BABYLON.TransformNode(`expanded-${definition.id}`, scene);
    root.position.set(definition.x, 0, definition.z);
    root.rotation.y = definition.rotationY;
    const niche = BABYLON.MeshBuilder.CreateBox(`${definition.id}-wall-niche`, {
      width: 1.35,
      height: 1.75,
      depth: .14
    }, scene);
    niche.parent = root;
    niche.position.set(0, 1, -.38);
    niche.material = fountainStoneMaterial;
    registerMesh(niche, { kind: 'fountain-niche', cameraObstacle: false, aimSurface: false, castsShadow: true });
    const waterSheet = BABYLON.MeshBuilder.CreatePlane(`${definition.id}-water-sheet`, {
      width: .72,
      height: 1.12,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    waterSheet.parent = root;
    waterSheet.position.set(0, 1.02, -.3);
    waterSheet.material = waterMaterial;
    registerMesh(waterSheet, { kind: 'fountain-water', cameraObstacle: false, aimSurface: false, pickable: false });
    const basin = BABYLON.MeshBuilder.CreateCylinder(`${definition.id}-basin`, {
      height: .3,
      diameterTop: 1.3,
      diameterBottom: 1.55,
      tessellation: 22
    }, scene);
    basin.parent = root;
    basin.position.y = .15;
    basin.material = fountainStoneMaterial;
    registerMesh(basin, { kind: 'fountain', cameraObstacle: false, aimSurface: false, castsShadow: true });
    const water = BABYLON.MeshBuilder.CreateCylinder(`${definition.id}-water`, {
      height: .08,
      diameter: 1.08,
      tessellation: 22
    }, scene);
    water.parent = root;
    water.position.y = .32;
    water.material = waterMaterial;
    registerMesh(water, { kind: 'fountain-water', cameraObstacle: false, aimSurface: false, pickable: false });
    const jets = [];
    for (let index = 0; index < 3; index += 1) {
      const jet = BABYLON.MeshBuilder.CreateCylinder(`${definition.id}-jet-${index}`, {
        height: .46,
        diameterTop: .025,
        diameterBottom: .075,
        tessellation: 7
      }, scene);
      jet.parent = root;
      jet.position.set((index - 1) * .12, .54, 0);
      jet.material = waterMaterial;
      registerMesh(jet, { kind: 'fountain-water', cameraObstacle: false, aimSurface: false, pickable: false });
      jets.push(jet);
    }
    animatedScenery.push({ kind: 'fountain', jets, phase: random() * Math.PI * 2, speed: .9 + random() * .6 });
  };

  const addPool = () => {
    const stone = BABYLON.MeshBuilder.CreateDisc('expanded-water-pool-stone', { radius: 1.8, tessellation: 40 }, scene);
    stone.rotation.x = Math.PI / 2;
    stone.position.set(0, .01, 20.2);
    stone.material = fountainStoneMaterial;
    registerMesh(stone, { kind: 'pool', cameraObstacle: false, aimSurface: false });
    const water = BABYLON.MeshBuilder.CreateDisc('expanded-water-pool', { radius: 1.52, tessellation: 40 }, scene);
    water.rotation.x = Math.PI / 2;
    water.position.set(0, .018, 20.2);
    water.material = waterMaterial;
    registerMesh(water, { kind: 'pool-water', cameraObstacle: false, aimSurface: false, pickable: false });
    animatedScenery.push({ kind: 'pool', mesh: water, phase: random() * Math.PI * 2 });
  };

  const addMoonArch = (name, z, exit = false) => {
    const root = new BABYLON.TransformNode(name, scene);
    root.position.z = z;
    const ring = BABYLON.MeshBuilder.CreateTorus(`${name}-ring`, { diameter: 3.35, thickness: .28, tessellation: 48 }, scene);
    ring.parent = root;
    ring.position.y = 1.63;
    ring.rotation.x = Math.PI / 2;
    ring.material = moonMaterial;
    registerMesh(ring, { kind: exit ? 'moon-door' : 'moon-arch', castsShadow: true });
    for (const side of [-1, 1]) {
      addBox(
        `${name}-pillar-${side}`,
        new BABYLON.Vector3(side * 1.5, .85, z),
        new BABYLON.Vector3(.44, 1.7, .48),
        { material: brickMaterial, kind: exit ? 'moon-door-frame' : 'moon-arch', castsShadow: true }
      );
    }
    if (!exit) return { root, ring, portal: null };
    const portal = BABYLON.MeshBuilder.CreateDisc(`${name}-portal`, { radius: 1.42, tessellation: 48 }, scene);
    portal.parent = root;
    portal.position.y = 1.47;
    portal.material = portalMaterial;
    portal.isPickable = false;
    portal.visibility = .08;
    return { root, ring, portal };
  };

  for (const definition of layout.treePositions) addTree(definition);
  for (const definition of layout.creaturePositions) addCreature(definition);
  for (const definition of layout.fountainPositions) addFountain(definition);
  addPool();

  for (let index = 0; index < 72; index += 1) {
    const sparkle = BABYLON.MeshBuilder.CreateSphere(`expanded-sky-sparkle-${index}`, {
      diameter: .025 + random() * .035,
      segments: 6
    }, scene);
    sparkle.position.set(
      (random() - .5) * WORLD.floorWidth * .94,
      WORLD.wallHeight + 2 + random() * 8,
      (random() - .5) * WORLD.floorDepth * .94
    );
    sparkle.material = sparkleMaterial;
    sparkle.isPickable = false;
    sparkle.visibility = 0;
    skySparkles.push({
      mesh: sparkle,
      baseY: sparkle.position.y,
      phase: random() * Math.PI * 2,
      twinkle: 1 + random() * 2,
      drift: .08 + random() * .16
    });
  }

  const halfWidth = WORLD.floorWidth / 2;
  const halfDepth = WORLD.floorDepth / 2;
  const wallY = WORLD.wallHeight / 2;
  addBox('expanded-outer-wall-west', new BABYLON.Vector3(-halfWidth + WORLD.wallThickness / 2, wallY, 0), new BABYLON.Vector3(WORLD.wallThickness, WORLD.wallHeight, WORLD.floorDepth), { castsShadow: true });
  addBox('expanded-outer-wall-east', new BABYLON.Vector3(halfWidth - WORLD.wallThickness / 2, wallY, 0), new BABYLON.Vector3(WORLD.wallThickness, WORLD.wallHeight, WORLD.floorDepth), { castsShadow: true });
  addBox('expanded-outer-wall-south', new BABYLON.Vector3(0, wallY, -halfDepth + WORLD.wallThickness / 2), new BABYLON.Vector3(WORLD.floorWidth, WORLD.wallHeight, WORLD.wallThickness), { castsShadow: true });
  const finalGap = 4.4;
  const northSideWidth = (WORLD.floorWidth - finalGap) / 2;
  addBox('expanded-outer-wall-northwest', new BABYLON.Vector3(-(finalGap / 2 + northSideWidth / 2), wallY, halfDepth - WORLD.wallThickness / 2), new BABYLON.Vector3(northSideWidth, WORLD.wallHeight, WORLD.wallThickness), { castsShadow: true });
  addBox('expanded-outer-wall-northeast', new BABYLON.Vector3(finalGap / 2 + northSideWidth / 2, wallY, halfDepth - WORLD.wallThickness / 2), new BABYLON.Vector3(northSideWidth, WORLD.wallHeight, WORLD.wallThickness), { castsShadow: true });

  for (const wall of layout.walls) {
    addBox(
      `expanded-${wall.id}`,
      new BABYLON.Vector3(wall.x, wallY, wall.z),
      new BABYLON.Vector3(wall.width, WORLD.wallHeight, wall.depth),
      { kind: 'variable-room-wall', castsShadow: true }
    );
  }

  addBox('expanded-jump-relic', new BABYLON.Vector3(0, .28, -14.2), new BABYLON.Vector3(3.9, .56, .72), { material: traversalMaterial, kind: 'jump-obstacle', castsShadow: true });
  addBox('expanded-crouch-lintel', new BABYLON.Vector3(0, 1.82, .1), new BABYLON.Vector3(4.1, .94, .72), { material: traversalMaterial, kind: 'crouch-obstacle', castsShadow: true });

  addMoonArch('expanded-entrance-moon-arch', WORLD.entranceZ, false);
  const exitMoonDoor = addMoonArch('expanded-exit-moon-door', WORLD.gateZ, true);

  const firstDoorResult = addBox(
    'expanded-first-rune-door',
    new BABYLON.Vector3(0, 1.4, WORLD.firstDoorZ),
    new BABYLON.Vector3(4.1, 2.8, .3),
    { material: runeDoorMaterial, kind: 'first-rune-door', castsShadow: true }
  );
  const finalDoorResult = addBox(
    'expanded-final-rune-door',
    new BABYLON.Vector3(0, 1.4, WORLD.gateZ),
    new BABYLON.Vector3(4.05, 2.8, .24),
    { material: finalDoorMaterial, kind: 'final-rune-door', castsShadow: true }
  );

  const route = routeMode === 'chapter1'
    ? {
      entrance: false,
      fragments: false,
      sunkenGate: false
    }
    : {
      entrance: false,
      southRunes: false,
      firstDoor: false,
      northRooms: false,
      allRunes: false,
      finalDoor: false,
      moonDoor: false,
      exit: false
    };
  const firstDoor = { state: 'LOCKED', progress: 0, mesh: firstDoorResult.mesh, collider: firstDoorResult.collider, material: runeDoorMaterial, baseAlpha: .82 };
  const finalDoor = { state: 'LOCKED', progress: 0, mesh: finalDoorResult.mesh, collider: finalDoorResult.collider, material: finalDoorMaterial, baseAlpha: .84 };
  let runeCount = 0;
  let chapterProgression = null;
  let exitProgress = 0;

  const markRoute = (key, message, events) => {
    if (route[key]) return false;
    route[key] = true;
    events.push({ type: key, message });
    return true;
  };

  const beginOpening = (door, events, message) => {
    if (door.state !== 'LOCKED') return false;
    door.state = 'OPENING';
    removeCollider(door.collider);
    events.push({ type: 'door-opening', message });
    return true;
  };

  const animateDoor = (door, deltaTime, events, label) => {
    if (door.state !== 'OPENING') return;
    door.progress = Math.min(1, door.progress + deltaTime / WORLD.gateOpenResponse);
    const eased = 1 - (1 - door.progress) ** 3;
    door.mesh.position.y = 1.4 + eased * WORLD.gateOpenHeight;
    door.material.alpha = door.baseAlpha * (1 - door.progress);
    if (door.progress >= 1) {
      door.state = 'OPEN';
      door.mesh.setEnabled(false);
      events.push({ type: 'door-open', message: `${label} open` });
    }
  };

  const animateScenery = () => {
    const now = performance.now() / 1000;
    for (const item of animatedScenery) {
      if (item.kind === 'tree') {
        item.root.rotation.z = Math.sin(now * item.speed + item.phase) * item.sway;
        item.root.rotation.x = Math.sin(now * item.speed * .6 + item.phase) * item.sway * .4;
      } else if (item.kind === 'creature') {
        item.root.position.y = item.baseY + Math.sin(now * item.speed + item.phase) * item.bob;
        item.root.rotation.y += Math.sin(now * item.speed * .35 + item.phase) * .0008;
      } else if (item.kind === 'fountain') {
        const pulse = .5 + Math.sin(now * item.speed + item.phase) * .5;
        for (const jet of item.jets) jet.scaling.y = .25 + pulse * .75;
      } else if (item.kind === 'pool') {
        item.mesh.rotation.z = Math.sin(now * .42 + item.phase) * .04;
      }
    }
    for (const sparkle of skySparkles) {
      const pulse = .5 + Math.sin(now * sparkle.twinkle + sparkle.phase) * .5;
      sparkle.mesh.visibility = .08 + pulse * .5;
      sparkle.mesh.position.y = sparkle.baseY + Math.sin(now * sparkle.drift + sparkle.phase) * .35;
      sparkle.mesh.scaling.setAll(.8 + pulse * .45);
    }
    exitMoonDoor.ring.rotation.z = Math.sin(now * .6) * .035;
    exitMoonDoor.portal.visibility = finalDoor.state === 'OPEN'
      ? .42 + Math.sin(now * 4) * .12
      : .06;
  };

  const world = {
    floor,
    colliders,
    cameraBlockers,
    aimSurfaces,
    gateBarrier: finalDoor.mesh,
    startPosition: new BABYLON.Vector3(PLAYER.start.x, PLAYER.start.y, PLAYER.start.z),
    dragonPosition: new BABYLON.Vector3(layout.dragonSpawns[0].x, 0, layout.dragonSpawns[0].z),
    dragonSpawns: layout.dragonSpawns.map(spawn => ({ ...spawn })),
    mazeSeed,
    routeMode,
    levelPlan,
    setRuneCount(count) {
      if (routeMode !== 'legacy') return 0;
      runeCount = Math.max(0, Math.min(POUCH.requiredRunes, Math.floor(Number(count) || 0)));
      return runeCount;
    },
    setChapterProgression(state) {
      chapterProgression = state?.kind === 'CHAPTER_ONE_PROGRESSION' ? state : null;
      return chapterProgression;
    },
    reset() {
      for (const key of Object.keys(route)) route[key] = false;
      runeCount = 0;
      chapterProgression = null;
      exitProgress = 0;
      for (const door of [firstDoor, finalDoor]) {
        door.state = 'LOCKED';
        door.progress = 0;
        door.mesh.position.y = 1.4;
        door.mesh.setEnabled(true);
        door.material.alpha = door.baseAlpha;
        restoreCollider(door.collider);
      }
      exitMoonDoor.portal.visibility = .06;
    },
    update(player, dragons = [], deltaTime, { playerActionsEnabled = true } = {}) {
      const events = [];
      if (routeMode === 'chapter1') {
        if (playerActionsEnabled && player.position.z > WORLD.entranceZ + .65) {
          markRoute('entrance', 'Moon Gate crossed · mine the three marked Garden Maze geodes', events);
        }
        if (chapterProgression?.routeRune?.completed) {
          markRoute('fragments', 'West Route-Rune completed · the Sunken Gate is yielding', events);
        }
        if (chapterProgression?.sunkenGate?.unlocked) {
          beginOpening(firstDoor, events, 'West Route-Rune answered · the Sunken Gate is opening');
        }
        animateDoor(firstDoor, deltaTime, events, 'Sunken Gate');
        if (playerActionsEnabled && firstDoor.state === 'OPEN' && player.position.z > WORLD.firstDoorZ + .75) {
          markRoute('sunkenGate', 'Sunken Gate crossed · Garden Maze slice complete', events);
        }
      } else {
        if (player.position.z > WORLD.entranceZ + .65) markRoute('entrance', 'Moon Gate crossed · search the southern rooms', events);
        if (runeCount >= POUCH.firstDoorRunes) {
          markRoute('southRunes', 'Two runes found · the inner seal is yielding', events);
          beginOpening(firstDoor, events, 'Two runes joined · the first door is opening');
        }
        animateDoor(firstDoor, deltaTime, events, 'First rune door');
        if (firstDoor.state === 'OPEN' && player.position.z > WORLD.firstDoorZ + .75) {
          markRoute('firstDoor', 'First rune door crossed · northern rooms reached', events);
        }
        if (route.firstDoor && player.position.z > 6) markRoute('northRooms', 'Deep maze rooms reached', events);
        if (runeCount >= POUCH.requiredRunes) {
          markRoute('allRunes', 'All four runes found · the Moon Door recognizes the coven', events);
          beginOpening(finalDoor, events, 'Four runes joined · the final Moon Door is opening');
        }
        animateDoor(finalDoor, deltaTime, events, 'Final Moon Door');
        if (finalDoor.state === 'OPEN') route.finalDoor = true;
        if (finalDoor.state === 'OPEN' && player.position.z >= WORLD.exitZ && !route.moonDoor) {
          markRoute('moonDoor', 'The Witch enters the Moon Door', events);
          exitProgress = .001;
        }
        if (route.moonDoor && !route.exit) {
          exitProgress = Math.min(1, exitProgress + deltaTime / WORLD.exitDuration);
          if (exitProgress >= 1) markRoute('exit', 'The Witch vanished into moonlight · route complete', events);
        }
      }
      animateScenery();
      return events;
    },
    nextObjective() {
      if (routeMode === 'chapter1') {
        if (!route.entrance) return 'Cross the Moon Gate';
        const fragmentCount = chapterProgression?.routeRune?.fragmentCount || 0;
        if (fragmentCount < 3) return `Mine ${3 - fragmentCount} required Garden Maze ${3 - fragmentCount === 1 ? 'geode' : 'geodes'}`;
        if (firstDoor.state !== 'OPEN') return 'Wait for the Sunken Gate to open';
        if (!route.sunkenGate) return 'Pass through the Sunken Gate';
        return 'Garden Maze slice complete · Rootbound Crossing is next';
      }
      if (!route.entrance) return 'Cross the entrance Moon Gate';
      if (runeCount < POUCH.firstDoorRunes) return `Find ${POUCH.firstDoorRunes - runeCount} southern door ${POUCH.firstDoorRunes - runeCount === 1 ? 'rune' : 'runes'}`;
      if (firstDoor.state !== 'OPEN') return 'Wait for the first rune door';
      if (!route.firstDoor) return 'Pass through the first rune door';
      if (runeCount < POUCH.requiredRunes) return `Find ${POUCH.requiredRunes - runeCount} northern Moon Door ${POUCH.requiredRunes - runeCount === 1 ? 'rune' : 'runes'}`;
      if (finalDoor.state !== 'OPEN') return 'Wait for the final Moon Door';
      if (!route.moonDoor) return 'Enter the open Moon Door';
      if (!route.exit) return 'Crossing through moonlight';
      return 'Expanded maze route complete';
    },
    snapshot(dragons = []) {
      const dragonStates = dragons.map(dragon => dragon.snapshot());
      const gardenMazeComplete = routeMode === 'chapter1' && route.sunkenGate;
      const chapterComplete = routeMode === 'chapter1'
        && Boolean(chapterProgression?.completion?.chapterComplete);
      return {
        routeMode,
        seed: mazeSeed,
        dimensions: { ...layout.dimensions },
        featureCounts: {
          berries: POUCH.berryBushes.length,
          fountains: layout.fountainPositions.length,
          geodes: routeMode === 'chapter1'
            ? levelPlan.requiredGeodes.length + levelPlan.optionalGeodes.length
            : POUCH.geodeRocks.length,
          potions: POUCH.powerups.length,
          dragons: layout.dragonSpawns.length,
          aggressiveDragons: layout.dragonSpawns.filter(spawn => spawn.aggressive).length,
          variableWalls: layout.walls.length
        },
        route: { ...route },
        doors: {
          first: routeMode === 'chapter1'
            ? { state: firstDoor.state, progress: firstDoor.progress, requiredRuneId: levelPlan.sunkenGate.requiredRuneId }
            : { state: firstDoor.state, progress: firstDoor.progress, requiredRunes: POUCH.firstDoorRunes },
          final: { state: finalDoor.state, progress: finalDoor.progress, requiredRunes: POUCH.requiredRunes }
        },
        gate: routeMode === 'chapter1'
          ? {
            id: levelPlan.sunkenGate.id,
            state: firstDoor.state,
            progress: firstDoor.progress,
            requiredRuneId: levelPlan.sunkenGate.requiredRuneId,
            runeCompleted: Boolean(chapterProgression?.routeRune?.completed)
          }
          : { state: finalDoor.state, progress: finalDoor.progress, runes: runeCount, requiredRunes: POUCH.requiredRunes },
        exit: {
          active: routeMode === 'legacy' ? Boolean(route.moonDoor) : false,
          progress: routeMode === 'legacy' ? exitProgress : 0,
          witchVisible: routeMode === 'legacy' ? Math.max(0, 1 - exitProgress) : 1
        },
        dragons: dragonStates,
        containedDragons: dragonStates.filter(dragon => !dragon.alive).length,
        objective: this.nextObjective(),
        gardenMazeComplete,
        chapterComplete,
        complete: routeMode === 'chapter1' ? chapterComplete : route.exit
      };
    }
  };

  return world;
}
