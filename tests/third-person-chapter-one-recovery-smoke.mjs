import assert from 'node:assert/strict';

import { navigateToProof } from './third-person-smoke-navigation.mjs';

const debugEndpoint = process.env.HMW_CDP_ENDPOINT || 'http://127.0.0.1:9232';
const gameUrl = process.env.HMW_GAME_URL || 'http://127.0.0.1:8769/third-person.html?quality=low';
const expectedUrl = new URL(gameUrl);
const pages = await fetch(`${debugEndpoint}/json/list`).then(response => response.json());
const target = pages.find(page => page.type === 'page' && new URL(page.url).origin === expectedUrl.origin);
if (!target) throw new Error('No Moonhollow Chrome page target found');

class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.errors = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        this.errors.push(message.params.args.map(argument => argument.value ?? argument.description ?? '').join(' '));
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timeout); resolve(value); },
        reject: error => { clearTimeout(timeout); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

const cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const evaluate = async expression => {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const snapshot = () => evaluate('window.__HMW_THIRD_PERSON_PROOF__.snapshot()');
const waitFor = async (expression, timeoutMilliseconds = 15000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(80);
  }
  throw new Error(`Timed out waiting for ${expression}`);
};
const stateFor = geodeId => `window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.geodeRocks.find(geode => geode.id === ${JSON.stringify(geodeId)})`;

const recoverFromLethalDamage = async (dragonId, whilePending = null) => {
  const before = await snapshot();
  assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.receiveDragonDamage(100, ${JSON.stringify(dragonId)})`), true);
  const lethal = await snapshot();
  assert.equal(lethal.recovery.pending, true);
  assert.equal(lethal.recovery.finalDamageDragonId, dragonId);
  assert.ok(lethal.recovery.engagedDragonIds.includes(dragonId));
  assert.equal(lethal.input.playerActionsBlocked, true);
  assert.ok(lethal.timing.time >= before.timing.time);
  const pendingResult = whilePending ? await whilePending() : null;
  await waitFor('!window.__HMW_THIRD_PERSON_PROOF__.snapshot().recovery.pending');
  const recovered = await snapshot();
  assert.ok(recovered.timing.time > lethal.timing.time, 'ordinary respawn must keep the current simulation epoch');
  return { lethal, recovered, pendingResult };
};

const mineAndCollect = async geode => {
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${geode.position.x}, 0, ${geode.position.z}); true`);
  const before = await snapshot();
  const rock = before.inventory.geodeRocks.find(candidate => candidate.id === geode.id);
  for (let strike = rock.strikes; strike < geode.strikesRequired; strike += 1) {
    assert.equal(await evaluate('window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()'), true);
  }
  await waitFor(`${stateFor(geode.id)}.reward.available`);
  await waitFor(`${stateFor(geode.id)}.reward.collected`);
  return snapshot();
};

try {
  await navigateToProof(cdp, gameUrl, {
    route: 'chapter1',
    params: {
      mazeSeed: 'chapter-one-recovery-smoke',
      character: 'purple',
      recoverySmoke: Date.now()
    }
  });
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
  await evaluate("window.__HMW_THIRD_PERSON_PROOF__.start('purple')");
  await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.localCharacter === 'purple'");

  const initial = await snapshot();
  const geode = initial.levelPlan.requiredGeodes[0];
  const finalDragon = initial.dragons.find(dragon => dragon.id === initial.combat.threatDragonId && dragon.alive)
    || initial.dragons.find(dragon => dragon.alive && dragon.aggressive);
  const unrelatedDragon = initial.dragons.find(dragon => dragon.alive
    && dragon.id !== finalDragon.id
    && dragon.id !== initial.combat.threatDragonId);
  const defeatedDragon = initial.dragons.find(dragon => dragon.alive
    && dragon.id !== finalDragon.id
    && dragon.id !== unrelatedDragon?.id
    && dragon.id !== initial.combat.threatDragonId);
  assert.ok(finalDragon && unrelatedDragon && defeatedDragon,
    'the recovery proof needs three independent living dragons');
  const unrelatedDragonIndex = initial.dragons.findIndex(dragon => dragon.id === unrelatedDragon.id);
  const defeatedDragonIndex = initial.dragons.findIndex(dragon => dragon.id === defeatedDragon.id);
  assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.damageDragon(${unrelatedDragonIndex}, 25)`), true);
  assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.damageDragon(${defeatedDragonIndex}, 100)`), true);
  const preparedDragons = await snapshot();
  const unrelatedHealth = preparedDragons.dragons.find(dragon => dragon.id === unrelatedDragon.id).health;
  assert.equal(preparedDragons.dragons.find(dragon => dragon.id === defeatedDragon.id).alive, false);
  assert.ok(unrelatedHealth < unrelatedDragon.maximumHealth, 'unrelated dragon needs a meaningful preserved lifecycle state');
  assert.equal(await evaluate("window.__HMW_THIRD_PERSON_PROOF__.setEquipmentMode('mining-tools')"), true);
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${geode.position.x}, 0, ${geode.position.z}); true`);
  assert.equal(await evaluate('window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()'), true);
  const partiallyMined = await snapshot();
  const partialRock = partiallyMined.inventory.geodeRocks.find(rock => rock.id === geode.id);
  assert.equal(partialRock.strikes, 1);

  const firstRecovery = await recoverFromLethalDamage(finalDragon.id, () => evaluate(`({
    movement: window.__HMW_THIRD_PERSON_PROOF__.setMovement(0, 1),
    equipment: window.__HMW_THIRD_PERSON_PROOF__.setEquipmentMode('staff'),
    mining: window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode(),
    casting: window.__HMW_THIRD_PERSON_PROOF__.castLightning()
  })`));
  const blockedActions = firstRecovery.pendingResult;
  assert.deepEqual(blockedActions, { movement: false, equipment: false, mining: false, casting: false });
  const afterFirst = firstRecovery.recovered;
  const respawn = afterFirst.recovery.respawnPosition;
  assert.equal(afterFirst.characterSelection.localCharacter, 'purple');
  assert.equal(afterFirst.combat.playerHealth, afterFirst.combat.playerMaximumHealth);
  assert.equal(afterFirst.combat.playerDefeated, false);
  assert.equal(afterFirst.inventory.equipment.mode, 'mining-tools');
  assert.equal(afterFirst.inventory.geodeRocks.find(rock => rock.id === geode.id).strikes, 1);
  assert.ok(Math.hypot(afterFirst.player.x - respawn.x, afterFirst.player.z - respawn.z) < .01);
  const resetDragon = afterFirst.dragons.find(dragon => dragon.id === finalDragon.id);
  const spawn = afterFirst.recovery.dragonSpawns.find(entry => entry.id === finalDragon.id);
  assert.equal(afterFirst.recovery.lastResetDragonIds.includes(finalDragon.id), true);
  assert.equal(afterFirst.recovery.lastResetDragonIds.includes(unrelatedDragon.id), false);
  assert.equal(afterFirst.recovery.lastResetDragonIds.includes(defeatedDragon.id), false);
  assert.equal(resetDragon.health, resetDragon.maximumHealth);
  assert.equal(resetDragon.aggressive, true);
  assert.ok(Math.hypot(resetDragon.position.x - spawn.x, resetDragon.position.z - spawn.z) < .01);
  const preservedUnrelatedDragon = afterFirst.dragons.find(dragon => dragon.id === unrelatedDragon.id);
  const preservedDefeatedDragon = afterFirst.dragons.find(dragon => dragon.id === defeatedDragon.id);
  assert.equal(preservedUnrelatedDragon.health, unrelatedHealth);
  assert.equal(preservedUnrelatedDragon.alive, true);
  assert.equal(preservedDefeatedDragon.alive, false);

  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${geode.position.x}, 0, ${geode.position.z}); true`);
  for (let strike = 1; strike < geode.strikesRequired; strike += 1) {
    assert.equal(await evaluate('window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()'), true);
  }
  await waitFor(`${stateFor(geode.id)}.reward.available`);
  const revealed = await snapshot();
  const revealedRock = revealed.inventory.geodeRocks.find(rock => rock.id === geode.id);
  assert.equal(revealedRock.mined, true);
  assert.equal(revealedRock.reward.collected, false);

  const secondRecovery = await recoverFromLethalDamage(finalDragon.id);
  const afterSecond = secondRecovery.recovered;
  const unclaimedAfterDeath = afterSecond.inventory.geodeRocks.find(rock => rock.id === geode.id);
  assert.equal(unclaimedAfterDeath.mined, true);
  assert.equal(unclaimedAfterDeath.reward.available, true);
  assert.equal(unclaimedAfterDeath.reward.collected, false);

  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${geode.position.x}, 0, ${geode.position.z}); true`);
  await waitFor(`${stateFor(geode.id)}.reward.collected`);
  const collected = await snapshot();
  const collectedRock = collected.inventory.geodeRocks.find(rock => rock.id === geode.id);
  assert.equal(collectedRock.reward.collected, true);
  assert.equal(collected.chapter.routeRune.fragmentCount, 1);
  assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()`), false);

  for (const requiredGeode of initial.levelPlan.requiredGeodes.slice(1)) await mineAndCollect(requiredGeode);
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().chapter.routeRune.completed');
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().chapter.sunkenGate.opened');
  const optionalGeode = initial.levelPlan.optionalGeodes[0];
  assert.ok(optionalGeode, 'the Chapter plan needs one optional Raw Damage Crystal geode');
  await mineAndCollect(optionalGeode);
  const permanentBeforeDeath = await snapshot();
  assert.equal(permanentBeforeDeath.inventory.rawDamageCrystals, 1);
  assert.equal(permanentBeforeDeath.combat.powerups.damageCrystalCount, 1);
  assert.equal(permanentBeforeDeath.combat.powerups.damageCrystalMultiplier, 1.1);
  assert.equal(permanentBeforeDeath.chapter.routeRune.completed, true);
  assert.equal(permanentBeforeDeath.chapter.sunkenGate.unlocked, true);
  assert.equal(permanentBeforeDeath.chapter.sunkenGate.opened, true);

  const berry = permanentBeforeDeath.inventory.pickups.find(pickup => !pickup.collected);
  assert.ok(berry, 'the recovery proof needs one ordinary health berry');
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${berry.position.x}, 0, ${berry.position.z}); true`);
  await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.pickups.find(pickup => pickup.id === ${JSON.stringify(berry.id)}).collected`);
  assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.receiveDragonDamage(20, ${JSON.stringify(finalDragon.id)})`), true);
  const berryBeforeUse = await snapshot();
  assert.equal(await evaluate('window.__HMW_THIRD_PERSON_PROOF__.useHealthBerry()'), true);
  const berryAfterUse = await snapshot();
  assert.equal(berryAfterUse.inventory.healthBerries, berryBeforeUse.inventory.healthBerries - 1);
  assert.equal(berryAfterUse.inventory.totalUsed, berryBeforeUse.inventory.totalUsed + 1);

  const thirdRecovery = await recoverFromLethalDamage(finalDragon.id);
  const afterThird = thirdRecovery.recovered;
  assert.equal(afterThird.inventory.geodeRocks.find(rock => rock.id === geode.id).reward.collected, true);
  assert.equal(afterThird.chapter.routeRune.fragmentCount, 3);
  assert.equal(afterThird.chapter.keeperClues.length, 3);
  assert.equal(afterThird.chapter.routeRune.completed, true);
  assert.equal(afterThird.chapter.sunkenGate.unlocked, true);
  assert.equal(afterThird.chapter.sunkenGate.opened, true);
  assert.equal(afterThird.inventory.rawDamageCrystals, 1);
  assert.equal(afterThird.combat.powerups.damageCrystalCount, 1);
  assert.equal(afterThird.combat.powerups.damageCrystalMultiplier, 1.1);
  assert.equal(afterThird.inventory.healthBerries, berryAfterUse.inventory.healthBerries);
  assert.equal(afterThird.inventory.totalUsed, berryAfterUse.inventory.totalUsed);
  assert.equal(afterThird.inventory.geodeRocks.find(rock => rock.id === geode.id).reward.collected, true);
  assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${geode.position.x}, 0, ${geode.position.z}); window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()`), false);

  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); true');
  const fullRestart = await snapshot();
  assert.equal(fullRestart.recovery.lastResetKind, 'FULL_ROUTE_RESTART');
  assert.equal(fullRestart.recovery.respawnCount, 0);
  assert.equal(fullRestart.recovery.lastDefeatAt, null);
  assert.equal(fullRestart.recovery.lastRespawnAt, null);
  assert.equal(fullRestart.recovery.finalDamageDragonId, null);
  assert.deepEqual(fullRestart.recovery.engagedDragonIds, []);
  assert.deepEqual(fullRestart.recovery.lastResetDragonIds, []);
  assert.equal(fullRestart.recovery.respawnPosition, null);
  assert.equal(fullRestart.chapter.routeRune.fragmentCount, 0);
  assert.equal(fullRestart.chapter.keeperClues.length, 0);
  assert.equal(fullRestart.inventory.geodeRocks.find(rock => rock.id === geode.id).strikes, 0);
  assert.equal(fullRestart.inventory.geodeRocks.find(rock => rock.id === geode.id).reward.available, false);
  assert.equal(fullRestart.inventory.geodeRocks.find(rock => rock.id === geode.id).reward.collected, false);
  assert.equal(fullRestart.timing.time, 0);
  assert.deepEqual(cdp.errors, []);
  console.log(JSON.stringify({
    passed: true,
    finalDamageDragonId: finalDragon.id,
    unrelatedDragonId: unrelatedDragon.id,
    defeatedDragonId: defeatedDragon.id,
    partialStrikes: partialRock.strikes,
    recoveryCount: afterThird.recovery.respawnCount,
    errors: cdp.errors
  }, null, 2));
} finally {
  cdp.close();
}
