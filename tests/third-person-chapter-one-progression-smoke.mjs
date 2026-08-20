import assert from 'node:assert/strict';

const debugEndpoint = process.env.HMW_CDP_ENDPOINT || 'http://127.0.0.1:9231';
const gameUrl = process.env.HMW_GAME_URL || 'http://127.0.0.1:8768/third-person.html?quality=low';

const pages = await fetch(`${debugEndpoint}/json/list`).then(response => response.json());
const expectedOrigin = new URL(gameUrl).origin;
const target = pages.find(page => (
  page.type === 'page'
    && page.url.startsWith(expectedOrigin)
    && page.url.includes('third-person')
));
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

const results = [];
try {
  for (const characterId of ['purple', 'green', 'frost', 'fire']) {
    await cdp.send('Page.bringToFront');
    await cdp.send('Page.navigate', {
      url: `${gameUrl}${gameUrl.includes('?') ? '&' : '?'}mazeSeed=chapter-one-browser-${characterId}&character=${characterId}&smoke=${Date.now()}`
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

    for (const [geodeIndex, geode] of initial.levelPlan.requiredGeodes.entries()) {
      await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${geode.position.x}, 0, ${geode.position.z}); true`);
      await delay(80);
      let startingStrike = 0;
      if (geodeIndex === 0) {
        await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', bubbles: true })); true");
        await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.geodeRocks.find(geode => geode.id === '${geode.id}').strikes === 1`);
        const visibleProgress = (await snapshot()).inventory.geodeRocks.find(entry => entry.id === geode.id);
        assert.ok(visibleProgress.visual.stoneScale.y < .72);
        assert.equal(visibleProgress.visual.revealedCrystals, 0);
        startingStrike = 1;
      }
      for (let strike = startingStrike; strike < geode.strikesRequired; strike += 1) {
        const accepted = await evaluate('window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()');
        assert.equal(accepted, true, `${characterId} strike ${strike + 1} should be accepted for ${geode.id}`);
      }
    }

    const optionalGeode = initial.levelPlan.optionalGeodes[0];
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${optionalGeode.position.x}, 0, ${optionalGeode.position.z}); true`);
    await delay(80);
    for (let strike = 0; strike < optionalGeode.strikesRequired; strike += 1) {
      assert.equal(await evaluate('window.__HMW_THIRD_PERSON_PROOF__.strikeNearbyGeode()'), true);
    }

    await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.doors.first.state === 'OPEN'");
    const completed = await snapshot();
    assert.equal(completed.chapter.routeRune.fragmentCount, 3);
    assert.equal(completed.chapter.routeRune.completed, true);
    assert.equal(completed.chapter.completedRunes.includes('route-rune-west'), true);
    assert.equal(completed.chapter.keeperClues.length, 3);
    assert.equal(completed.chapter.sunkenGate.opened, true);
    assert.equal(completed.world.gate.requiredRuneId, 'route-rune-west');
    assert.equal(completed.world.gate.runeCompleted, true);
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
      gate: completed.world.doors.first.state
    });
  }

  await delay(250);
  assert.deepEqual(cdp.errors, []);
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  cdp.close();
}
