const debugEndpoint = process.env.HMW_CDP_ENDPOINT || 'http://127.0.0.1:9223';
const gameUrl = process.env.HMW_GAME_URL || 'http://127.0.0.1:8766/third-person.html?quality=low&narration=instant';

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
await cdp.send('Emulation.clearDeviceMetricsOverride');
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });

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
const navigate = async () => {
  await cdp.send('Page.navigate', { url: `${gameUrl}${gameUrl.includes('?') ? '&' : '?'}openingTest=${Date.now()}` });
  await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
  await waitFor("document.querySelector('#loading')?.classList.contains('is-hidden')");
  await delay(500);
};
const click = async selector => {
  const point = await evaluate(`(() => {
    const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
};
const press = async ({ key, code, keyCode }) => {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
};

await navigate();
const briefing = await evaluate(`({
  speaker: document.querySelector('#coven-briefing h1').textContent.replace(/\\s+/g, ' ').trim(),
  tagline: document.querySelector('#briefing-subtitle').textContent.trim(),
  paragraphs: [...document.querySelectorAll('.briefing-transcript p')].map(paragraph => paragraph.textContent.trim()),
  buttonText: document.querySelector('#briefing-continue').textContent.trim(),
  soundStatus: document.querySelector('#briefing-sound-status').textContent.trim(),
  snapshot: window.__HMW_THIRD_PERSON_PROOF__.snapshot(),
  selectionVisible: document.querySelector('#witch-selection').classList.contains('is-current')
})`);
if (process.env.HMW_BRIEFING_SCREENSHOT_PATH) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(process.env.HMW_BRIEFING_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
}

await click('#briefing-continue');
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().opening.step === 'SELECTION'");
const narrationComplete = await snapshot();
await click('[data-character="green"]');
const greenSelected = await evaluate(`({
  snapshot: window.__HMW_THIRD_PERSON_PROOF__.snapshot(),
  overlayVisible: !document.querySelector('#start-overlay').classList.contains('is-hidden'),
  confirmText: document.querySelector('#confirm-witch').textContent,
  confirmDisabled: document.querySelector('#confirm-witch').disabled,
  selectedCard: document.querySelector('.witch-card.is-selected')?.dataset.character
})`);
if (process.env.HMW_SCREENSHOT_PATH) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(process.env.HMW_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
}

await click('#confirm-witch');
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().active && window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.localCharacter === 'green'");
const greenStarted = await snapshot();
const greenUi = await evaluate(`({
  playerName: document.querySelector('#player-character-name').textContent,
  teammateName: document.querySelector('#teammate-character-name').textContent,
  selectedSpell: document.querySelector('#selected-spell-name').textContent,
  magicStatus: document.querySelector('#aegis-status').textContent,
  partyIsPurple: document.querySelector('#green-witch-party').classList.contains('is-purple'),
  partyHidden: document.querySelector('#green-witch-party').hidden,
  partyDisplay: getComputedStyle(document.querySelector('#green-witch-party')).display,
  teammateDemosHidden: document.querySelector('#green-party-actions').hidden
})`);
await delay(350);
await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 });
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.setMovement(0, 1, false); true');
const crossingStartedAt = Date.now();
while (Date.now() - crossingStartedAt < 45000) {
  if ((await snapshot()).world.route.arch) break;
  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.setMovement(0, 1, false); true');
  await delay(100);
}
await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 });
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.stopMovement(); true');
const greenCrossed = await snapshot();
await evaluate("window.__HMW_THIRD_PERSON_PROOF__.teleport(0, 0, 5.5); true");
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().greenWitch.abilities.dragonInRange');
await evaluate(`(() => {
  const proof = window.__HMW_THIRD_PERSON_PROOF__;
  proof.selectSpell('vineTrap');
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyO', key: 'o' }));
  proof.receiveDragonDamage(30);
  proof.selectSpell('restore');
  proof.setGreenRestoreFriendTargeted(false);
  proof.castSpell();
  return true;
})()`);
await delay(150);
const greenAbilityProof = await snapshot();

await navigate();
await press({ key: 'Enter', code: 'Enter', keyCode: 13 });
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().opening.step === 'SELECTION'");
await press({ key: 'd', code: 'KeyD', keyCode: 68 });
const keyboardGreenFocus = await snapshot();
await press({ key: 'a', code: 'KeyA', keyCode: 65 });
await press({ key: 'Enter', code: 'Enter', keyCode: 13 });
const purpleSelected = await snapshot();
await press({ key: 'Escape', code: 'Escape', keyCode: 27 });
const escapedSelection = await snapshot();
await press({ key: 'Enter', code: 'Enter', keyCode: 13 });
const purpleAwaitingConfirmation = await snapshot();
await press({ key: 'Enter', code: 'Enter', keyCode: 13 });
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().active && window.__HMW_THIRD_PERSON_PROOF__.snapshot().characterSelection.localCharacter === 'purple'");
const purpleStarted = await snapshot();

const exactBriefing = [
  '“Witches, attend me. Three nights ago, the ancient wards encircling Moonhollow began to fail.”',
  '“The cause remains unknown. Creatures are already crossing the Rift. The outlying farms stand abandoned, and the nearest villages prepare to flee.”',
  '“No ordinary soldier can endure passage through the failing barrier. Only witches of your power may enter.”',
  '“Find the source of the breach. Destroy what has crossed into our world. Seal the Rift.”',
  '“Should you fail, Moonhollow will be merely the first to fall.”',
  '“Who among you will enter the Hollow?”'
];

const checks = {
  covenLeaderIntroducesBriefing: briefing.snapshot.opening.step === 'BRIEFING'
    && !briefing.selectionVisible
    && briefing.speaker === 'Coven Leader Warden of Moonhollow'
    && briefing.snapshot.opening.narration.status === 'READY'
    && briefing.snapshot.covenLeader.presentation.visibility === 1
    && briefing.snapshot.covenLeader.presentation.nameplateVisible
    && briefing.snapshot.purpleWitch.presentation.visibility === 0
    && briefing.snapshot.greenWitch.presentation.visibility === 0,
  exactCovenBriefing: briefing.snapshot.opening.narration.lineCount === exactBriefing.length
    && briefing.paragraphs.join('\n') === exactBriefing.join('\n'),
  audibleBriefingPrompt: briefing.tagline === 'Moonhollow has fallen silent. The Coven has not.'
    && briefing.buttonText === 'Hear the Coven briefing'
    && briefing.soundStatus.includes('sound will play through your computer'),
  choiceWaitsForNarration: narrationComplete.opening.step === 'SELECTION'
    && narrationComplete.opening.narration.status === 'COMPLETE'
    && narrationComplete.covenLeader.presentation.visibility === 0
    && narrationComplete.purpleWitch.presentation.visibility === 1
    && narrationComplete.greenWitch.presentation.visibility === 1,
  mouseSelectDoesNotStart: greenSelected.snapshot.opening.awaitingConfirmation
    && greenSelected.snapshot.characterSelection.selectedCharacter === 'green'
    && greenSelected.snapshot.characterSelection.localCharacter === null
    && greenSelected.overlayVisible
    && greenSelected.selectedCard === 'green'
    && !greenSelected.confirmDisabled,
  separateGreenConfirmation: greenSelected.confirmText === 'Enter Moonhollow as the Green Witch'
    && !greenSelected.snapshot.active,
  greenSoloOnly: greenStarted.characterSelection.partyMode === 'SOLO'
    && greenStarted.characterSelection.localCharacter === 'green'
    && greenStarted.characterSelection.remoteCharacter === null
    && greenStarted.witch.label === 'Green Witch'
    && greenStarted.witch.visibility === 1
    && greenStarted.purpleWitch.presentation.visibility === 0
    && greenStarted.teammate === null
    && greenStarted.combat.playerName === 'Green Witch'
    && !greenStarted.combat.spellcastingEnabled
    && greenStarted.greenWitch.abilities.locallyControlled
    && !greenStarted.greenWitch.abilities.friendAvailable
    && greenStarted.greenWitch.abilities.selectedSpell === 'vineTrap',
  greenHudBound: greenUi.playerName === 'Green Witch'
    && greenUi.selectedSpell === 'Vine Trap'
    && greenUi.magicStatus === 'Plant magic ready'
    && greenUi.partyHidden
    && greenUi.partyDisplay === 'none'
    && greenUi.teammateDemosHidden,
  waitsAtMoonGate: !greenStarted.world.route.arch
    && greenStarted.world.objective === 'Cross the Moon Gate',
  controlledCrossingStartsRoute: greenCrossed.world.route.arch
    && greenCrossed.world.objective === 'Jump over the fallen stone relic'
    && greenCrossed.player.z > -8.55,
  greenLocalAbilitiesBound: greenAbilityProof.dragon.restrained
    && greenAbilityProof.combat.playerHealth === 100
    && greenAbilityProof.greenWitch.abilities.lastCast?.spell === 'restore'
    && greenAbilityProof.greenWitch.abilities.lastCast?.targetMode === 'SELF'
    && greenAbilityProof.greenWitch.abilities.lastCast?.restored === 30,
  keyboardNavigation: keyboardGreenFocus.opening.focusedCharacter === 'green'
    && purpleSelected.opening.selectedCharacter === 'purple'
    && purpleSelected.opening.awaitingConfirmation
    && !purpleSelected.active,
  escapeReturnsOneStep: escapedSelection.opening.step === 'SELECTION'
    && escapedSelection.opening.selectedCharacter === null
    && !escapedSelection.opening.awaitingConfirmation,
  keyboardSeparateConfirmation: purpleAwaitingConfirmation.opening.awaitingConfirmation
    && !purpleAwaitingConfirmation.active,
  purpleSoloOnly: purpleStarted.characterSelection.partyMode === 'SOLO'
    && purpleStarted.characterSelection.localCharacter === 'purple'
    && purpleStarted.characterSelection.remoteCharacter === null
    && purpleStarted.witch.label === 'Purple Witch'
    && purpleStarted.witch.visibility === 1
    && purpleStarted.greenWitch.presentation.visibility === 0
    && purpleStarted.teammate === null
    && purpleStarted.combat.spellcastingEnabled,
  noRuntimeErrors: cdp.errors.length === 0
};

console.log(JSON.stringify({
  checks,
  evidence: {
    briefing,
    narrationComplete: { opening: narrationComplete.opening, covenLeader: narrationComplete.covenLeader },
    greenSelected: { opening: greenSelected.snapshot.opening, characterSelection: greenSelected.snapshot.characterSelection, confirmText: greenSelected.confirmText },
    greenStarted: { opening: greenStarted.opening, characterSelection: greenStarted.characterSelection, combat: greenStarted.combat, abilities: greenStarted.greenWitch.abilities, teammate: greenStarted.teammate, ui: greenUi },
    greenCrossed: { input: greenCrossed.input, player: greenCrossed.player, world: greenCrossed.world, teammate: greenCrossed.teammate },
    greenAbilityProof: { combat: greenAbilityProof.combat, dragon: greenAbilityProof.dragon, abilities: greenAbilityProof.greenWitch.abilities },
    keyboard: { keyboardGreenFocus: keyboardGreenFocus.opening, purpleSelected: purpleSelected.opening, escapedSelection: escapedSelection.opening, purpleAwaitingConfirmation: purpleAwaitingConfirmation.opening },
    purpleStarted: { characterSelection: purpleStarted.characterSelection, combat: purpleStarted.combat, teammate: purpleStarted.teammate },
    errors: cdp.errors
  }
}, null, 2));

const failed = Object.values(checks).some(value => !value);
cdp.close();
await delay(50);
process.exit(failed ? 1 : 0);
