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

const witches = [
  { id: 'purple', selectedSpell: 'frost', snapshotPath: 'combat.selectedSpell' },
  { id: 'green', selectedSpell: 'restore', snapshotPath: 'greenWitch.abilities.selectedSpell' },
  { id: 'frost', selectedSpell: 'iceLance', snapshotPath: 'combat.selectedSpell' },
  { id: 'fire', selectedSpell: 'fireRing', snapshotPath: 'combat.selectedSpell' }
];
const results = [];

try {
  for (const witch of witches) {
    await navigateToProof(cdp, gameUrl, {
      route: 'chapter1',
      params: {
        mazeSeed: `chapter-one-recovery-identity-${witch.id}`,
        character: witch.id,
        recoveryIdentitySmoke: Date.now()
      }
    });
    await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
    await waitFor("typeof window.__HMW_THIRD_PERSON_PROOF__?.start === 'function'");
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.start(${JSON.stringify(witch.id)})`);
    await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.localCharacter === ${JSON.stringify(witch.id)}`);
    assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.selectSpell(${JSON.stringify(witch.selectedSpell)})`), witch.selectedSpell);

    const before = await snapshot();
    assert.equal(before.characterSelection.localCharacter, witch.id);
    assert.equal(witch.snapshotPath.split('.').reduce((value, key) => value[key], before), witch.selectedSpell);
    const source = before.dragons.find(dragon => dragon.alive && dragon.aggressive);
    assert.ok(source, `${witch.id} recovery needs a living aggressive dragon`);
    assert.equal(await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.receiveDragonDamage(100, ${JSON.stringify(source.id)})`), true);
    await waitFor('!window.__HMW_THIRD_PERSON_PROOF__.snapshot().recovery.pending');
    const after = await snapshot();
    assert.equal(after.characterSelection.localCharacter, witch.id);
    assert.equal(witch.snapshotPath.split('.').reduce((value, key) => value[key], after), witch.selectedSpell);
    assert.equal(after.combat.playerHealth, after.combat.playerMaximumHealth);
    assert.equal(after.recovery.lastResetKind, 'ORDINARY_RESPAWN');
    results.push({ witch: witch.id, selectedSpell: witch.selectedSpell, respawnCount: after.recovery.respawnCount });
  }

  assert.deepEqual(cdp.errors, []);
  console.log(JSON.stringify({ passed: true, cases: results, errors: cdp.errors }, null, 2));
} finally {
  cdp.close();
}
