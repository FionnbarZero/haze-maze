import assert from 'node:assert/strict';
import test from 'node:test';

import { ChapterRespawnState, createDefeatContext } from '../third-person/chapter-recovery.js';
import { LightningCombat } from '../third-person/combat.js';
import { PouchInventory } from '../third-person/inventory.js';

test('defeat context keeps only durable lethal-hit engagement evidence', () => {
  const context = createDefeatContext({
    defeatedAt: 12.4,
    finalDamageDragonId: 'dragon-5',
    threatDragonId: 'dragon-5'
  });

  assert.equal(context.defeatedAt, 12.4);
  assert.equal(context.finalDamageDragonId, 'dragon-5');
  assert.deepEqual(context.engagedDragonIds, ['dragon-5']);
  assert.equal(Object.isFrozen(context), true);
});

test('Chapter respawn state blocks duplicate defeats, uses continuous time, and full restart clears the abandoned epoch', () => {
  const recovery = new ChapterRespawnState({ recoveryDelay: .85 });
  assert.equal(recovery.begin({ defeatedAt: 18.05, finalDamageDragonId: 'dragon-2', threatDragonId: 'dragon-4' }), true);
  assert.equal(recovery.begin({ defeatedAt: 18.1, finalDamageDragonId: 'dragon-7' }), false);
  assert.equal(recovery.isDue(18.899), false);
  assert.equal(recovery.isDue(18.9), true);
  assert.equal(recovery.complete(18.9, ['dragon-2'], { x: -8, y: 0, z: -12 }), true);

  const afterRespawn = recovery.snapshot();
  assert.equal(afterRespawn.pending, false);
  assert.equal(afterRespawn.lastRespawnAt, 18.9);
  assert.equal(afterRespawn.finalDamageDragonId, 'dragon-2');
  assert.deepEqual(afterRespawn.lastResetDragonIds, ['dragon-2']);
  assert.deepEqual(afterRespawn.respawnPosition, { x: -8, y: 0, z: -12 });
  assert.equal(afterRespawn.lastResetKind, 'ORDINARY_RESPAWN');

  assert.equal(recovery.begin({ defeatedAt: 20, finalDamageDragonId: 'dragon-3' }), true);
  recovery.cancelForFullRestart();
  assert.equal(recovery.isDue(100), false);
  assert.deepEqual(recovery.snapshot(), {
    pending: false,
    respawnCount: 0,
    lastDefeatAt: null,
    lastRespawnAt: null,
    finalDamageDragonId: null,
    engagedDragonIds: [],
    respawnAt: null,
    lastResetDragonIds: [],
    respawnPosition: null,
    lastResetKind: 'FULL_ROUTE_RESTART'
  });
});

test('combat recovery clears temporary state at the current epoch without erasing permanent modifiers or selection', () => {
  const hudTimes = [];
  const combat = Object.assign(Object.create(LightningCombat.prototype), {
    cooldownUntil: { lightning: 24, frost: 24, aegis: 24, freeze: 24, iceLance: 24, fireball: 24, fireRing: 24 },
    selectedSpell: 'frost',
    loadout: ['lightning', 'frost', 'aegis'],
    lastTime: 18,
    targeted: true,
    candidateTargeted: true,
    assisted: true,
    aimState: 'DIRECT',
    lastCast: { spell: 'frost' },
    dragon: { maximumHealth: 100 },
    currentTarget: { id: 'dragon-2' },
    playerHealth: 0,
    playerMaximumHealth: 10,
    aegisUntil: 24,
    lightningBoostUntil: 24,
    geodeCount: 3,
    geodeDamageMultiplier: 1.3,
    damageCrystalCount: 2,
    damageCrystalMultiplier: 1.2,
    aegisBoostPrimed: true,
    lastAegisDuration: 8,
    aegisHitUntil: 24,
    aegisAbsorbedHits: 2,
    fireRingUntil: 24,
    fireRingHitUntil: 24,
    fireRingAbsorbedHits: 2,
    fireRingRepelledCreatures: 2,
    damageTaken: 10,
    dragonInAttackRange: true,
    threatDragon: { id: 'dragon-2' },
    nextDragonAttackAt: 24,
    playerDefeated: true,
    dragonAttackEvents: [{ time: 18, dragonId: 'dragon-2' }],
    playerDamageEvents: [{ time: 18, dragonId: 'dragon-2', amount: 10 }],
    aegis: { mesh: { setEnabled: () => {} }, light: { intensity: 1 } },
    fireRing: { root: { setEnabled: () => {} }, light: { intensity: 1 } },
    crosshair: { classList: { remove: () => {} } },
    crosshairLabel: { dataset: {} },
    targetCard: { classList: { remove: () => {} }, setAttribute: () => {} },
    healthFill: { style: {} },
    healthCopy: { textContent: '' },
    targetStatus: { textContent: '' },
    updateSpellSelection: () => {},
    updatePlayerHud: time => hudTimes.push(time)
  });

  LightningCombat.prototype.recoverAfterDefeat.call(combat, 18.9);

  assert.equal(combat.lastTime, 18.9);
  assert.equal(combat.playerHealth, 10);
  assert.equal(combat.playerDefeated, false);
  assert.equal(combat.selectedSpell, 'frost');
  assert.equal(combat.geodeCount, 3);
  assert.equal(combat.damageCrystalCount, 2);
  assert.equal(combat.lightningBoostUntil, 0);
  assert.equal(combat.aegisBoostPrimed, false);
  assert.deepEqual(hudTimes, [18.9]);
});

test('inventory resynchronizes permanent combat modifiers without restoring a snapshot', () => {
  const applied = [];
  const inventory = Object.assign(Object.create(PouchInventory.prototype), {
    geodes: 4,
    rawDamageCrystals: 3,
    combat: {
      setGeodeCount: value => applied.push(['geodes', value]),
      setDamageCrystalCount: value => applied.push(['crystals', value])
    },
    updateInterface: () => {}
  });

  PouchInventory.prototype.resynchronizeCombatModifiers.call(inventory);
  assert.deepEqual(applied, [['geodes', 4], ['crystals', 3]]);

  applied.length = 0;
  inventory.chapterMode = true;
  PouchInventory.prototype.resynchronizeCombatModifiers.call(inventory);
  assert.deepEqual(applied, [['geodes', 0], ['crystals', 3]],
    'Chapter fragments must not become legacy geode-damage bonuses after respawn');
});
