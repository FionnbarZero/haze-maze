import { createWorld } from './world.js?v=20260820-chapter-one-v2';
import { createPlaceholderWitch } from './witch.js?v=20260820-chapter-one-v1';
import { createPlaceholderDragon } from './dragon.js?v=20260819-expanded-maze-v1';
import { ProofInput } from './input.js?v=20260819-solo-cast-v1';
import { CharacterController } from './controller.js?v=20260818-witchselect-v1';
import { ShoulderCamera } from './camera.js?v=20260819-runtime-audit-v1';
import { LightningCombat } from './combat.js?v=20260820-chapter-one-v2';
import { PouchInventory } from './inventory.js?v=20260820-chapter-one-v3';
import { DebugTelemetry } from './debug.js?v=20260818-witchselect-v1';
import { AdaptiveQualityController, initialHardwareScaling, resolveQualityRequest } from './quality.js?v=20260818-witchselect-v1';
import { MobileQualificationRecorder } from './qualification.js?v=20260818-witchselect-v1';
import { RemotePlayerReplica, SimulatedTeammateFeed } from './remote-player.js?v=20260819-runtime-audit-v1';
import { GreenWitchAbilities } from './green-witch.js?v=20260820-chapter-one-v2';
import { CharacterSelectionFlow, PLAYABLE_WITCHES } from './character-selection.js?v=20260819-elemental-witches-v1';
import { ChapterOneProgression } from './chapter-progression.js?v=20260820-chapter-one-v3';
import { ChapterOneGeodeState } from './chapter-geode-state.js?v=20260820-chapter-one-v3';

const moduleStartedAt = performance.now();
const qualityRequest = resolveQualityRequest();
const queryParameters = new URLSearchParams(location.search);
const simulatedPartyEnabled = queryParameters.get('party') === 'simulated';
const mazeSeed = queryParameters.get('mazeSeed') || undefined;
const routeMode = queryParameters.get('route') === 'legacy' ? 'legacy' : 'chapter1';
const loading = document.querySelector('#loading');
const loadingCopy = document.querySelector('#loading-copy');

function showFatalError(error) {
  loadingCopy.textContent = `The technical proof could not start: ${error.message}`;
  loading.querySelector('strong').textContent = 'Renderer unavailable';
  loading.querySelector('span').style.animation = 'none';
  loading.querySelector('span').style.borderColor = '#ff759f';
  console.error(error);
}

try {
  if (!window.BABYLON) throw new Error('Babylon.js did not load from the experimental CDN');
  const BABYLON = window.BABYLON;
  const canvas = document.querySelector('#render-canvas');
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    adaptToDeviceRatio: true,
    powerPreference: 'high-performance'
  });
  engine.setHardwareScalingLevel(initialHardwareScaling(qualityRequest));
  const qualityController = new AdaptiveQualityController(engine, qualityRequest);

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromHexString('#17122aff');
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = .012;
  scene.fogColor = BABYLON.Color3.FromHexString('#1d152c');
  scene.imageProcessingConfiguration.contrast = 1.06;
  scene.imageProcessingConfiguration.exposure = 1.22;

  const ambient = new BABYLON.HemisphericLight('moon-ambient', new BABYLON.Vector3(0, 1, 0), scene);
  ambient.diffuse = BABYLON.Color3.FromHexString('#baaadf');
  ambient.groundColor = BABYLON.Color3.FromHexString('#2a2138');
  ambient.intensity = .86;
  const moonLight = new BABYLON.DirectionalLight('moon-key', new BABYLON.Vector3(.35, -1, .45), scene);
  moonLight.position.set(-8, 13, -5);
  moonLight.diffuse = BABYLON.Color3.FromHexString('#ebe4ff');
  moonLight.intensity = 1.62;
  const shadowGenerator = new BABYLON.ShadowGenerator(qualityRequest.profile?.shadowMapSize || 1024, moonLight);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.bias = .0005;
  const sceneInstrumentation = new BABYLON.SceneInstrumentation(scene);

  const world = createWorld(BABYLON, scene, shadowGenerator, { seed: mazeSeed, routeMode });
  const chapterProgression = routeMode === 'chapter1' ? new ChapterOneProgression() : null;
  const chapterGeodeState = routeMode === 'chapter1'
    ? new ChapterOneGeodeState({
      geodes: [...world.levelPlan.requiredGeodes, ...world.levelPlan.optionalGeodes]
    })
    : null;
  const purpleWitch = createPlaceholderWitch(BABYLON, scene, shadowGenerator, { label: 'Purple Witch' });
  const dragons = world.dragonSpawns.map(spawn => createPlaceholderDragon(
    BABYLON,
    scene,
    shadowGenerator,
    new BABYLON.Vector3(spawn.x, 0, spawn.z),
    { id: spawn.id, aggressive: spawn.aggressive }
  ));
  const dragon = dragons[0];
  const applyDragonPatrol = (actor, spawn) => {
    if (!spawn.patrolRadius) {
      actor.clearPatrol();
      return;
    }
    actor.setPatrol([
      new BABYLON.Vector3(spawn.x - spawn.patrolRadius, 0, spawn.z),
      new BABYLON.Vector3(spawn.x + spawn.patrolRadius, 0, spawn.z)
    ], spawn.patrolSpeed, .65);
  };
  for (const [index, actor] of dragons.entries()) applyDragonPatrol(actor, world.dragonSpawns[index]);
  const controller = new CharacterController(BABYLON, world);
  const greenWitch = createPlaceholderWitch(BABYLON, scene, shadowGenerator, {
    id: 'green-witch',
    label: 'Green Witch',
    palette: {
      primary: '#1f5b35',
      primaryLight: '#388455',
      accent: '#76b95d',
      hair: '#453724',
      hairEmissive: '#0f160b',
      leather: '#324128',
      wood: '#58492c',
      orb: '#e4ffd5',
      orbEmissive: '#42ad58',
      orbCast: '#c8ff9e',
      orbLight: '#7dff91',
      label: '#c5ffd0'
    }
  });
  const frostWitch = createPlaceholderWitch(BABYLON, scene, shadowGenerator, {
    id: 'frost-witch',
    label: 'Frost Witch',
    palette: {
      primary: '#245a78',
      primaryLight: '#4e91ae',
      accent: '#a9ebf5',
      hair: '#d9f4f5',
      hairEmissive: '#193b4a',
      leather: '#28445b',
      wood: '#5c7184',
      orb: '#f0ffff',
      orbEmissive: '#57cce7',
      orbCast: '#d5fbff',
      orbLight: '#83ebff',
      label: '#cff8ff'
    }
  });
  const fireWitch = createPlaceholderWitch(BABYLON, scene, shadowGenerator, {
    id: 'fire-witch',
    label: 'Fire Witch',
    palette: {
      primary: '#7f2d1e',
      primaryLight: '#b9552c',
      accent: '#f1a143',
      hair: '#3a1712',
      hairEmissive: '#3b0903',
      leather: '#4f271b',
      wood: '#70402a',
      orb: '#fff1a9',
      orbEmissive: '#e84a0b',
      orbCast: '#fff0a0',
      orbLight: '#ff7b28',
      label: '#ffd2a0'
    }
  });
  const playableWitchActors = Object.freeze({
    purple: purpleWitch,
    green: greenWitch,
    frost: frostWitch,
    fire: fireWitch
  });
  const covenLeader = createPlaceholderWitch(BABYLON, scene, shadowGenerator, {
    id: 'coven-leader',
    label: 'Coven Leader',
    palette: {
      primary: '#30294d',
      primaryLight: '#665b86',
      accent: '#a980b9',
      hair: '#c8c1d4',
      hairEmissive: '#1b1722',
      leather: '#3c3247',
      wood: '#57435c',
      orb: '#fff0c7',
      orbEmissive: '#bc82d5',
      orbCast: '#ffe9a6',
      orbLight: '#e2b4ff',
      label: '#f3ddff'
    }
  });
  covenLeader.root.scaling.setAll(1.22);
  const stagingZ = world.startPosition.z + .85;
  const covenLeaderState = {
    position: new BABYLON.Vector3(1.35, 0, world.startPosition.z + .35),
    facingYaw: Math.PI,
    speed: 0,
    grounded: true,
    crouched: false,
    stateLabel: 'IDLE'
  };
  const covenLeaderInput = { aiming: false };
  const previewInput = { aiming: false };
  const previewWitchStates = Object.freeze({
    purple: { position: new BABYLON.Vector3(-2.55, 0, stagingZ), facingYaw: Math.PI, speed: 0, grounded: true, crouched: false, stateLabel: 'IDLE' },
    green: { position: new BABYLON.Vector3(-.85, 0, stagingZ), facingYaw: Math.PI, speed: 0, grounded: true, crouched: false, stateLabel: 'IDLE' },
    frost: { position: new BABYLON.Vector3(.85, 0, stagingZ), facingYaw: Math.PI, speed: 0, grounded: true, crouched: false, stateLabel: 'IDLE' },
    fire: { position: new BABYLON.Vector3(2.55, 0, stagingZ), facingYaw: Math.PI, speed: 0, grounded: true, crouched: false, stateLabel: 'IDLE' }
  });
  const initialPlayerState = controller.snapshot();
  const greenReplica = new RemotePlayerReplica(BABYLON, greenWitch, {
    sequence: 0,
    sentAt: performance.now() / 1000,
    position: { x: 1.15, y: 0, z: world.startPosition.z + .35 },
    facingYaw: initialPlayerState.facingYaw,
    speed: 0,
    grounded: true,
    crouched: false,
    state: 'IDLE'
  });
  const greenSimulation = new SimulatedTeammateFeed(greenReplica, initialPlayerState);
  greenSimulation.setEnabled(simulatedPartyEnabled);
  greenReplica.setEnabled(simulatedPartyEnabled);
  const companionCharacterId = characterId => characterId === 'green' ? 'purple' : 'green';
  let selectedCharacter = 'purple';
  let localWitch = purpleWitch;
  let remoteWitch = greenWitch;
  for (const actor of dragons) controller.addDynamicObstacle(actor);
  const mobile = matchMedia('(pointer:coarse)').matches;
  const shoulderCamera = new ShoulderCamera(BABYLON, scene, world, mobile);
  shoulderCamera.addBlockers(dragons.flatMap(actor => actor.meshes));
  const input = new ProofInput(canvas);
  const combat = new LightningCombat(BABYLON, scene, shoulderCamera, purpleWitch, dragons, controller);
  const greenAbilities = new GreenWitchAbilities(BABYLON, scene, greenWitch, purpleWitch, dragons, combat);
  const inventory = new PouchInventory(BABYLON, scene, shadowGenerator, controller, combat, purpleWitch, {
    routeMode,
    levelPlan: world.levelPlan,
    progression: chapterProgression,
    geodeState: chapterGeodeState
  });
  const telemetry = new DebugTelemetry(engine, scene, sceneInstrumentation, moduleStartedAt);
  const toast = document.querySelector('#toast');
  const routePanel = document.querySelector('.route-panel');
  const routeLabel = document.querySelector('#route-label');
  const routeObjective = document.querySelector('#route-objective');
  const routeProgress = document.querySelector('#route-progress');
  routeLabel.textContent = routeMode === 'chapter1' ? 'Chapter 1 · Garden Maze' : 'Technical route';
  routePanel.setAttribute('aria-label', routeMode === 'chapter1' ? 'Chapter 1 route objective' : 'Legacy technical route objective');
  let toastTimer = 0;
  let completed = false;
  let qualification = null;
  let openingFlow = null;

  const showMessage = message => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1500);
  };
  const legacySpellSlots = Object.freeze({ lightning: 0, frost: 1, aegis: 2 });
  const resolveActiveSpell = requested => {
    const entries = spellRackPresentation[selectedCharacter] || [];
    if (entries.some(entry => entry.id === requested)) return requested;
    return entries[legacySpellSlots[requested] ?? 0]?.id || entries[0]?.id || requested;
  };
  const selectActiveSpell = spell => {
    const selected = resolveActiveSpell(spell);
    return selectedCharacter === 'green'
      ? greenAbilities.selectSpell(selected)
      : combat.selectSpell(selected);
  };
  const castActiveSpell = spell => {
    const now = performance.now() / 1000;
    if (routeMode === 'chapter1' && !inventory.canCastWithStaff()) {
      if (spell) {
        showMessage('Mining Tools are active · equip the wand or staff to cast');
        return false;
      }
      return inventory.strikeNearbyGeode();
    }
    if (selectedCharacter !== 'green') {
      if (!inventory.canCastWithStaff()) {
        showMessage('Equip the Moon staff from the pouch before casting · press P');
        return false;
      }
      return combat.cast(now, spell ? resolveActiveSpell(spell) : undefined);
    }
    if (spell) greenAbilities.selectSpell(resolveActiveSpell(spell), false);
    return greenAbilities.castSelected(now);
  };
  input.onCast = castActiveSpell;
  input.onSelectSpell = selectActiveSpell;
  input.onShoulder = () => {
    shoulderCamera.switchShoulder();
    showMessage(`${shoulderCamera.side === 1 ? 'Right' : 'Left'} shoulder selected`);
  };
  input.onPouch = () => inventory.toggle();
  input.onMessage = showMessage;
  combat.onMessage = showMessage;
  inventory.onMessage = showMessage;
  greenAbilities.onMessage = showMessage;
  inventory.onOpenChange = open => input.setModalOpen(open);
  const castGreenUtility = cast => {
    if (selectedCharacter === 'green' && !inventory.canCastWithStaff()) {
      showMessage('Mining Tools are active · equip the wand or staff to cast');
      return false;
    }
    return cast(performance.now() / 1000);
  };
  input.onGreenVine = () => castGreenUtility(now => greenAbilities.castVineTrap(now));
  input.onGreenRestore = () => castGreenUtility(now => greenAbilities.castSmartRestore(now));
  document.querySelector('#green-vine-demo').addEventListener('click', () => input.onGreenVine());
  document.querySelector('#green-restore-demo').addEventListener('click', () => input.onGreenRestore());
  const syncEquipmentMode = () => {
    const localSpellcastingEnabled = inventory.canCastWithStaff();
    combat.setSpellcastingEnabled(
      selectedCharacter !== 'green' && localSpellcastingEnabled,
      localSpellcastingEnabled ? 'alternate-character' : 'mining-tools'
    );
    greenAbilities.setSpellcastingEnabled(selectedCharacter !== 'green' || localSpellcastingEnabled);
  };
  inventory.onEquipmentModeChange = syncEquipmentMode;

  const playerNameCopy = document.querySelector('#player-character-name');
  const teammateNameCopy = document.querySelector('#teammate-character-name');
  const playerVitals = document.querySelector('#player-vitals');
  const teammatePanel = document.querySelector('#green-witch-party');
  const greenPartyActions = document.querySelector('#green-party-actions');
  const pouchCharacterName = document.querySelector('#pouch-character-name');
  const touchSpellButtons = [...document.querySelectorAll('.spell-rack button[data-spell]')];
  const spellRackPresentation = {
    purple: [
      { id: 'lightning', symbol: 'ϟ', label: 'Lightning' },
      { id: 'frost', symbol: '❄', label: 'Frost' },
      { id: 'aegis', symbol: '◯', label: 'Aegis' }
    ],
    green: [
      { id: 'vineTrap', symbol: '⌁', label: 'Vine Trap' },
      { id: 'restore', symbol: '+', label: 'Restore' }
    ],
    frost: [
      { id: 'freeze', symbol: '❄', label: 'Freeze' },
      { id: 'iceLance', symbol: '◇', label: 'Ice Lance' }
    ],
    fire: [
      { id: 'fireball', symbol: '●', label: 'Fireball' },
      { id: 'fireRing', symbol: '○', label: 'Fire Ring' }
    ]
  };

  const updateCharacterInterface = () => {
    const local = PLAYABLE_WITCHES[selectedCharacter];
    const remoteCharacterId = companionCharacterId(selectedCharacter);
    const remote = PLAYABLE_WITCHES[remoteCharacterId];
    playerNameCopy.textContent = local.name;
    teammateNameCopy.textContent = remote.name;
    pouchCharacterName.textContent = local.name;
    playerVitals.setAttribute('aria-label', `${local.name} health and protection`);
    teammatePanel.setAttribute('aria-label', `Simulated ${remote.name} teammate`);
    for (const characterId of Object.keys(PLAYABLE_WITCHES)) {
      playerVitals.classList.toggle(`is-${characterId}`, selectedCharacter === characterId);
    }
    teammatePanel.classList.toggle('is-purple', remoteCharacterId === 'purple');
    teammatePanel.hidden = !simulatedPartyEnabled;
    greenPartyActions.hidden = !simulatedPartyEnabled || selectedCharacter === 'green';
    const entries = spellRackPresentation[selectedCharacter];
    for (const [index, button] of touchSpellButtons.entries()) {
      const entry = entries[index];
      button.hidden = !entry;
      button.disabled = !entry;
      if (!entry) continue;
      button.dataset.spell = entry.id;
      button.querySelector('b').textContent = entry.symbol;
      button.querySelector('span').textContent = entry.label;
      button.classList.toggle('is-selected', index === 0);
    }
    if (selectedCharacter === 'green') greenAbilities.updateSpellSelection(false);
    else combat.updateSpellSelection(false);
  };

  const selectLocalCharacter = characterId => {
    if (!PLAYABLE_WITCHES[characterId]) return false;
    selectedCharacter = characterId;
    covenLeader.setVisibility(0);
    covenLeader.setNameplateVisible(false);
    const remoteCharacterId = companionCharacterId(characterId);
    localWitch = playableWitchActors[characterId];
    remoteWitch = playableWitchActors[remoteCharacterId];
    for (const [actorCharacterId, actor] of Object.entries(playableWitchActors)) {
      actor.root.scaling.set(1, 1, 1);
      actor.setPresentationOffset();
      actor.setVisibility(actorCharacterId === characterId || (simulatedPartyEnabled && actorCharacterId === remoteCharacterId) ? 1 : 0);
      actor.setNameplateVisible(simulatedPartyEnabled && actorCharacterId === remoteCharacterId);
    }
    greenReplica.setPresentation(remoteWitch);
    greenSimulation.setEnabled(simulatedPartyEnabled);
    greenReplica.setEnabled(simulatedPartyEnabled);
    if (simulatedPartyEnabled) {
      greenSimulation.reset(controller.snapshot());
      greenReplica.update(0, performance.now() / 1000);
    }
    combat.setCharacter(characterId, localWitch, PLAYABLE_WITCHES[characterId].name);
    greenAbilities.setMode({
      locallyControlled: characterId === 'green',
      friendWitch: simulatedPartyEnabled
        ? characterId === 'green' ? remoteWitch : localWitch
        : localWitch,
      friendAvailable: simulatedPartyEnabled
    });
    inventory.setCharacter(characterId, localWitch);
    updateCharacterInterface();
    return true;
  };

  const updateRouteHud = worldState => {
    if (worldState.routeMode === 'chapter1') {
      const chapterState = chapterProgression.snapshot();
      const checkpointKeys = ['entrance', 'fragments', 'sunkenGate'];
      const completedCheckpoints = checkpointKeys.filter(key => worldState.route[key]).length;
      routeObjective.textContent = worldState.objective;
      routeProgress.textContent = `${completedCheckpoints} / ${checkpointKeys.length} route beats · ${chapterState.routeRune.fragmentCount} / 3 West Rune fragments`;
      routePanel.classList.toggle('is-complete', worldState.gardenMazeComplete);
      return;
    }
    const checkpointKeys = ['entrance', 'southRunes', 'firstDoor', 'northRooms', 'allRunes', 'finalDoor', 'moonDoor', 'exit'];
    const completedCheckpoints = checkpointKeys.filter(key => worldState.route[key]).length;
    routeObjective.textContent = worldState.objective;
    routeProgress.textContent = `${completedCheckpoints} / ${checkpointKeys.length} checkpoints · ${worldState.gate.runes} / ${worldState.gate.requiredRunes} runes`;
    routePanel.classList.toggle('is-complete', worldState.complete);
  };
  updateRouteHud(world.snapshot(dragons));

  const startProof = (characterId = 'purple') => {
    if (!selectLocalCharacter(characterId)) return false;
    openingFlow?.complete(characterId);
    document.querySelector('#start-overlay').classList.add('is-hidden');
    document.querySelector('#hud').classList.add('is-active');
    input.start();
    qualification?.recordEvent('gameplay-start');
    showMessage(routeMode === 'chapter1'
      ? 'Cross the Moon Gate · equip Mining Tools with P · press O beside three required geodes'
      : characterId === 'purple'
        ? 'Explore the maze rooms · find four runes to open both doors · P opens the pouch'
        : 'Explore the maze rooms · recover four runes to open both doors · P opens the pouch');
    return true;
  };

  openingFlow = new CharacterSelectionFlow({
    onConfirm: characterId => startProof(characterId),
    onNarrationLine: (_line, index) => covenLeader.setCast(performance.now() / 1000, `address ${index + 1}`),
    onPreviewChange: (selectedId, focusedId, step) => {
      if (step === 'COMPLETE') return;
      if (step === 'BRIEFING') {
        covenLeader.setVisibility(1);
        covenLeader.setNameplateVisible(true);
        for (const actor of Object.values(playableWitchActors)) {
          actor.setVisibility(0);
          actor.setNameplateVisible(false);
        }
        return;
      }
      covenLeader.setVisibility(0);
      covenLeader.setNameplateVisible(false);
      const emphasized = selectedId || focusedId || null;
      const hasEmphasis = Boolean(emphasized);
      const previewScale = characterId => emphasized === characterId ? 1.08 : hasEmphasis ? .78 : 1;
      for (const [characterId, actor] of Object.entries(playableWitchActors)) {
        const highlighted = emphasized === characterId;
        actor.setVisibility(highlighted || !hasEmphasis ? 1 : .2);
        actor.setNameplateVisible(highlighted || !hasEmphasis);
        actor.root.scaling.setAll(previewScale(characterId));
        actor.setPresentationOffset(
          highlighted ? 2.4 - previewWitchStates[characterId].position.x : 0,
          highlighted ? .1 : 0,
          highlighted ? .24 : 0
        );
      }
    }
  });

  const resetTechnicalRoute = () => {
    completed = false;
    input.clearHeldInput();
    input.setCrouched(false);
    input.active = true;
    input.updateBlockedState();
    chapterProgression?.reset();
    world.reset();
    for (const [index, actor] of dragons.entries()) {
      const spawn = world.dragonSpawns[index];
      actor.setSpawnPosition(new BABYLON.Vector3(spawn.x, 0, spawn.z));
      actor.setAggressive(spawn.aggressive);
      actor.reset();
      applyDragonPatrol(actor, spawn);
    }
    combat.reset();
    inventory.reset();
    controller.reset();
    localWitch.update(controller, input, 0, performance.now() / 1000);
    greenAbilities.reset();
    localWitch.root.setEnabled(true);
    localWitch.root.scaling.setAll(1);
    localWitch.setVisibility(1);
    if (simulatedPartyEnabled) {
      greenSimulation.reset(controller.snapshot());
      greenReplica.update(0, performance.now() / 1000);
    }
    updateCharacterInterface();
    shoulderCamera.setLook(0, 0);
    shoulderCamera.snapNextUpdate();
    if (chapterProgression) world.setChapterProgression(chapterProgression.snapshot());
    updateRouteHud(world.snapshot(dragons));
    showMessage('Qualification route reset · begin at the Moon Gate');
  };
  combat.onPlayerDefeated = () => setTimeout(resetTechnicalRoute, 850);

  const snapshotProof = () => ({
    ready: scene.isReady(),
    active: input.active,
    opening: openingFlow?.snapshot() || null,
    characterSelection: {
      partyMode: simulatedPartyEnabled ? 'SIMULATED' : 'SOLO',
      selectedCharacter: openingFlow?.completed ? selectedCharacter : openingFlow?.selectedCharacter || null,
      localCharacter: input.active ? selectedCharacter : null,
      remoteCharacter: input.active && simulatedPartyEnabled ? companionCharacterId(selectedCharacter) : null,
      localName: input.active ? PLAYABLE_WITCHES[selectedCharacter].name : null,
      remoteName: input.active && simulatedPartyEnabled
        ? PLAYABLE_WITCHES[companionCharacterId(selectedCharacter)].name
        : null,
      previewName: !input.active && openingFlow?.selectedCharacter
        ? PLAYABLE_WITCHES[openingFlow.selectedCharacter].name
        : null
    },
    input: {
      pointerLocked: input.pointerLocked,
      aiming: input.aiming,
      sprinting: input.sprinting,
      blocked: input.blocked,
      movement: input.movementAxes(),
      heldActions: input.heldActionNames(),
      pendingActions: input.pendingActionNames(),
      modalOpen: input.modalOpen,
      coarsePointer: matchMedia('(pointer:coarse)').matches
    },
    player: controller.snapshot(),
    camera: shoulderCamera.snapshot(input.aiming),
    witch: localWitch.snapshot(),
    purpleWitch: { presentation: purpleWitch.snapshot() },
    covenLeader: {
      presentation: covenLeader.snapshot(),
      speaking: openingFlow?.narrationStatus === 'SPEAKING'
    },
    greenWitch: {
      replica: greenReplica.snapshot(),
      simulation: greenSimulation.snapshot(),
      presentation: greenWitch.snapshot(),
      abilities: greenAbilities.snapshot()
    },
    frostWitch: { presentation: frostWitch.snapshot() },
    fireWitch: { presentation: fireWitch.snapshot() },
    teammate: simulatedPartyEnabled ? {
      character: companionCharacterId(selectedCharacter),
      replica: greenReplica.snapshot(),
      simulation: greenSimulation.snapshot(),
      presentation: remoteWitch.snapshot()
    } : null,
    dragon: dragon.snapshot(),
    dragons: dragons.map(actor => actor.snapshot()),
    combat: combat.snapshot(),
    inventory: inventory.snapshot(),
    chapter: chapterProgression?.snapshot() || null,
    chapterGeodes: chapterGeodeState?.snapshot() || null,
    levelPlan: world.levelPlan,
    world: world.snapshot(dragons),
    navigation: {
      colliders: world.colliders.map(collider => ({
        name: collider.name,
        kind: collider.kind,
        min: { x: collider.min.x, y: collider.min.y, z: collider.min.z },
        max: { x: collider.max.x, y: collider.max.y, z: collider.max.z }
      }))
    },
    performance: telemetry.snapshot(),
    quality: qualityController.snapshot(),
    meshCount: scene.meshes.length,
    engine: `Babylon.js WebGL ${engine.webGLVersion}`
  });

  qualification = new MobileQualificationRecorder({
    canvas,
    telemetry,
    qualityController,
    getState: snapshotProof,
    resetRoute: resetTechnicalRoute
  });

  let lastTime = performance.now();
  engine.runRenderLoop(() => {
    const nowMilliseconds = performance.now();
    const now = nowMilliseconds / 1000;
    const measuredDeltaTime = Math.max(.001, (nowMilliseconds - lastTime) / 1000);
    const deltaTime = Math.min(.05, measuredDeltaTime);
    lastTime = nowMilliseconds;
    shoulderCamera.updateLook(input);
    controller.update(input, shoulderCamera.yaw, deltaTime);
    const cameraWitch = openingFlow?.step === 'BRIEFING' ? covenLeader : localWitch;
    shoulderCamera.update(controller, input, deltaTime, cameraWitch);
    if (input.active) {
      localWitch.update(controller, input, deltaTime, now);
    } else {
      for (const [characterId, actor] of Object.entries(playableWitchActors)) {
        actor.update(previewWitchStates[characterId], previewInput, deltaTime, now);
      }
    }
    covenLeaderState.stateLabel = openingFlow?.narrationStatus === 'SPEAKING' ? 'ADDRESSING COVEN' : 'IDLE';
    covenLeader.update(covenLeaderState, covenLeaderInput, deltaTime, now);
    const currentPlayerState = controller.snapshot();
    if (input.active) {
      greenSimulation.update(now, currentPlayerState);
      greenReplica.update(deltaTime, now);
    }
    for (const actor of dragons) actor.update(now, deltaTime);
    combat.update();
    greenAbilities.update(now, selectedCharacter === 'green' ? shoulderCamera : null);
    inventory.update(now, deltaTime);
    if (chapterProgression) {
      if (chapterProgression.hasCompletedRune()) chapterProgression.unlockSunkenGate();
      world.setChapterProgression(chapterProgression.snapshot());
    } else {
      world.setRuneCount(inventory.runes);
    }
    const routeEvents = world.update(controller, dragons, deltaTime);
    let worldState = world.snapshot(dragons);
    if (chapterProgression && worldState.doors.first.state === 'OPEN') {
      chapterProgression.markSunkenGateOpened();
      if (worldState.route.sunkenGate) chapterProgression.completeGardenMaze();
      world.setChapterProgression(chapterProgression.snapshot());
      worldState = world.snapshot(dragons);
    }
    for (const event of routeEvents) {
      showMessage(event.message);
    }
    if (worldState.exit.active) {
      const visibility = worldState.exit.witchVisible;
      localWitch.setVisibility(visibility);
      localWitch.root.scaling.setAll(Math.max(.01, visibility));
    }
    if (worldState.routeMode === 'legacy' && worldState.complete && !completed) {
      completed = true;
      input.active = false;
      input.clearHeldInput();
      localWitch.setVisibility(0);
      localWitch.root.setEnabled(false);
      document.exitPointerLock?.();
    }
    updateRouteHud(worldState);
    scene.render();
    telemetry.markFirstRenderedFrame();
    qualityController.update(nowMilliseconds);
    const playerState = controller.snapshot();
    const cameraState = shoulderCamera.snapshot(input.aiming);
    const combatState = combat.snapshot();
    const dragonState = dragon.snapshot();
    const witchState = localWitch.snapshot();
    telemetry.update(
      now,
      measuredDeltaTime,
      playerState,
      cameraState,
      combatState,
      dragonState,
      worldState,
      witchState
    );
    qualification?.update(nowMilliseconds, {
      player: playerState,
      camera: cameraState,
      combat: combatState,
      dragon: dragonState,
      witch: witchState,
      world: worldState
    });
  });

  const resize = () => engine.resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', resize);
  addEventListener('blur', () => telemetry.recordLifecycle('blur'));
  addEventListener('focus', () => telemetry.recordLifecycle('focus'));
  document.addEventListener('visibilitychange', () => telemetry.recordLifecycle(document.hidden ? 'hidden' : 'visible'));
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    telemetry.recordLifecycle('contextLost');
    input.clearHeldInput();
    showMessage('WebGL context lost · waiting for recovery');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    telemetry.recordLifecycle('contextRestored');
    showMessage('WebGL context restored');
  });

  scene.executeWhenReady(() => {
    telemetry.markReady();
    loading.classList.add('is-hidden');
    loading.setAttribute('aria-hidden', 'true');
  });

  window.__HMW_THIRD_PERSON_PROOF__ = Object.freeze({
    start: startProof,
    snapshot: snapshotProof,
    startCovenBriefing: () => openingFlow.startNarration(),
    showCharacterSelection: () => openingFlow.showSelection(),
    selectCharacter: characterId => openingFlow.select(characterId),
    confirmCharacterSelection: () => openingFlow.confirm(),
    setMovement: (x, y, sprint = false) => {
      input.move.x = Math.max(-1, Math.min(1, x));
      input.move.y = Math.max(-1, Math.min(1, y));
      if (sprint) input.keys.add('ShiftLeft'); else input.keys.delete('ShiftLeft');
    },
    stopMovement: () => { input.move.x = 0; input.move.y = 0; input.keys.delete('ShiftLeft'); },
    playerPosition: () => ({ x: controller.position.x, y: controller.position.y, z: controller.position.z }),
    look: (yawDelta, pitchDelta = 0) => { input.lookDelta.x += yawDelta; input.lookDelta.y += pitchDelta; },
    setLook: (yaw, pitch) => shoulderCamera.setLook(yaw, pitch),
    setAim: value => { input.aiming = Boolean(value); },
    jump: () => input.actions.add('jump'),
    crouch: () => input.toggleCrouch(),
    setCrouched: value => input.setCrouched(value),
    switchShoulder: () => shoulderCamera.switchShoulder(),
    selectSpell: selectActiveSpell,
    castSpell: castActiveSpell,
    castLightning: () => castActiveSpell('lightning'),
    castFrost: () => castActiveSpell('frost'),
    castAegis: () => castActiveSpell('aegis'),
    castFreeze: () => castActiveSpell('freeze'),
    castIceLance: () => castActiveSpell('iceLance'),
    castFireball: () => castActiveSpell('fireball'),
    castFireRing: () => castActiveSpell('fireRing'),
    castGreenVine: () => greenAbilities.castVineTrap(performance.now() / 1000),
    castGreenRestore: (target = 'smart') => target === 'smart'
      ? greenAbilities.castSmartRestore(performance.now() / 1000)
      : greenAbilities.castRestore(performance.now() / 1000, target === 'friend'),
    setGreenRestoreFriendTargeted: value => greenAbilities.setFriendTargeted(value),
    damageGreenWitch: amount => greenAbilities.receiveDamage(amount),
    resetGreenWitch: () => greenAbilities.reset(),
    setGreenSimulationEnabled: value => greenSimulation.setEnabled(value),
    receiveGreenSnapshot: snapshot => greenReplica.receiveSnapshot(snapshot),
    receiveDragonDamage: amount => combat.receiveDragonDamage(amount),
    damageActiveDragon: amount => (combat.currentTarget || dragon).damage(amount, performance.now() / 1000),
    damageDragon: (index, amount) => dragons[index]?.damage(amount, performance.now() / 1000) || false,
    focusDragon: index => {
      const target = dragons[index];
      if (!target) return null;
      combat.currentTarget = target;
      greenAbilities.setDragonTarget(target);
      return target.id;
    },
    teleportNearDragon: (index, distance = 4.2) => {
      const target = dragons[index];
      if (!target) return false;
      controller.teleport(target.root.position.x, 0, target.root.position.z - Math.max(1.5, Number(distance) || 4.2));
      shoulderCamera.snapNextUpdate();
      return true;
    },
    togglePouch: () => inventory.toggle(),
    useHealthBerry: () => inventory.useHealthBerry(),
    useLightningPotion: () => inventory.useLightningPotion(),
    useAegisPotion: () => inventory.useAegisPotion(),
    equipPurpleItem: item => inventory.toggleEquipment(item),
    setEquipmentMode: mode => inventory.toggleEquipment(mode),
    strikeNearbyGeode: () => inventory.strikeNearbyGeode(),
    teleport: (x, y, z) => { controller.teleport(x, y, z); shoulderCamera.snapNextUpdate(); },
    resetRoute: resetTechnicalRoute,
    resetPerformance: () => telemetry.reset(),
    dispose: () => {
      engine.stopRenderLoop();
      openingFlow.dispose();
      qualification?.dispose();
      sceneInstrumentation.dispose();
      scene.dispose();
      engine.dispose();
    }
  });
  window.__HMW_MOBILE_QUALIFICATION__ = Object.freeze({
    enabled: qualification.enabled,
    start: () => qualification.start(),
    end: () => qualification.end(),
    resetRoute: () => qualification.resetRoute(),
    snapshot: () => qualification.snapshot()
  });
} catch (error) {
  showFatalError(error);
}
