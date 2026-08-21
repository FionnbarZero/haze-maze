import { LEGACY_SMOKE_SEED, navigateToProof } from './third-person-smoke-navigation.mjs';

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
await navigateToProof(cdp, gameUrl, {
  route: 'legacy',
  params: { mazeSeed: LEGACY_SMOKE_SEED, dragonDefeatTest: Date.now() }
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
const TEST_DRAGON_INDEX = 1;
const TEST_DRAGON_ID = `dragon-${TEST_DRAGON_INDEX}`;
// expanded-smoke-seed: this north-west room position has a direct rendered line to dragon-1.
const TEST_DRAGON_SIGHT_LINE = Object.freeze({ x: -9, z: 17 });
const testDragon = state => state.dragons[TEST_DRAGON_INDEX];
const resetNearTestDragon = async () => {
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.resetRoute(); window.__HMW_THIRD_PERSON_PROOF__.focusDragon(${TEST_DRAGON_INDEX}); window.__HMW_THIRD_PERSON_PROOF__.teleport(${TEST_DRAGON_SIGHT_LINE.x}, 0, ${TEST_DRAGON_SIGHT_LINE.z}); true`);
  await delay(250);
};
const acquireTestDragonTarget = async (label, timeoutMilliseconds = 12000) => {
  const startedAt = Date.now();
  let finalState;
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const state = await snapshot();
    finalState = state;
    const [targetX, targetY, targetZ] = testDragon(state).aimPoint;
    const camera = state.camera.position;
    const deltaX = targetX - camera.x;
    const deltaY = targetY - camera.y;
    const deltaZ = targetZ - camera.z;
    const distance = Math.hypot(deltaX, deltaY, deltaZ);
    const yaw = Math.atan2(deltaX, deltaZ);
    const pitch = Math.asin(deltaY / distance);
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.setLook(${yaw}, ${pitch}); true`);
    await delay(120);
    finalState = await snapshot();
    if (finalState.combat.targeted && finalState.combat.targetDragonId === TEST_DRAGON_ID) return finalState;
  }
  const state = finalState || await snapshot();
  throw new Error(`Timed out acquiring ${TEST_DRAGON_ID} for ${label}: ${JSON.stringify({
    player: state.player,
    camera: state.camera,
    dragon: testDragon(state),
    combat: state.combat
  })}`);
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
await resetNearTestDragon();
const targetingBeforeDamage = await acquireTestDragonTarget('initial damage');

const healthAfterHits = [];
const damageAfterHits = [];
const castResolutions = [];
for (let hit = 0; hit < 4; hit += 1) {
  await acquireTestDragonTarget(`damage cast ${hit + 1}`);
  const state = await castLightningWithO();
  healthAfterHits.push(testDragon(state).health);
  damageAfterHits.push(state.combat.lastCast?.damage);
  castResolutions.push({
    resolution: state.combat.lastCast?.resolution,
    intendedKind: state.combat.lastCast?.intendedKind,
    actualKind: state.combat.lastCast?.actualKind,
    intendedTarget: state.combat.lastCast?.intendedTarget,
    actualTarget: state.combat.lastCast?.actualTarget
  });
}
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().dragons[1].state === 'DEFEATED'");
const defeated = await snapshot();
await delay(750);
const defeatedSettled = await snapshot();
const hud = await evaluate(`({
  health: document.querySelector('#target-health-copy').textContent,
  fill: document.querySelector('#target-health-fill').style.transform
})`);
await castLightningWithO();
const afterDuplicateCast = await snapshot();

await resetNearTestDragon();
const afterRouteReset = await acquireTestDragonTarget('frost after route reset');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castFrost(); true');
await delay(250);
const frozenBeforeLightning = await snapshot();
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Digit1', key: '1' })); true`);
await acquireTestDragonTarget('lightning after frost');
const frostThenLightning = await castLightningWithO();

await resetNearTestDragon();
await acquireTestDragonTarget('pointer-lock interruption setup');
await evaluate(`document.dispatchEvent(new Event('pointerlockchange')); true`);
await delay(100);
const afterPointerLockLoss = await acquireTestDragonTarget('lightning after pointer-lock interruption');
const resumedAfterPointerLockLoss = await castLightningWithO();

const checks = {
  dragonTargetedBeforeDamage: targetingBeforeDamage.combat.targeted
    && targetingBeforeDamage.combat.candidateTargeted
    && targetingBeforeDamage.combat.targetDragonId === TEST_DRAGON_ID
    && ['DIRECT', 'ASSISTED'].includes(targetingBeforeDamage.combat.aimState),
  eachHitDealtConfiguredDamage: damageAfterHits.every(damage => damage === 25),
  eachCastReachedDragon: castResolutions.every(cast => cast.intendedKind === 'dragon'
    && cast.actualKind === 'dragon'
    && ['TARGET', 'TARGET_ASSISTED'].includes(cast.resolution)),
  healthReachedZero: JSON.stringify(healthAfterHits) === JSON.stringify([75, 50, 25, 0]),
  defeatedDragonSettled: Math.hypot(
    testDragon(defeatedSettled).aimPoint[0] - testDragon(defeated).aimPoint[0],
    testDragon(defeatedSettled).aimPoint[2] - testDragon(defeated).aimPoint[2]
  ) < .001,
  dragonDefeatedOnce: !testDragon(defeated).alive && testDragon(defeated).state === 'DEFEATED' && !testDragon(defeated).enabled,
  healthHudReachedZero: hud.health === 'CONTAINED' && hud.fill === 'scaleX(0)',
  duplicateCastDidNotChangeDefeat: testDragon(afterDuplicateCast).health === 0
    && !testDragon(afterDuplicateCast).alive
    && testDragon(afterDuplicateCast).state === 'DEFEATED',
  routeResetRestoredCombat: testDragon(afterRouteReset).health === 100
    && testDragon(afterRouteReset).alive
    && testDragon(afterRouteReset).enabled
    && afterRouteReset.world.doors.first.state === 'LOCKED'
    && afterRouteReset.world.doors.final.state === 'LOCKED',
  frostDidNotPreventLaterDamage: testDragon(frozenBeforeLightning).frozen
    && testDragon(frozenBeforeLightning).health === 100
    && testDragon(frostThenLightning).health === 75
    && frostThenLightning.combat.lastCast?.spell === 'lightning'
    && frostThenLightning.combat.lastCast?.damage === 25,
  pointerLockLossPreservedFreshCombat: testDragon(afterPointerLockLoss).health === 100
    && testDragon(resumedAfterPointerLockLoss).health === 75
    && resumedAfterPointerLockLoss.combat.lastCast?.spell === 'lightning'
    && resumedAfterPointerLockLoss.combat.lastCast?.damage === 25,
  noRuntimeErrors: cdp.errors.length === 0
};

console.log(JSON.stringify({
  checks,
  evidence: {
    targetingBeforeDamage: targetingBeforeDamage.combat,
    healthAfterHits,
    damageAfterHits,
    castResolutions,
    defeatedDragonPosition: {
      id: testDragon(defeated).id,
      defeated: testDragon(defeated).aimPoint,
      settled: testDragon(defeatedSettled).aimPoint
    },
    dragon: testDragon(defeated),
    world: defeated.world,
    hud,
    duplicateCast: afterDuplicateCast.combat.lastCast,
    routeReset: afterRouteReset,
    frostThenLightning: {
      frozen: testDragon(frozenBeforeLightning),
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
