import assert from 'node:assert/strict';
import { LEGACY_SMOKE_SEED, navigateToProof } from './third-person-smoke-navigation.mjs';

const debugEndpoint = process.env.HMW_CDP_ENDPOINT || 'http://127.0.0.1:9223';
const gameUrl = process.env.HMW_GAME_URL || 'http://127.0.0.1:8766/third-person.html?quality=low&route=legacy';

const pages = await fetch(`${debugEndpoint}/json/list`).then(response => response.json());
const target = pages.find(page => page.type === 'page');
if (!target) throw new Error('No Chrome page target found');

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
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await navigateToProof(cdp, gameUrl, {
  route: 'legacy',
  params: { mazeSeed: LEGACY_SMOKE_SEED, expandedTest: Date.now() }
});

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const evaluate = async expression => {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const waitFor = async (expression, timeoutMilliseconds = 45000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
};
const snapshot = () => evaluate('window.__HMW_THIRD_PERSON_PROOF__.snapshot()');
const dragonsClearOfWalls = state => state.dragons.every(dragon => state.navigation.colliders
  .filter(collider => collider.max.y > .01 && collider.min.y < 2.25)
  .every(collider => {
    const nearestX = Math.max(collider.min.x, Math.min(dragon.position.x, collider.max.x));
    const nearestZ = Math.max(collider.min.z, Math.min(dragon.position.z, collider.max.z));
    return Math.hypot(dragon.position.x - nearestX, dragon.position.z - nearestZ) >= dragon.collisionRadius - .01;
  }));
const teleportToRune = async index => {
  const state = await snapshot();
  const rune = state.inventory.runePickups[index];
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${rune.position.x}, 0, ${rune.position.z}); true`);
  await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.runes === ${index + 1}`);
  return snapshot();
};

try {
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.start(); true');
  await delay(250);

  const initial = await snapshot();
  const legacyLabels = await evaluate(`({
    route: document.querySelector('#route-label').textContent.trim(),
    pick: document.querySelector('#pouch-geode-pick-label').textContent.trim(),
    geodes: document.querySelector('#pouch-geode-label').textContent.trim(),
    runes: document.querySelector('#pouch-rune-label').textContent.trim(),
    keeperCluesHidden: document.querySelector('#keeper-clues-section').hidden
  })`);
  assert.deepEqual(legacyLabels, {
    route: 'Technical route',
    pick: 'Crystal geode pick',
    geodes: 'Magical geodes',
    runes: 'Rune-door runes',
    keeperCluesHidden: true
  });
  assert.ok(initial.world.dimensions.areaMultiplier >= 3);
  assert.deepEqual(initial.world.featureCounts, {
    berries: 12,
    fountains: 8,
    geodes: 4,
    potions: 8,
    dragons: 10,
    aggressiveDragons: 10,
    variableWalls: initial.world.featureCounts.variableWalls
  });
  assert.ok(initial.world.featureCounts.variableWalls >= 20);
  assert.equal(initial.dragons.length, 10);
  assert.equal(initial.dragons.filter(dragon => dragon.aggressive).length, 10);
  await delay(1800);
  assert.equal(dragonsClearOfWalls(await snapshot()), true, 'dragon patrols must not overlap maze walls');

  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.teleportNearDragon(1, 1.8); true');
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().combat.damageTaken > 0', 5000);
  const secondDragonContact = await snapshot();
  assert.equal(secondDragonContact.dragons[1].aggressive, true);
  assert.equal(secondDragonContact.combat.threatDragonId, 'dragon-1');
  assert.equal(/dragon/i.test(secondDragonContact.camera.collisionMesh), false,
    'a nearby dragon must not collapse the third-person camera boom');

  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.teleportNearDragon(0, 1.8); true');
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().combat.damageTaken > 0', 5000);
  const dragonZeroContact = await snapshot();
  assert.equal(dragonZeroContact.dragons[0].aggressive, true);
  assert.equal(dragonZeroContact.combat.threatDragonId, 'dragon-0');

  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); true');
  const oneRune = await teleportToRune(0);
  assert.equal(oneRune.world.doors.first.state, 'LOCKED');
  const twoRunes = await teleportToRune(1);
  assert.notEqual(twoRunes.world.doors.first.state, 'LOCKED');
  await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.doors.first.state === 'OPEN'");
  const firstDoorOpen = await snapshot();
  assert.equal(firstDoorOpen.world.doors.final.state, 'LOCKED');

  const threeRunes = await teleportToRune(2);
  assert.equal(threeRunes.world.doors.final.state, 'LOCKED');
  await teleportToRune(3);
  await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.doors.final.state === 'OPEN'");
  const finalDoorOpen = await snapshot();
  assert.equal(finalDoorOpen.inventory.runes, 4);
  assert.equal(finalDoorOpen.world.gate.runes, 4);

  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.teleport(0, 0, 25.82); true');
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.exit.active');
  const enteringMoonDoor = await snapshot();
  assert.ok(enteringMoonDoor.world.exit.witchVisible < 1);
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.complete');
  const completed = await snapshot();
  assert.equal(completed.world.exit.witchVisible, 0);
  assert.equal(completed.witch.visibility, 0);
  assert.equal(completed.active, false);

  await delay(250);
  assert.deepEqual(cdp.errors, []);
  console.log(JSON.stringify({
    passed: true,
    seed: initial.world.seed,
    dimensions: initial.world.dimensions,
    featureCounts: initial.world.featureCounts,
    dragonPopulation: {
      total: initial.dragons.length,
      aggressive: initial.dragons.filter(dragon => dragon.aggressive).length,
      secondDragonDamageTaken: secondDragonContact.combat.damageTaken,
      dragonZeroDamageTaken: dragonZeroContact.combat.damageTaken
    },
    doors: completed.world.doors,
    exit: completed.world.exit
  }, null, 2));
} finally {
  cdp.close();
}
