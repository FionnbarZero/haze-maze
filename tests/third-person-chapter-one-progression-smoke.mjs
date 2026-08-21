import assert from 'node:assert/strict';
import { navigateToProof } from './third-person-smoke-navigation.mjs';

const debugEndpoint = process.env.HMW_CDP_ENDPOINT || 'http://127.0.0.1:9231';
const gameUrl = process.env.HMW_GAME_URL || 'http://127.0.0.1:8768/third-person.html?quality=low';

const pages = await fetch(`${debugEndpoint}/json/list`).then(response => response.json());
const expectedUrl = new URL(gameUrl);
const target = pages.find(page => {
  if (page.type !== 'page') return false;
  try {
    const pageUrl = new URL(page.url);
    return pageUrl.origin === expectedUrl.origin && pageUrl.pathname === expectedUrl.pathname;
  } catch {
    return false;
  }
});
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
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

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
const blockedCastExpression = characterId => ({
  purple: 'window.__HMW_THIRD_PERSON_PROOF__.castLightning()',
  green: 'window.__HMW_THIRD_PERSON_PROOF__.castGreenVine()',
  frost: 'window.__HMW_THIRD_PERSON_PROOF__.castIceLance()',
  fire: 'window.__HMW_THIRD_PERSON_PROOF__.castFireball()'
}[characterId]);

// Match the Chapter 1 level validator so browser navigation honours the same
// floor clearance that proves the required sockets are reachable.
const GRID_STEP = .4;
const PLAYER_CLEARANCE = .42;
const MAX_ROUTE_REPLANS = 8;
const keyFor = (x, z) => `${x}:${z}`;

function navigationPath(state, target) {
  const minimumX = -state.world.dimensions.width / 2 + .7;
  const maximumX = state.world.dimensions.width / 2 - .7;
  const minimumZ = -state.world.dimensions.depth / 2 + .7;
  const maximumZ = state.world.dimensions.depth / 2 - .7;
  const columns = Math.floor((maximumX - minimumX) / GRID_STEP) + 1;
  const rows = Math.floor((maximumZ - minimumZ) / GRID_STEP) + 1;
  const pointFor = (x, z) => ({ x: minimumX + x * GRID_STEP, z: minimumZ + z * GRID_STEP });
  const blocked = (x, z) => {
    const point = pointFor(x, z);
    if (state.navigation.colliders.some(collider => collider.max.y > .01
      && collider.min.y < 1.75
      && point.x >= collider.min.x - PLAYER_CLEARANCE
      && point.x <= collider.max.x + PLAYER_CLEARANCE
      && point.z >= collider.min.z - PLAYER_CLEARANCE
      && point.z <= collider.max.z + PLAYER_CLEARANCE)) return true;
    return state.dragons.some(dragon => dragon.alive
      && Math.hypot(point.x - dragon.position.x, point.z - dragon.position.z)
        < dragon.collisionRadius + PLAYER_CLEARANCE + .35);
  };
  const nearestFree = position => {
    const centerX = Math.round((position.x - minimumX) / GRID_STEP);
    const centerZ = Math.round((position.z - minimumZ) / GRID_STEP);
    let best = null;
    for (let radius = 0; radius <= 8 && !best; radius += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
          if (x < 0 || z < 0 || x >= columns || z >= rows || blocked(x, z)) continue;
          const point = pointFor(x, z);
          const distance = Math.hypot(point.x - position.x, point.z - position.z);
          if (!best || distance < best.distance) best = { x, z, distance };
        }
      }
    }
    if (!best) throw new Error(`No walkable grid point near ${position.x}, ${position.z}`);
    return best;
  };

  const start = nearestFree(state.player);
  const goal = nearestFree(target);
  const queue = [start];
  const visited = new Set([keyFor(start.x, start.z)]);
  const previous = new Map();
  let cursor = 0;
  while (cursor < queue.length && !visited.has(keyFor(goal.x, goal.z))) {
    const current = queue[cursor++];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx;
      const z = current.z + dz;
      const key = keyFor(x, z);
      if (x < 0 || z < 0 || x >= columns || z >= rows || visited.has(key) || blocked(x, z)) continue;
      visited.add(key);
      previous.set(key, current);
      queue.push({ x, z });
    }
  }
  if (!visited.has(keyFor(goal.x, goal.z))) {
    throw new Error(`No normal walking route to ${target.x}, ${target.z}`);
  }

  const gridPath = [goal];
  while (gridPath.at(-1).x !== start.x || gridPath.at(-1).z !== start.z) {
    gridPath.push(previous.get(keyFor(gridPath.at(-1).x, gridPath.at(-1).z)));
  }
  gridPath.reverse();
  return gridPath.map(point => pointFor(point.x, point.z));
}

const walkDiagnostics = (state, target, waypoint, samples, replans, loadedUrl) => ({
  loadedUrl,
  player: state.player,
  input: state.input,
  camera: state.camera,
  combat: {
    playerHealth: state.combat.playerHealth,
    playerDefeated: state.combat.playerDefeated,
    threatDragonId: state.combat.threatDragonId,
    targetDragonId: state.combat.targetDragonId
  },
  target,
  waypoint,
  replans,
  route: state.world.route,
  chapter: state.chapter,
  performance: {
    sampleCount: state.performance.sampleCount,
    averageFps: state.performance.averageFps,
    averageFrameTimeMs: state.performance.averageFrameTimeMs,
    p95FrameTimeMs: state.performance.p95FrameTimeMs,
    frameSpikesOver50Ms: state.performance.frameSpikesOver50Ms
  },
  nearbyDragons: state.dragons.map(dragon => ({
    id: dragon.id,
    state: dragon.state,
    alive: dragon.alive,
    distance: Math.hypot(dragon.position.x - state.player.x, dragon.position.z - state.player.z),
    position: dragon.position
  })).filter(dragon => dragon.distance < 6),
  samples
});

async function walkWaypoint(target, waypoint, label, replans) {
  const initial = await snapshot();
  const frameTime = Math.max(80, Math.min(600, initial.performance.averageFrameTimeMs || 120));
  const pollMilliseconds = Math.max(90, Math.min(350, Math.round(frameTime * .75)));
  const stalledAfterMilliseconds = Math.max(2200, Math.round(frameTime * 14));
  let bestDistance = Infinity;
  let lastProgressAt = Date.now();
  const samples = [];

  while (true) {
    const state = await snapshot();
    const position = state.player;
    const distance = Math.hypot(waypoint.x - position.x, waypoint.z - position.z);
    samples.push({
      elapsedMilliseconds: Date.now() - lastProgressAt,
      x: position.x,
      z: position.z,
      distance,
      speed: position.speed,
      state: position.state,
      collision: position.collision,
      input: { active: state.active, blocked: state.input.blocked, movement: state.input.movement },
      playerHealth: state.combat.playerHealth,
      playerDefeated: state.combat.playerDefeated
    });
    if (samples.length > 16) samples.shift();

    if (!state.active || state.input.blocked || state.combat.playerDefeated) {
      await evaluate('window.__HMW_THIRD_PERSON_PROOF__.stopMovement(); true');
      const diagnostics = walkDiagnostics(
        state, target, waypoint, samples, replans, await evaluate('location.href')
      );
      throw new Error(`${label} normal movement became unavailable: ${JSON.stringify(diagnostics)}`);
    }
    if (distance <= .27) return;
    if (distance < bestDistance - .04) {
      bestDistance = distance;
      lastProgressAt = Date.now();
    }
    if (Date.now() - lastProgressAt > stalledAfterMilliseconds) {
      await evaluate('window.__HMW_THIRD_PERSON_PROOF__.stopMovement(); true');
      const diagnostics = walkDiagnostics(
        state, target, waypoint, samples, replans, await evaluate('location.href')
      );
      throw new Error(`${label} waypoint made no progress: ${JSON.stringify(diagnostics)}`);
    }
    const yaw = Math.atan2(waypoint.x - position.x, waypoint.z - position.z);
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.setLook(${yaw}, 0); window.__HMW_THIRD_PERSON_PROOF__.setMovement(0, 1); true`);
    await delay(pollMilliseconds);
  }
}

async function walkNormalRouteTo(target, label) {
  let lastFailure = null;
  for (let replans = 0; replans <= MAX_ROUTE_REPLANS; replans += 1) {
    const state = await snapshot();
    const waypoints = navigationPath(state, target);
    try {
      for (const waypoint of waypoints.slice(1)) await walkWaypoint(target, waypoint, label, replans);
      await evaluate('window.__HMW_THIRD_PERSON_PROOF__.stopMovement(); true');
      const finalPosition = await evaluate('window.__HMW_THIRD_PERSON_PROOF__.playerPosition()');
      assert.ok(Math.hypot(target.x - finalPosition.x, target.z - finalPosition.z) <= 1.05,
        `${label} should be reached through normal movement`);
      return;
    } catch (error) {
      lastFailure = error;
      if (/normal movement became unavailable/.test(error.message)) throw error;
    }
  }
  throw new Error(`${label} exhausted ${MAX_ROUTE_REPLANS} bounded replans: ${lastFailure?.message}`);
}

const results = [];
try {
  for (const characterId of ['purple']) {
    await cdp.send('Page.bringToFront');
    await navigateToProof(cdp, gameUrl, {
      route: 'chapter1',
      params: {
        mazeSeed: `chapter-one-browser-${characterId}`,
        character: characterId,
        smoke: Date.now()
      }
    });
    await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.start('${characterId}'); true`);
    await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.localCharacter === '${characterId}'`);
    const initial = await snapshot();
    assert.equal(initial.world.routeMode, 'chapter1');
    assert.equal(initial.levelPlan.validation.valid, true);
    assert.equal(initial.levelPlan.requiredGeodes.length, 3);
    assert.equal(initial.inventory.equipment.tools.pick.ownerId, characterId);
    assert.equal(initial.inventory.equipment.tools.hammer.ownerId, characterId);
    assert.equal(initial.inventory.equipment.canCast, true);
    assert.equal(initial.inventory.equipment.canMine, false);
    assert.equal(initial.world.doors.first.state, 'LOCKED');
    assert.ok(initial.inventory.geodeRocks.filter(geode => geode.required)
      .every(geode => geode.visual.discoveryMarkerEnabled),
    'every required geode should have a visible discovery marker before mining');
    assert.ok(initial.inventory.geodeRocks.filter(geode => !geode.required)
      .every(geode => !geode.visual.discoveryMarkerEnabled),
    'optional geodes should not impersonate required route markers');

    await evaluate("window.__HMW_THIRD_PERSON_PROOF__.setEquipmentMode('mining-tools'); true");
    const miningMode = await snapshot();
    assert.equal(miningMode.inventory.equipment.canCast, false);
    assert.equal(miningMode.inventory.equipment.canMine, true);
    assert.equal(miningMode.witch.heldItem, 'miningTools');
    assert.equal(miningMode.combat.spellcastingEnabled, false);
    assert.equal(miningMode.combat.spellcastingDisabledReason, 'mining-tools');
    if (characterId === 'green') assert.equal(miningMode.greenWitch.abilities.spellcastingEnabled, false);
    const blockedCast = await evaluate(blockedCastExpression(characterId));
    assert.equal(blockedCast, false, `${characterId} spellcasting must be blocked in Mining Tools mode`);

    let collectedFragments = 0;
    for (const geode of initial.levelPlan.requiredGeodes) {
      await walkNormalRouteTo(geode.position, geode.id);
      const discovered = (await snapshot()).inventory.geodeRocks.find(entry => entry.id === geode.id);
      assert.equal(discovered.visual.discoveryMarkerEnabled, true);
      for (let strike = 0; strike < geode.strikesRequired; strike += 1) {
        const accepted = await evaluate('window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()');
        assert.equal(accepted, true, `${characterId} strike ${strike + 1} should be accepted for ${geode.id}`);
        if (strike === 0) {
          const message = await evaluate("document.querySelector('#toast').textContent.trim()");
          assert.equal(message, 'Geode struck · bright cracks spread through the stone');
          assert.equal(/\d/.test(message), false, 'mining feedback should not reveal numeric hit counts');
        }
      }
      const broken = await snapshot();
      const brokenRock = broken.inventory.geodeRocks.find(entry => entry.id === geode.id);
      assert.equal(brokenRock.visual.discoveryMarkerEnabled, false);
      assert.equal(brokenRock.reward.available, true);
      assert.equal(brokenRock.reward.visualEnabled, true);
      assert.equal(broken.chapter.routeRune.fragmentCount, collectedFragments,
        'breaking a geode must not award progression before pickup');
      await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.geodeRocks.find(geode => geode.id === '${geode.id}').reward.collected`);
      collectedFragments += 1;
      assert.equal((await snapshot()).chapter.routeRune.fragmentCount, collectedFragments);
    }

    const optionalGeode = initial.levelPlan.optionalGeodes[0];
    await walkNormalRouteTo(optionalGeode.position, optionalGeode.id);
    for (let strike = 0; strike < optionalGeode.strikesRequired; strike += 1) {
      assert.equal(await evaluate('window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()'), true);
    }
    const optionalBroken = await snapshot();
    const optionalRock = optionalBroken.inventory.geodeRocks.find(entry => entry.id === optionalGeode.id);
    assert.equal(optionalRock.reward.available, true);
    assert.equal(optionalBroken.inventory.rawDamageCrystals, 0,
      'breaking an optional geode must not award its crystal before pickup');
    await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.geodeRocks.find(geode => geode.id === '${optionalGeode.id}').reward.collected`);

    await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.doors.first.state === 'OPEN'");
    const completed = await snapshot();
    assert.equal(completed.chapter.routeRune.fragmentCount, 3);
    assert.equal(completed.chapter.routeRune.completed, true);
    assert.equal(completed.chapter.completedRunes.includes('route-rune-west'), true);
    assert.equal(completed.chapter.keeperClues.length, 3);
    assert.equal(completed.chapter.sunkenGate.opened, true);
    assert.equal(completed.chapter.completion.chapterComplete, false);
    assert.equal(completed.world.gate.requiredRuneId, 'route-rune-west');
    assert.equal(completed.world.gate.runeCompleted, true);
    assert.equal(completed.world.chapterComplete, false);
    assert.equal(completed.world.complete, false);
    assert.equal(completed.world.doors.final.state, 'LOCKED');
    assert.equal(completed.inventory.rawDamageCrystals, 1);
    assert.equal(completed.combat.powerups.damageCrystalCount, 1);
    assert.equal(completed.combat.powerups.damageCrystalMultiplier, 1.1);
    assert.ok(completed.inventory.geodeRocks.filter(geode => geode.required)
      .every(geode => !geode.visual.stoneEnabled && geode.visual.revealedCrystals > 0));
    const keeperClues = await evaluate(`Array.from(document.querySelectorAll('#keeper-clue-list li')).map(item => item.textContent.trim())`);
    assert.equal(keeperClues.length, 3);
    for (const clue of completed.chapter.keeperClues) {
      assert.ok(keeperClues.some(copy => copy.includes(clue.title) && copy.includes(clue.text)));
    }

    assert.equal(await evaluate("window.__HMW_THIRD_PERSON_PROOF__.setEquipmentMode('staff')"), true);
    const staffMode = await snapshot();
    assert.equal(staffMode.inventory.equipment.canCast, true);
    if (characterId === 'green') assert.equal(staffMode.greenWitch.abilities.spellcastingEnabled, true);
    else assert.equal(staffMode.combat.spellcastingEnabled, true);
    results.push({
      characterId,
      seed: completed.world.seed,
      strikes: completed.inventory.geodeRocks.filter(geode => geode.required)
        .map(geode => geode.strikesRequired),
      clues: completed.chapter.keeperClues.map(clue => clue.id),
      gate: completed.world.doors.first.state,
      movementOnly: true,
      rewardsCollected: completed.inventory.geodeRocks.filter(geode => geode.reward?.collected).length
    });
  }

  await delay(250);
  assert.deepEqual(cdp.errors, []);
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  cdp.close();
}
