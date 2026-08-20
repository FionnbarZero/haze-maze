import { COMBAT, PLAYER, POUCH } from './config.js?v=20260819-expanded-maze-v1';
import { blockerPrecedesTarget, raySphereEntryDistance } from './targeting.js?v=20260818-rewards-v1';

export const SPELLS = Object.freeze({
  lightning: Object.freeze({ label: 'Lightning', cooldown: COMBAT.lightningCooldown, targeted: true }),
  frost: Object.freeze({ label: 'Frost', cooldown: COMBAT.frostCooldown, targeted: true }),
  aegis: Object.freeze({ label: 'Aegis Globe', cooldown: COMBAT.aegisCooldown, targeted: false }),
  freeze: Object.freeze({ label: 'Freeze', cooldown: COMBAT.frostCooldown, targeted: true }),
  iceLance: Object.freeze({ label: 'Ice Lance', cooldown: COMBAT.iceLanceCooldown, targeted: true }),
  fireball: Object.freeze({ label: 'Fireball', cooldown: COMBAT.fireballCooldown, targeted: true }),
  fireRing: Object.freeze({ label: 'Fire Ring', cooldown: COMBAT.fireRingCooldown, targeted: false })
});

export const CHARACTER_LOADOUTS = Object.freeze({
  purple: Object.freeze(['lightning', 'frost', 'aegis']),
  frost: Object.freeze(['freeze', 'iceLance']),
  fire: Object.freeze(['fireball', 'fireRing']),
  green: Object.freeze([])
});

const createCooldowns = () => Object.fromEntries(Object.keys(SPELLS).map(spell => [spell, 0]));

export class LightningCombat {
  constructor(BABYLON, scene, camera, witch, dragonOrDragons, controller) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.camera = camera;
    this.witch = witch;
    this.playerName = 'Purple Witch';
    this.activeCharacter = 'purple';
    this.loadout = [...CHARACTER_LOADOUTS.purple];
    this.spellcastingEnabled = true;
    this.dragons = (Array.isArray(dragonOrDragons) ? dragonOrDragons : [dragonOrDragons]).filter(Boolean);
    if (!this.dragons.length) throw new Error('LightningCombat requires at least one dragon');
    this.dragon = this.dragons[0];
    this.currentTarget = this.dragon;
    this.threatDragon = null;
    this.controller = controller;
    this.cooldownUntil = createCooldowns();
    this.selectedSpell = 'lightning';
    this.lastTime = 0;
    this.targeted = false;
    this.candidateTargeted = false;
    this.assisted = false;
    this.aimState = 'NONE';
    this.lastCast = null;
    this.playerMaximumHealth = PLAYER.maximumHealth;
    this.playerHealth = PLAYER.maximumHealth;
    this.aegisUntil = 0;
    this.lightningBoostUntil = 0;
    this.geodeCount = 0;
    this.geodeDamageMultiplier = 1;
    this.aegisBoostPrimed = false;
    this.lastAegisDuration = COMBAT.aegisDuration;
    this.aegisHitUntil = 0;
    this.aegisAbsorbedHits = 0;
    this.fireRingUntil = 0;
    this.fireRingHitUntil = 0;
    this.fireRingAbsorbedHits = 0;
    this.fireRingRepelledCreatures = 0;
    this.damageTaken = 0;
    this.dragonInAttackRange = false;
    this.nextDragonAttackAt = 0;
    this.playerDefeated = false;
    this.onMessage = () => {};
    this.onPlayerDefeated = () => {};
    this.crosshair = document.querySelector('#crosshair');
    this.crosshairLabel = this.crosshair.querySelector('i');
    this.targetCard = document.querySelector('#target-card');
    this.healthFill = document.querySelector('#target-health-fill');
    this.healthCopy = document.querySelector('#target-health-copy');
    this.targetStatus = document.querySelector('#target-status');
    this.spellNameCopy = document.querySelector('#selected-spell-name');
    this.spellHelpCopy = document.querySelector('#selected-spell-help');
    this.playerVitals = document.querySelector('#player-vitals');
    this.playerHealthFill = document.querySelector('#player-health-fill');
    this.playerHealthCopy = document.querySelector('#player-health-copy');
    this.aegisStatus = document.querySelector('#aegis-status');
    this.powerupStatus = document.querySelector('#powerup-status');
    this.aegis = this.createAegisGlobe();
    this.fireRing = this.createFireRing();
    this.updateSpellSelection(false);
  }

  createAegisGlobe() {
    const material = new this.BABYLON.StandardMaterial('aegis-globe-material', this.scene);
    material.diffuseColor = this.BABYLON.Color3.FromHexString('#78d9ff');
    material.emissiveColor = this.BABYLON.Color3.FromHexString('#823ecb');
    material.specularColor = this.BABYLON.Color3.FromHexString('#eefaff');
    material.alpha = .2;
    material.backFaceCulling = false;
    const mesh = this.BABYLON.MeshBuilder.CreateSphere('witch-aegis-globe', {
      diameter: 2.55,
      segments: 24
    }, this.scene);
    mesh.parent = this.witch.root;
    mesh.position.set(0, .92, 0);
    mesh.scaling.y = .82;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    const light = new this.BABYLON.PointLight('aegis-globe-light', new this.BABYLON.Vector3(0, .92, 0), this.scene);
    light.parent = this.witch.root;
    light.diffuse = this.BABYLON.Color3.FromHexString('#a787ff');
    light.range = 4.5;
    light.intensity = 0;
    return { mesh, material, light };
  }

  createFireRing() {
    const material = new this.BABYLON.StandardMaterial('fire-ring-material', this.scene);
    material.diffuseColor = this.BABYLON.Color3.FromHexString('#ff713d');
    material.emissiveColor = this.BABYLON.Color3.FromHexString('#ff2b0a');
    material.specularColor = this.BABYLON.Color3.FromHexString('#ffe19a');
    material.alpha = .88;
    const root = new this.BABYLON.TransformNode('witch-fire-ring-root', this.scene);
    root.parent = this.witch.root;
    root.position.y = .08;
    const rings = [0, 1, 2].map(index => {
      const ring = this.BABYLON.MeshBuilder.CreateTorus(`witch-fire-ring-${index}`, {
        diameter: COMBAT.fireRingRadius * 2 + index * .12,
        thickness: .075 + index * .018,
        tessellation: 48
      }, this.scene);
      ring.parent = root;
      ring.position.y = index * .035;
      ring.material = material;
      ring.isPickable = false;
      return ring;
    });
    const light = new this.BABYLON.PointLight('fire-ring-light', new this.BABYLON.Vector3(0, .48, 0), this.scene);
    light.parent = root;
    light.diffuse = this.BABYLON.Color3.FromHexString('#ff6a2d');
    light.range = 6;
    light.intensity = 0;
    root.setEnabled(false);
    return { root, rings, material, light };
  }

  setWitch(witch, playerName = this.playerName) {
    this.witch = witch;
    this.playerName = playerName;
    this.aegis.mesh.parent = witch.root;
    this.aegis.light.parent = witch.root;
    this.fireRing.root.parent = witch.root;
  }

  setCharacter(characterId, witch = this.witch, playerName = this.playerName) {
    if (!CHARACTER_LOADOUTS[characterId]) return false;
    this.activeCharacter = characterId;
    this.loadout = [...CHARACTER_LOADOUTS[characterId]];
    this.setWitch(witch, playerName);
    this.selectedSpell = this.loadout[0] || 'lightning';
    this.updateSpellSelection(false);
    this.updatePlayerHud(this.lastTime);
    return true;
  }

  setGeodeCount(count = 0) {
    this.geodeCount = Math.max(0, Math.floor(Number(count) || 0));
    this.geodeDamageMultiplier = 1 + this.geodeCount * POUCH.geodePowerPerCrystal;
    this.updatePlayerHud(this.lastTime);
    return this.geodeDamageMultiplier;
  }

  setSpellcastingEnabled(value) {
    this.spellcastingEnabled = Boolean(value);
    if (!this.spellcastingEnabled) {
      this.targeted = false;
      this.candidateTargeted = false;
      this.assisted = false;
      this.aimState = 'NONE';
      this.crosshair.classList.remove('is-targeting', 'is-assisted', 'is-obstructed', 'is-self-cast');
      this.crosshairLabel.dataset.stateLabel = '';
    } else {
      this.updateSpellSelection(false);
    }
    this.updatePlayerHud(this.lastTime);
  }

  selectSpell(value, announce = true) {
    const selected = this.loadout.includes(value) ? value : this.loadout[0] || this.selectedSpell;
    const changed = selected !== this.selectedSpell;
    this.selectedSpell = selected;
    this.updateSpellSelection(announce && changed);
    return selected;
  }

  updateSpellSelection(announce) {
    const spell = SPELLS[this.selectedSpell];
    if (!spell) return;
    this.spellNameCopy.textContent = spell.label;
    this.spellHelpCopy.textContent = spell.targeted
      ? `${this.loadout.map((_entry, index) => index + 1).join(' / ')} select · O casts`
      : `${spell.label} protects you · O casts`;
    for (const button of document.querySelectorAll('.spell-rack button[data-spell]')) {
      button.classList.toggle('is-selected', button.dataset.spell === this.selectedSpell);
    }
    this.crosshair.dataset.spell = this.selectedSpell;
    if (announce) this.onMessage(`${spell.label} selected`);
  }

  pickAimSurface(ray, predicate = () => true) {
    return this.scene.pickWithRay(
      ray,
      mesh => mesh.isEnabled()
        && mesh.isVisible
        && mesh.visibility > 0
        && mesh.isPickable
        && mesh.metadata?.aimSurface === true
        && predicate(mesh),
      false
    );
  }

  resolveAim(range = COMBAT.spellRange) {
    const cameraRay = this.camera.getAimRay(range);
    const cameraHit = this.pickAimSurface(cameraRay);
    const directTarget = cameraHit?.pickedMesh?.metadata?.combatTarget;
    if (directTarget?.alive) {
      return {
        cameraRay,
        cameraHit,
        target: directTarget,
        intendedPoint: cameraHit.pickedPoint.clone(),
        targetEntryDistance: cameraHit.distance,
        mode: 'DIRECT'
      };
    }

    const firstSurfaceDistance = cameraHit?.hit ? cameraHit.distance : Infinity;
    let assistedTarget = null;
    for (const candidate of this.dragons) {
      if (!candidate.alive) continue;
      const aimPoint = candidate.getAimPoint();
      const targetEntryDistance = raySphereEntryDistance(
        cameraRay.origin,
        cameraRay.direction,
        aimPoint,
        candidate.aimRadius,
        range
      );
      if (targetEntryDistance === null
        || blockerPrecedesTarget(firstSurfaceDistance, targetEntryDistance, COMBAT.aimAssistWallTolerance)
        || (assistedTarget && assistedTarget.targetEntryDistance <= targetEntryDistance)) continue;
      assistedTarget = { target: candidate, aimPoint, targetEntryDistance };
    }
    if (assistedTarget) {
      return {
        cameraRay,
        cameraHit,
        target: assistedTarget.target,
        intendedPoint: assistedTarget.aimPoint,
        targetEntryDistance: assistedTarget.targetEntryDistance,
        mode: 'ASSISTED'
      };
    }

    return {
      cameraRay,
      cameraHit,
      target: null,
      intendedPoint: cameraHit?.hit
        ? cameraHit.pickedPoint.clone()
        : cameraRay.origin.add(cameraRay.direction.scale(range)),
      targetEntryDistance: null,
      mode: 'WORLD'
    };
  }

  resolveStaffPath(solution) {
    const origin = this.witch.getOrbPosition();
    const orbVector = solution.intendedPoint.subtract(origin);
    const orbDistance = orbVector.length();
    const direction = orbVector.scale(1 / Math.max(.001, orbDistance));

    if (solution.target) {
      const blockerLength = Math.max(0, orbDistance - COMBAT.staffRayTerminalTolerance);
      const blockerRay = new this.BABYLON.Ray(origin, direction, blockerLength);
      const blockerHit = this.pickAimSurface(
        blockerRay,
        mesh => mesh.metadata?.combatTarget !== solution.target
      );
      if (blockerHit?.hit && blockerPrecedesTarget(
        blockerHit.distance,
        orbDistance,
        COMBAT.staffRayTerminalTolerance
      )) {
        return {
          origin,
          impactPoint: blockerHit.pickedPoint.clone(),
          actualHit: blockerHit,
          obstructed: true
        };
      }

      const targetRay = new this.BABYLON.Ray(
        origin,
        direction,
        orbDistance + solution.target.aimRadius + COMBAT.staffRayTerminalTolerance
      );
      const targetHit = this.pickAimSurface(
        targetRay,
        mesh => mesh.metadata?.combatTarget === solution.target
      );
      return {
        origin,
        impactPoint: targetHit?.hit ? targetHit.pickedPoint.clone() : solution.intendedPoint,
        actualHit: targetHit,
        obstructed: false
      };
    }

    const orbRay = new this.BABYLON.Ray(
      origin,
      direction,
      orbDistance + COMBAT.staffRayTerminalTolerance
    );
    const actualHit = this.pickAimSurface(orbRay);
    return {
      origin,
      impactPoint: actualHit?.hit ? actualHit.pickedPoint.clone() : solution.intendedPoint,
      actualHit,
      obstructed: false
    };
  }

  update() {
    this.lastTime = performance.now() / 1000;
    if (this.spellcastingEnabled) {
      const targetedSpell = SPELLS[this.selectedSpell].targeted;
      const solution = targetedSpell ? this.resolveAim() : null;
      const path = solution?.target ? this.resolveStaffPath(solution) : null;
      if (solution?.target) this.currentTarget = solution.target;
      this.candidateTargeted = Boolean(solution?.target);
      this.targeted = Boolean(solution?.target && !path?.obstructed);
      this.assisted = this.targeted && solution.mode === 'ASSISTED';
      this.aimState = !targetedSpell
        ? 'SELF'
        : path?.obstructed
          ? 'OBSTRUCTED'
          : this.assisted
            ? 'ASSISTED'
            : this.targeted
              ? 'DIRECT'
              : 'NONE';
    }
    this.updateTargetHud();
    this.updateAegis(this.lastTime);
    this.updateFireRing(this.lastTime);
    this.updateDragonThreat(this.lastTime);
    this.updatePlayerHud(this.lastTime);
  }

  updateTargetHud() {
    const target = this.currentTarget || this.dragon;
    this.crosshair.classList.toggle('is-targeting', this.targeted);
    this.crosshair.classList.toggle('is-assisted', this.assisted);
    this.crosshair.classList.toggle('is-obstructed', this.aimState === 'OBSTRUCTED');
    this.crosshair.classList.toggle('is-self-cast', this.aimState === 'SELF');
    this.crosshairLabel.dataset.stateLabel = this.targeted
      ? ['frost', 'freeze'].includes(this.selectedSpell) ? 'FREEZE' : 'HIT'
      : this.aimState === 'OBSTRUCTED'
        ? 'BLOCKED'
        : this.aimState === 'SELF'
          ? 'SELF'
          : '';
    const showTarget = this.candidateTargeted
      || target.health < target.maximumHealth
      || target.isFrozen(this.lastTime);
    this.targetCard.classList.toggle('is-visible', showTarget);
    this.targetCard.classList.toggle('is-frozen', target.isFrozen(this.lastTime));
    this.targetCard.setAttribute('aria-hidden', String(!showTarget));
    this.healthFill.style.transform = `scaleX(${target.health / target.maximumHealth})`;
    this.healthCopy.textContent = target.alive
      ? `${target.health} / ${target.maximumHealth}`
      : 'CONTAINED';
    this.targetStatus.textContent = target.isRestrained(this.lastTime)
      ? `Vinebound ${Math.max(0, target.restrainedUntil - this.lastTime).toFixed(1)}s`
      : target.isFrozen(this.lastTime)
      ? `Frozen ${Math.max(0, target.frozenUntil - this.lastTime).toFixed(1)}s`
      : target.state === 'ATTACK'
        ? 'Attacking'
        : target.aggressive
          ? 'Hostile'
          : target.alive
            ? 'Watchful'
            : '';
  }

  updateAegis(time) {
    const active = time < this.aegisUntil;
    this.aegis.mesh.setEnabled(active);
    if (!active) {
      this.aegis.light.intensity = 0;
      return;
    }
    const struck = time < this.aegisHitUntil;
    const pulse = .5 + Math.sin(time * 7) * .5;
    this.aegis.material.alpha = struck ? .42 : .16 + pulse * .08;
    this.aegis.material.emissiveColor = struck
      ? this.BABYLON.Color3.FromHexString('#ddf8ff')
      : this.BABYLON.Color3.FromHexString('#823ecb');
    const scale = 1 + pulse * .015 + (struck ? .045 : 0);
    this.aegis.mesh.scaling.set(scale, .82 * scale, scale);
    this.aegis.light.intensity = struck ? 2.8 : .55 + pulse * .25;
  }

  updateFireRing(time) {
    const active = time < this.fireRingUntil;
    this.fireRing.root.setEnabled(active);
    if (!active) {
      this.fireRing.light.intensity = 0;
      return;
    }
    const struck = time < this.fireRingHitUntil;
    const pulse = .5 + Math.sin(time * 11) * .5;
    this.fireRing.material.alpha = struck ? 1 : .64 + pulse * .28;
    this.fireRing.material.emissiveColor = struck
      ? this.BABYLON.Color3.FromHexString('#fff0a8')
      : this.BABYLON.Color3.FromHexString('#ff2b0a');
    this.fireRing.rings.forEach((ring, index) => {
      ring.rotation.y = time * (index % 2 ? -1.8 : 1.55) + index * .7;
      ring.position.y = .025 + index * .04 + Math.sin(time * 7 + index) * .025;
      const scale = 1 + pulse * .018 + index * .012;
      ring.scaling.set(scale, scale, scale);
    });
    this.fireRing.light.intensity = struck ? 3.8 : 1.4 + pulse * .75;

    for (const dragon of this.dragons) {
      if (!dragon.alive) continue;
      let deltaX = dragon.root.position.x - this.controller.position.x;
      let deltaZ = dragon.root.position.z - this.controller.position.z;
      let distance = Math.hypot(deltaX, deltaZ);
      const boundary = COMBAT.fireRingRadius + dragon.collisionRadius + .08;
      if (distance >= boundary) continue;
      if (distance < .001) {
        deltaX = Math.sin(this.controller.facingYaw || 0);
        deltaZ = Math.cos(this.controller.facingYaw || 0);
        distance = 1;
      }
      dragon.teleport(new this.BABYLON.Vector3(
        this.controller.position.x + deltaX / distance * boundary,
        dragon.root.position.y,
        this.controller.position.z + deltaZ / distance * boundary
      ));
      this.fireRingRepelledCreatures += 1;
      this.fireRingHitUntil = time + .22;
    }
  }

  updateDragonThreat(time) {
    if (time < this.fireRingUntil || this.playerDefeated) {
      this.dragonInAttackRange = false;
      this.threatDragon = null;
      this.nextDragonAttackAt = 0;
      return;
    }
    const attackRangeSquared = COMBAT.dragonAttackRange * COMBAT.dragonAttackRange;
    const threat = this.dragons
      .filter(dragon => dragon.aggressive && dragon.alive && !dragon.isFrozen(time) && !dragon.isRestrained(time))
      .map(dragon => ({
        dragon,
        distanceSquared: (this.controller.position.x - dragon.root.position.x) ** 2
          + (this.controller.position.z - dragon.root.position.z) ** 2
      }))
      .filter(candidate => candidate.distanceSquared <= attackRangeSquared)
      .sort((left, right) => left.distanceSquared - right.distanceSquared)[0]?.dragon || null;
    if (!threat) {
      this.dragonInAttackRange = false;
      this.threatDragon = null;
      this.nextDragonAttackAt = 0;
      return;
    }
    if (!this.dragonInAttackRange || this.threatDragon !== threat) {
      this.dragonInAttackRange = true;
      this.threatDragon = threat;
      this.nextDragonAttackAt = time + COMBAT.dragonAttackWindup;
      return;
    }
    if (time < this.nextDragonAttackAt) return;
    this.nextDragonAttackAt = time + COMBAT.dragonAttackInterval;
    if (threat.attack(time)) this.receiveDragonDamage(COMBAT.dragonAttackDamage, time);
  }

  receiveDragonDamage(amount, time = performance.now() / 1000) {
    if (this.playerDefeated || amount <= 0) return false;
    if (time < this.fireRingUntil) {
      this.fireRingAbsorbedHits += 1;
      this.fireRingHitUntil = time + .3;
      this.onMessage('Fire Ring turned aside the dragon strike');
      return false;
    }
    if (time < this.aegisUntil) {
      this.aegisAbsorbedHits += 1;
      this.aegisHitUntil = time + .3;
      this.onMessage('Aegis Globe absorbed the dragon strike');
      return false;
    }
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.damageTaken += amount;
    this.playerVitals.classList.add('is-hit');
    setTimeout(() => this.playerVitals.classList.remove('is-hit'), 180);
    if (this.playerHealth === 0) {
      this.playerDefeated = true;
      this.onMessage(`The ${this.playerName} was overwhelmed`);
      this.onPlayerDefeated();
    } else {
      this.onMessage(`Dragon strike · ${this.playerHealth} health remains`);
    }
    return true;
  }

  restorePlayerHealth(amount) {
    if (this.playerDefeated || amount <= 0) return 0;
    const restored = Math.min(amount, this.playerMaximumHealth - this.playerHealth);
    if (restored <= 0) return 0;
    this.playerHealth += restored;
    this.playerVitals.classList.add('is-healed');
    setTimeout(() => this.playerVitals.classList.remove('is-healed'), 260);
    this.updatePlayerHud(this.lastTime);
    return restored;
  }

  lightningBoostActive(time = performance.now() / 1000) {
    return time < this.lightningBoostUntil;
  }

  activateLightningBoost(time = performance.now() / 1000) {
    if (this.lightningBoostActive(time)) return false;
    this.lightningBoostUntil = time + COMBAT.lightningPotionDuration;
    this.updatePlayerHud(time);
    return true;
  }

  primeAegisBoost() {
    if (this.aegisBoostPrimed) return false;
    this.aegisBoostPrimed = true;
    this.updatePlayerHud(this.lastTime);
    return true;
  }

  updatePlayerHud(time) {
    this.playerHealthFill.style.transform = `scaleX(${this.playerHealth / this.playerMaximumHealth})`;
    this.playerHealthCopy.textContent = `${this.playerHealth} / ${this.playerMaximumHealth}`;
    if (!this.spellcastingEnabled) {
      this.playerVitals.classList.remove('is-aegis', 'is-powered');
      this.aegisStatus.textContent = 'Plant magic ready';
      this.powerupStatus.textContent = 'Vine Trap · Restore';
      return;
    }
    const aegisActive = time < this.aegisUntil;
    const fireRingActive = time < this.fireRingUntil;
    const protectionActive = aegisActive || fireRingActive;
    this.playerVitals.classList.toggle('is-aegis', protectionActive);
    if (this.activeCharacter === 'fire') {
      const cooldown = Math.max(0, this.cooldownUntil.fireRing - time);
      this.aegisStatus.textContent = fireRingActive
        ? `Fire Ring active · ${(this.fireRingUntil - time).toFixed(1)}s`
        : cooldown > 0
          ? `Fire Ring recharging · ${cooldown.toFixed(1)}s`
          : 'Fire Ring ready';
    } else if (this.activeCharacter === 'frost') {
      this.aegisStatus.textContent = 'Ice magic ready';
    } else {
      const cooldown = Math.max(0, this.cooldownUntil.aegis - time);
      this.aegisStatus.textContent = aegisActive
        ? `Aegis active · ${(this.aegisUntil - time).toFixed(1)}s`
        : cooldown > 0
          ? `Aegis recharging · ${cooldown.toFixed(1)}s`
          : 'Aegis ready';
    }
    const powerups = [];
    if (this.lightningBoostActive(time)) {
      powerups.push(`Lightning ×${COMBAT.lightningPotionDamageMultiplier} · ${(this.lightningBoostUntil - time).toFixed(1)}s`);
    }
    if (this.geodeCount) powerups.push(`${this.geodeCount} geode · permanent ×${this.geodeDamageMultiplier.toFixed(1)}`);
    if (this.aegisBoostPrimed) powerups.push(`Next Aegis ×${COMBAT.aegisPotionDurationMultiplier}`);
    const defaultStatus = this.activeCharacter === 'frost'
      ? 'Freeze · Ice Lance'
      : this.activeCharacter === 'fire'
        ? 'Fireball · Fire Ring'
        : 'No powerup active';
    this.powerupStatus.textContent = powerups.length ? powerups.join(' · ') : defaultStatus;
    this.playerVitals.classList.toggle('is-powered', powerups.length > 0);
  }

  cast(time, requestedSpell = this.selectedSpell) {
    const selected = this.selectSpell(requestedSpell, false);
    const spell = SPELLS[selected];
    if (time < this.cooldownUntil[selected]) {
      this.onMessage(`${spell.label} ready in ${(this.cooldownUntil[selected] - time).toFixed(1)}s`);
      return false;
    }
    this.cooldownUntil[selected] = time + spell.cooldown;
    if (selected === 'aegis') return this.castAegis(time);
    if (selected === 'fireRing') return this.castFireRing(time);
    return this.castAtTarget(selected, time);
  }

  castAtTarget(spell, time) {
    this.witch.setCast(time, spell);
    const solution = this.resolveAim();
    const path = this.resolveStaffPath(solution);
    const intendedTarget = solution.target;
    const obstructed = Boolean(intendedTarget && path.obstructed);
    this.controller.requestCastFacing(
      intendedTarget ? intendedTarget.getAimPoint() : solution.intendedPoint
    );

    const potionMultiplier = spell === 'lightning' && this.lightningBoostActive(time)
      ? COMBAT.lightningPotionDamageMultiplier
      : 1;
    const lightningMultiplier = potionMultiplier * this.geodeDamageMultiplier;
    const damageMultiplier = spell === 'lightning' ? lightningMultiplier : 1;
    const baseDamage = spell === 'lightning'
      ? COMBAT.lightningDamage
      : spell === 'iceLance'
        ? COMBAT.iceLanceDamage
        : spell === 'fireball'
          ? COMBAT.fireballDamage
          : 0;
    const damage = baseDamage * damageMultiplier;
    this.lastCast = {
      spell,
      origin: { x: path.origin.x, y: path.origin.y, z: path.origin.z },
      impact: { x: path.impactPoint.x, y: path.impactPoint.y, z: path.impactPoint.z },
      intendedTarget: intendedTarget
        ? solution.mode === 'DIRECT' ? solution.cameraHit?.pickedMesh?.name : 'dragon-aim-volume'
        : solution.cameraHit?.pickedMesh?.name || null,
      actualTarget: path.actualHit?.pickedMesh?.name || (intendedTarget && !obstructed ? 'dragon-aim-point' : null),
      intendedKind: intendedTarget ? 'dragon' : solution.cameraHit?.pickedMesh?.metadata?.kind || null,
      actualKind: path.actualHit?.pickedMesh?.metadata?.kind || null,
      obstructed,
      aimMode: solution.mode,
      targetEntryDistance: solution.targetEntryDistance,
      damageMultiplier,
      damage: intendedTarget && !obstructed ? damage : 0,
      resolution: intendedTarget && !obstructed
        ? solution.mode === 'ASSISTED' ? 'TARGET_ASSISTED' : 'TARGET'
        : obstructed
          ? 'OBSTRUCTED'
          : 'WORLD'
    };

    if (spell === 'lightning') this.createLightning(path.origin, path.impactPoint);
    else if (['frost', 'freeze'].includes(spell)) this.createFrost(path.origin, path.impactPoint, spell);
    else if (spell === 'iceLance') this.createIceLance(path.origin, path.impactPoint);
    else if (spell === 'fireball') this.createFireball(path.origin, path.impactPoint);

    if (intendedTarget && !obstructed && intendedTarget.alive) {
      if (['frost', 'freeze'].includes(spell)) {
        intendedTarget.freeze(time, COMBAT.frostDuration);
        this.dragonInAttackRange = false;
        this.threatDragon = null;
        this.nextDragonAttackAt = 0;
        this.onMessage(`${SPELLS[spell].label} bound the dragon · ${COMBAT.frostDuration.toFixed(1)}s`);
      } else {
        intendedTarget.damage(damage, time);
        const powerCopy = spell === 'lightning' && lightningMultiplier > 1 ? ` ×${lightningMultiplier.toFixed(1)}` : '';
        this.onMessage(intendedTarget.alive
          ? `${SPELLS[spell].label}${powerCopy} hit · ${intendedTarget.health} health remains`
          : 'Training dragon contained');
      }
    } else if (obstructed) {
      this.onMessage(`The ${SPELLS[spell].label.toLowerCase()} path is blocked by the maze`);
    } else {
      this.onMessage(`${SPELLS[spell].label} struck the brickwork`);
    }
    this.updateTargetHud();
    return true;
  }

  castAegis(time) {
    this.witch.setCast(time, 'aegis');
    const durationMultiplier = this.aegisBoostPrimed ? COMBAT.aegisPotionDurationMultiplier : 1;
    const duration = COMBAT.aegisDuration * durationMultiplier;
    this.aegisBoostPrimed = false;
    this.lastAegisDuration = duration;
    this.aegisUntil = time + duration;
    const origin = this.witch.getOrbPosition();
    this.lastCast = {
      spell: 'aegis',
      origin: { x: origin.x, y: origin.y, z: origin.z },
      impact: { x: this.controller.position.x, y: this.controller.position.y + .9, z: this.controller.position.z },
      intendedTarget: this.playerName.toLowerCase().replaceAll(' ', '-'),
      actualTarget: this.playerName.toLowerCase().replaceAll(' ', '-'),
      intendedKind: 'self',
      actualKind: 'self',
      obstructed: false,
      aimMode: 'SELF',
      targetEntryDistance: 0,
      durationMultiplier,
      duration,
      resolution: 'SELF'
    };
    this.updateAegis(time);
    this.updatePlayerHud(time);
    this.onMessage(`Aegis Globe${durationMultiplier > 1 ? ' ×2' : ''} active · ${duration.toFixed(0)}s protection`);
    return true;
  }

  castFireRing(time) {
    this.witch.setCast(time, 'fire ring');
    this.fireRingUntil = time + COMBAT.fireRingDuration;
    this.dragonInAttackRange = false;
    this.threatDragon = null;
    this.nextDragonAttackAt = 0;
    const origin = this.witch.getOrbPosition();
    this.lastCast = {
      spell: 'fireRing',
      origin: { x: origin.x, y: origin.y, z: origin.z },
      impact: { x: this.controller.position.x, y: this.controller.position.y, z: this.controller.position.z },
      intendedTarget: this.playerName.toLowerCase().replaceAll(' ', '-'),
      actualTarget: this.playerName.toLowerCase().replaceAll(' ', '-'),
      intendedKind: 'self',
      actualKind: 'self',
      obstructed: false,
      aimMode: 'SELF',
      targetEntryDistance: 0,
      duration: COMBAT.fireRingDuration,
      radius: COMBAT.fireRingRadius,
      resolution: 'SELF'
    };
    this.updateFireRing(time);
    this.updatePlayerHud(time);
    this.onMessage(`Fire Ring active · ${COMBAT.fireRingDuration.toFixed(0)}s creature barrier`);
    return true;
  }

  createLightning(origin, impact) {
    this.createEnergyStreams({
      prefix: 'lightning-stream',
      origin,
      impact,
      colors: ['#f4ecff', '#a978ff'],
      duration: COMBAT.lightningEffectDuration,
      streams: 4,
      amplitude: .08,
      lightColor: '#b989ff'
    });
  }

  createFrost(origin, impact, spell = 'frost') {
    this.createEnergyStreams({
      prefix: spell === 'freeze' ? 'freeze-stream' : 'frost-stream',
      origin,
      impact,
      colors: ['#efffff', '#66d8ff'],
      duration: COMBAT.frostEffectDuration,
      streams: 3,
      amplitude: .045,
      lightColor: '#79e4ff'
    });
  }

  createIceLance(origin, impact) {
    this.createEnergyStreams({
      prefix: 'ice-lance-stream',
      origin,
      impact,
      colors: ['#f5ffff', '#70dfff'],
      duration: COMBAT.iceLanceEffectDuration,
      streams: 5,
      amplitude: .025,
      lightColor: '#b9f8ff'
    });
  }

  createFireball(origin, impact) {
    this.createEnergyStreams({
      prefix: 'fireball-stream',
      origin,
      impact,
      colors: ['#fff0a2', '#ff4a16'],
      duration: COMBAT.fireballEffectDuration,
      streams: 6,
      amplitude: .07,
      lightColor: '#ff6d24'
    });
    const burst = this.BABYLON.MeshBuilder.CreateSphere('fireball-impact-burst', { diameter: .58, segments: 12 }, this.scene);
    const material = new this.BABYLON.StandardMaterial('fireball-impact-material', this.scene);
    material.diffuseColor = this.BABYLON.Color3.FromHexString('#ffad38');
    material.emissiveColor = this.BABYLON.Color3.FromHexString('#ff3108');
    material.alpha = .82;
    burst.position.copyFrom(impact);
    burst.material = material;
    burst.isPickable = false;
    setTimeout(() => {
      burst.dispose();
      material.dispose();
    }, COMBAT.fireballEffectDuration * 1000);
  }

  createEnergyStreams({ prefix, origin, impact, colors, duration, streams, amplitude, lightColor }) {
    const direction = impact.subtract(origin);
    const distance = direction.length();
    if (distance < .01) return;
    direction.normalize();
    let right = this.BABYLON.Vector3.Cross(direction, this.BABYLON.Vector3.Up());
    if (right.lengthSquared() < .01) right = this.BABYLON.Vector3.Right();
    right.normalize();
    const up = this.BABYLON.Vector3.Cross(right, direction).normalize();
    const lines = [];
    for (let stream = 0; stream < streams; stream += 1) {
      const points = [];
      const sections = Math.max(7, Math.ceil(distance * 2.4));
      for (let index = 0; index <= sections; index += 1) {
        const t = index / sections;
        const envelope = Math.sin(t * Math.PI);
        const phase = stream * 2.17 + index * 1.91;
        const offset = right.scale(Math.sin(phase) * amplitude * envelope)
          .add(up.scale(Math.cos(phase * 1.37) * amplitude * .8 * envelope));
        points.push(this.BABYLON.Vector3.Lerp(origin, impact, t).add(offset));
      }
      const line = this.BABYLON.MeshBuilder.CreateLines(`${prefix}-${stream}`, { points }, this.scene);
      line.color = this.BABYLON.Color3.FromHexString(colors[stream ? 1 : 0]);
      line.alpha = stream === 0 ? 1 : .72;
      line.isPickable = false;
      lines.push(line);
    }
    const impactLight = new this.BABYLON.PointLight(`${prefix}-impact-light`, impact, this.scene);
    impactLight.diffuse = this.BABYLON.Color3.FromHexString(lightColor);
    impactLight.intensity = 3.2;
    impactLight.range = 7;
    setTimeout(() => {
      for (const line of lines) line.dispose();
      impactLight.dispose();
    }, duration * 1000);
  }

  reset() {
    this.cooldownUntil = createCooldowns();
    this.selectedSpell = this.loadout[0] || 'lightning';
    this.lastTime = 0;
    this.targeted = false;
    this.candidateTargeted = false;
    this.assisted = false;
    this.aimState = 'NONE';
    this.lastCast = null;
    this.currentTarget = this.dragon;
    this.playerHealth = this.playerMaximumHealth;
    this.aegisUntil = 0;
    this.lightningBoostUntil = 0;
    this.geodeCount = 0;
    this.geodeDamageMultiplier = 1;
    this.aegisBoostPrimed = false;
    this.lastAegisDuration = COMBAT.aegisDuration;
    this.aegisHitUntil = 0;
    this.aegisAbsorbedHits = 0;
    this.fireRingUntil = 0;
    this.fireRingHitUntil = 0;
    this.fireRingAbsorbedHits = 0;
    this.fireRingRepelledCreatures = 0;
    this.damageTaken = 0;
    this.dragonInAttackRange = false;
    this.threatDragon = null;
    this.nextDragonAttackAt = 0;
    this.playerDefeated = false;
    this.aegis.mesh.setEnabled(false);
    this.aegis.light.intensity = 0;
    this.fireRing.root.setEnabled(false);
    this.fireRing.light.intensity = 0;
    this.crosshair.classList.remove('is-targeting', 'is-assisted', 'is-obstructed', 'is-self-cast');
    this.crosshairLabel.dataset.stateLabel = '';
    this.targetCard.classList.remove('is-visible', 'is-frozen');
    this.targetCard.setAttribute('aria-hidden', 'true');
    this.healthFill.style.transform = 'scaleX(1)';
    this.healthCopy.textContent = `${this.dragon.maximumHealth} / ${this.dragon.maximumHealth}`;
    this.targetStatus.textContent = '';
    this.updateSpellSelection(false);
    this.updatePlayerHud(0);
  }

  snapshot() {
    const cooldowns = Object.fromEntries(
      Object.entries(this.cooldownUntil).map(([name, until]) => [name, Math.max(0, until - this.lastTime)])
    );
    return {
      activeCharacter: this.activeCharacter,
      loadout: [...this.loadout],
      selectedSpell: this.selectedSpell,
      spellcastingEnabled: this.spellcastingEnabled,
      playerName: this.playerName,
      targeted: this.targeted,
      candidateTargeted: this.candidateTargeted,
      assisted: this.assisted,
      aimState: this.aimState,
      cooldownRemaining: cooldowns.lightning,
      cooldowns,
      lastCast: this.lastCast,
      playerHealth: this.playerHealth,
      playerMaximumHealth: this.playerMaximumHealth,
      playerDefeated: this.playerDefeated,
      damageTaken: this.damageTaken,
      aegis: {
        active: this.lastTime < this.aegisUntil,
        remaining: Math.max(0, this.aegisUntil - this.lastTime),
        duration: this.lastAegisDuration,
        boostPrimed: this.aegisBoostPrimed,
        absorbedHits: this.aegisAbsorbedHits,
        visible: this.aegis.mesh.isEnabled()
      },
      fireRing: {
        active: this.lastTime < this.fireRingUntil,
        remaining: Math.max(0, this.fireRingUntil - this.lastTime),
        duration: COMBAT.fireRingDuration,
        radius: COMBAT.fireRingRadius,
        absorbedHits: this.fireRingAbsorbedHits,
        repelledCreatures: this.fireRingRepelledCreatures,
        visible: this.fireRing.root.isEnabled()
      },
      powerups: {
        lightningActive: this.lightningBoostActive(this.lastTime),
        lightningRemaining: Math.max(0, this.lightningBoostUntil - this.lastTime),
        lightningDamageMultiplier: this.lightningBoostActive(this.lastTime)
          ? COMBAT.lightningPotionDamageMultiplier * this.geodeDamageMultiplier
          : this.geodeDamageMultiplier,
        geodeCount: this.geodeCount,
        geodeDamageMultiplier: this.geodeDamageMultiplier,
        aegisPrimed: this.aegisBoostPrimed,
        aegisDurationMultiplier: this.aegisBoostPrimed ? COMBAT.aegisPotionDurationMultiplier : 1
      },
      dragonInAttackRange: this.dragonInAttackRange,
      targetDragonId: this.currentTarget?.id || null,
      threatDragonId: this.threatDragon?.id || null,
      dragonCount: this.dragons.length,
      aggressiveDragonCount: this.dragons.filter(dragon => dragon.aggressive).length,
      activeLightningStreams: this.scene.meshes.filter(mesh => mesh.name.startsWith('lightning-stream-')).length,
      activeFrostStreams: this.scene.meshes.filter(mesh => mesh.name.startsWith('frost-stream-') || mesh.name.startsWith('freeze-stream-')).length,
      activeIceLanceStreams: this.scene.meshes.filter(mesh => mesh.name.startsWith('ice-lance-stream-')).length,
      activeFireballStreams: this.scene.meshes.filter(mesh => mesh.name.startsWith('fireball-stream-')).length
    };
  }
}
