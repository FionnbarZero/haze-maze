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

try {
  await navigateToProof(cdp, gameUrl, {
    route: 'chapter1',
    params: {
      mazeSeed: 'chapter-one-party-recovery-smoke',
      party: 'simulated',
      character: 'purple',
      partyRecoverySmoke: Date.now()
    }
  });
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
  await evaluate("window.__HMW_THIRD_PERSON_PROOF__.start('purple')");
  await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.localCharacter === 'purple'");
  await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.partyMode === 'SIMULATED'");
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.replica.snapshotsReceived >= 10');

  const started = await snapshot();
  const replicaBefore = started.greenWitch.replica;
  const simulationBefore = started.greenWitch.simulation;
  const setupDragonIndex = started.dragons.findIndex(dragon => dragon.alive && dragon.aggressive);
  const setupDragon = started.dragons[setupDragonIndex];
  assert.ok(setupDragon, 'the party recovery proof needs one living aggressive dragon');
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.focusDragon(${setupDragonIndex}); window.__HMW_THIRD_PERSON_PROOF__.teleportNearDragon(${setupDragonIndex}, 3); true`);
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.abilities.dragonInRange');
  assert.equal(await evaluate('window.__HMW_THIRD_PERSON_PROOF__.damageGreenWitch(37)'), 37);
  assert.equal(await evaluate("window.__HMW_THIRD_PERSON_PROOF__.setGreenRestoreFriendTargeted(true); window.__HMW_THIRD_PERSON_PROOF__.castGreenVine()"), true);
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.abilities.activeVineStreams === 2');
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.abilities.bindingCount === 3');

  const beforeDeath = await snapshot();
  const greenBefore = beforeDeath.greenWitch.abilities;
  assert.equal(greenBefore.activeVineTargetDragonIds.length, 1,
    'Green Vine must select exactly one living dragon for this recovery proof');
  const finalDamageDragonId = greenBefore.activeVineTargetDragonIds[0];
  const dragonBefore = beforeDeath.dragons.find(dragon => dragon.id === finalDamageDragonId);
  assert.ok(dragonBefore, 'the actual Green Vine target must remain present before defeat');
  assert.equal(greenBefore.locallyControlled, false);
  assert.equal(greenBefore.health, 63);
  assert.equal(greenBefore.storedHealth, 63);
  assert.equal(greenBefore.storedFriendHealth, 100);
  assert.equal(greenBefore.selectedSpell, 'vineTrap');
  assert.ok(greenBefore.cooldowns.vineTrap > 0);
  assert.equal(greenBefore.friendTargeted, true);
  assert.equal(greenBefore.lastCast?.spell, 'vineTrap');
  assert.equal(greenBefore.activeVineStreams, 2);
  assert.equal(dragonBefore.restrained, true);
  assert.ok(dragonBefore.restrainedRemaining > 0);

  assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.receiveDragonDamage(100, ${JSON.stringify(finalDamageDragonId)})`), true);
  await waitFor('!window.__HMW_THIRD_PERSON_PROOF__.snapshot().recovery.pending');
  const recovered = await snapshot();
  const greenAfter = recovered.greenWitch.abilities;
  const dragonAfter = recovered.dragons.find(dragon => dragon.id === finalDamageDragonId);
  const dragonSpawn = recovered.recovery.dragonSpawns.find(spawn => spawn.id === finalDamageDragonId);
  assert.ok(dragonAfter, 'the actual Green Vine target must remain present after recovery');
  assert.ok(dragonSpawn, 'the actual Green Vine target must have an authored recovery spawn');
  assert.equal(recovered.characterSelection.localCharacter, 'purple');
  assert.equal(recovered.combat.playerHealth, recovered.combat.playerMaximumHealth);
  assert.equal(recovered.recovery.lastResetKind, 'ORDINARY_RESPAWN');
  assert.equal(dragonAfter.health, dragonAfter.maximumHealth);
  assert.equal(dragonAfter.restrained, false);
  assert.equal(dragonAfter.restrainedRemaining, 0);
  assert.ok(Math.hypot(dragonAfter.position.x - dragonSpawn.x, dragonAfter.position.z - dragonSpawn.z) < .01);
  assert.equal(greenAfter.health, greenBefore.health);
  assert.equal(greenAfter.storedHealth, greenBefore.storedHealth);
  assert.equal(greenAfter.storedFriendHealth, greenBefore.storedFriendHealth);
  assert.equal(greenAfter.selectedSpell, greenBefore.selectedSpell);
  assert.ok(greenAfter.cooldowns.vineTrap > 0, 'Purple recovery must not clear Green cooldowns');
  assert.ok(greenAfter.cooldowns.vineTrap < greenBefore.cooldowns.vineTrap,
    'Green cooldown should only advance normally during Purple recovery');
  assert.equal(greenAfter.friendTargeted, greenBefore.friendTargeted);
  assert.deepEqual(greenAfter.lastCast, greenBefore.lastCast);
  assert.equal(greenAfter.bindingCount, 0);
  assert.equal(greenAfter.activeVineStreams, 0);
  assert.deepEqual(greenAfter.activeVineTargetDragonIds, []);
  assert.ok(recovered.greenWitch.replica.snapshotsReceived > replicaBefore.snapshotsReceived,
    'ordinary recovery must not reset the replica snapshot counter');
  assert.ok(recovered.greenWitch.replica.latestSequence > replicaBefore.latestSequence,
    'replica sequence must remain monotonic through recovery');
  assert.ok(recovered.greenWitch.simulation.sequence > simulationBefore.sequence,
    'simulated feed sequence must remain monotonic through recovery');
  assert.equal(recovered.recovery.lastResetDragonIds.includes(finalDamageDragonId), true);

  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); true');
  const fullRestart = await snapshot();
  assert.equal(fullRestart.recovery.lastResetKind, 'FULL_ROUTE_RESTART');
  assert.equal(fullRestart.greenWitch.abilities.storedHealth, fullRestart.greenWitch.abilities.maximumHealth);
  assert.equal(fullRestart.greenWitch.abilities.storedFriendHealth, 100);
  assert.equal(fullRestart.greenWitch.abilities.cooldowns.vineTrap, 0);
  assert.equal(fullRestart.greenWitch.abilities.lastCast, null);
  assert.equal(fullRestart.greenWitch.abilities.activeVineStreams, 0);
  assert.deepEqual(cdp.errors, []);
  console.log(JSON.stringify({
    passed: true,
    finalDamageDragonId,
    greenHealth: greenAfter.health,
    greenCooldownRemaining: greenAfter.cooldowns.vineTrap,
    snapshotsReceivedBefore: replicaBefore.snapshotsReceived,
    snapshotsReceivedAfter: recovered.greenWitch.replica.snapshotsReceived,
    latestSequenceBefore: replicaBefore.latestSequence,
    latestSequenceAfter: recovered.greenWitch.replica.latestSequence,
    simulationSequenceBefore: simulationBefore.sequence,
    simulationSequenceAfter: recovered.greenWitch.simulation.sequence,
    resetKind: recovered.recovery.lastResetKind,
    errors: cdp.errors
  }, null, 2));
} finally {
  cdp.close();
}
