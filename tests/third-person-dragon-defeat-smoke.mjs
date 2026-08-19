const debugEndpoint = process.env.HMW_CDP_ENDPOINT || 'http://127.0.0.1:9223';
const gameUrl = process.env.HMW_GAME_URL || 'http://127.0.0.1:8766/?quality=low';

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
const resetAt = async (x, z) => {
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.teleport(${x}, 0, ${z}); true`);
  await delay(250);
};
const aimAtDragon = async () => {
  for (let pass = 0; pass < 7; pass += 1) {
    const state = await snapshot();
    const [targetX, targetY, targetZ] = state.dragon.aimPoint;
    const camera = state.camera.position;
    const deltaX = targetX - camera.x;
    const deltaY = targetY - camera.y;
    const deltaZ = targetZ - camera.z;
    const distance = Math.hypot(deltaX, deltaY, deltaZ);
    const yaw = Math.atan2(deltaX, deltaZ);
    const pitch = Math.asin(deltaY / distance);
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.setLook(${yaw}, ${pitch}); true`);
    await delay(190);
  }
};
const castLightningWithO = async () => {
  await evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyO', key: 'o' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, code: 'KeyO', key: 'o' }));
    return true;
  })()`);
  await delay(430);
  return snapshot();
};

await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.start(); true');
await resetAt(0, 4.8);
await aimAtDragon();

const phaseOneHealth = [];
const phaseOneDamage = [];
for (let hit = 0; hit < 4; hit += 1) {
  const state = await castLightningWithO();
  phaseOneHealth.push(state.dragon.health);
  phaseOneDamage.push(state.combat.lastCast?.damage);
}
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().dragon.state === 'DEFEATED'");
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.route.firstDragon === true");
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().dragon.state === 'IDLE'");
const phaseOneDefeated = await snapshot();
await aimAtDragon();

const phaseTwoHealth = [];
const phaseTwoDamage = [];
for (let hit = 0; hit < 4; hit += 1) {
  const state = await castLightningWithO();
  phaseTwoHealth.push(state.dragon.health);
  phaseTwoDamage.push(state.combat.lastCast?.damage);
}
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().dragon.state === 'DEFEATED'");
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.route.dragon === true");
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.gate.state === 'OPEN'");
const defeated = await snapshot();
const hud = await evaluate(`({
  health: document.querySelector('#target-health-copy').textContent,
  fill: document.querySelector('#target-health-fill').style.transform
})`);
await castLightningWithO();
const afterDuplicateCast = await snapshot();

await resetAt(0, 4.8);
await aimAtDragon();
const afterRouteReset = await snapshot();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castFrost(); true');
await delay(250);
const frozenBeforeLightning = await snapshot();
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Digit1', key: '1' })); true`);
const frostThenLightning = await castLightningWithO();

await resetAt(0, 4.8);
await aimAtDragon();
await evaluate(`document.dispatchEvent(new Event('pointerlockchange')); true`);
await delay(100);
const afterPointerLockLoss = await snapshot();
const resumedAfterPointerLockLoss = await castLightningWithO();

const checks = {
  eachPhaseOneHitDealtConfiguredDamage: phaseOneDamage.every(damage => damage === 25),
  phaseOneHealthReachedZero: JSON.stringify(phaseOneHealth) === JSON.stringify([75, 50, 25, 0]),
  firstPhaseRecorded: phaseOneDefeated.world.route.firstDragon
    && !phaseOneDefeated.world.route.dragon
    && phaseOneDefeated.world.route.secondRoom,
  eachPhaseTwoHitDealtConfiguredDamage: phaseTwoDamage.every(damage => damage === 25),
  phaseTwoHealthReachedZero: JSON.stringify(phaseTwoHealth) === JSON.stringify([75, 50, 25, 0]),
  dragonDefeatedOnce: !defeated.dragon.alive && defeated.dragon.state === 'DEFEATED' && !defeated.dragon.enabled,
  defeatRecorded: defeated.world.route.dragon,
  gateUnlocked: defeated.world.gate.state === 'OPEN',
  healthHudReachedZero: hud.health === 'CONTAINED' && hud.fill === 'scaleX(0)',
  duplicateCastDidNotChangeDefeat: afterDuplicateCast.dragon.health === 0
    && !afterDuplicateCast.dragon.alive
    && afterDuplicateCast.world.route.dragon,
  routeResetRestoredCombat: afterRouteReset.dragon.health === 100
    && afterRouteReset.dragon.alive
    && afterRouteReset.dragon.enabled
    && !afterRouteReset.world.route.dragon
    && !afterRouteReset.world.route.firstDragon
    && afterRouteReset.world.gate.state === 'LOCKED',
  frostDidNotPreventLaterDamage: frozenBeforeLightning.dragon.frozen
    && frozenBeforeLightning.dragon.health === 100
    && frostThenLightning.dragon.health === 75
    && frostThenLightning.combat.lastCast?.spell === 'lightning'
    && frostThenLightning.combat.lastCast?.damage === 25,
  pointerLockLossPreservedFreshCombat: afterPointerLockLoss.dragon.health === 100
    && resumedAfterPointerLockLoss.dragon.health === 75
    && resumedAfterPointerLockLoss.combat.lastCast?.spell === 'lightning'
    && resumedAfterPointerLockLoss.combat.lastCast?.damage === 25,
  noRuntimeErrors: cdp.errors.length === 0
};

console.log(JSON.stringify({
  checks,
  evidence: {
    phaseOneHealth,
    phaseOneDamage,
    phaseOneDefeated,
    phaseTwoHealth,
    phaseTwoDamage,
    dragon: defeated.dragon,
    world: defeated.world,
    hud,
    duplicateCast: afterDuplicateCast.combat.lastCast,
    routeReset: afterRouteReset,
    frostThenLightning: {
      frozen: frozenBeforeLightning.dragon,
      afterLightning: frostThenLightning
    },
    pointerLockRecovery: {
      afterLoss: afterPointerLockLoss,
      afterCast: resumedAfterPointerLockLoss
    },
    errors: cdp.errors
  }
}, null, 2));

cdp.close();
if (Object.values(checks).some(value => !value)) process.exitCode = 1;
