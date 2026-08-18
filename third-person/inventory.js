import { COMBAT, POUCH } from './config.js?v=20260818-rewards-v1';
import { hexColor3 } from './utils.js';

export class PouchInventory {
  constructor(BABYLON, scene, shadowGenerator, controller, combat) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.controller = controller;
    this.combat = combat;
    this.healthBerries = 0;
    this.gold = 0;
    this.lightningPotions = 0;
    this.aegisPotions = 0;
    this.totalCollected = 0;
    this.totalUsed = 0;
    this.totalPotionsCollected = 0;
    this.totalPotionsUsed = 0;
    this.open = false;
    this.onMessage = () => {};
    this.onOpenChange = () => {};
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
    this.pickups = this.createBerryBushes();
    this.chest = this.createGoldChest();
    this.powerupPickups = this.createPowerupPickups();
    this.bindInterface();
    this.updateInterface();
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

  bindInterface() {
    this.closeButton.addEventListener('click', () => this.setOpen(false));
    this.berryButton.addEventListener('click', () => this.useHealthBerry());
    this.lightningPotionButton.addEventListener('click', () => this.useLightningPotion());
    this.aegisPotionButton.addEventListener('click', () => this.useAegisPotion());
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
      const availableItem = [this.berryButton, this.lightningPotionButton, this.aegisPotionButton]
        .find(button => !button.disabled);
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
    const lightningActive = this.combat.lightningBoostActive();
    this.lightningPotionCountCopy.textContent = lightningLabel;
    this.lightningPotionButton.disabled = this.lightningPotions === 0 || lightningActive;
    this.lightningPotionActionCopy.textContent = lightningActive
      ? `Active · ×${COMBAT.lightningPotionDamageMultiplier} damage · ${Math.max(0, this.combat.lightningBoostUntil - performance.now() / 1000).toFixed(1)}s`
      : this.lightningPotions
        ? `Drink · ×${COMBAT.lightningPotionDamageMultiplier} lightning damage for ${COMBAT.lightningPotionDuration}s`
        : 'Find the amber storm potion in the arena';

    const aegisLabel = `${this.aegisPotions} ${this.aegisPotions === 1 ? 'potion' : 'potions'}`;
    this.aegisPotionCountCopy.textContent = aegisLabel;
    this.aegisPotionButton.disabled = this.aegisPotions === 0 || this.combat.aegisBoostPrimed;
    this.aegisPotionActionCopy.textContent = this.combat.aegisBoostPrimed
      ? `Primed · next Aegis lasts ${COMBAT.aegisDuration * COMBAT.aegisPotionDurationMultiplier}s`
      : this.aegisPotions
        ? `Drink · next Aegis lasts ×${COMBAT.aegisPotionDurationMultiplier} longer`
        : 'Find the blue potion in the arena';
  }

  reset() {
    this.setOpen(false);
    this.healthBerries = 0;
    this.gold = 0;
    this.lightningPotions = 0;
    this.aegisPotions = 0;
    this.totalCollected = 0;
    this.totalUsed = 0;
    this.totalPotionsCollected = 0;
    this.totalPotionsUsed = 0;
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
    this.chest.opened = false;
    this.chest.openProgress = 0;
    this.chest.lidPivot.rotation.x = 0;
    this.chest.glow.intensity = .18;
    this.updateInterface();
  }

  snapshot() {
    return {
      open: this.open,
      healthBerries: this.healthBerries,
      gold: this.gold,
      lightningPotions: this.lightningPotions,
      aegisPotions: this.aegisPotions,
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
      pickups: this.pickups.map(pickup => ({
        id: pickup.id,
        collected: pickup.collected,
        position: { x: pickup.position.x, y: pickup.position.y, z: pickup.position.z }
      }))
    };
  }
}
