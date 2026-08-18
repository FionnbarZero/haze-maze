import { damp } from './utils.js';

export function createPlaceholderWitch(BABYLON, scene, shadowGenerator) {
  const root = new BABYLON.TransformNode('placeholder-witch-root', scene);
  const visual = new BABYLON.TransformNode('placeholder-witch-visual', scene);
  visual.parent = root;
  const meshes = [];

  const material = (name, diffuse, emissive = '#000000') => {
    const result = new BABYLON.StandardMaterial(name, scene);
    result.diffuseColor = BABYLON.Color3.FromHexString(diffuse);
    result.emissiveColor = BABYLON.Color3.FromHexString(emissive);
    result.specularColor = new BABYLON.Color3(.18, .12, .2);
    return result;
  };
  const purple = material('witch-purple-temp', '#5d227e');
  const purpleLight = material('witch-purple-light-temp', '#8c3bab');
  const pink = material('witch-pink-temp', '#c34f93');
  const skin = material('witch-skin-temp', '#d69b82');
  const hair = material('witch-hair-temp', '#8f2f20', '#160402');
  const leather = material('witch-leather-temp', '#4b2a22');
  const wood = material('witch-staff-temp', '#6f4628');
  const orbMaterial = material('witch-orb-temp', '#eadcff', '#8b45d6');

  const addMesh = (mesh, parent, position, meshMaterial) => {
    mesh.parent = parent;
    mesh.position.copyFrom(position);
    mesh.material = meshMaterial;
    mesh.isPickable = false;
    meshes.push(mesh);
    shadowGenerator.addShadowCaster(mesh);
    return mesh;
  };

  const skirt = addMesh(BABYLON.MeshBuilder.CreateCylinder('witch-skirt', { height: .72, diameterTop: .58, diameterBottom: 1.02, tessellation: 18 }, scene), visual, new BABYLON.Vector3(0, .78, 0), purple);
  const torso = addMesh(BABYLON.MeshBuilder.CreateCylinder('witch-torso', { height: .58, diameterTop: .62, diameterBottom: .72, tessellation: 16 }, scene), visual, new BABYLON.Vector3(0, 1.22, 0), purpleLight);
  const belt = addMesh(BABYLON.MeshBuilder.CreateTorus('witch-belt', { diameter: .69, thickness: .07, tessellation: 22 }, scene), visual, new BABYLON.Vector3(0, .98, 0), leather);
  belt.rotation.x = Math.PI / 2;
  const head = addMesh(BABYLON.MeshBuilder.CreateSphere('witch-head', { diameter: .39, segments: 18 }, scene), visual, new BABYLON.Vector3(0, 1.62, .01), skin);
  head.scaling.y = 1.12;
  const hood = addMesh(BABYLON.MeshBuilder.CreateTorus('witch-hood', { diameter: .55, thickness: .12, tessellation: 24 }, scene), visual, new BABYLON.Vector3(0, 1.64, -.035), pink);
  hood.rotation.x = Math.PI / 2;

  for (const [x, y, z, scale] of [[-.16,1.72,-.12,.22],[.12,1.75,-.14,.24],[-.23,1.56,-.16,.25],[.2,1.54,-.15,.26],[-.12,1.4,-.17,.23],[.15,1.34,-.17,.22]]) {
    const curl = addMesh(BABYLON.MeshBuilder.CreateSphere(`witch-curl-${meshes.length}`, { diameter: 1, segments: 10 }, scene), visual, new BABYLON.Vector3(x, y, z), hair);
    curl.scaling.set(scale * .72, scale, scale * .62);
  }

  const cape = addMesh(BABYLON.MeshBuilder.CreatePlane('witch-cape', { width: 1.08, height: 1.2, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene), visual, new BABYLON.Vector3(-.05, 1.03, -.24), pink);
  cape.rotation.y = Math.PI;
  cape.rotation.z = -.08;

  const leftLeg = new BABYLON.TransformNode('witch-left-leg', scene);
  const rightLeg = new BABYLON.TransformNode('witch-right-leg', scene);
  leftLeg.parent = visual; rightLeg.parent = visual;
  leftLeg.position.set(-.2, .65, 0); rightLeg.position.set(.2, .65, 0);
  for (const [node, side] of [[leftLeg, -1], [rightLeg, 1]]) {
    addMesh(BABYLON.MeshBuilder.CreateCylinder(`witch-leg-${side}`, { height: .64, diameter: .2, tessellation: 12 }, scene), node, new BABYLON.Vector3(0, -.3, 0), leather);
    const boot = addMesh(BABYLON.MeshBuilder.CreateBox(`witch-boot-${side}`, { width: .24, height: .22, depth: .38 }, scene), node, new BABYLON.Vector3(0, -.63, .08), leather);
    boot.rotation.x = -.08;
  }

  const leftArm = new BABYLON.TransformNode('witch-left-arm', scene);
  const rightArm = new BABYLON.TransformNode('witch-right-arm', scene);
  leftArm.parent = visual; rightArm.parent = visual;
  leftArm.position.set(-.42, 1.38, 0); rightArm.position.set(.42, 1.38, 0);
  addMesh(BABYLON.MeshBuilder.CreateCapsule('witch-left-sleeve', { height: .62, radius: .11, tessellation: 12 }, scene), leftArm, new BABYLON.Vector3(0, -.27, 0), purpleLight);
  addMesh(BABYLON.MeshBuilder.CreateCapsule('witch-right-sleeve', { height: .62, radius: .11, tessellation: 12 }, scene), rightArm, new BABYLON.Vector3(0, -.27, 0), purpleLight);
  addMesh(BABYLON.MeshBuilder.CreateSphere('witch-left-hand', { diameter: .16, segments: 10 }, scene), leftArm, new BABYLON.Vector3(0, -.58, 0), skin);
  addMesh(BABYLON.MeshBuilder.CreateSphere('witch-right-hand', { diameter: .16, segments: 10 }, scene), rightArm, new BABYLON.Vector3(0, -.58, 0), skin);

  const staffSocket = new BABYLON.TransformNode('RightHand_StaffSocket', scene);
  staffSocket.parent = rightArm;
  staffSocket.position.set(.05, -.58, .02);
  const staff = addMesh(BABYLON.MeshBuilder.CreateCylinder('witch-staff', { height: 1.62, diameterTop: .055, diameterBottom: .085, tessellation: 12 }, scene), staffSocket, new BABYLON.Vector3(0, .25, 0), wood);
  staff.rotation.z = -.08;
  const orb = addMesh(BABYLON.MeshBuilder.CreateSphere('witch-staff-orb', { diameter: .25, segments: 16 }, scene), staffSocket, new BABYLON.Vector3(-.065, 1.08, 0), orbMaterial);
  const orbLight = new BABYLON.PointLight('witch-orb-light', new BABYLON.Vector3(0, 0, 0), scene);
  orbLight.parent = orb;
  orbLight.diffuse = BABYLON.Color3.FromHexString('#bd82ff');
  orbLight.intensity = .65;
  orbLight.range = 4;

  let gait = 0;
  let moveWeight = 0;
  let crouchWeight = 0;
  let castWeight = 0;
  let castUntil = 0;
  let animationState = 'IDLE';
  let previousAnimationState = 'IDLE';
  let transitionWeight = 1;
  let visibility = 1;

  return {
    root,
    meshes,
    orb,
    setCast(time) { castUntil = time + .42; },
    setVisibility(value) {
      visibility = value;
      for (const mesh of meshes) mesh.visibility = value;
    },
    getOrbPosition() {
      orb.computeWorldMatrix(true);
      return orb.getAbsolutePosition().clone();
    },
    update(state, input, deltaTime, time) {
      root.position.copyFrom(state.position);
      root.rotation.y = state.facingYaw;
      const requestedState = time < castUntil
        ? 'CAST LIGHTNING'
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
      orbLight.intensity = .58 + Math.sin(time * 6) * .12 + castWeight * 1.2;
      orbMaterial.emissiveColor.set(.48 + castWeight * .35, .2 + castWeight * .28, .72 + castWeight * .2);
      void skirt; void torso;
    },
    snapshot() {
      return {
        animationState,
        previousAnimationState,
        transitionWeight,
        castWeight,
        crouchWeight,
        visibility,
        staffSocket: staffSocket.name,
        staffAttached: staff.parent === staffSocket
      };
    }
  };
}
