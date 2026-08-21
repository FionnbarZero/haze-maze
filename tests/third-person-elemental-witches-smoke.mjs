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
await navigateToProof(cdp, gameUrl, {
  route: 'legacy',
  params: { mazeSeed: LEGACY_SMOKE_SEED, elementalTest: Date.now() }
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
const aimAtDragon = async () => {
  for (let pass = 0; pass < 7; pass += 1) {
    const state = await snapshot();
    const [targetX, targetY, targetZ] = state.dragon.aimPoint;
    const camera = state.camera.position;
    const deltaX = targetX - camera.x;
    const deltaY = targetY - camera.y;
    const deltaZ = targetZ - camera.z;
    const distance = Math.hypot(deltaX, deltaY, deltaZ);
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.setLook(${Math.atan2(deltaX, deltaZ)}, ${Math.asin(deltaY / distance)}); true`);
    await delay(180);
  }
};
const resetAt = async (x, z) => {
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.teleport(${x}, 0, ${z}); true`);
  await delay(250);
};

await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.showCharacterSelection(); true');
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().opening.step === 'SELECTION'");
const selectionCards = await evaluate(`[...document.querySelectorAll('[data-character]')].map(card => ({
  id: card.dataset.character,
  title: card.querySelector('strong')?.textContent,
  copy: card.textContent.replace(/\\s+/g, ' ').trim()
}))`);

await evaluate("window.__HMW_THIRD_PERSON_PROOF__.selectCharacter('frost'); true");
const frostSelected = await snapshot();
const frostConfirm = await evaluate(`({
  text: document.querySelector('#confirm-witch').textContent,
  selected: document.querySelector('.witch-card.is-selected')?.dataset.character
})`);
if (process.env.HMW_SCREENSHOT_PATH) {
  await delay(500);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(process.env.HMW_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
}
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.confirmCharacterSelection(); true');
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.localCharacter === 'frost'");
const frostStarted = await snapshot();
const frostHud = await evaluate(`({
  character: document.querySelector('#player-character-name').textContent,
  spell: document.querySelector('#selected-spell-name').textContent,
  status: document.querySelector('#aegis-status').textContent,
  rack: [...document.querySelectorAll('.spell-rack button:not([disabled])')].map(button => button.dataset.spell)
})`);

await resetAt(0, 6.2);
await aimAtDragon();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castFreeze(); true');
await delay(220);
const freezeCast = await snapshot();

await resetAt(0, 6.2);
await aimAtDragon();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castIceLance(); true');
await delay(220);
const iceLanceCast = await snapshot();

await evaluate("window.__HMW_THIRD_PERSON_PROOF__.start('fire'); window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); true");
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.localCharacter === 'fire'");
const fireStarted = await snapshot();
const fireHud = await evaluate(`({
  character: document.querySelector('#player-character-name').textContent,
  spell: document.querySelector('#selected-spell-name').textContent,
  status: document.querySelector('#aegis-status').textContent,
  rack: [...document.querySelectorAll('.spell-rack button:not([disabled])')].map(button => button.dataset.spell)
})`);

await resetAt(0, 6.2);
await aimAtDragon();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castFireball(); true');
await delay(220);
const fireballCast = await snapshot();

await resetAt(0, 7.35);
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castFireRing(); window.__HMW_THIRD_PERSON_PROOF__.receiveDragonDamage(99); true');
await delay(280);
const fireRingCast = await snapshot();
const fireRingHud = await evaluate(`({
  spell: document.querySelector('#selected-spell-name').textContent,
  protection: document.querySelector('#aegis-status').textContent,
  fireTheme: document.querySelector('#player-vitals').classList.contains('is-fire')
})`);

const cardIds = selectionCards.map(card => card.id);
const dragonDistance = Math.hypot(
  fireRingCast.dragon.aimPoint[0] - fireRingCast.player.x,
  fireRingCast.dragon.aimPoint[2] - fireRingCast.player.z
);
const checks = {
  fourPlayableCardsShown: ['purple', 'green', 'frost', 'fire'].every(id => cardIds.includes(id)) && cardIds.length === 4,
  frostCardExplainsPowers: selectionCards.find(card => card.id === 'frost')?.copy.includes('Freeze')
    && selectionCards.find(card => card.id === 'frost')?.copy.includes('Ice Lance'),
  fireCardExplainsPowers: selectionCards.find(card => card.id === 'fire')?.copy.includes('Fireball')
    && selectionCards.find(card => card.id === 'fire')?.copy.includes('Fire Ring'),
  frostSelectionRequiresConfirmation: frostSelected.opening.awaitingConfirmation
    && frostSelected.characterSelection.localCharacter === null
    && frostConfirm.selected === 'frost'
    && frostConfirm.text === 'Enter Moonhollow as the Frost Witch',
  frostWitchStartsSolo: frostStarted.characterSelection.localCharacter === 'frost'
    && frostStarted.characterSelection.remoteCharacter === null
    && frostStarted.witch.label === 'Frost Witch'
    && frostStarted.frostWitch.presentation.visibility === 1
    && frostStarted.purpleWitch.presentation.visibility === 0,
  frostHudAndLoadout: frostHud.character === 'Frost Witch'
    && frostHud.spell === 'Freeze'
    && frostHud.status === 'Ice magic ready'
    && frostHud.rack.join(',') === 'freeze,iceLance',
  freezeStopsWithoutDamage: freezeCast.dragon.frozen
    && freezeCast.dragon.health === freezeCast.dragon.maximumHealth
    && freezeCast.combat.lastCast?.spell === 'freeze',
  iceLanceCausesDamage: iceLanceCast.dragon.health === 70
    && iceLanceCast.combat.lastCast?.spell === 'iceLance'
    && iceLanceCast.combat.lastCast?.damage === 30,
  fireWitchStartsSolo: fireStarted.characterSelection.localCharacter === 'fire'
    && fireStarted.characterSelection.remoteCharacter === null
    && fireStarted.witch.label === 'Fire Witch'
    && fireStarted.fireWitch.presentation.visibility === 1
    && fireStarted.greenWitch.presentation.visibility === 0,
  fireHudAndLoadout: fireHud.character === 'Fire Witch'
    && fireHud.spell === 'Fireball'
    && fireHud.status === 'Fire Ring ready'
    && fireHud.rack.join(',') === 'fireball,fireRing',
  fireballCausesDamage: fireballCast.dragon.health === 72
    && fireballCast.combat.lastCast?.spell === 'fireball'
    && fireballCast.combat.lastCast?.damage === 28,
  fireRingBlocksDamage: fireRingCast.combat.fireRing.active
    && fireRingCast.combat.fireRing.visible
    && fireRingCast.combat.fireRing.absorbedHits >= 1
    && fireRingCast.combat.playerHealth === fireRingCast.combat.playerMaximumHealth,
  fireRingBlocksCreaturePassage: fireRingCast.combat.fireRing.repelledCreatures >= 1
    && dragonDistance >= fireRingCast.combat.fireRing.radius + 1,
  fireRingFeedbackVisible: fireRingHud.protection.startsWith('Fire Ring active') && fireRingHud.fireTheme,
  noRuntimeErrors: cdp.errors.length === 0
};

console.log(JSON.stringify({
  checks,
  evidence: {
    selectionCards,
    frost: { selected: frostSelected.opening, confirm: frostConfirm, started: frostStarted.characterSelection, hud: frostHud, freeze: freezeCast.combat, iceLance: iceLanceCast.combat },
    fire: { started: fireStarted.characterSelection, hud: fireHud, fireball: fireballCast.combat, fireRing: fireRingCast.combat, dragonDistance, fireRingHud },
    errors: cdp.errors
  }
}, null, 2));

const failed = Object.values(checks).some(value => !value);
cdp.close();
await delay(50);
process.exit(failed ? 1 : 0);
