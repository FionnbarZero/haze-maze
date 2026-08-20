const debugEndpoint = process.env.HMW_CDP_ENDPOINT || 'http://127.0.0.1:9223';
const gameUrl = process.env.HMW_GAME_URL || 'http://127.0.0.1:8766/third-person.html?quality=low&party=simulated';

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
      }, 60000);
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
await cdp.send('Emulation.clearDeviceMetricsOverride');
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
await cdp.send('Page.navigate', { url: gameUrl });

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

await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.start(); true');
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.replica.snapshotsReceived >= 2');
const initial = await snapshot();
const initialUi = await evaluate(`({
  partyVisible: getComputedStyle(document.querySelector('#green-witch-party')).display !== 'none',
  health: document.querySelector('#green-witch-health-copy').textContent,
  status: document.querySelector('#green-witch-status').textContent,
  restoreTarget: document.querySelector('#green-restore-target').textContent,
  buttons: [...document.querySelectorAll('.party-actions button')].map(button => button.textContent.trim())
})`);

await evaluate(`(() => {
  const proof = window.__HMW_THIRD_PERSON_PROOF__;
  const state = proof.snapshot().greenWitch.replica;
  proof.setGreenSimulationEnabled(false);
  proof.receiveGreenSnapshot({
    sequence: state.latestSequence + 100,
    position: { x: state.position.x + 3, y: state.position.y, z: state.position.z + 1 },
    facingYaw: 1.2,
    speed: 3,
    grounded: true,
    crouched: false,
    state: 'WALK'
  });
  return true;
})()`);
await delay(35);
const interpolationEarly = await snapshot();
await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.replica.interpolationError < ${interpolationEarly.greenWitch.replica.interpolationError * .75}`);
const interpolationSettled = await snapshot();

await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.setGreenSimulationEnabled(true); window.__HMW_THIRD_PERSON_PROOF__.teleport(0, 0, 5.5); true');
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.abilities.dragonInRange');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castGreenVine(); true');
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.abilities.bindingCount === 3');
const vine = await snapshot();
const vineUi = await evaluate(`({
  status: document.querySelector('#green-witch-status').textContent,
  vineDisabled: document.querySelector('#green-vine-demo').disabled
})`);
if (process.env.HMW_SCREENSHOT_PATH) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(process.env.HMW_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
}

await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.damageGreenWitch(40); window.__HMW_THIRD_PERSON_PROOF__.setGreenRestoreFriendTargeted(false); window.__HMW_THIRD_PERSON_PROOF__.castGreenRestore("self"); true');
await delay(100);
const selfRestore = await snapshot();

await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.receiveDragonDamage(40); window.__HMW_THIRD_PERSON_PROOF__.setGreenRestoreFriendTargeted(true); window.__HMW_THIRD_PERSON_PROOF__.castGreenRestore("friend"); true');
await delay(100);
const friendRestore = await snapshot();
const friendRestoreUi = await evaluate(`({
  target: document.querySelector('#green-restore-target').textContent,
  playerHealth: document.querySelector('#player-health-copy').textContent,
  greenHealth: document.querySelector('#green-witch-health-copy').textContent
})`);

await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.receiveDragonDamage(40); window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyH', key: 'h' })); true`);
await delay(100);
const smartRestore = await snapshot();

const earlyReplica = interpolationEarly.greenWitch.replica;
const settledReplica = interpolationSettled.greenWitch.replica;
const abilities = initial.greenWitch.abilities;
const vineCast = vine.greenWitch.abilities.lastCast;
const vineTarget = vine.dragons.find(dragon => dragon.id === vine.greenWitch.abilities.targetDragonId);
const checks = {
  remoteReplicaPresent: initial.greenWitch.replica.kind === 'REMOTE_REPLICA'
    && initial.greenWitch.replica.source === 'SIMULATED_LAN_SNAPSHOTS',
  simulatedSnapshotsArrive: initial.greenWitch.replica.snapshotsReceived >= 2
    && initial.greenWitch.simulation.enabled,
  distinctGreenPresentation: initial.greenWitch.presentation.label === 'Green Witch'
    && initial.greenWitch.presentation.nameplateVisible,
  twoUnlockedSpellTemplates: Object.keys(abilities.spells).length === 2
    && abilities.spells.vineTrap.unlocked
    && abilities.spells.restore.unlocked,
  partyHudVisible: initialUi.partyVisible
    && initialUi.health === '100 / 100'
    && initialUi.buttons.length === 2,
  remoteSnapshotInterpolated: earlyReplica.interpolationError > settledReplica.interpolationError
    && earlyReplica.position.x !== earlyReplica.targetPosition.x
    && settledReplica.interpolationError < earlyReplica.interpolationError * .75,
  vineTrapUsesBothArms: vineCast?.spell === 'vineTrap'
    && vineCast.originCount === 2
    && vineCast.origins.left.join(',') !== vineCast.origins.right.join(','),
  vineTrapRestrainsDragon: vineTarget?.restrained
    && vineTarget.state === 'VINEBOUND'
    && vine.greenWitch.abilities.bindingCount === 3
    && vine.greenWitch.abilities.activeVineStreams === 2,
  vineFeedbackVisible: vineUi.status.startsWith('Dragon vinebound') && vineUi.vineDisabled,
  restoreSelfMode: selfRestore.greenWitch.abilities.health === 90
    && selfRestore.combat.playerHealth === 100
    && selfRestore.greenWitch.abilities.lastCast?.targetMode === 'SELF'
    && selfRestore.greenWitch.abilities.lastCast?.restored === 30,
  restoreFriendMode: friendRestore.combat.playerHealth === 90
    && friendRestore.greenWitch.abilities.health === 100
    && friendRestore.greenWitch.abilities.lastCast?.targetMode === 'FRIEND'
    && friendRestore.greenWitch.abilities.lastCast?.restored === 30,
  restorePreviewDifferentiatesTarget: friendRestoreUi.target === 'Restore target · Purple Witch'
    && friendRestoreUi.playerHealth === '90 / 100'
    && friendRestoreUi.greenHealth === '100 / 100',
  smartRestoreChoosesWoundedFriend: smartRestore.combat.playerHealth === 90
    && smartRestore.greenWitch.abilities.lastCast?.targetMode === 'FRIEND',
  noRuntimeErrors: cdp.errors.length === 0
};

console.log(JSON.stringify({
  checks,
  evidence: {
    initial: initial.greenWitch,
    initialUi,
    interpolation: { early: earlyReplica, settled: settledReplica },
    vine: { dragon: vineTarget, abilities: vine.greenWitch.abilities, ui: vineUi },
    selfRestore: { combat: selfRestore.combat, green: selfRestore.greenWitch.abilities },
    friendRestore: { combat: friendRestore.combat, green: friendRestore.greenWitch.abilities, ui: friendRestoreUi },
    smartRestore: { combat: smartRestore.combat, green: smartRestore.greenWitch.abilities },
    errors: cdp.errors
  }
}, null, 2));

const failed = Object.values(checks).some(value => !value);
cdp.close();
await delay(50);
process.exit(failed ? 1 : 0);
