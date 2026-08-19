import { GREEN_WITCH } from './config.js?v=20260818-greenwitch-v1';

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

export class GreenWitchAbilities {
  constructor(BABYLON, scene, greenWitch, localWitch, dragon, combat) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.greenWitch = greenWitch;
    this.localWitch = localWitch;
    this.dragon = dragon;
    this.combat = combat;
    this.maximumHealth = GREEN_WITCH.maximumHealth;
    this.health = this.maximumHealth;
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

  friendDistance() {
    const friend = this.localWitch.root.position;
    const self = this.greenWitch.root.position;
    return Math.hypot(friend.x - self.x, friend.y - self.y, friend.z - self.z);
  }

  dragonDistance() {
    const dragon = this.dragon.root.position;
    const self = this.greenWitch.root.position;
    return Math.hypot(dragon.x - self.x, dragon.y - self.y, dragon.z - self.z);
  }

  resolveRestoreTarget(friendTargeted = this.friendTargeted) {
    const friendInRange = this.friendDistance() <= GREEN_WITCH.restoreRange;
    return friendTargeted && friendInRange ? 'FRIEND' : 'SELF';
  }

  setFriendTargeted(value) {
    this.friendTargeted = Boolean(value);
    this.updateHud(this.lastTime);
    return this.resolveRestoreTarget();
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
    const restored = Math.min(amount, this.maximumHealth - this.health);
    this.health += restored;
    return restored;
  }

  castVineTrap(time = performance.now() / 1000) {
    this.lastTime = time;
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

  castRestore(time = performance.now() / 1000, friendTargeted = this.friendTargeted) {
    this.lastTime = time;
    if (time < this.cooldownUntil.restore) {
      this.onMessage(`Restore ready in ${(this.cooldownUntil.restore - time).toFixed(1)}s`);
      return false;
    }
    this.cooldownUntil.restore = time + GREEN_WITCH.restoreCooldown;
    const target = this.resolveRestoreTarget(friendTargeted);
    const restored = target === 'FRIEND'
      ? this.combat.restorePlayerHealth(GREEN_WITCH.restoreAmount)
      : this.restoreSelf(GREEN_WITCH.restoreAmount);
    const targetWitch = target === 'FRIEND' ? this.localWitch : this.greenWitch;
    this.greenWitch.setCast(time, 'restore');
    this.createRestoreEffect(targetWitch.root, time);
    this.lastCast = {
      spell: 'restore',
      target: target === 'FRIEND' ? 'purple-witch' : 'green-witch',
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
      ? `Green Witch restored ${target === 'FRIEND' ? 'Purple Witch' : 'herself'} · +${restored} health`
      : `${target === 'FRIEND' ? 'Purple Witch' : 'Green Witch'} is already at full health`);
    this.updateHud(time);
    return true;
  }

  castSmartRestore(time = performance.now() / 1000) {
    const friendNeedsHealing = this.combat.playerHealth < this.combat.playerMaximumHealth;
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

  update(time) {
    this.lastTime = time;
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
    this.updateHud(time);
  }

  updateHud(time) {
    const target = this.resolveRestoreTarget();
    if (this.healthFill) this.healthFill.style.transform = `scaleX(${this.health / this.maximumHealth})`;
    if (this.healthCopy) this.healthCopy.textContent = `${this.health} / ${this.maximumHealth}`;
    if (this.restoreTargetCopy) this.restoreTargetCopy.textContent = `Restore target · ${target === 'FRIEND' ? 'Purple Witch' : 'Self'}`;
    const vineRemaining = Math.max(0, this.cooldownUntil.vineTrap - time);
    const restoreRemaining = Math.max(0, this.cooldownUntil.restore - time);
    const vineInRange = this.dragonDistance() <= GREEN_WITCH.vineTrapRange;
    if (this.vineButton) this.vineButton.disabled = vineRemaining > 0 || !vineInRange || !this.dragon.alive;
    if (this.restoreButton) this.restoreButton.disabled = restoreRemaining > 0;
    if (this.statusCopy) {
      this.statusCopy.textContent = this.dragon.isRestrained(time)
        ? `Dragon vinebound · ${Math.max(0, this.dragon.restrainedUntil - time).toFixed(1)}s`
        : !vineInRange && this.dragon.alive
          ? 'Move near the dragon to use Vine Trap'
        : vineRemaining > 0 || restoreRemaining > 0
          ? `Vine ${vineRemaining.toFixed(1)}s · Restore ${restoreRemaining.toFixed(1)}s`
          : 'Two-spell ability template ready';
    }
  }

  reset() {
    this.health = this.maximumHealth;
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
    this.updateHud(0);
  }

  snapshot() {
    const restoreTarget = this.resolveRestoreTarget();
    return {
      character: 'GREEN WITCH',
      role: 'RESTORATIVE PLANT MAGIC',
      health: this.health,
      maximumHealth: this.maximumHealth,
      spells: Object.fromEntries(Object.entries(GREEN_WITCH_SPELLS).map(([id, spell]) => [id, { ...spell }])),
      cooldowns: {
        vineTrap: Math.max(0, this.cooldownUntil.vineTrap - this.lastTime),
        restore: Math.max(0, this.cooldownUntil.restore - this.lastTime)
      },
      restoreTarget,
      friendTargeted: this.friendTargeted,
      friendInRange: this.friendDistance() <= GREEN_WITCH.restoreRange,
      dragonInRange: this.dragonDistance() <= GREEN_WITCH.vineTrapRange,
      lastCast: this.lastCast,
      activeVineStreams: this.transientEffects.filter(effect => effect.kind === 'VINE').length,
      activeRestoreEffects: this.transientEffects.filter(effect => effect.kind === 'RESTORE').length,
      bindingCount: this.vineBindings.filter(ring => ring.isEnabled()).length
    };
  }
}
