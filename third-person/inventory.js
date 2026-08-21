import { COMBAT, POUCH } from './config.js?v=20260821-simulation-time-v1';
import { ChapterOneInteractions, EQUIPMENT_MODES } from './chapter-interactions.js?v=20260820-chapter-one-v3';
import { ChapterOneGeodeState } from './chapter-geode-state.js?v=20260820-chapter-one-v3';
import { hexColor3 } from './utils.js';

export class PouchInventory {
  constructor(BABYLON, scene, shadowGenerator, controller, combat, purpleWitch, options = {}) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.controller = controller;
    this.combat = combat;
    this.purpleWitch = purpleWitch;
    this.activeWitch = purpleWitch;
    this.activeCharacter = 'purple';
    this.routeMode = options.routeMode === 'chapter1' ? 'chapter1' : 'legacy';
    this.chapterMode = this.routeMode === 'chapter1';
    this.levelPlan = options.levelPlan || null;
    this.progression = options.progression || null;
    if (this.chapterMode && (!this.levelPlan || !this.progression)) {
      throw new Error('Chapter 1 inventory requires a validated level plan and progression state');
    }
    const chapterGeodes = this.chapterMode
      ? [...this.levelPlan.requiredGeodes, ...this.levelPlan.optionalGeodes]
      : [];
    this.geodeState = this.chapterMode
      ? options.geodeState || new ChapterOneGeodeState({ geodes: chapterGeodes })
      : null;
    this.interactions = this.chapterMode
      ? new ChapterOneInteractions({
        actorId: this.activeCharacter,
        geodes: chapterGeodes,
        geodeState: this.geodeState
      })
      : null;
    this.ownedEquipment = this.chapterMode ? null : { staff: true, geodePick: false, geodeHammer: false };
    this.equippedItem = this.chapterMode ? null : 'staff';
    this.geodes = 0;
    this.rawDamageCrystals = 0;
    this.runes = 0;
    this.healthBerries = 0;
    this.gold = 0;
    this.lightningPotions = 0;
    this.aegisPotions = 0;
    this.totalCollected = 0;
    this.totalUsed = 0;
    this.totalPotionsCollected = 0;
    this.totalPotionsUsed = 0;
    this.lastTime = 0;
    this.open = false;
    this.onMessage = () => {};
    this.onOpenChange = () => {};
    this.onEquipmentModeChange = () => {};
    this.overlay = document.querySelector('#pouch-overlay');
    this.closeButton = document.querySelector('#close-pouch');
    this.berryButton = document.querySelector('#use-health-berry');
    this.berryCountCopy = document.querySelector('#pouch-berry-count');
    this.berryActionCopy = document.querySelector('#berry-action-copy');
    this.hudCountCopy = document.querySelector('#hud-berry-count');
    this.hudGoldCopy = document.querySelector('#hud-gold-count');
    this.goldCountCopy = document.querySelector('#pouch-gold-count');
    this.lightningPotionButton = document.querySelector('#use-lightning-potion');
    this.lightningPotionCountCopy = document.querySelector('#pouch-lightning-potion-count');
    this.lightningPotionActionCopy = document.querySelector('#lightning-potion-action-copy');
    this.aegisPotionButton = document.querySelector('#use-aegis-potion');
    this.aegisPotionCountCopy = document.querySelector('#pouch-aegis-potion-count');
    this.aegisPotionActionCopy = document.querySelector('#aegis-potion-action-copy');
    this.gearSection = document.querySelector('#pouch-gear-section');
    this.gearHeading = document.querySelector('#pouch-gear-heading');
    this.staffButton = document.querySelector('#pouch-staff-item');
    this.staffLabel = document.querySelector('#pouch-staff-label');
    this.staffActionCopy = document.querySelector('#staff-action-copy');
    this.staffStateCopy = document.querySelector('#pouch-staff-state');
    this.geodePickButton = document.querySelector('#pouch-geode-pick-item');
    this.geodePickLabel = document.querySelector('#pouch-geode-pick-label');
    this.geodePickActionCopy = document.querySelector('#geode-pick-action-copy');
    this.geodePickStateCopy = document.querySelector('#pouch-geode-pick-state');
    this.geodeHammerButton = document.querySelector('#pouch-geode-hammer-item');
    this.geodeHammerLabel = document.querySelector('#pouch-geode-hammer-label');
    this.geodeHammerActionCopy = document.querySelector('#geode-hammer-action-copy');
    this.geodeHammerStateCopy = document.querySelector('#pouch-geode-hammer-state');
    this.geodeCountCopy = document.querySelector('#pouch-geode-count');
    this.geodeLabel = document.querySelector('#pouch-geode-label');
    this.geodePowerCopy = document.querySelector('#geode-power-copy');
    this.runeCountCopy = document.querySelector('#pouch-rune-count');
    this.runeLabel = document.querySelector('#pouch-rune-label');
    this.runeActionCopy = document.querySelector('#rune-action-copy');
    this.spellHelpCopy = document.querySelector('#selected-spell-help');
    this.keeperCluesSection = document.querySelector('#keeper-clues-section');
    this.keeperClueList = document.querySelector('#keeper-clue-list');
    this.configureRouteLabels();
    this.pickups = this.createBerryBushes();
    this.chest = this.createGoldChest();
    this.powerupPickups = this.createPowerupPickups();
    this.equipmentPickups = this.createEquipmentPickups();
    this.geodeRocks = this.createGeodeRocks();
    this.runePickups = this.createRunePickups();
    this.bindInterface();
    this.applyEquippedItem();
    this.updateInterface();
  }

  configureRouteLabels() {
    this.keeperCluesSection.hidden = !this.chapterMode;
    this.geodeLabel.closest('.pouch-item').setAttribute(
      'aria-label',
      this.chapterMode ? 'Carried Raw Damage Crystals' : 'Mined magical geodes'
    );
    this.runeLabel.closest('.pouch-item').setAttribute(
      'aria-label',
      this.chapterMode ? 'West Route-Rune fragments and completion' : 'Recovered rune-door runes'
    );
    if (this.chapterMode) return;
    this.gearHeading.textContent = 'Held equipment · Purple Witch';
    this.staffLabel.textContent = 'Moon staff';
    this.geodePickLabel.textContent = 'Crystal geode pick';
    this.geodeHammerLabel.textContent = 'Geode hammer';
    this.geodeLabel.textContent = 'Magical geodes';
    this.runeLabel.textContent = 'Rune-door runes';
  }

  renderKeeperClues(clues) {
    if (!this.chapterMode) return;
    const signature = clues.map(clue => clue.id).join('|');
    if (signature === this.keeperClueSignature) return;
    this.keeperClueSignature = signature;
    this.keeperClueList.replaceChildren();
    if (!clues.length) {
      const empty = document.createElement('li');
      empty.className = 'is-empty';
      empty.textContent = 'No Keeper clues recovered yet.';
      this.keeperClueList.append(empty);
      return;
    }
    for (const clue of clues) {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      const text = document.createElement('small');
      title.textContent = clue.title;
      text.textContent = clue.text;
      item.append(title, text);
      this.keeperClueList.append(item);
    }
  }

  createBerryBushes() {
    const leafMaterial = new this.BABYLON.StandardMaterial('berry-bush-leaf-material', this.scene);
    leafMaterial.diffuseColor = hexColor3(this.BABYLON, '#35563f');
    leafMaterial.emissiveColor = hexColor3(this.BABYLON, '#0b1b10');
    leafMaterial.specularColor = hexColor3(this.BABYLON, '#15261a');

    const branchMaterial = new this.BABYLON.StandardMaterial('berry-bush-branch-material', this.scene);
    branchMaterial.diffuseColor = hexColor3(this.BABYLON, '#5b3b2b');
    branchMaterial.specularColor = hexColor3(this.BABYLON, '#1d100c');

    const berryMaterial = new this.BABYLON.StandardMaterial('golden-health-berry-material', this.scene);
    berryMaterial.diffuseColor = hexColor3(this.BABYLON, '#f5b942');
    berryMaterial.emissiveColor = hexColor3(this.BABYLON, '#b55a0d');
    berryMaterial.specularColor = hexColor3(this.BABYLON, '#fff1a8');

    const leafOffsets = [
      [-.24, .52, .02, .54, .38, .48],
      [.23, .56, -.03, .5, .36, .46],
      [0, .72, .08, .58, .4, .52]
    ];
    const berryOffsets = [
      [-.27, .69, -.25],
      [.16, .8, -.31],
      [.34, .59, .08],
      [-.12, .52, .34],
      [.04, .91, .12]
    ];

    return POUCH.berryBushes.map((definition, index) => {
      const root = new this.BABYLON.TransformNode(`health-berry-bush-${definition.id}`, this.scene);
      const sourceMeshes = [];

      const branch = this.BABYLON.MeshBuilder.CreateCylinder(`health-berry-branch-${definition.id}`, {
        height: .62,
        diameterTop: .08,
        diameterBottom: .18,
        tessellation: 7
      }, this.scene);
      branch.parent = root;
      branch.position.y = .31;
      branch.material = branchMaterial;
      branch.isPickable = false;
      sourceMeshes.push(branch);

      for (let leafIndex = 0; leafIndex < leafOffsets.length; leafIndex += 1) {
        const [x, y, z, scaleX, scaleY, scaleZ] = leafOffsets[leafIndex];
        const leaves = this.BABYLON.MeshBuilder.CreateSphere(`health-berry-leaves-${definition.id}-${leafIndex}`, {
          diameter: 1,
          segments: 8
        }, this.scene);
        leaves.parent = root;
        leaves.position.set(x, y, z);
        leaves.scaling.set(scaleX, scaleY, scaleZ);
        leaves.material = leafMaterial;
        leaves.isPickable = false;
        sourceMeshes.push(leaves);
      }

      for (let berryIndex = 0; berryIndex < berryOffsets.length; berryIndex += 1) {
        const [x, y, z] = berryOffsets[berryIndex];
        const berry = this.BABYLON.MeshBuilder.CreateSphere(`golden-health-berry-${definition.id}-${berryIndex}`, {
          diameter: .18,
          segments: 10
        }, this.scene);
        berry.parent = root;
        berry.position.set(x, y, z);
        berry.material = berryMaterial;
        berry.isPickable = false;
        sourceMeshes.push(berry);
      }

      const bushMesh = this.BABYLON.Mesh.MergeMeshes(sourceMeshes, true, true, undefined, true, true);
      if (!bushMesh) throw new Error(`Could not merge temporary berry bush ${definition.id}`);
      bushMesh.name = `health-berry-bush-mesh-${definition.id}`;
      bushMesh.parent = root;
      bushMesh.isPickable = false;
      this.shadowGenerator.addShadowCaster(bushMesh);
      root.position.set(definition.x, definition.y, definition.z);

      return {
        id: definition.id,
        root,
        position: new this.BABYLON.Vector3(definition.x, definition.y, definition.z),
        phase: index * 1.91,
        collected: false
      };
    });
  }

  createGoldChest() {
    const definition = POUCH.goldChest;
    const woodMaterial = new this.BABYLON.StandardMaterial('reward-chest-wood-material', this.scene);
    woodMaterial.diffuseColor = hexColor3(this.BABYLON, '#684026');
    woodMaterial.emissiveColor = hexColor3(this.BABYLON, '#160b05');
    woodMaterial.specularColor = hexColor3(this.BABYLON, '#2a160b');

    const metalMaterial = new this.BABYLON.StandardMaterial('reward-chest-metal-material', this.scene);
    metalMaterial.diffuseColor = hexColor3(this.BABYLON, '#9f7630');
    metalMaterial.emissiveColor = hexColor3(this.BABYLON, '#2d1904');
    metalMaterial.specularColor = hexColor3(this.BABYLON, '#f8d57b');

    const coinMaterial = new this.BABYLON.StandardMaterial('reward-chest-coin-material', this.scene);
    coinMaterial.diffuseColor = hexColor3(this.BABYLON, '#f3bd3f');
    coinMaterial.emissiveColor = hexColor3(this.BABYLON, '#8f4a08');
    coinMaterial.specularColor = hexColor3(this.BABYLON, '#fff1a1');

    const root = new this.BABYLON.TransformNode(`gold-chest-${definition.id}`, this.scene);
    root.position.set(definition.x, definition.y, definition.z);
    root.rotation.y = -Math.PI / 4;

    const base = this.BABYLON.MeshBuilder.CreateBox(`gold-chest-base-${definition.id}`, {
      width: 1.35,
      height: .58,
      depth: .82
    }, this.scene);
    base.parent = root;
    base.position.y = .3;
    base.material = woodMaterial;
    base.isPickable = false;
    this.shadowGenerator.addShadowCaster(base);

    for (const x of [-.51, .51]) {
      const band = this.BABYLON.MeshBuilder.CreateBox(`gold-chest-band-${definition.id}-${x}`, {
        width: .1,
        height: .64,
        depth: .86
      }, this.scene);
      band.parent = root;
      band.position.set(x, .32, 0);
      band.material = metalMaterial;
      band.isPickable = false;
      this.shadowGenerator.addShadowCaster(band);
    }

    const lock = this.BABYLON.MeshBuilder.CreateBox(`gold-chest-lock-${definition.id}`, {
      width: .22,
      height: .28,
      depth: .08
    }, this.scene);
    lock.parent = root;
    lock.position.set(0, .48, -.45);
    lock.material = metalMaterial;
    lock.isPickable = false;

    const lidPivot = new this.BABYLON.TransformNode(`gold-chest-lid-pivot-${definition.id}`, this.scene);
    lidPivot.parent = root;
    lidPivot.position.set(0, .57, .38);
    const lid = this.BABYLON.MeshBuilder.CreateBox(`gold-chest-lid-${definition.id}`, {
      width: 1.4,
      height: .3,
      depth: .84
    }, this.scene);
    lid.parent = lidPivot;
    lid.position.set(0, .12, -.39);
    lid.material = woodMaterial;
    lid.isPickable = false;
    this.shadowGenerator.addShadowCaster(lid);

    const coins = [];
    for (let index = 0; index < 12; index += 1) {
      const coin = this.BABYLON.MeshBuilder.CreateCylinder(`gold-chest-coin-${definition.id}-${index}`, {
        height: .045,
        diameter: .19,
        tessellation: 12
      }, this.scene);
      coin.parent = root;
      coin.position.set(-.46 + index % 4 * .3, .62 + Math.floor(index / 4) * .035, -.2 + Math.floor(index / 4) * .18);
      coin.rotation.y = index * .71;
      coin.material = coinMaterial;
      coin.isPickable = false;
      coins.push(coin);
    }

    const glow = new this.BABYLON.PointLight(
      `gold-chest-glow-${definition.id}`,
      new this.BABYLON.Vector3(0, .72, 0),
      this.scene
    );
    glow.parent = root;
    glow.diffuse = hexColor3(this.BABYLON, '#ffd164');
    glow.range = 3.8;
    glow.intensity = .18;

    return {
      id: definition.id,
      root,
      lidPivot,
      coins,
      glow,
      amount: definition.gold,
      position: new this.BABYLON.Vector3(definition.x, definition.y, definition.z),
      opened: false,
      openProgress: 0
    };
  }

  createPowerupPickups() {
    const glassMaterial = new this.BABYLON.StandardMaterial('powerup-bottle-glass-material', this.scene);
    glassMaterial.diffuseColor = hexColor3(this.BABYLON, '#d8efff');
    glassMaterial.specularColor = hexColor3(this.BABYLON, '#ffffff');
    glassMaterial.alpha = .36;
    glassMaterial.backFaceCulling = false;

    const lightningMaterial = new this.BABYLON.StandardMaterial('lightning-potion-material', this.scene);
    lightningMaterial.diffuseColor = hexColor3(this.BABYLON, '#e9b83d');
    lightningMaterial.emissiveColor = hexColor3(this.BABYLON, '#a4430b');
    lightningMaterial.specularColor = hexColor3(this.BABYLON, '#fff3ae');

    const aegisMaterial = new this.BABYLON.StandardMaterial('aegis-potion-material', this.scene);
    aegisMaterial.diffuseColor = hexColor3(this.BABYLON, '#52bdf5');
    aegisMaterial.emissiveColor = hexColor3(this.BABYLON, '#164db0');
    aegisMaterial.specularColor = hexColor3(this.BABYLON, '#ddf8ff');

    const corkMaterial = new this.BABYLON.StandardMaterial('powerup-bottle-cork-material', this.scene);
    corkMaterial.diffuseColor = hexColor3(this.BABYLON, '#7b5231');
    corkMaterial.specularColor = hexColor3(this.BABYLON, '#28170c');

    return POUCH.powerups.map((definition, index) => {
      const root = new this.BABYLON.TransformNode(`powerup-${definition.id}`, this.scene);
      root.position.set(definition.x, definition.y, definition.z);

      const bottle = this.BABYLON.MeshBuilder.CreateSphere(`powerup-bottle-${definition.id}`, {
        diameter: .55,
        segments: 14
      }, this.scene);
      bottle.parent = root;
      bottle.position.y = .47;
      bottle.scaling.set(.78, 1, .78);
      bottle.material = glassMaterial;
      bottle.isPickable = false;

      const liquid = this.BABYLON.MeshBuilder.CreateSphere(`powerup-liquid-${definition.id}`, {
        diameter: .44,
        segments: 12
      }, this.scene);
      liquid.parent = root;
      liquid.position.y = .42;
      liquid.scaling.set(.76, .72, .76);
      liquid.material = definition.type === 'lightning' ? lightningMaterial : aegisMaterial;
      liquid.isPickable = false;

      const neck = this.BABYLON.MeshBuilder.CreateCylinder(`powerup-neck-${definition.id}`, {
        height: .3,
        diameter: .18,
        tessellation: 12
      }, this.scene);
      neck.parent = root;
      neck.position.y = .79;
      neck.material = glassMaterial;
      neck.isPickable = false;

      const cork = this.BABYLON.MeshBuilder.CreateCylinder(`powerup-cork-${definition.id}`, {
        height: .14,
        diameter: .2,
        tessellation: 10
      }, this.scene);
      cork.parent = root;
      cork.position.y = 1;
      cork.material = corkMaterial;
      cork.isPickable = false;
      this.shadowGenerator.addShadowCaster(cork);

      const glow = new this.BABYLON.PointLight(
        `powerup-glow-${definition.id}`,
        new this.BABYLON.Vector3(0, .5, 0),
        this.scene
      );
      glow.parent = root;
      glow.diffuse = definition.type === 'lightning'
        ? hexColor3(this.BABYLON, '#ffc85f')
        : hexColor3(this.BABYLON, '#5bcfff');
      glow.range = 3.1;
      glow.intensity = .58;

      return {
        id: definition.id,
        type: definition.type,
        root,
        glow,
        position: new this.BABYLON.Vector3(definition.x, definition.y, definition.z),
        phase: index * 2.37,
        collected: false
      };
    });
  }

  createEquipmentPickups() {
    if (this.chapterMode) return [];
    const handleMaterial = new this.BABYLON.StandardMaterial('field-tool-handle-material', this.scene);
    handleMaterial.diffuseColor = hexColor3(this.BABYLON, '#725037');
    handleMaterial.specularColor = hexColor3(this.BABYLON, '#25170f');

    const metalMaterial = new this.BABYLON.StandardMaterial('field-tool-metal-material', this.scene);
    metalMaterial.diffuseColor = hexColor3(this.BABYLON, '#8e91a5');
    metalMaterial.emissiveColor = hexColor3(this.BABYLON, '#20243b');
    metalMaterial.specularColor = hexColor3(this.BABYLON, '#dce8ff');

    return POUCH.equipmentPickups.map((definition, index) => {
      const root = new this.BABYLON.TransformNode(`equipment-pickup-${definition.id}`, this.scene);
      root.position.set(definition.x, definition.y, definition.z);

      const handle = this.BABYLON.MeshBuilder.CreateCylinder(`equipment-handle-${definition.id}`, {
        height: .9,
        diameter: .08,
        tessellation: 10
      }, this.scene);
      handle.parent = root;
      handle.position.y = .55;
      handle.rotation.z = -.18;
      handle.material = handleMaterial;
      handle.isPickable = false;
      this.shadowGenerator.addShadowCaster(handle);

      const head = definition.type === 'geodePick'
        ? this.BABYLON.MeshBuilder.CreateCylinder(`equipment-head-${definition.id}`, {
          height: .58,
          diameterTop: .05,
          diameterBottom: .14,
          tessellation: 10
        }, this.scene)
        : this.BABYLON.MeshBuilder.CreateBox(`equipment-head-${definition.id}`, {
          width: .5,
          height: .2,
          depth: .22
        }, this.scene);
      head.parent = root;
      head.position.set(-.1, 1.02, 0);
      if (definition.type === 'geodePick') head.rotation.z = Math.PI / 2;
      head.material = metalMaterial;
      head.isPickable = false;
      this.shadowGenerator.addShadowCaster(head);

      const glow = new this.BABYLON.PointLight(
        `equipment-glow-${definition.id}`,
        new this.BABYLON.Vector3(0, .72, 0),
        this.scene
      );
      glow.parent = root;
      glow.diffuse = hexColor3(this.BABYLON, '#bca8ff');
      glow.range = 2.6;
      glow.intensity = .35;

      return {
        id: definition.id,
        type: definition.type,
        root,
        glow,
        position: new this.BABYLON.Vector3(definition.x, definition.y, definition.z),
        phase: index * 2.13,
        collected: false
      };
    });
  }

  createGeodeRocks() {
    const stoneMaterial = new this.BABYLON.StandardMaterial('geode-rock-stone-material', this.scene);
    stoneMaterial.diffuseColor = hexColor3(this.BABYLON, '#4f465c');
    stoneMaterial.specularColor = hexColor3(this.BABYLON, '#24202c');

    const crystalMaterial = new this.BABYLON.StandardMaterial('geode-rock-crystal-material', this.scene);
    crystalMaterial.diffuseColor = hexColor3(this.BABYLON, '#cfacff');
    crystalMaterial.emissiveColor = hexColor3(this.BABYLON, '#7542b8');
    crystalMaterial.specularColor = hexColor3(this.BABYLON, '#fff4ff');

    const requiredMarkerMaterial = new this.BABYLON.StandardMaterial('required-geode-marker-material', this.scene);
    requiredMarkerMaterial.diffuseColor = hexColor3(this.BABYLON, '#f3d88d');
    requiredMarkerMaterial.emissiveColor = hexColor3(this.BABYLON, '#c486ff');
    requiredMarkerMaterial.specularColor = hexColor3(this.BABYLON, '#fff8d4');
    requiredMarkerMaterial.alpha = .82;

    const fragmentMaterial = new this.BABYLON.StandardMaterial('route-fragment-pickup-material', this.scene);
    fragmentMaterial.diffuseColor = hexColor3(this.BABYLON, '#f5d998');
    fragmentMaterial.emissiveColor = hexColor3(this.BABYLON, '#a45bdb');
    fragmentMaterial.specularColor = hexColor3(this.BABYLON, '#fff8dc');

    const definitions = this.chapterMode
      ? [...this.levelPlan.requiredGeodes, ...this.levelPlan.optionalGeodes].map(geode => ({
        ...geode,
        x: geode.position.x,
        y: geode.position.y,
        z: geode.position.z
      }))
      : POUCH.geodeRocks;
    return definitions.map((definition, rockIndex) => {
      const root = new this.BABYLON.TransformNode(`geode-rock-${definition.id}`, this.scene);
      root.position.set(definition.x, definition.y, definition.z);

      const stone = this.BABYLON.MeshBuilder.CreateSphere(`geode-rock-stone-${definition.id}`, {
        diameter: 1.28,
        segments: 9
      }, this.scene);
      stone.parent = root;
      stone.position.y = .43;
      stone.scaling.set(1.18, .72, .92);
      stone.rotation.y = rockIndex * .7 + .35;
      stone.material = stoneMaterial;
      stone.isPickable = false;
      this.shadowGenerator.addShadowCaster(stone);

      const crystals = [];
      for (const [index, offset] of [[0, [-.26, .8, -.02, -.18]], [1, [0, .93, .06, .08]], [2, [.25, .78, .02, .25]]]) {
        const [x, y, z, tilt] = offset;
        const crystal = this.BABYLON.MeshBuilder.CreateCylinder(`geode-crystal-${definition.id}-${index}`, {
          height: .55 + index * .06,
          diameterTop: 0,
          diameterBottom: .2,
          tessellation: 6
        }, this.scene);
        crystal.parent = root;
        crystal.position.set(x, y, z);
        crystal.rotation.z = tilt;
        crystal.material = crystalMaterial;
        crystal.isPickable = false;
        if (this.chapterMode) crystal.setEnabled(false);
        this.shadowGenerator.addShadowCaster(crystal);
        crystals.push(crystal);
      }

      const glow = new this.BABYLON.PointLight(
        `geode-rock-glow-${definition.id}`,
        new this.BABYLON.Vector3(0, .82, 0),
        this.scene
      );
      glow.parent = root;
      glow.diffuse = hexColor3(this.BABYLON, '#c69cff');
      glow.range = 3.4;
      glow.intensity = .65;

      const discoveryMarker = new this.BABYLON.TransformNode(`required-geode-marker-${definition.id}`, this.scene);
      discoveryMarker.parent = root;
      const markerBeam = this.BABYLON.MeshBuilder.CreateCylinder(`required-geode-beam-${definition.id}`, {
        height: 3.2,
        diameter: .075,
        tessellation: 8
      }, this.scene);
      markerBeam.parent = discoveryMarker;
      markerBeam.position.y = 1.95;
      markerBeam.material = requiredMarkerMaterial;
      markerBeam.isPickable = false;
      const markerRing = this.BABYLON.MeshBuilder.CreateTorus(`required-geode-ring-${definition.id}`, {
        diameter: 1.48,
        thickness: .075,
        tessellation: 32
      }, this.scene);
      markerRing.parent = discoveryMarker;
      markerRing.position.y = 1.18;
      markerRing.material = requiredMarkerMaterial;
      markerRing.isPickable = false;
      discoveryMarker.setEnabled(this.chapterMode && Boolean(definition.required));

      const rewardRoot = new this.BABYLON.TransformNode(`geode-reward-${definition.id}`, this.scene);
      rewardRoot.parent = root;
      rewardRoot.position.y = 1.08;
      const rewardMesh = this.BABYLON.MeshBuilder.CreateCylinder(`geode-reward-mesh-${definition.id}`, {
        height: .62,
        diameterTop: .05,
        diameterBottom: .38,
        tessellation: definition.required ? 4 : 6
      }, this.scene);
      rewardMesh.parent = rewardRoot;
      rewardMesh.material = definition.required ? fragmentMaterial : crystalMaterial;
      rewardMesh.isPickable = false;
      const rewardGlow = new this.BABYLON.PointLight(
        `geode-reward-glow-${definition.id}`,
        new this.BABYLON.Vector3(0, 0, 0),
        this.scene
      );
      rewardGlow.parent = rewardRoot;
      rewardGlow.diffuse = hexColor3(this.BABYLON, definition.required ? '#f3d88d' : '#cfacff');
      rewardGlow.range = 3.1;
      rewardGlow.intensity = .9;
      rewardRoot.setEnabled(false);

      return {
        id: definition.id,
        root,
        stone,
        crystals,
        glow,
        discoveryMarker,
        reward: {
          root: rewardRoot,
          mesh: rewardMesh,
          glow: rewardGlow,
          available: false,
          collected: false,
          collectibleAt: 0,
          content: null
        },
        required: Boolean(definition.required),
        content: definition.content ? structuredClone(definition.content) : null,
        strikesRequired: definition.strikesRequired || 1,
        strikes: 0,
        position: new this.BABYLON.Vector3(definition.x, definition.y, definition.z),
        mined: false,
        blockedNotified: false,
        phase: rockIndex * 1.77
      };
    });
  }

  createRunePickups() {
    if (this.chapterMode) return [];
    const runeMaterial = new this.BABYLON.StandardMaterial('gate-rune-material', this.scene);
    runeMaterial.diffuseColor = hexColor3(this.BABYLON, '#f0c46e');
    runeMaterial.emissiveColor = hexColor3(this.BABYLON, '#a749d2');
    runeMaterial.specularColor = hexColor3(this.BABYLON, '#fff1ba');

    return POUCH.runes.map((definition, index) => {
      const root = new this.BABYLON.TransformNode(`gate-rune-${definition.id}`, this.scene);
      root.position.set(definition.x, definition.y, definition.z);

      const ring = this.BABYLON.MeshBuilder.CreateTorus(`gate-rune-ring-${definition.id}`, {
        diameter: .58,
        thickness: .085,
        tessellation: 24
      }, this.scene);
      ring.parent = root;
      ring.position.y = .65;
      ring.rotation.x = Math.PI / 2;
      ring.material = runeMaterial;
      ring.isPickable = false;
      this.shadowGenerator.addShadowCaster(ring);

      const mark = this.BABYLON.MeshBuilder.CreateBox(`gate-rune-mark-${definition.id}`, {
        width: .09,
        height: .5,
        depth: .06
      }, this.scene);
      mark.parent = root;
      mark.position.y = .65;
      mark.rotation.z = (index - 1) * .58;
      mark.material = runeMaterial;
      mark.isPickable = false;

      const glow = new this.BABYLON.PointLight(
        `gate-rune-glow-${definition.id}`,
        new this.BABYLON.Vector3(0, .65, 0),
        this.scene
      );
      glow.parent = root;
      glow.diffuse = hexColor3(this.BABYLON, '#d184ff');
      glow.range = 3.6;
      glow.intensity = .75;

      root.setEnabled(definition.available);
      return {
        id: definition.id,
        source: definition.source,
        root,
        glow,
        position: new this.BABYLON.Vector3(definition.x, definition.y, definition.z),
        phase: index * 1.83,
        available: definition.available,
        collected: false,
        falling: false
      };
    });
  }

  setCharacter(characterId, witch = this.activeWitch) {
    this.activeCharacter = ['purple', 'green', 'frost', 'fire'].includes(characterId) ? characterId : 'purple';
    this.activeWitch = witch || this.purpleWitch;
    if (this.chapterMode) {
      this.interactions.assignToolsToActor(this.activeCharacter);
      if (this.gearSection) this.gearSection.hidden = false;
    } else if (this.gearSection) {
      this.gearSection.hidden = this.activeCharacter !== 'purple';
    }
    this.applyEquippedItem();
    this.updateInterface();
    this.onEquipmentModeChange(this.currentEquipmentMode());
  }

  currentEquipmentMode() {
    return this.chapterMode ? this.interactions.mode : this.equippedItem;
  }

  applyEquippedItem() {
    const equippedItem = this.currentEquipmentMode();
    const presentationItem = this.chapterMode && equippedItem === EQUIPMENT_MODES.miningTools
      ? 'miningTools'
      : equippedItem;
    this.activeWitch?.setHeldItem(presentationItem);
  }

  toggleEquipment(item) {
    if (this.chapterMode) {
      const mode = item === 'staff'
        ? EQUIPMENT_MODES.staff
        : ['miningTools', 'mining-tools', 'geodePick', 'geodeHammer'].includes(item)
          ? EQUIPMENT_MODES.miningTools
          : null;
      if (!mode) return false;
      this.interactions.setMode(mode);
      this.applyEquippedItem();
      this.updateInterface();
      this.onEquipmentModeChange(mode);
      this.onMessage(mode === EQUIPMENT_MODES.staff
        ? 'Wand or staff ready · spellcasting enabled'
        : 'Mining Tools ready · press O near a geode to strike · spells stored');
      return true;
    }
    if (this.activeCharacter !== 'purple') return false;
    if (!this.ownedEquipment[item]) {
      this.onMessage(item === 'geodePick'
        ? 'The crystal geode pick is still hidden in the maze'
        : 'The geode hammer is still hidden in the maze');
      return false;
    }
    this.equippedItem = this.equippedItem === item ? null : item;
    this.applyEquippedItem();
    this.updateInterface();
    this.onEquipmentModeChange(this.currentEquipmentMode());
    if (!this.equippedItem) this.onMessage('Hands free · equipment stored in the pouch');
    else if (item === 'staff') this.onMessage('Moon staff equipped · spellcasting ready');
    else this.onMessage(`${item === 'geodePick' ? 'Crystal geode pick' : 'Geode hammer'} equipped · staff stored`);
    return true;
  }

  canCastWithStaff() {
    if (this.chapterMode) return this.interactions.canActorCast(this.activeCharacter);
    return this.activeCharacter !== 'purple' || this.equippedItem === 'staff';
  }

  collectEquipment(pickup) {
    if (pickup.collected) return false;
    pickup.collected = true;
    pickup.root.setEnabled(false);
    this.ownedEquipment[pickup.type] = true;
    this.updateInterface();
    this.onMessage(pickup.type === 'geodePick'
      ? 'Crystal geode pick found · stored in the pouch'
      : 'Geode hammer found · stored in the pouch');
    return true;
  }

  mineGeodeRock(rock) {
    if (rock.mined || !this.ownedEquipment.geodePick || !this.ownedEquipment.geodeHammer) return false;
    rock.mined = true;
    rock.blockedNotified = false;
    for (const crystal of rock.crystals) crystal.setEnabled(false);
    rock.glow.intensity = .08;
    this.geodes += 1;
    this.combat.setGeodeCount(this.geodes);
    this.updateInterface();
    const increase = Math.round(this.geodes * POUCH.geodePowerPerCrystal * 100);
    this.onMessage(`Magical geode mined · lightning power permanently increased ${increase}%`);
    return true;
  }

  applyChapterGeodeVisual(rock, state) {
    if (!rock || !state) return;
    rock.strikes = state.strikes;
    rock.mined = state.broken;
    const progress = state.strikes / state.strikesRequired;
    rock.stone.scaling.set(1.18 - progress * .12, .72 - progress * .17, .92 - progress * .1);
    rock.stone.rotation.z = Math.sin(state.strikes * 2.17) * .055 * (1 - progress);
    rock.glow.intensity = state.broken ? .82 : .48 + progress * .32;
    rock.stone.setEnabled(!state.broken);
    rock.discoveryMarker.setEnabled(rock.required && !state.broken);
    for (const crystal of rock.crystals) crystal.setEnabled(state.broken);
  }

  spawnChapterGeodeReward(rock, content) {
    if (!rock || !content || rock.reward.available || rock.reward.collected) return false;
    rock.reward.available = true;
    rock.reward.content = structuredClone(content);
    rock.reward.collectibleAt = this.lastTime + .65;
    rock.reward.root.rotation.y = 0;
    rock.reward.root.setEnabled(true);
    this.onMessage(content.kind === 'route-rune-fragment'
      ? 'Geode opened · a glowing Route-Rune fragment emerged'
      : 'Geode opened · a Raw Damage Crystal emerged');
    return true;
  }

  collectChapterGeodeReward(rock) {
    const reward = rock?.reward;
    if (!reward?.available || reward.collected || !reward.content) return false;
    let message = '';
    if (reward.content.kind === 'route-rune-fragment') {
      const collected = this.progression.collectFragment(reward.content);
      if (!collected.accepted) return false;
      const clueTitle = reward.content.clue?.title || 'Keeper clue';
      message = collected.completedNow
        ? `${clueTitle} recovered · West Route-Rune completed · Sunken Gate unlocked`
        : `${clueTitle} recovered · route-rune fragment ${collected.fragmentCount} / 3`;
    } else if (reward.content.kind === 'raw-damage-crystal') {
      this.rawDamageCrystals += reward.content.amount || 1;
      this.combat.setDamageCrystalCount(this.rawDamageCrystals);
      message = `Raw Damage Crystal collected · ${this.rawDamageCrystals} carried · +${this.rawDamageCrystals * 10}% spell damage`;
    } else {
      return false;
    }
    reward.available = false;
    reward.collected = true;
    reward.root.setEnabled(false);
    this.geodes += 1;
    this.onMessage(message);
    this.updateInterface();
    return true;
  }

  strikeNearbyGeode() {
    if (!this.chapterMode) return false;
    if (!this.interactions.canActorMine(this.activeCharacter)) {
      this.onMessage('Equip Mining Tools from the pouch before striking a geode');
      return false;
    }
    const player = this.controller.position;
    const radiusSquared = POUCH.geodeMineRadius * POUCH.geodeMineRadius;
    const rock = this.geodeRocks.find(candidate => {
      if (candidate.mined) return false;
      const dx = player.x - candidate.position.x;
      const dz = player.z - candidate.position.z;
      return dx * dx + dz * dz <= radiusSquared;
    });
    if (!rock) {
      this.onMessage('Mining Tools ready · move beside an unopened geode');
      return false;
    }
    const result = this.interactions.strikeGeode(rock.id, this.activeCharacter);
    if (!result.accepted) return false;
    this.applyChapterGeodeVisual(rock, {
      strikes: result.strikes,
      strikesRequired: result.strikesRequired,
      broken: result.brokenNow
    });
    if (!result.brokenNow) {
      this.onMessage('Geode struck · bright cracks spread through the stone');
      this.updateInterface();
      return true;
    }

    this.spawnChapterGeodeReward(rock, result.content);
    this.updateInterface();
    return true;
  }

  revealDragonRune(source, position = null) {
    const rune = this.runePickups.find(pickup => pickup.source === source);
    if (!rune || rune.available || rune.collected) return false;
    if (position) rune.position.set(position.x, position.y || 0, position.z);
    rune.root.position.set(rune.position.x, rune.position.y + 1.65, rune.position.z);
    rune.available = true;
    rune.falling = true;
    rune.root.setEnabled(true);
    this.updateInterface();
    return true;
  }

  collectRune(rune) {
    if (!rune.available || rune.collected) return false;
    rune.collected = true;
    rune.falling = false;
    rune.root.setEnabled(false);
    this.runes += 1;
    this.updateInterface();
    const remaining = Math.max(0, POUCH.requiredRunes - this.runes);
    this.onMessage(remaining
      ? `Gate rune recovered · ${remaining} ${remaining === 1 ? 'rune remains' : 'runes remain'}`
      : `All ${POUCH.requiredRunes} gate runes recovered · the Moon Door is yielding`);
    return true;
  }

  bindInterface() {
    this.closeButton.addEventListener('click', () => this.setOpen(false));
    this.berryButton.addEventListener('click', () => this.useHealthBerry());
    this.lightningPotionButton.addEventListener('click', () => this.useLightningPotion());
    this.aegisPotionButton.addEventListener('click', () => this.useAegisPotion());
    this.staffButton.addEventListener('click', () => this.toggleEquipment('staff'));
    this.geodePickButton.addEventListener('click', () => this.toggleEquipment('geodePick'));
    this.geodeHammerButton.addEventListener('click', () => this.toggleEquipment('geodeHammer'));
    this.overlay.addEventListener('pointerdown', event => {
      if (event.target === this.overlay) this.setOpen(false);
    });
  }

  setOpen(value) {
    const next = Boolean(value);
    if (next === this.open) return;
    this.open = next;
    this.overlay.classList.toggle('is-open', this.open);
    this.overlay.setAttribute('aria-hidden', String(!this.open));
    this.onOpenChange(this.open);
    this.updateInterface();
    if (this.open) requestAnimationFrame(() => {
      const availableItem = [...this.overlay.querySelectorAll('button.pouch-item')]
        .find(button => !button.disabled && !button.closest('[hidden]'));
      (availableItem || this.closeButton).focus();
    });
  }

  toggle() {
    this.setOpen(!this.open);
  }

  collect(pickup) {
    if (pickup.collected) return false;
    pickup.collected = true;
    pickup.root.setEnabled(false);
    this.healthBerries += 1;
    this.totalCollected += 1;
    this.updateInterface();
    this.onMessage(`Golden health berry collected · ${this.healthBerries} in pouch · press P`);
    return true;
  }

  useHealthBerry() {
    if (this.healthBerries <= 0) {
      this.onMessage('The pouch has no health berries');
      return false;
    }
    const restored = this.combat.restorePlayerHealth(POUCH.healthBerryRestore);
    if (restored <= 0) {
      this.onMessage('Health is already full · berry preserved');
      this.updateInterface();
      return false;
    }
    this.healthBerries -= 1;
    this.totalUsed += 1;
    this.updateInterface();
    this.onMessage(`Golden berry eaten · restored ${restored} health`);
    return true;
  }

  collectGoldChest() {
    if (this.chest.opened) return false;
    this.chest.opened = true;
    this.gold += this.chest.amount;
    this.updateInterface();
    this.onMessage(`Treasure chest opened · ${this.chest.amount} gold collected`);
    return true;
  }

  collectPowerup(pickup) {
    if (pickup.collected) return false;
    pickup.collected = true;
    pickup.root.setEnabled(false);
    if (pickup.type === 'lightning') this.lightningPotions += 1;
    else this.aegisPotions += 1;
    this.totalPotionsCollected += 1;
    this.updateInterface();
    this.onMessage(pickup.type === 'lightning'
      ? 'Storm potion collected · use it from the pouch'
      : 'Blue Aegis potion collected · use it from the pouch');
    return true;
  }

  useLightningPotion() {
    if (this.activeCharacter !== 'purple') {
      this.onMessage('Storm potions can only empower the Purple Witch');
      return false;
    }
    if (this.lightningPotions <= 0) {
      this.onMessage('The pouch has no storm potions');
      return false;
    }
    if (!this.combat.activateLightningBoost()) {
      this.onMessage('Lightning is already empowered · potion preserved');
      this.updateInterface();
      return false;
    }
    this.lightningPotions -= 1;
    this.totalPotionsUsed += 1;
    this.updateInterface();
    this.onMessage(`Storm potion used · lightning attacks ×${COMBAT.lightningPotionDamageMultiplier} for ${COMBAT.lightningPotionDuration}s`);
    return true;
  }

  useAegisPotion() {
    if (this.activeCharacter !== 'purple') {
      this.onMessage('Aegis potions can only empower the Purple Witch');
      return false;
    }
    if (this.aegisPotions <= 0) {
      this.onMessage('The pouch has no blue Aegis potions');
      return false;
    }
    if (!this.combat.primeAegisBoost()) {
      this.onMessage('The next Aegis is already empowered · potion preserved');
      this.updateInterface();
      return false;
    }
    this.aegisPotions -= 1;
    this.totalPotionsUsed += 1;
    this.updateInterface();
    this.onMessage(`Blue potion used · next Aegis lasts ×${COMBAT.aegisPotionDurationMultiplier} longer`);
    return true;
  }

  update(time, deltaTime) {
    this.lastTime = time;
    const player = this.controller.position;
    const pickupRadiusSquared = POUCH.pickupRadius * POUCH.pickupRadius;
    for (const pickup of this.pickups) {
      if (pickup.collected) continue;
      pickup.root.rotation.y += deltaTime * .24;
      pickup.root.position.y = pickup.position.y + Math.sin(time * 2.1 + pickup.phase) * .035;
      const dx = player.x - pickup.position.x;
      const dz = player.z - pickup.position.z;
      if (dx * dx + dz * dz <= pickupRadiusSquared) this.collect(pickup);
    }

    for (const pickup of this.powerupPickups) {
      if (pickup.collected) continue;
      pickup.root.rotation.y += deltaTime * .72;
      pickup.root.position.y = pickup.position.y + Math.sin(time * 2.4 + pickup.phase) * .08;
      pickup.glow.intensity = .44 + (.5 + Math.sin(time * 4 + pickup.phase) * .5) * .34;
      const dx = player.x - pickup.position.x;
      const dz = player.z - pickup.position.z;
      if (dx * dx + dz * dz <= pickupRadiusSquared) this.collectPowerup(pickup);
    }

    for (const pickup of this.equipmentPickups) {
      if (pickup.collected) continue;
      pickup.root.rotation.y += deltaTime * .48;
      pickup.root.position.y = pickup.position.y + Math.sin(time * 2.2 + pickup.phase) * .06;
      pickup.glow.intensity = .25 + (.5 + Math.sin(time * 3.6 + pickup.phase) * .5) * .28;
      if (this.activeCharacter !== 'purple') continue;
      const dx = player.x - pickup.position.x;
      const dz = player.z - pickup.position.z;
      if (dx * dx + dz * dz <= pickupRadiusSquared) this.collectEquipment(pickup);
    }

    if (this.chapterMode) {
      for (const rock of this.geodeRocks) {
        if (rock.discoveryMarker.isEnabled()) {
          rock.discoveryMarker.rotation.y += deltaTime * .42;
          rock.discoveryMarker.position.y = Math.sin(time * 1.8 + rock.phase) * .08;
        }
        if (!rock.reward.available || rock.reward.collected) continue;
        rock.reward.root.rotation.y += deltaTime * 1.8;
        rock.reward.root.position.y = 1.08 + Math.sin(time * 3.2 + rock.phase) * .12;
        rock.reward.glow.intensity = .72 + (.5 + Math.sin(time * 4.4 + rock.phase) * .5) * .38;
        if (time < rock.reward.collectibleAt) continue;
        const dx = player.x - rock.position.x;
        const dz = player.z - rock.position.z;
        if (dx * dx + dz * dz <= pickupRadiusSquared) this.collectChapterGeodeReward(rock);
      }
    }

    const mineRadiusSquared = POUCH.geodeMineRadius * POUCH.geodeMineRadius;
    for (const rock of this.geodeRocks) {
      if (rock.mined) continue;
      rock.glow.intensity = .48 + (.5 + Math.sin(time * 3.2 + rock.phase) * .5) * .35;
      const dx = player.x - rock.position.x;
      const dz = player.z - rock.position.z;
      const inRange = dx * dx + dz * dz <= mineRadiusSquared;
      if (!inRange) {
        rock.blockedNotified = false;
        continue;
      }
      if (this.chapterMode) {
        if (!rock.blockedNotified) {
          rock.blockedNotified = true;
          this.onMessage(this.interactions.canActorMine(this.activeCharacter)
            ? 'Geode ready · press O to strike'
            : 'Unopened geode · equip Mining Tools from the pouch');
        }
        continue;
      }
      if (this.activeCharacter !== 'purple') continue;
      if (this.ownedEquipment.geodePick && this.ownedEquipment.geodeHammer) {
        this.mineGeodeRock(rock);
      } else if (!rock.blockedNotified) {
        rock.blockedNotified = true;
        const missing = [
          !this.ownedEquipment.geodePick ? 'crystal geode pick' : null,
          !this.ownedEquipment.geodeHammer ? 'geode hammer' : null
        ].filter(Boolean).join(' and ');
        this.onMessage(`Magical crystal rock found · locate the ${missing}`);
      }
    }

    for (const rune of this.runePickups) {
      if (!rune.available || rune.collected) continue;
      rune.root.rotation.y += deltaTime * 1.05;
      if (rune.falling) {
        rune.root.position.y = Math.max(rune.position.y, rune.root.position.y - deltaTime * 3.6);
        if (rune.root.position.y <= rune.position.y) rune.falling = false;
      } else {
        rune.root.position.y = rune.position.y + Math.sin(time * 2.6 + rune.phase) * .08;
      }
      rune.glow.intensity = .55 + (.5 + Math.sin(time * 4.2 + rune.phase) * .5) * .4;
      const dx = player.x - rune.position.x;
      const dz = player.z - rune.position.z;
      if (dx * dx + dz * dz <= pickupRadiusSquared) this.collectRune(rune);
    }

    if (!this.chest.opened) {
      const dx = player.x - this.chest.position.x;
      const dz = player.z - this.chest.position.z;
      if (dx * dx + dz * dz <= POUCH.chestPickupRadius * POUCH.chestPickupRadius) this.collectGoldChest();
    }
    const targetOpenProgress = this.chest.opened ? 1 : 0;
    this.chest.openProgress += (targetOpenProgress - this.chest.openProgress) * Math.min(1, deltaTime * 7);
    const easedOpenProgress = 1 - (1 - this.chest.openProgress) ** 3;
    this.chest.lidPivot.rotation.x = easedOpenProgress * 1.38;
    this.chest.glow.intensity = .18 + easedOpenProgress * (.65 + Math.sin(time * 4.5) * .08);
    if (this.open) this.updateInterface();
  }

  updateInterface() {
    const label = `${this.healthBerries} ${this.healthBerries === 1 ? 'berry' : 'berries'}`;
    this.berryCountCopy.textContent = label;
    this.hudCountCopy.textContent = label;
    this.hudGoldCopy.textContent = `${this.gold} gold`;
    this.goldCountCopy.textContent = `${this.gold} gold`;
    this.berryButton.disabled = this.healthBerries === 0;
    this.berryActionCopy.textContent = this.healthBerries === 0
      ? 'Find a glowing bush in the maze'
      : this.combat.playerHealth >= this.combat.playerMaximumHealth
        ? 'Health full · berry will be preserved'
        : `Eat berry · restore up to ${POUCH.healthBerryRestore} health`;

    const lightningLabel = `${this.lightningPotions} ${this.lightningPotions === 1 ? 'potion' : 'potions'}`;
    const lightningActive = this.combat.lightningBoostActive(this.lastTime);
    const purplePowerupsAvailable = this.activeCharacter === 'purple';
    this.lightningPotionCountCopy.textContent = lightningLabel;
    this.lightningPotionButton.disabled = !purplePowerupsAvailable || this.lightningPotions === 0 || lightningActive;
    this.lightningPotionActionCopy.textContent = !purplePowerupsAvailable
      ? 'Purple Witch only · potion preserved'
      : lightningActive
      ? `Active · ×${COMBAT.lightningPotionDamageMultiplier} damage · ${Math.max(0, this.combat.lightningBoostUntil - this.lastTime).toFixed(1)}s`
      : this.lightningPotions
        ? `Drink · ×${COMBAT.lightningPotionDamageMultiplier} lightning damage for ${COMBAT.lightningPotionDuration}s`
        : 'Find the amber storm potion in the arena';

    const aegisLabel = `${this.aegisPotions} ${this.aegisPotions === 1 ? 'potion' : 'potions'}`;
    this.aegisPotionCountCopy.textContent = aegisLabel;
    this.aegisPotionButton.disabled = !purplePowerupsAvailable || this.aegisPotions === 0 || this.combat.aegisBoostPrimed;
    this.aegisPotionActionCopy.textContent = !purplePowerupsAvailable
      ? 'Purple Witch only · potion preserved'
      : this.combat.aegisBoostPrimed
      ? `Primed · next Aegis lasts ${COMBAT.aegisDuration * COMBAT.aegisPotionDurationMultiplier}s`
      : this.aegisPotions
        ? `Drink · next Aegis lasts ×${COMBAT.aegisPotionDurationMultiplier} longer`
        : 'Find the blue potion in the arena';

    const equipmentState = item => this.equippedItem === item ? 'Held' : 'Stored';
    const equipmentAction = (item, label) => this.equippedItem === item
      ? `${label} currently active`
      : `Switch to ${label}`;
    if (this.chapterMode) {
      const chapterState = this.progression.snapshot();
      const miningActive = this.interactions.mode === EQUIPMENT_MODES.miningTools;
      this.gearHeading.textContent = `Equipment mode · ${this.activeCharacter[0].toUpperCase()}${this.activeCharacter.slice(1)} Witch`;
      this.staffButton.disabled = false;
      this.staffStateCopy.textContent = miningActive ? 'Stored' : 'Held';
      this.staffActionCopy.textContent = miningActive ? 'Switch to spellcasting mode' : 'Spellcasting enabled';
      this.geodePickButton.disabled = false;
      this.geodePickStateCopy.textContent = miningActive ? 'Held' : 'Stored';
      this.geodePickActionCopy.textContent = miningActive
        ? 'Pick and hammer ready · O strikes nearby geodes'
        : 'Switch to the paired Mining Tools';
      this.geodeHammerButton.disabled = false;
      this.geodeHammerStateCopy.textContent = 'Paired';
      this.geodeHammerActionCopy.textContent = 'Unique hammer · owned with the geode pick';
      this.spellHelpCopy.textContent = miningActive
        ? 'Mining Tools active · O strikes geodes'
        : '1 / 2 / 3 select · O casts';
      this.geodeCountCopy.textContent = `${this.rawDamageCrystals} raw ${this.rawDamageCrystals === 1 ? 'crystal' : 'crystals'}`;
      this.geodePowerCopy.textContent = this.rawDamageCrystals
        ? `Personal spell damage · +${this.rawDamageCrystals * 10}%`
        : miningActive
          ? 'Press O beside an unopened geode to strike'
          : 'Optional geodes may contain Raw Damage Crystals';
      this.runeCountCopy.textContent = `${chapterState.routeRune.fragmentCount} / ${chapterState.routeRune.requiredFragments}`;
      const clueCount = chapterState.keeperClues.length;
      this.renderKeeperClues(chapterState.keeperClues);
      this.runeActionCopy.textContent = chapterState.routeRune.completed
        ? `West Route-Rune complete · permanent · ${clueCount} Keeper clues recovered`
        : `${chapterState.routeRune.requiredFragments - chapterState.routeRune.fragmentCount} fragments remain · ${clueCount} Keeper ${clueCount === 1 ? 'clue' : 'clues'} recovered`;
      return;
    }
    this.staffButton.disabled = false;
    this.staffStateCopy.textContent = equipmentState('staff');
    this.staffActionCopy.textContent = equipmentAction('staff', 'staff');

    this.geodePickButton.disabled = !this.ownedEquipment.geodePick;
    this.geodePickStateCopy.textContent = this.ownedEquipment.geodePick ? equipmentState('geodePick') : 'Not found';
    this.geodePickActionCopy.textContent = this.ownedEquipment.geodePick
      ? equipmentAction('geodePick', 'crystal pick')
      : 'Hidden somewhere inside the maze';

    this.geodeHammerButton.disabled = !this.ownedEquipment.geodeHammer;
    this.geodeHammerStateCopy.textContent = this.ownedEquipment.geodeHammer ? equipmentState('geodeHammer') : 'Not found';
    this.geodeHammerActionCopy.textContent = this.ownedEquipment.geodeHammer
      ? equipmentAction('geodeHammer', 'geode hammer')
      : 'Hidden elsewhere inside the maze';

    this.geodeCountCopy.textContent = `${this.geodes} ${this.geodes === 1 ? 'geode' : 'geodes'}`;
    this.geodePowerCopy.textContent = this.geodes
      ? `Permanent lightning increase · +${Math.round(this.geodes * POUCH.geodePowerPerCrystal * 100)}%`
      : this.ownedEquipment.geodePick && this.ownedEquipment.geodeHammer
        ? 'Both mining tools found · seek the glowing corner rock'
        : 'Find both mining tools to open magical crystal rocks';

    this.runeCountCopy.textContent = `${this.runes} / ${POUCH.requiredRunes}`;
    const runesRemaining = Math.max(0, POUCH.requiredRunes - this.runes);
    this.runeActionCopy.textContent = runesRemaining
      ? `${runesRemaining} ${runesRemaining === 1 ? 'rune remains' : 'runes remain'} · search the maze rooms`
      : 'Complete set · the Moon Door can open';
  }

  reset(time = 0) {
    this.lastTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    this.setOpen(false);
    this.ownedEquipment = this.chapterMode ? null : { staff: true, geodePick: false, geodeHammer: false };
    this.equippedItem = this.chapterMode ? null : 'staff';
    this.geodes = 0;
    this.rawDamageCrystals = 0;
    this.runes = 0;
    this.healthBerries = 0;
    this.gold = 0;
    this.lightningPotions = 0;
    this.aegisPotions = 0;
    this.totalCollected = 0;
    this.totalUsed = 0;
    this.totalPotionsCollected = 0;
    this.totalPotionsUsed = 0;
    if (this.chapterMode) {
      this.geodeState.reset();
      this.interactions.reset(this.activeCharacter);
    }
    for (const pickup of this.pickups) {
      pickup.collected = false;
      pickup.root.position.copyFrom(pickup.position);
      pickup.root.rotation.y = 0;
      pickup.root.setEnabled(true);
    }
    for (const pickup of this.powerupPickups) {
      pickup.collected = false;
      pickup.root.position.copyFrom(pickup.position);
      pickup.root.rotation.y = 0;
      pickup.root.setEnabled(true);
    }
    for (const pickup of this.equipmentPickups) {
      pickup.collected = false;
      pickup.root.position.copyFrom(pickup.position);
      pickup.root.rotation.y = 0;
      pickup.root.setEnabled(true);
    }
    for (const rock of this.geodeRocks) {
      rock.mined = false;
      rock.strikes = 0;
      rock.blockedNotified = false;
      rock.glow.intensity = .65;
      rock.stone.setEnabled(true);
      rock.stone.scaling.set(1.18, .72, .92);
      rock.stone.rotation.z = 0;
      rock.discoveryMarker.position.y = 0;
      rock.discoveryMarker.rotation.y = 0;
      rock.discoveryMarker.setEnabled(this.chapterMode && rock.required);
      rock.reward.available = false;
      rock.reward.collected = false;
      rock.reward.collectibleAt = 0;
      rock.reward.content = null;
      rock.reward.root.position.y = 1.08;
      rock.reward.root.rotation.y = 0;
      rock.reward.root.setEnabled(false);
      for (const crystal of rock.crystals) crystal.setEnabled(!this.chapterMode);
    }
    for (const rune of this.runePickups) {
      const definition = POUCH.runes.find(entry => entry.id === rune.id);
      rune.position.set(definition.x, definition.y, definition.z);
      rune.root.position.copyFrom(rune.position);
      rune.root.rotation.y = 0;
      rune.available = definition.available;
      rune.collected = false;
      rune.falling = false;
      rune.root.setEnabled(rune.available);
    }
    this.chest.opened = false;
    this.chest.openProgress = 0;
    this.chest.lidPivot.rotation.x = 0;
    this.chest.glow.intensity = .18;
    this.combat.setGeodeCount(0);
    this.combat.setDamageCrystalCount(0);
    this.applyEquippedItem();
    this.updateInterface();
    this.onEquipmentModeChange(this.currentEquipmentMode());
  }

  snapshot() {
    const chapterState = this.chapterMode ? this.progression.snapshot() : null;
    const interactionState = this.chapterMode ? this.interactions.snapshot() : null;
    const equippedItem = interactionState?.mode || this.equippedItem;
    const ownedEquipment = interactionState
      ? {
        staff: true,
        geodePick: interactionState.tools.pick.ownerId === this.activeCharacter,
        geodeHammer: interactionState.tools.hammer.ownerId === this.activeCharacter
      }
      : { ...this.ownedEquipment };
    return {
      open: this.open,
      healthBerries: this.healthBerries,
      gold: this.gold,
      lightningPotions: this.lightningPotions,
      aegisPotions: this.aegisPotions,
      activeCharacter: this.activeCharacter,
      equipment: {
        owned: ownedEquipment,
        equipped: equippedItem,
        staffStored: equippedItem !== 'staff',
        mode: equippedItem,
        tools: interactionState?.tools || null,
        canCast: interactionState?.canCast ?? this.canCastWithStaff(),
        canMine: interactionState?.canMine ?? false
      },
      geodes: this.geodes,
      rawDamageCrystals: this.rawDamageCrystals,
      geodeDamageMultiplier: 1 + (this.chapterMode ? this.rawDamageCrystals : this.geodes) * POUCH.geodePowerPerCrystal,
      runes: this.chapterMode ? chapterState.routeRune.fragmentCount : this.runes,
      requiredRunes: this.chapterMode ? chapterState.routeRune.requiredFragments : POUCH.requiredRunes,
      chapter: chapterState,
      restoreAmount: POUCH.healthBerryRestore,
      totalCollected: this.totalCollected,
      totalUsed: this.totalUsed,
      totalPotionsCollected: this.totalPotionsCollected,
      totalPotionsUsed: this.totalPotionsUsed,
      chest: {
        id: this.chest.id,
        opened: this.chest.opened,
        openProgress: this.chest.openProgress,
        amount: this.chest.amount,
        position: { x: this.chest.position.x, y: this.chest.position.y, z: this.chest.position.z }
      },
      powerups: this.powerupPickups.map(pickup => ({
        id: pickup.id,
        type: pickup.type,
        collected: pickup.collected,
        position: { x: pickup.position.x, y: pickup.position.y, z: pickup.position.z }
      })),
      equipmentPickups: this.equipmentPickups.map(pickup => ({
        id: pickup.id,
        type: pickup.type,
        collected: pickup.collected,
        position: { x: pickup.position.x, y: pickup.position.y, z: pickup.position.z }
      })),
      geodeRocks: this.geodeRocks.map(rock => ({
        id: rock.id,
        mined: rock.mined,
        required: rock.required,
        strikes: this.chapterMode
          ? interactionState.geodes.find(geode => geode.id === rock.id)?.strikes || 0
          : rock.mined ? 1 : 0,
        strikesRequired: rock.strikesRequired,
        remaining: this.chapterMode
          ? interactionState.geodes.find(geode => geode.id === rock.id)?.remaining ?? rock.strikesRequired
          : rock.mined ? 0 : 1,
        revealedContent: this.chapterMode
          ? interactionState.geodes.find(geode => geode.id === rock.id)?.content || null
          : null,
        reward: this.chapterMode ? {
          available: rock.reward.available,
          collected: rock.reward.collected,
          kind: rock.reward.content?.kind || null,
          collectible: rock.reward.available && this.lastTime >= rock.reward.collectibleAt,
          position: { x: rock.position.x, y: rock.position.y + rock.reward.root.position.y, z: rock.position.z },
          visualEnabled: rock.reward.root.isEnabled()
        } : null,
        visual: {
          stoneEnabled: rock.stone.isEnabled(),
          stoneScale: { x: rock.stone.scaling.x, y: rock.stone.scaling.y, z: rock.stone.scaling.z },
          revealedCrystals: rock.crystals.filter(crystal => crystal.isEnabled()).length,
          glowIntensity: rock.glow.intensity,
          discoveryMarkerEnabled: rock.discoveryMarker.isEnabled()
        },
        position: { x: rock.position.x, y: rock.position.y, z: rock.position.z }
      })),
      runePickups: this.runePickups.map(rune => ({
        id: rune.id,
        source: rune.source,
        available: rune.available,
        collected: rune.collected,
        falling: rune.falling,
        position: { x: rune.position.x, y: rune.position.y, z: rune.position.z }
      })),
      pickups: this.pickups.map(pickup => ({
        id: pickup.id,
        collected: pickup.collected,
        position: { x: pickup.position.x, y: pickup.position.y, z: pickup.position.z }
      }))
    };
  }
}
