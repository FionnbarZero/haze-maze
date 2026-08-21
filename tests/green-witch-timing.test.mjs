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
  assert.deepEqual(abilities.cooldownUntil, { vineTrap: 0, restore: 0 });
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
