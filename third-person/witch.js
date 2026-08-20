import { damp } from './utils.js?v=20260818-witchselect-v1';

export function createPlaceholderWitch(BABYLON, scene, shadowGenerator, options = {}) {
  const id = options.id || 'witch';
  const named = suffix => `${id}-${suffix}`;
  const palette = {
    primary: '#5d227e',
    primaryLight: '#8c3bab',
    accent: '#c34f93',
    skin: '#d69b82',
    hair: '#8f2f20',
    hairEmissive: '#160402',
    leather: '#4b2a22',
    wood: '#6f4628',
    orb: '#eadcff',
    orbEmissive: '#8b45d6',
    orbCast: '#dfb8ff',
    orbLight: '#bd82ff',
    label: '#eadcff',
    ...options.palette
  };
  const root = new BABYLON.TransformNode(id === 'witch' ? 'placeholder-witch-root' : `${id}-root`, scene);
  const visual = new BABYLON.TransformNode(id === 'witch' ? 'placeholder-witch-visual' : `${id}-visual`, scene);
  visual.parent = root;
  const meshes = [];

  const material = (name, diffuse, emissive = '#000000') => {
    const result = new BABYLON.StandardMaterial(name, scene);
    result.diffuseColor = BABYLON.Color3.FromHexString(diffuse);
    result.emissiveColor = BABYLON.Color3.FromHexString(emissive);
    result.specularColor = new BABYLON.Color3(.18, .12, .2);
    return result;
  };
  const purple = material(named('primary-temp'), palette.primary);
  const purpleLight = material(named('primary-light-temp'), palette.primaryLight);
  const pink = material(named('accent-temp'), palette.accent);
  const skin = material(named('skin-temp'), palette.skin);
  const hair = material(named('hair-temp'), palette.hair, palette.hairEmissive);
  const leather = material(named('leather-temp'), palette.leather);
  const wood = material(named('staff-temp'), palette.wood);
  const orbMaterial = material(named('orb-temp'), palette.orb, palette.orbEmissive);
  const orbBaseColor = BABYLON.Color3.FromHexString(palette.orbEmissive);
  const orbCastColor = BABYLON.Color3.FromHexString(palette.orbCast);

  const addMesh = (mesh, parent, position, meshMaterial) => {
    mesh.parent = parent;
    mesh.position.copyFrom(position);
    mesh.material = meshMaterial;
    mesh.isPickable = false;
    meshes.push(mesh);
    shadowGenerator.addShadowCaster(mesh);
    return mesh;
  };

  const skirt = addMesh(BABYLON.MeshBuilder.CreateCylinder(named('skirt'), { height: .72, diameterTop: .58, diameterBottom: 1.02, tessellation: 18 }, scene), visual, new BABYLON.Vector3(0, .78, 0), purple);
  const torso = addMesh(BABYLON.MeshBuilder.CreateCylinder(named('torso'), { height: .58, diameterTop: .62, diameterBottom: .72, tessellation: 16 }, scene), visual, new BABYLON.Vector3(0, 1.22, 0), purpleLight);
  const belt = addMesh(BABYLON.MeshBuilder.CreateTorus(named('belt'), { diameter: .69, thickness: .07, tessellation: 22 }, scene), visual, new BABYLON.Vector3(0, .98, 0), leather);
  belt.rotation.x = Math.PI / 2;
  const head = addMesh(BABYLON.MeshBuilder.CreateSphere(named('head'), { diameter: .39, segments: 18 }, scene), visual, new BABYLON.Vector3(0, 1.62, .01), skin);
  head.scaling.y = 1.12;
  const hood = addMesh(BABYLON.MeshBuilder.CreateTorus(named('hood'), { diameter: .55, thickness: .12, tessellation: 24 }, scene), visual, new BABYLON.Vector3(0, 1.64, -.035), pink);
  hood.rotation.x = Math.PI / 2;

  for (const [x, y, z, scale] of [[-.16,1.72,-.12,.22],[.12,1.75,-.14,.24],[-.23,1.56,-.16,.25],[.2,1.54,-.15,.26],[-.12,1.4,-.17,.23],[.15,1.34,-.17,.22]]) {
    const curl = addMesh(BABYLON.MeshBuilder.CreateSphere(named(`curl-${meshes.length}`), { diameter: 1, segments: 10 }, scene), visual, new BABYLON.Vector3(x, y, z), hair);
    curl.scaling.set(scale * .72, scale, scale * .62);
  }

  const cape = addMesh(BABYLON.MeshBuilder.CreatePlane(named('cape'), { width: 1.08, height: 1.2, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene), visual, new BABYLON.Vector3(-.05, 1.03, -.24), pink);
  cape.rotation.y = Math.PI;
  cape.rotation.z = -.08;

  const leftLeg = new BABYLON.TransformNode(named('left-leg'), scene);
  const rightLeg = new BABYLON.TransformNode(named('right-leg'), scene);
  leftLeg.parent = visual; rightLeg.parent = visual;
  leftLeg.position.set(-.2, .65, 0); rightLeg.position.set(.2, .65, 0);
  for (const [node, side] of [[leftLeg, -1], [rightLeg, 1]]) {
    addMesh(BABYLON.MeshBuilder.CreateCylinder(named(`leg-${side}`), { height: .64, diameter: .2, tessellation: 12 }, scene), node, new BABYLON.Vector3(0, -.3, 0), leather);
    const boot = addMesh(BABYLON.MeshBuilder.CreateBox(named(`boot-${side}`), { width: .24, height: .22, depth: .38 }, scene), node, new BABYLON.Vector3(0, -.63, .08), leather);
    boot.rotation.x = -.08;
  }

  const leftArm = new BABYLON.TransformNode(named('left-arm'), scene);
  const rightArm = new BABYLON.TransformNode(named('right-arm'), scene);
  leftArm.parent = visual; rightArm.parent = visual;
  leftArm.position.set(-.42, 1.38, 0); rightArm.position.set(.42, 1.38, 0);
  addMesh(BABYLON.MeshBuilder.CreateCapsule(named('left-sleeve'), { height: .62, radius: .11, tessellation: 12 }, scene), leftArm, new BABYLON.Vector3(0, -.27, 0), purpleLight);
  addMesh(BABYLON.MeshBuilder.CreateCapsule(named('right-sleeve'), { height: .62, radius: .11, tessellation: 12 }, scene), rightArm, new BABYLON.Vector3(0, -.27, 0), purpleLight);
  const leftHand = addMesh(BABYLON.MeshBuilder.CreateSphere(named('left-hand'), { diameter: .16, segments: 10 }, scene), leftArm, new BABYLON.Vector3(0, -.58, 0), skin);
  const rightHand = addMesh(BABYLON.MeshBuilder.CreateSphere(named('right-hand'), { diameter: .16, segments: 10 }, scene), rightArm, new BABYLON.Vector3(0, -.58, 0), skin);

  const staffSocket = new BABYLON.TransformNode(id === 'witch' ? 'RightHand_StaffSocket' : `${id}-RightHand_StaffSocket`, scene);
  staffSocket.parent = rightArm;
  staffSocket.position.set(.05, -.58, .02);
  const staff = addMesh(BABYLON.MeshBuilder.CreateCylinder(named('staff'), { height: 1.62, diameterTop: .055, diameterBottom: .085, tessellation: 12 }, scene), staffSocket, new BABYLON.Vector3(0, .25, 0), wood);
  staff.rotation.z = -.08;
  const orb = addMesh(BABYLON.MeshBuilder.CreateSphere(named('staff-orb'), { diameter: .25, segments: 16 }, scene), staffSocket, new BABYLON.Vector3(-.065, 1.08, 0), orbMaterial);
  const orbLight = new BABYLON.PointLight(named('orb-light'), new BABYLON.Vector3(0, 0, 0), scene);
  orbLight.parent = orb;
  orbLight.diffuse = BABYLON.Color3.FromHexString(palette.orbLight);
  orbLight.intensity = .65;
  orbLight.range = 4;

  const pickHandle = addMesh(BABYLON.MeshBuilder.CreateCylinder(named('geode-pick-handle'), {
    height: 1.12,
    diameter: .075,
    tessellation: 10
  }, scene), staffSocket, new BABYLON.Vector3(0, .18, 0), wood);
  pickHandle.rotation.z = -.08;
  const pickHead = addMesh(BABYLON.MeshBuilder.CreateCylinder(named('geode-pick-head'), {
    height: .62,
    diameterTop: .055,
    diameterBottom: .14,
    tessellation: 10
  }, scene), staffSocket, new BABYLON.Vector3(-.02, .72, 0), leather);
  pickHead.rotation.z = Math.PI / 2;

  const hammerHandle = addMesh(BABYLON.MeshBuilder.CreateCylinder(named('geode-hammer-handle'), {
    height: .92,
    diameter: .085,
    tessellation: 10
  }, scene), staffSocket, new BABYLON.Vector3(.16, .08, .08), wood);
  hammerHandle.rotation.z = .12;
  const hammerHead = addMesh(BABYLON.MeshBuilder.CreateBox(named('geode-hammer-head'), {
    width: .5,
    height: .2,
    depth: .22
  }, scene), staffSocket, new BABYLON.Vector3(.21, .56, .08), leather);

  let gait = 0;
  let moveWeight = 0;
  let crouchWeight = 0;
  let castWeight = 0;
  let castUntil = 0;
  let castSpell = 'lightning';
  let animationState = 'IDLE';
  let previousAnimationState = 'IDLE';
  let transitionWeight = 1;
  let visibility = 1;
  let heldItem = 'staff';
  let nameplateVisible = Boolean(options.label);
  const presentationOffset = BABYLON.Vector3.Zero();

  let nameplate = null;
  if (options.label) {
    const labelTexture = new BABYLON.DynamicTexture(named('nameplate-texture'), { width: 512, height: 96 }, scene, true);
    labelTexture.hasAlpha = true;
    labelTexture.drawText(options.label.toUpperCase(), null, 62, '700 34px system-ui', palette.label, 'transparent', true);
    const labelMaterial = new BABYLON.StandardMaterial(named('nameplate-material'), scene);
    labelMaterial.diffuseTexture = labelTexture;
    labelMaterial.opacityTexture = labelTexture;
    labelMaterial.emissiveColor = BABYLON.Color3.FromHexString(palette.label).scale(.68);
    labelMaterial.disableLighting = true;
    labelMaterial.backFaceCulling = false;
    nameplate = BABYLON.MeshBuilder.CreatePlane(named('nameplate'), { width: 1.75, height: .33 }, scene);
    nameplate.parent = root;
    nameplate.position.set(0, 2.2, 0);
    nameplate.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    nameplate.material = labelMaterial;
    nameplate.isPickable = false;
    meshes.push(nameplate);
  }

  const equipmentMeshes = {
    staff: [staff, orb],
    geodePick: [pickHandle, pickHead],
    geodeHammer: [hammerHandle, hammerHead],
    miningTools: [pickHandle, pickHead, hammerHandle, hammerHead]
  };
  const applyEquipmentVisibility = () => {
    for (const mesh of [staff, orb]) mesh.visibility = heldItem === 'staff' ? visibility : 0;
    for (const mesh of [pickHandle, pickHead]) {
      mesh.visibility = ['geodePick', 'miningTools'].includes(heldItem) ? visibility : 0;
    }
    for (const mesh of [hammerHandle, hammerHead]) {
      mesh.visibility = ['geodeHammer', 'miningTools'].includes(heldItem) ? visibility : 0;
    }
    if (heldItem !== 'staff') orbLight.intensity = 0;
  };
  applyEquipmentVisibility();

  return {
    root,
    meshes,
    orb,
    setCast(time, spell = 'lightning') {
      castUntil = time + .42;
      castSpell = spell;
    },
    setVisibility(value) {
      visibility = value;
      for (const mesh of meshes) mesh.visibility = mesh === nameplate && !nameplateVisible ? 0 : value;
      applyEquipmentVisibility();
    },
    setHeldItem(item = null) {
      if (item !== null && !equipmentMeshes[item]) return false;
      heldItem = item;
      applyEquipmentVisibility();
      return true;
    },
    setNameplateVisible(value) {
      nameplateVisible = Boolean(value && nameplate);
      if (nameplate) nameplate.visibility = nameplateVisible ? visibility : 0;
    },
    setPresentationOffset(x = 0, y = 0, z = 0) {
      presentationOffset.set(x, y, z);
    },
    getOrbPosition() {
      orb.computeWorldMatrix(true);
      return orb.getAbsolutePosition().clone();
    },
    getHandPositions() {
      leftHand.computeWorldMatrix(true);
      rightHand.computeWorldMatrix(true);
      return {
        left: leftHand.getAbsolutePosition().clone(),
        right: rightHand.getAbsolutePosition().clone()
      };
    },
    update(state, input, deltaTime, time) {
      root.position.copyFrom(state.position);
      root.position.addInPlace(presentationOffset);
      root.rotation.y = state.facingYaw;
      const requestedState = time < castUntil
        ? `CAST ${castSpell.toUpperCase()}`
        : state.stateLabel;
      if (requestedState !== animationState) {
        previousAnimationState = animationState;
        animationState = requestedState;
        transitionWeight = 0;
      }
      transitionWeight = damp(transitionWeight, 1, .09, deltaTime);
      moveWeight = damp(moveWeight, state.speed > .05 ? 1 : 0, .09, deltaTime);
      crouchWeight = damp(crouchWeight, state.crouched ? 1 : 0, .12, deltaTime);
      castWeight = damp(castWeight, time < castUntil ? 1 : 0, time < castUntil ? .06 : .16, deltaTime);
      gait += deltaTime * (5.2 + state.speed * 1.4) * moveWeight;
      const stride = Math.sin(gait) * moveWeight;
      const sprintWeight = state.stateLabel === 'SPRINT' ? 1 : 0;
      const airborne = !state.grounded ? 1 : 0;
      const landingWeight = state.stateLabel === 'LAND' ? 1 : 0;
      const aimWeight = input.aiming ? 1 : 0;
      const strideScale = .58 + sprintWeight * .24;
      leftLeg.rotation.x = stride * strideScale * (1 - airborne) - airborne * .28 + landingWeight * .22;
      rightLeg.rotation.x = -stride * strideScale * (1 - airborne) - airborne * .12 + landingWeight * .22;
      leftArm.rotation.x = -stride * (.42 + sprintWeight * .18) - aimWeight * .18;
      rightArm.rotation.x = stride * .28 * (1 - aimWeight) - aimWeight * .62 - castWeight * .72;
      rightArm.rotation.z = -castWeight * .2;
      staffSocket.rotation.x = -aimWeight * .12 - castWeight * .18;
      staffSocket.rotation.z = -.12 + castWeight * .2;
      visual.scaling.y = damp(visual.scaling.y, state.crouched ? .72 : 1, .12, deltaTime);
      visual.position.y = Math.abs(Math.cos(gait)) * .025 * moveWeight - landingWeight * .06;
      visual.rotation.z = damp(visual.rotation.z, Math.sin(gait) * .012 * moveWeight, .1, deltaTime);
      cape.rotation.z = -.08 - stride * .025;
      cape.rotation.x = state.speed * .015 + airborne * .06;
      orbLight.intensity = heldItem === 'staff'
        ? .58 + Math.sin(time * 6) * .12 + castWeight * 1.2
        : 0;
      orbMaterial.emissiveColor.copyFrom(BABYLON.Color3.Lerp(orbBaseColor, orbCastColor, castWeight));
      void skirt; void torso;
    },
    snapshot() {
      return {
        animationState,
        previousAnimationState,
        transitionWeight,
        castWeight,
        castSpell,
        crouchWeight,
        visibility,
        scale: root.scaling.x,
        presentationOffset: presentationOffset.asArray(),
        label: options.label || null,
        nameplateVisible: Boolean(nameplate && nameplateVisible && nameplate.visibility > 0),
        heldItem,
        staffSocket: staffSocket.name,
        staffAttached: heldItem === 'staff' && staff.parent === staffSocket
      };
    }
  };
}
