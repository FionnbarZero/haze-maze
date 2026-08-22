import assert from 'node:assert/strict';
import test from 'node:test';

import { GreenWitchAbilities } from '../third-person/green-witch.js';
import { PouchInventory } from '../third-person/inventory.js';

test('Green Witch reset moves omitted-timestamp casts into the new simulation epoch', () => {
  const hudTimes = [];
  const abilities = Object.assign(Object.create(GreenWitchAbilities.prototype), {
    maximumHealth: 10,
    friendMaximumHealth: 100,
    health: 1,
    friendHealth: 2,
    cooldownUntil: { vineTrap: 18, restore: 18 },
    lastTime: 18,
    lastCast: { spell: 'vineTrap' },
    friendTargeted: true,
    vineBindings: [{ setEnabled: () => {} }],
    transientEffects: [{ nodes: [{ dispose: () => {} }], light: { dispose: () => {} }, material: { dispose: () => {} } }],
    spellcastingEnabled: true,
    selectedSpell: 'vineTrap',
    updateHud: time => hudTimes.push(time)
  });

  GreenWitchAbilities.prototype.reset.call(abilities, .25);

  assert.equal(abilities.lastTime, .25);
  assert.equal(abilities.health, 10);
  assert.equal(abilities.friendHealth, 100);
  assert.deepEqual(abilities.cooldownUntil, { vineTrap: 0, restore: 0 });
  assert.equal(abilities.lastCast, null);
  assert.equal(abilities.friendTargeted, false);
  assert.deepEqual(abilities.transientEffects, []);
  assert.deepEqual(hudTimes, [.25]);

  let castTime = null;
  abilities.castVineTrap = time => {
    castTime = time;
    return true;
  };
  assert.equal(GreenWitchAbilities.prototype.castSelected.call(abilities), true);
  assert.equal(castTime, .25,
    'an omitted-timestamp action must use the reset simulation epoch, not the previous route time');
});

test('Green Witch ordinary recovery clears only local temporary ability state', () => {
  const hudTimes = [];
  const disabledBindings = [];
  const disposed = [];
  const removedClasses = [];
  const abilities = Object.assign(Object.create(GreenWitchAbilities.prototype), {
    maximumHealth: 100,
    friendMaximumHealth: 100,
    health: 41,
    friendHealth: 73,
    selectedSpell: 'restore',
    lastTime: 18,
    cooldownUntil: { vineTrap: 24, restore: 23 },
    lastCast: { spell: 'restore', target: 'purple-witch' },
    friendTargeted: true,
    vineBindings: [{ setEnabled: value => disabledBindings.push(value) }, { setEnabled: value => disabledBindings.push(value) }],
    transientEffects: [{
      nodes: [{ dispose: () => disposed.push('node') }],
      light: { dispose: () => disposed.push('light') },
      material: { dispose: () => disposed.push('material') }
    }],
    crosshair: { classList: { remove: (...names) => removedClasses.push(...names) } },
    crosshairLabel: { dataset: { stateLabel: 'FRIEND' } },
    updateHud: time => hudTimes.push(time)
  });

  GreenWitchAbilities.prototype.recoverAfterDefeat.call(abilities, 18.9);

  assert.equal(abilities.lastTime, 18.9);
  assert.equal(abilities.selectedSpell, 'restore');
  assert.equal(abilities.health, 41);
  assert.equal(abilities.friendHealth, 73);
  assert.deepEqual(abilities.cooldownUntil, { vineTrap: 0, restore: 0 });
  assert.equal(abilities.lastCast, null);
  assert.equal(abilities.friendTargeted, false);
  assert.deepEqual(disabledBindings, [false, false]);
  assert.deepEqual(disposed, ['node', 'light', 'material']);
  assert.deepEqual(removedClasses, ['is-targeting', 'is-assisted', 'is-obstructed', 'is-self-cast']);
  assert.equal(abilities.crosshairLabel.dataset.stateLabel, '');
  assert.deepEqual(abilities.transientEffects, []);
  assert.deepEqual(hudTimes, [18.9]);
});

test('Green Witch reconciles only Vine effects attached to recovered dragons', () => {
  const disposed = [];
  const bindingStates = [];
  const recoveredVine = {
    kind: 'VINE',
    targetDragonId: 'dragon-2',
    nodes: [{ dispose: () => disposed.push('recovered-vine') }]
  };
  const unrelatedVine = {
    kind: 'VINE',
    targetDragonId: 'dragon-7',
    nodes: [{ dispose: () => disposed.push('unrelated-vine') }]
  };
  const restoreEffect = {
    kind: 'RESTORE',
    nodes: [{ dispose: () => disposed.push('restore') }]
  };
  const lastCast = { spell: 'vineTrap', target: 'training-dragon' };
  const abilities = Object.assign(Object.create(GreenWitchAbilities.prototype), {
    lastTime: 18,
    health: 41,
    friendHealth: 73,
    selectedSpell: 'restore',
    cooldownUntil: { vineTrap: 24, restore: 23 },
    lastCast,
    friendTargeted: true,
    dragon: { id: 'dragon-2' },
    vineBindings: [{ setEnabled: value => bindingStates.push(value) }],
    transientEffects: [recoveredVine, unrelatedVine, restoreEffect],
    updateHud: () => {}
  });

  const result = GreenWitchAbilities.prototype.reconcileRecoveredDragons.call(abilities, ['dragon-2'], 18.9);

  assert.deepEqual(result, {
    recoveredDragonIds: ['dragon-2'],
    disposedVineEffects: 1,
    bindingsDisabled: true
  });
  assert.deepEqual(disposed, ['recovered-vine']);
  assert.deepEqual(bindingStates, [false]);
  assert.deepEqual(abilities.transientEffects, [unrelatedVine, restoreEffect]);
  assert.equal(abilities.lastTime, 18.9);
  assert.equal(abilities.health, 41);
  assert.equal(abilities.friendHealth, 73);
  assert.equal(abilities.selectedSpell, 'restore');
  assert.deepEqual(abilities.cooldownUntil, { vineTrap: 24, restore: 23 });
  assert.equal(abilities.lastCast, lastCast);
  assert.equal(abilities.friendTargeted, true);
});

test('Green Witch leaves bindings and unrelated effects alone when another dragon recovers', () => {
  const disposed = [];
  const bindingStates = [];
  const unrelatedVine = {
    kind: 'VINE',
    targetDragonId: 'dragon-7',
    nodes: [{ dispose: () => disposed.push('unrelated-vine') }]
  };
  const abilities = Object.assign(Object.create(GreenWitchAbilities.prototype), {
    lastTime: 18,
    dragon: { id: 'dragon-7' },
    vineBindings: [{ setEnabled: value => bindingStates.push(value) }],
    transientEffects: [unrelatedVine],
    updateHud: () => {}
  });

  const result = GreenWitchAbilities.prototype.reconcileRecoveredDragons.call(abilities, ['dragon-2'], 18.9);

  assert.deepEqual(result, {
    recoveredDragonIds: ['dragon-2'],
    disposedVineEffects: 0,
    bindingsDisabled: false
  });
  assert.deepEqual(disposed, []);
  assert.deepEqual(bindingStates, []);
  assert.deepEqual(abilities.transientEffects, [unrelatedVine]);
});

test('inventory reset adopts the supplied simulation epoch for post-reset reward timing', () => {
  const inventory = Object.assign(Object.create(PouchInventory.prototype), {
    chapterMode: false,
    lastTime: 18,
    pickups: [],
    powerupPickups: [],
    equipmentPickups: [],
    geodeRocks: [],
    runePickups: [],
    chest: { opened: true, openProgress: 1, lidPivot: { rotation: { x: 1 } }, glow: { intensity: 1 } },
    combat: { setGeodeCount: () => {}, setDamageCrystalCount: () => {} },
    setOpen: () => {},
    applyEquippedItem: () => {},
    updateInterface: () => {},
    onEquipmentModeChange: () => {}
  });

  PouchInventory.prototype.reset.call(inventory, .25);

  assert.equal(inventory.lastTime, .25);
  inventory.onMessage = () => {};
  const rock = {
    reward: {
      available: false,
      collected: false,
      root: { rotation: { y: 0 }, setEnabled: () => {} }
    }
  };
  assert.equal(inventory.spawnChapterGeodeReward(rock, { kind: 'route-rune-fragment' }), true);
  assert.equal(rock.reward.collectibleAt, .9,
    'a reward immediately after reset must use the new simulation epoch');
});
