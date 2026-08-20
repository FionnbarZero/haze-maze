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
const reset = async () => {
  await evaluate('window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); true');
  await delay(250);
};

await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.start(); true');

await reset();
const pouchInterruption = await evaluate(`(() => {
  const proof = window.__HMW_THIRD_PERSON_PROOF__;
  proof.jump();
  const queued = proof.snapshot();
  proof.togglePouch();
  const cleared = proof.snapshot();
  return { queued, cleared };
})()`);
await delay(900);
const pouchOpenAfterFrame = await snapshot();

const guardedBefore = await snapshot();
await evaluate(`(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyV', key: 'v' }));
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Digit2', key: '2' }));
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyO', key: 'o' }));
  return true;
})()`);
await delay(250);
const guardedAfter = await snapshot();

await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyP', key: 'p' })); true`);
await delay(800);
const pouchClosedAfterFrame = await snapshot();

await reset();
const crouchFocusInterruption = await evaluate(`(() => {
  const proof = window.__HMW_THIRD_PERSON_PROOF__;
  proof.crouch();
  const queued = proof.snapshot();
  window.dispatchEvent(new Event('blur'));
  const cleared = proof.snapshot();
  return { queued, cleared };
})()`);
await delay(700);
const crouchAfterFocusFrame = await snapshot();

await reset();
const focusInterruption = await evaluate(`(() => {
  const proof = window.__HMW_THIRD_PERSON_PROOF__;
  proof.jump();
  const queued = proof.snapshot();
  window.dispatchEvent(new Event('blur'));
  const cleared = proof.snapshot();
  return { queued, cleared };
})()`);
await delay(800);
const focusAfterFrame = await snapshot();

await reset();
const pointerLockInterruption = await evaluate(`(() => {
  const proof = window.__HMW_THIRD_PERSON_PROOF__;
  proof.jump();
  const queued = proof.snapshot();
  document.dispatchEvent(new Event('pointerlockchange'));
  const cleared = proof.snapshot();
  return { queued, cleared };
})()`);
await delay(800);
const pointerLockAfterFrame = await snapshot();

await reset();
const routeResetInterruption = await evaluate(`(() => {
  const proof = window.__HMW_THIRD_PERSON_PROOF__;
  proof.jump();
  const queued = proof.snapshot();
  proof.resetRoute();
  const cleared = proof.snapshot();
  return { queued, cleared };
})()`);
await delay(800);
const routeResetAfterFrame = await snapshot();

await reset();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.jump(); true');
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().player.didJump');
const resumedJump = await snapshot();

await reset();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.crouch(); true');
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().player.crouched');
const resumedCrouch = await snapshot();

await reset();
const resumedControlsBefore = await snapshot();
await evaluate(`(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyV', key: 'v' }));
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Digit2', key: '2' }));
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyO', key: 'o' }));
  return true;
})()`);
await delay(500);
const resumedControlsAfter = await snapshot();

const noPendingActions = state => state.input.pendingActions.length === 0;
const didNotJump = state => !state.player.didJump
  && state.player.grounded
  && Math.abs(state.player.y) < .001
  && Math.abs(state.player.verticalVelocity) < .001;

const checks = {
  jumpWasQueuedBeforePouch: pouchInterruption.queued.input.pendingActions.includes('jump'),
  pouchClearedQueuedJump: noPendingActions(pouchInterruption.cleared)
    && pouchInterruption.cleared.input.modalOpen,
  queuedJumpDidNotRunBehindPouch: noPendingActions(pouchOpenAfterFrame)
    && didNotJump(pouchOpenAfterFrame),
  pouchGuardedImmediateActions: guardedAfter.camera.side === guardedBefore.camera.side
    && guardedAfter.combat.selectedSpell === guardedBefore.combat.selectedSpell
    && guardedAfter.combat.lastCast === guardedBefore.combat.lastCast,
  closingPouchDidNotReleaseOldAction: !pouchClosedAfterFrame.input.modalOpen
    && noPendingActions(pouchClosedAfterFrame)
    && didNotJump(pouchClosedAfterFrame),
  crouchChangeWasQueuedBeforeFocusLoss: crouchFocusInterruption.queued.input.pendingActions.includes('crouchChanged'),
  focusLossClearedQueuedCrouchChange: noPendingActions(crouchFocusInterruption.cleared)
    && noPendingActions(crouchAfterFocusFrame),
  focusLossClearedQueuedJump: focusInterruption.queued.input.pendingActions.includes('jump')
    && noPendingActions(focusInterruption.cleared)
    && didNotJump(focusAfterFrame),
  pointerLockLossClearedQueuedJump: pointerLockInterruption.queued.input.pendingActions.includes('jump')
    && noPendingActions(pointerLockInterruption.cleared)
    && didNotJump(pointerLockAfterFrame),
  routeResetClearedQueuedJump: routeResetInterruption.queued.input.pendingActions.includes('jump')
    && noPendingActions(routeResetInterruption.cleared)
    && didNotJump(routeResetAfterFrame),
  ordinaryJumpResumed: resumedJump.player.didJump && resumedJump.player.maximumAirHeight > 0,
  ordinaryCrouchResumed: resumedCrouch.player.crouched
    && resumedCrouch.player.capsuleHeight < 1.75
    && noPendingActions(resumedCrouch),
  ordinaryShoulderResumed: resumedControlsAfter.camera.side !== resumedControlsBefore.camera.side,
  ordinarySpellSelectionResumed: resumedControlsAfter.combat.selectedSpell === 'frost',
  ordinaryCastingResumed: resumedControlsAfter.combat.lastCast?.spell === 'frost',
  noRuntimeErrors: cdp.errors.length === 0
};

const inputEvidence = state => ({
  input: state.input,
  player: state.player,
  cameraSide: state.camera.side,
  selectedSpell: state.combat.selectedSpell,
  lastCastSpell: state.combat.lastCast?.spell || null
});
const interruptionEvidence = result => ({
  queued: inputEvidence(result.queued),
  cleared: inputEvidence(result.cleared)
});

console.log(JSON.stringify({
  checks,
  evidence: {
    pouch: {
      interruption: interruptionEvidence(pouchInterruption),
      afterFrame: inputEvidence(pouchOpenAfterFrame),
      guardedBefore: inputEvidence(guardedBefore),
      guardedAfter: inputEvidence(guardedAfter),
      closed: inputEvidence(pouchClosedAfterFrame)
    },
    crouchFocus: { interruption: interruptionEvidence(crouchFocusInterruption), afterFrame: inputEvidence(crouchAfterFocusFrame) },
    focus: { interruption: interruptionEvidence(focusInterruption), afterFrame: inputEvidence(focusAfterFrame) },
    pointerLock: { interruption: interruptionEvidence(pointerLockInterruption), afterFrame: inputEvidence(pointerLockAfterFrame) },
    routeReset: { interruption: interruptionEvidence(routeResetInterruption), afterFrame: inputEvidence(routeResetAfterFrame) },
    resumed: {
      jump: inputEvidence(resumedJump),
      crouch: inputEvidence(resumedCrouch),
      before: inputEvidence(resumedControlsBefore),
      after: inputEvidence(resumedControlsAfter)
    },
    errors: cdp.errors
  }
}, null, 2));

const failed = Object.values(checks).some(value => !value);
cdp.close();
await delay(50);
process.exit(failed ? 1 : 0);
