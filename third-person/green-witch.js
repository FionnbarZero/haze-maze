import { GREEN_WITCH } from './config.js?v=20260819-expanded-maze-v1';

export const GREEN_WITCH_SPELLS = Object.freeze({
  vineTrap: Object.freeze({
    label: 'Vine Trap',
    unlocked: true,
    role: 'CONTROL',
    cooldown: GREEN_WITCH.vineTrapCooldown
  }),
  restore: Object.freeze({
    label: 'Restore',
    unlocked: true,
    role: 'HEALING',
    cooldown: GREEN_WITCH.restoreCooldown
  })
});

const presentationName = (presentation, fallback = 'Ally') => presentation?.snapshot?.().label || fallback;
const characterTargetId = name => name.toLowerCase().replaceAll(' ', '-');

export class GreenWitchAbilities {
  constructor(BABYLON, scene, greenWitch, localWitch, dragonOrDragons, combat) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.greenWitch = greenWitch;
    this.friendWitch = localWitch;
    this.friendName = presentationName(localWitch, 'Purple Witch');
    this.dragons = (Array.isArray(dragonOrDragons) ? dragonOrDragons : [dragonOrDragons]).filter(Boolean);
    if (!this.dragons.length) throw new Error('GreenWitchAbilities requires at least one dragon');
    this.dragon = this.dragons[0];
    this.combat = combat;
    this.locallyControlled = false;
    this.spellcastingEnabled = true;
    this.friendAvailable = false;
    this.selectedSpell = 'vineTrap';
    this.maximumHealth = GREEN_WITCH.maximumHealth;
    this.health = this.maximumHealth;
    this.friendMaximumHealth = 100;
    this.friendHealth = this.friendMaximumHealth;
    this.cooldownUntil = { vineTrap: 0, restore: 0 };
    this.lastTime = 0;
    this.lastCast = null;
    this.friendTargeted = false;
    this.transientEffects = [];
    this.onMessage = () => {};
    this.partyPanel = document.querySelector('#green-witch-party');
    this.healthCopy = document.querySelector('#green-witch-health-copy');
    this.healthFill = document.querySelector('#green-witch-health-fill');
    this.statusCopy = document.querySelector('#green-witch-status');
    this.restoreTargetCopy = document.querySelector('#green-restore-target');
    this.vineButton = document.querySelector('#green-vine-demo');
    this.restoreButton = document.querySelector('#green-restore-demo');
    this.crosshair = document.querySelector('#crosshair');
    this.crosshairLabel = this.crosshair.querySelector('i');
    this.spellNameCopy = document.querySelector('#selected-spell-name');
    this.spellHelpCopy = document.querySelector('#selected-spell-help');
    this.vineMaterial = this.createVineMaterial();
    this.vineBindings = this.createVineBindings();
    this.updateHud(0);
  }

  createVineMaterial() {
    const material = new this.BABYLON.StandardMaterial('green-witch-vine-material', this.scene);
    material.diffuseColor = this.BABYLON.Color3.FromHexString('#2f8b4d');
    material.emissiveColor = this.BABYLON.Color3.FromHexString('#164d2a');
    material.specularColor = this.BABYLON.Color3.FromHexString('#a9ffc0');
    return material;
  }

  createVineBindings() {
    return [0, 1, 2].map(index => {
      const ring = this.BABYLON.MeshBuilder.CreateTorus(`green-vine-binding-${index}`, {
        diameter: 1.7 - index * .14,
        thickness: .065,
        tessellation: 28
      }, this.scene);
      ring.parent = this.dragon.root;
      ring.position.set(0, .58 + index * .38, 0);
      ring.rotation.x = Math.PI / 2 + (index - 1) * .16;
      ring.rotation.z = (index - 1) * .22;
      ring.material = this.vineMaterial;
      ring.isPickable = false;
      ring.setEnabled(false);
      return ring;
    });
  }

  setDragonTarget(dragon) {
    if (!dragon || dragon === this.dragon) return this.dragon;
    this.dragon = dragon;
    for (const ring of this.vineBindings) ring.parent = dragon.root;
    return dragon;
  }

  resolveDragon() {
    const time = this.lastTime;
    if (this.dragon?.alive && this.dragon.isRestrained(time)) return this.dragon;
    const self = this.greenWitch.root.position;
    const living = this.dragons.filter(dragon => dragon.alive);
    const nearest = living.sort((left, right) => {
      const leftDistance = (left.root.position.x - self.x) ** 2 + (left.root.position.z - self.z) ** 2;
      const rightDistance = (right.root.position.x - self.x) ** 2 + (right.root.position.z - self.z) ** 2;
      return leftDistance - rightDistance;
    })[0];
    return this.setDragonTarget(nearest || this.dragon);
  }

  friendDistance() {
    const friend = this.friendWitch.root.position;
    const self = this.greenWitch.root.position;
    return Math.hypot(friend.x - self.x, friend.y - self.y, friend.z - self.z);
  }

  dragonDistance() {
    this.resolveDragon();
    const dragon = this.dragon.root.position;
    const self = this.greenWitch.root.position;
    return Math.hypot(dragon.x - self.x, dragon.y - self.y, dragon.z - self.z);
  }

  resolveRestoreTarget(friendTargeted = this.friendTargeted) {
    const friendInRange = this.friendDistance() <= GREEN_WITCH.restoreRange;
    return this.friendAvailable && friendTargeted && friendInRange ? 'FRIEND' : 'SELF';
  }

  setFriendTargeted(value) {
    this.friendTargeted = Boolean(value);
    this.updateHud(this.lastTime);
    return this.resolveRestoreTarget();
  }

  setMode({ locallyControlled, friendWitch = this.friendWitch, friendAvailable = false } = {}) {
    this.locallyControlled = Boolean(locallyControlled);
    this.friendAvailable = Boolean(friendAvailable);
    this.friendWitch = friendWitch;
    this.friendName = presentationName(friendWitch, this.friendName);
    this.selectedSpell = 'vineTrap';
    this.friendTargeted = false;
    this.updateHud(this.lastTime);
    if (this.locallyControlled) this.updateSpellSelection(false);
  }

  setSpellcastingEnabled(value) {
    this.spellcastingEnabled = Boolean(value);
    if (!this.spellcastingEnabled) {
      this.friendTargeted = false;
      this.crosshair.classList.remove('is-targeting', 'is-assisted', 'is-obstructed', 'is-self-cast');
      this.crosshairLabel.dataset.stateLabel = '';
    }
    this.updateSpellSelection(false);
    this.updateHud(this.lastTime);
  }

  rejectDisabledCast() {
    if (this.spellcastingEnabled) return false;
    this.onMessage('Spellcasting is unavailable while Mining Tools are active');
    return true;
  }

  selectSpell(value, announce = true) {
    const selected = value === 'restore' ? 'restore' : 'vineTrap';
    const changed = selected !== this.selectedSpell;
    this.selectedSpell = selected;
    this.updateSpellSelection(announce && changed);
    return selected;
  }

  updateSpellSelection(announce) {
    if (!this.locallyControlled) return;
    const spell = GREEN_WITCH_SPELLS[this.selectedSpell];
    this.spellNameCopy.textContent = spell.label;
    this.spellHelpCopy.textContent = !this.spellcastingEnabled
      ? 'Mining Tools active · O strikes geodes'
      : this.selectedSpell === 'restore'
      ? this.friendAvailable
        ? 'Aim at your friend to heal them · otherwise heals self · O casts'
        : 'Restores your health · O casts'
      : '1 / 2 select · O casts';
    this.crosshair.dataset.spell = this.selectedSpell;
    if (announce) this.onMessage(`${spell.label} selected`);
  }

  castSelected(time = this.lastTime) {
    if (this.rejectDisabledCast()) return false;
    return this.selectedSpell === 'restore'
      ? this.castRestore(time, this.friendTargeted)
      : this.castVineTrap(time);
  }

  receiveDamage(amount) {
    if (amount <= 0 || this.health <= 0) return 0;
    const applied = Math.min(this.health, amount);
    this.health -= applied;
    this.partyPanel?.classList.add('is-hit');
    setTimeout(() => this.partyPanel?.classList.remove('is-hit'), 180);
    this.updateHud(this.lastTime);
    return applied;
  }

  restoreSelf(amount) {
    if (this.locallyControlled) return this.combat.restorePlayerHealth(amount);
    const restored = Math.min(amount, this.maximumHealth - this.health);
    this.health += restored;
    return restored;
  }

  restoreFriend(amount) {
    if (!this.locallyControlled) return this.combat.restorePlayerHealth(amount);
    const restored = Math.min(amount, this.friendMaximumHealth - this.friendHealth);
    this.friendHealth += restored;
    return restored;
  }

  castVineTrap(time = this.lastTime) {
    if (this.rejectDisabledCast()) return false;
    this.lastTime = time;
    this.resolveDragon();
    if (time < this.cooldownUntil.vineTrap) {
      this.onMessage(`Vine Trap ready in ${(this.cooldownUntil.vineTrap - time).toFixed(1)}s`);
      return false;
    }
    if (!this.dragon.alive) {
      this.onMessage('Vine Trap has no living target');
      return false;
    }
    if (this.dragonDistance() > GREEN_WITCH.vineTrapRange) {
      this.onMessage('Green Witch must be nearer the dragon to cast Vine Trap');
      return false;
    }
    this.cooldownUntil.vineTrap = time + GREEN_WITCH.vineTrapCooldown;
    this.greenWitch.setCast(time, 'vine trap');
    const hands = this.greenWitch.getHandPositions();
    const impact = this.dragon.getAimPoint();
    const restrained = this.dragon.restrain(time, GREEN_WITCH.vineTrapDuration);
    const effectNames = [
      this.createVineStream('left', hands.left, impact, -1, time),
      this.createVineStream('right', hands.right, impact, 1, time)
    ];
    this.lastCast = {
      spell: 'vineTrap',
      target: 'training-dragon',
      originCount: 2,
      origins: {
        left: hands.left.asArray(),
        right: hands.right.asArray()
      },
      impact: impact.asArray(),
      duration: GREEN_WITCH.vineTrapDuration,
      effectNames,
      resolution: restrained ? 'TARGET' : 'NO_TARGET'
    };
    this.onMessage(`Green Witch cast Vine Trap · dragon held for ${GREEN_WITCH.vineTrapDuration.toFixed(1)}s`);
    this.updateHud(time);
    return restrained;
  }

  createVineStream(sideName, origin, impact, side, time) {
    const distance = this.BABYLON.Vector3.Distance(origin, impact);
    const sections = Math.max(8, Math.ceil(distance * 1.5));
    const points = [];
    for (let index = 0; index <= sections; index += 1) {
      const progress = index / sections;
      const point = this.BABYLON.Vector3.Lerp(origin, impact, progress);
      const envelope = Math.sin(progress * Math.PI);
      point.x += Math.sin(progress * Math.PI * 3 + side) * .12 * envelope;
      point.y += Math.sin(progress * Math.PI) * .38 + Math.cos(progress * Math.PI * 4) * .035;
      point.z += side * Math.sin(progress * Math.PI * 2) * .08 * envelope;
      points.push(point);
    }
    const mesh = this.BABYLON.MeshBuilder.CreateTube(`green-vine-${sideName}-${this.lastTime.toFixed(3)}`, {
      path: points,
      radius: .035,
      tessellation: 8,
      cap: this.BABYLON.Mesh.CAP_ALL
    }, this.scene);
    mesh.material = this.vineMaterial;
    mesh.isPickable = false;
    this.transientEffects.push({
      kind: 'VINE',
      nodes: [mesh],
      startedAt: time,
      expiresAt: time + GREEN_WITCH.vineTrapDuration
    });
    return mesh.name;
  }

  castRestore(time = this.lastTime, friendTargeted = this.friendTargeted) {
    if (this.rejectDisabledCast()) return false;
    this.lastTime = time;
    if (time < this.cooldownUntil.restore) {
      this.onMessage(`Restore ready in ${(this.cooldownUntil.restore - time).toFixed(1)}s`);
      return false;
    }
    this.cooldownUntil.restore = time + GREEN_WITCH.restoreCooldown;
    const target = this.resolveRestoreTarget(friendTargeted);
    const restored = target === 'FRIEND'
      ? this.restoreFriend(GREEN_WITCH.restoreAmount)
      : this.restoreSelf(GREEN_WITCH.restoreAmount);
    const targetWitch = target === 'FRIEND' ? this.friendWitch : this.greenWitch;
    this.greenWitch.setCast(time, 'restore');
    this.createRestoreEffect(targetWitch.root, time);
    this.lastCast = {
      spell: 'restore',
      target: target === 'FRIEND' ? characterTargetId(this.friendName) : 'green-witch',
      targetMode: target,
      friendTargeted: Boolean(friendTargeted),
      restored,
      amount: GREEN_WITCH.restoreAmount,
      range: this.friendDistance(),
      resolution: restored > 0 ? 'RESTORED' : 'FULL_HEALTH'
    };
    this.partyPanel?.classList.add('is-healing');
    setTimeout(() => this.partyPanel?.classList.remove('is-healing'), 320);
    this.onMessage(restored > 0
      ? `Green Witch restored ${target === 'FRIEND' ? this.friendName : 'herself'} · +${restored} health`
      : `${target === 'FRIEND' ? this.friendName : 'Green Witch'} is already at full health`);
    this.updateHud(time);
    return true;
  }

  castSmartRestore(time = this.lastTime) {
    const friendNeedsHealing = this.friendAvailable && (this.locallyControlled
      ? this.friendHealth < this.friendMaximumHealth
      : this.combat.playerHealth < this.combat.playerMaximumHealth);
    this.setFriendTargeted(friendNeedsHealing);
    return this.castRestore(time, friendNeedsHealing);
  }

  createRestoreEffect(targetRoot, time) {
    const material = new this.BABYLON.StandardMaterial(`green-restore-material-${time.toFixed(3)}`, this.scene);
    material.diffuseColor = this.BABYLON.Color3.FromHexString('#a4ffad');
    material.emissiveColor = this.BABYLON.Color3.FromHexString('#47d874');
    material.alpha = .68;
    const nodes = [0, 1, 2].map(index => {
      const ring = this.BABYLON.MeshBuilder.CreateTorus(`green-restore-ring-${index}-${time.toFixed(3)}`, {
        diameter: 1.15 + index * .22,
        thickness: .035,
        tessellation: 30
      }, this.scene);
      ring.parent = targetRoot;
      ring.position.set(0, .3 + index * .42, 0);
      ring.rotation.x = Math.PI / 2;
      ring.material = material;
      ring.isPickable = false;
      return ring;
    });
    const light = new this.BABYLON.PointLight(`green-restore-light-${time.toFixed(3)}`, new this.BABYLON.Vector3(0, 1, 0), this.scene);
    light.parent = targetRoot;
    light.diffuse = this.BABYLON.Color3.FromHexString('#72ff98');
    light.intensity = 2.2;
    light.range = 5;
    this.transientEffects.push({
      kind: 'RESTORE',
      nodes,
      material,
      light,
      startedAt: time,
      expiresAt: time + .9
    });
  }

  updateLocalTargeting(camera) {
    if (!this.locallyControlled || !camera) return;
    if (!this.spellcastingEnabled) {
      this.crosshair.classList.remove('is-targeting', 'is-assisted', 'is-obstructed', 'is-self-cast');
      this.crosshairLabel.dataset.stateLabel = '';
      this.updateSpellSelection(false);
      return;
    }
    this.resolveDragon();
    let friendTargeted = false;
    if (this.friendAvailable && this.selectedSpell === 'restore' && this.friendDistance() <= GREEN_WITCH.restoreRange) {
      const ray = camera.getAimRay(GREEN_WITCH.restoreRange);
      const target = this.friendWitch.root.position.add(new this.BABYLON.Vector3(0, 1.05, 0));
      const toTarget = target.subtract(ray.origin);
      const alongRay = this.BABYLON.Vector3.Dot(toTarget, ray.direction);
      const closest = ray.origin.add(ray.direction.scale(Math.max(0, alongRay)));
      friendTargeted = alongRay >= 0
        && alongRay <= GREEN_WITCH.restoreRange
        && this.BABYLON.Vector3.Distance(closest, target) <= .8;
    }
    this.friendTargeted = friendTargeted;
    const vineTargeted = this.selectedSpell === 'vineTrap'
      && this.dragon.alive
      && this.dragonDistance() <= GREEN_WITCH.vineTrapRange;
    this.crosshair.classList.toggle('is-targeting', vineTargeted || friendTargeted);
    this.crosshair.classList.toggle('is-self-cast', this.selectedSpell === 'restore' && !friendTargeted);
    this.crosshair.classList.remove('is-assisted', 'is-obstructed');
    this.crosshairLabel.dataset.stateLabel = friendTargeted
      ? 'FRIEND'
      : this.selectedSpell === 'restore'
        ? 'SELF'
        : vineTargeted
          ? 'BIND'
          : '';
    this.updateSpellSelection(false);
  }

  update(time, camera = null) {
    this.lastTime = time;
    this.resolveDragon();
    const restrained = this.dragon.isRestrained(time);
    for (const [index, ring] of this.vineBindings.entries()) {
      ring.setEnabled(restrained && this.dragon.alive);
      if (ring.isEnabled()) {
        const pulse = 1 + Math.sin(time * 5 + index) * .035;
        ring.scaling.set(pulse, pulse, pulse);
      }
    }
    for (const effect of this.transientEffects) {
      if (effect.kind !== 'RESTORE') continue;
      const progress = Math.min(1, (time - effect.startedAt) / (effect.expiresAt - effect.startedAt));
      for (const [index, node] of effect.nodes.entries()) {
        const scale = .72 + progress * .55 + index * .025;
        node.scaling.set(scale, scale, scale);
        node.position.y = .24 + index * .38 + progress * .38;
      }
      if (effect.light) effect.light.intensity = 2.2 * (1 - progress);
      if (effect.material) effect.material.alpha = .68 * (1 - progress);
    }
    const expired = this.transientEffects.filter(effect => time >= effect.expiresAt);
    this.transientEffects = this.transientEffects.filter(effect => time < effect.expiresAt);
    for (const effect of expired) {
      for (const node of effect.nodes) node.dispose();
      effect.light?.dispose();
      effect.material?.dispose();
    }
    this.updateLocalTargeting(camera);
    this.updateHud(time);
  }

  updateHud(time) {
    const target = this.resolveRestoreTarget();
    const partyHealth = this.locallyControlled ? this.friendHealth : this.health;
    const partyMaximumHealth = this.locallyControlled ? this.friendMaximumHealth : this.maximumHealth;
    if (this.healthFill) this.healthFill.style.transform = `scaleX(${partyHealth / partyMaximumHealth})`;
    if (this.healthCopy) this.healthCopy.textContent = `${partyHealth} / ${partyMaximumHealth}`;
    if (this.restoreTargetCopy) this.restoreTargetCopy.textContent = `Restore target · ${target === 'FRIEND' ? this.friendName : 'Self'}`;
    const vineRemaining = Math.max(0, this.cooldownUntil.vineTrap - time);
    const restoreRemaining = Math.max(0, this.cooldownUntil.restore - time);
    const vineInRange = this.dragonDistance() <= GREEN_WITCH.vineTrapRange;
    if (this.vineButton) this.vineButton.disabled = !this.spellcastingEnabled || vineRemaining > 0 || !vineInRange || !this.dragon.alive;
    if (this.restoreButton) this.restoreButton.disabled = !this.spellcastingEnabled || restoreRemaining > 0;
    if (this.statusCopy) {
      this.statusCopy.textContent = this.locallyControlled
        ? this.friendAvailable
          ? `Simulated ${this.friendName} · combat ready`
          : 'Solo plant magic ready'
        : this.dragon.isRestrained(time)
        ? `Dragon vinebound · ${Math.max(0, this.dragon.restrainedUntil - time).toFixed(1)}s`
        : !vineInRange && this.dragon.alive
          ? 'Move near the dragon to use Vine Trap'
        : vineRemaining > 0 || restoreRemaining > 0
          ? `Vine ${vineRemaining.toFixed(1)}s · Restore ${restoreRemaining.toFixed(1)}s`
          : 'Two-spell ability template ready';
    }
  }

  reset(time = 0) {
    this.lastTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    this.health = this.maximumHealth;
    this.friendHealth = this.friendMaximumHealth;
    this.cooldownUntil = { vineTrap: 0, restore: 0 };
    this.lastCast = null;
    this.friendTargeted = false;
    for (const ring of this.vineBindings) ring.setEnabled(false);
    for (const effect of this.transientEffects) {
      for (const node of effect.nodes) node.dispose();
      effect.light?.dispose();
      effect.material?.dispose();
    }
    this.transientEffects = [];
    this.updateHud(this.lastTime);
  }

  snapshot() {
    const restoreTarget = this.resolveRestoreTarget();
    const ownHealth = this.locallyControlled ? this.combat.playerHealth : this.health;
    return {
      character: 'GREEN WITCH',
      role: 'RESTORATIVE PLANT MAGIC',
      locallyControlled: this.locallyControlled,
      spellcastingEnabled: this.spellcastingEnabled,
      friendAvailable: this.friendAvailable,
      friendName: this.friendName,
      selectedSpell: this.selectedSpell,
      health: ownHealth,
      maximumHealth: this.maximumHealth,
      friendHealth: this.locallyControlled ? this.friendHealth : this.combat.playerHealth,
      spells: Object.fromEntries(Object.entries(GREEN_WITCH_SPELLS).map(([id, spell]) => [id, { ...spell }])),
      cooldowns: {
        vineTrap: Math.max(0, this.cooldownUntil.vineTrap - this.lastTime),
        restore: Math.max(0, this.cooldownUntil.restore - this.lastTime)
      },
      restoreTarget,
      friendTargeted: this.friendTargeted,
      friendInRange: this.friendAvailable && this.friendDistance() <= GREEN_WITCH.restoreRange,
      dragonInRange: this.dragonDistance() <= GREEN_WITCH.vineTrapRange,
      targetDragonId: this.dragon?.id || null,
      lastCast: this.lastCast,
      activeVineStreams: this.transientEffects.filter(effect => effect.kind === 'VINE').length,
      activeRestoreEffects: this.transientEffects.filter(effect => effect.kind === 'RESTORE').length,
      bindingCount: this.vineBindings.filter(ring => ring.isEnabled()).length
    };
  }
}
