import { COMBAT, PLAYER } from './config.js?v=20260818-greenwitch-v1';
import { blockerPrecedesTarget, raySphereEntryDistance } from './targeting.js?v=20260818-rewards-v1';

export const SPELLS = Object.freeze({
  lightning: Object.freeze({ label: 'Lightning', cooldown: COMBAT.lightningCooldown, targeted: true }),
  frost: Object.freeze({ label: 'Frost', cooldown: COMBAT.frostCooldown, targeted: true }),
  aegis: Object.freeze({ label: 'Aegis Globe', cooldown: COMBAT.aegisCooldown, targeted: false })
});

const spellName = value => value in SPELLS ? value : 'lightning';

export class LightningCombat {
  constructor(BABYLON, scene, camera, witch, dragon, controller) {
    this.BABYLON = BABYLON;
    this.scene = scene;
    this.camera = camera;
    this.witch = witch;
    this.dragon = dragon;
    this.controller = controller;
    this.cooldownUntil = { lightning: 0, frost: 0, aegis: 0 };
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
    this.aegisBoostPrimed = false;
    this.lastAegisDuration = COMBAT.aegisDuration;
    this.aegisHitUntil = 0;
    this.aegisAbsorbedHits = 0;
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

  selectSpell(value, announce = true) {
    const selected = spellName(value);
    const changed = selected !== this.selectedSpell;
    this.selectedSpell = selected;
    this.updateSpellSelection(announce && changed);
    return selected;
  }

  updateSpellSelection(announce) {
    const spell = SPELLS[this.selectedSpell];
    this.spellNameCopy.textContent = spell.label;
    this.spellHelpCopy.textContent = spell.targeted
      ? '1 / 2 / 3 select · left click casts'
      : 'Self-cast protection · left click casts';
    for (const button of document.querySelectorAll('.spell-rack button[data-spell]')) {
      button.classList.toggle('is-selected', button.dataset.spell === this.selectedSpell);
    }
    this.crosshair.dataset.spell = this.selectedSpell;
    if (announce) this.onMessage(`${spell.label} selected`);
  }

  pickAimSurface(ray, predicate = () => true) {
    return this.scene.pickWithRay(
      ray,
      mesh => mesh.metadata?.aimSurface === true && predicate(mesh),
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

    if (this.dragon.alive) {
      const aimPoint = this.dragon.getAimPoint();
      const targetEntryDistance = raySphereEntryDistance(
        cameraRay.origin,
        cameraRay.direction,
        aimPoint,
        this.dragon.aimRadius,
        range
      );
      const firstSurfaceDistance = cameraHit?.hit ? cameraHit.distance : Infinity;
      const assisted = targetEntryDistance !== null
        && !blockerPrecedesTarget(firstSurfaceDistance, targetEntryDistance, COMBAT.aimAssistWallTolerance);
      if (assisted) {
        return {
          cameraRay,
          cameraHit,
          target: this.dragon,
          intendedPoint: aimPoint,
          targetEntryDistance,
          mode: 'ASSISTED'
        };
      }
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
    const targetedSpell = SPELLS[this.selectedSpell].targeted;
    const solution = targetedSpell ? this.resolveAim() : null;
    const path = solution?.target ? this.resolveStaffPath(solution) : null;
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
    this.updateTargetHud();
    this.updateAegis(this.lastTime);
    this.updateDragonThreat(this.lastTime);
    this.updatePlayerHud(this.lastTime);
  }

  updateTargetHud() {
    this.crosshair.classList.toggle('is-targeting', this.targeted);
    this.crosshair.classList.toggle('is-assisted', this.assisted);
    this.crosshair.classList.toggle('is-obstructed', this.aimState === 'OBSTRUCTED');
    this.crosshair.classList.toggle('is-self-cast', this.aimState === 'SELF');
    this.crosshairLabel.dataset.stateLabel = this.targeted
      ? this.selectedSpell === 'frost' ? 'FREEZE' : 'HIT'
      : this.aimState === 'OBSTRUCTED'
        ? 'BLOCKED'
        : this.aimState === 'SELF'
          ? 'SELF'
          : '';
    const showTarget = this.candidateTargeted
      || this.dragon.health < this.dragon.maximumHealth
      || this.dragon.isFrozen(this.lastTime);
    this.targetCard.classList.toggle('is-visible', showTarget);
    this.targetCard.classList.toggle('is-frozen', this.dragon.isFrozen(this.lastTime));
    this.targetCard.setAttribute('aria-hidden', String(!showTarget));
    this.healthFill.style.transform = `scaleX(${this.dragon.health / this.dragon.maximumHealth})`;
    this.healthCopy.textContent = this.dragon.alive
      ? `${this.dragon.health} / ${this.dragon.maximumHealth}`
      : 'CONTAINED';
    this.targetStatus.textContent = this.dragon.isRestrained(this.lastTime)
      ? `Vinebound ${Math.max(0, this.dragon.restrainedUntil - this.lastTime).toFixed(1)}s`
      : this.dragon.isFrozen(this.lastTime)
      ? `Frozen ${Math.max(0, this.dragon.frozenUntil - this.lastTime).toFixed(1)}s`
      : this.dragon.state === 'ATTACK'
        ? 'Attacking'
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

  updateDragonThreat(time) {
    if (!this.dragon.alive || this.dragon.isFrozen(time) || this.dragon.isRestrained(time) || this.playerDefeated) {
      this.dragonInAttackRange = false;
      this.nextDragonAttackAt = 0;
      return;
    }
    const deltaX = this.controller.position.x - this.dragon.root.position.x;
    const deltaZ = this.controller.position.z - this.dragon.root.position.z;
    const inRange = deltaX * deltaX + deltaZ * deltaZ <= COMBAT.dragonAttackRange * COMBAT.dragonAttackRange;
    if (!inRange) {
      this.dragonInAttackRange = false;
      this.nextDragonAttackAt = 0;
      return;
    }
    if (!this.dragonInAttackRange) {
      this.dragonInAttackRange = true;
      this.nextDragonAttackAt = time + COMBAT.dragonAttackWindup;
      return;
    }
    if (time < this.nextDragonAttackAt) return;
    this.nextDragonAttackAt = time + COMBAT.dragonAttackInterval;
    if (this.dragon.attack(time)) this.receiveDragonDamage(COMBAT.dragonAttackDamage, time);
  }

  receiveDragonDamage(amount, time = performance.now() / 1000) {
    if (this.playerDefeated || amount <= 0) return false;
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
      this.onMessage('The Purple Witch was overwhelmed');
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
    const active = time < this.aegisUntil;
    const cooldown = Math.max(0, this.cooldownUntil.aegis - time);
    this.playerVitals.classList.toggle('is-aegis', active);
    this.aegisStatus.textContent = active
      ? `Aegis active · ${(this.aegisUntil - time).toFixed(1)}s`
      : cooldown > 0
        ? `Aegis recharging · ${cooldown.toFixed(1)}s`
        : 'Aegis ready';
    const powerups = [];
    if (this.lightningBoostActive(time)) {
      powerups.push(`Lightning ×${COMBAT.lightningPotionDamageMultiplier} · ${(this.lightningBoostUntil - time).toFixed(1)}s`);
    }
    if (this.aegisBoostPrimed) powerups.push(`Next Aegis ×${COMBAT.aegisPotionDurationMultiplier}`);
    this.powerupStatus.textContent = powerups.length ? powerups.join(' · ') : 'No powerup active';
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

    const lightningMultiplier = spell === 'lightning' && this.lightningBoostActive(time)
      ? COMBAT.lightningPotionDamageMultiplier
      : 1;
    const lightningDamage = COMBAT.lightningDamage * lightningMultiplier;
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
      damageMultiplier: spell === 'lightning' ? lightningMultiplier : 1,
      damage: spell === 'lightning' && intendedTarget && !obstructed ? lightningDamage : 0,
      resolution: intendedTarget && !obstructed
        ? solution.mode === 'ASSISTED' ? 'TARGET_ASSISTED' : 'TARGET'
        : obstructed
          ? 'OBSTRUCTED'
          : 'WORLD'
    };

    if (spell === 'lightning') this.createLightning(path.origin, path.impactPoint);
    else this.createFrost(path.origin, path.impactPoint);

    if (intendedTarget && !obstructed && intendedTarget.alive) {
      if (spell === 'lightning') {
        intendedTarget.damage(lightningDamage, time);
        this.onMessage(intendedTarget.alive
          ? `Lightning${lightningMultiplier > 1 ? ' ×2' : ''} hit · ${intendedTarget.health} health remains`
          : 'Training dragon contained');
      } else {
        intendedTarget.freeze(time, COMBAT.frostDuration);
        this.dragonInAttackRange = false;
        this.nextDragonAttackAt = 0;
        this.onMessage(`Frost bound the dragon · ${COMBAT.frostDuration.toFixed(1)}s`);
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
      intendedTarget: 'purple-witch',
      actualTarget: 'purple-witch',
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

  createFrost(origin, impact) {
    this.createEnergyStreams({
      prefix: 'frost-stream',
      origin,
      impact,
      colors: ['#efffff', '#66d8ff'],
      duration: COMBAT.frostEffectDuration,
      streams: 3,
      amplitude: .045,
      lightColor: '#79e4ff'
    });
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
    this.cooldownUntil = { lightning: 0, frost: 0, aegis: 0 };
    this.selectedSpell = 'lightning';
    this.lastTime = 0;
    this.targeted = false;
    this.candidateTargeted = false;
    this.assisted = false;
    this.aimState = 'NONE';
    this.lastCast = null;
    this.playerHealth = this.playerMaximumHealth;
    this.aegisUntil = 0;
    this.lightningBoostUntil = 0;
    this.aegisBoostPrimed = false;
    this.lastAegisDuration = COMBAT.aegisDuration;
    this.aegisHitUntil = 0;
    this.aegisAbsorbedHits = 0;
    this.damageTaken = 0;
    this.dragonInAttackRange = false;
    this.nextDragonAttackAt = 0;
    this.playerDefeated = false;
    this.aegis.mesh.setEnabled(false);
    this.aegis.light.intensity = 0;
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
      selectedSpell: this.selectedSpell,
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
      powerups: {
        lightningActive: this.lightningBoostActive(this.lastTime),
        lightningRemaining: Math.max(0, this.lightningBoostUntil - this.lastTime),
        lightningDamageMultiplier: this.lightningBoostActive(this.lastTime)
          ? COMBAT.lightningPotionDamageMultiplier
          : 1,
        aegisPrimed: this.aegisBoostPrimed,
        aegisDurationMultiplier: this.aegisBoostPrimed ? COMBAT.aegisPotionDurationMultiplier : 1
      },
      dragonInAttackRange: this.dragonInAttackRange,
      activeLightningStreams: this.scene.meshes.filter(mesh => mesh.name.startsWith('lightning-stream-')).length,
      activeFrostStreams: this.scene.meshes.filter(mesh => mesh.name.startsWith('frost-stream-')).length
    };
  }
}
