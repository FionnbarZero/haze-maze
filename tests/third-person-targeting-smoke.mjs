const debugEndpoint = process.env.HMW_CDP_ENDPOINT || 'http://127.0.0.1:9223';
const gameUrl = process.env.HMW_GAME_URL || 'http://127.0.0.1:8766/third-person.html?quality=low';

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

const waitFor = async (expression, timeoutMilliseconds = 30000) => {
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
const aimAtDragon = async (yawOffset = 0, pitchOffset = 0) => {
  for (let pass = 0; pass < 7; pass += 1) {
    const state = await snapshot();
    const [targetX, targetY, targetZ] = state.dragon.aimPoint;
    const camera = state.camera.position;
    const deltaX = targetX - camera.x;
    const deltaY = targetY - camera.y;
    const deltaZ = targetZ - camera.z;
    const distance = Math.hypot(deltaX, deltaY, deltaZ);
    const yaw = Math.atan2(deltaX, deltaZ) + yawOffset;
    const pitch = Math.asin(deltaY / distance) + pitchOffset;
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.setLook(${yaw}, ${pitch}); true`);
    await delay(190);
  }
};
const cast = async () => {
  const result = await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castLightning()');
  await delay(260);
  return result;
};
const angleDifference = (a, b) => Math.abs(((a - b + Math.PI) % (Math.PI * 2)) - Math.PI);

await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.start(); true');

await resetAt(0, 4.8);
await aimAtDragon();
const normalBefore = await snapshot();
await cast();
const normalAfter = await snapshot();

await resetAt(0, 7.35);
await aimAtDragon();
const closeBefore = await snapshot();
await cast();
const closeAfter = await snapshot();

await resetAt(1.7, 6.45);
await aimAtDragon();
const offCenterBefore = await snapshot();
const [offTargetX, , offTargetZ] = offCenterBefore.dragon.aimPoint;
const desiredFacing = Math.atan2(
  offTargetX - offCenterBefore.player.x,
  offTargetZ - offCenterBefore.player.z
);
await cast();
const offCenterAfter = await snapshot();

await resetAt(0, -1.2);
await aimAtDragon();
const obstructedBefore = await snapshot();
await cast();
const obstructedAfter = await snapshot();

await resetAt(0, 7.35);
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.setLook(0, 0); window.__HMW_THIRD_PERSON_PROOF__.setMovement(0, 1); true');
await delay(900);
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.stopMovement(); true');
const separationAfter = await snapshot();
const dragonDistance = Math.hypot(
  separationAfter.player.x - separationAfter.dragon.aimPoint[0],
  separationAfter.player.z - separationAfter.dragon.aimPoint[2]
);

const targetResolution = value => value === 'TARGET' || value === 'TARGET_ASSISTED';
const checks = {
  normalRangeTargeted: normalBefore.combat.targeted,
  normalRangeDamaged: normalAfter.dragon.health === 75,
  normalRangeResolved: targetResolution(normalAfter.combat.lastCast?.resolution),
  closeRangeTargeted: closeBefore.combat.targeted,
  closeRangeDamaged: closeAfter.dragon.health === 75,
  closeRangeResolved: targetResolution(closeAfter.combat.lastCast?.resolution),
  closeRangeStaffOrigin: Boolean(closeAfter.combat.lastCast?.origin && closeAfter.combat.lastCast?.impact),
  offCenterTargeted: offCenterBefore.combat.targeted,
  offCenterDamaged: offCenterAfter.dragon.health === 75,
  offCenterFacingImproved: angleDifference(offCenterAfter.player.facingYaw, desiredFacing)
    < angleDifference(offCenterBefore.player.facingYaw, desiredFacing),
  offCenterFacingActive: offCenterAfter.player.castFacingActive,
  wallRejectedTarget: !obstructedBefore.combat.targeted,
  wallPreventedDamage: obstructedAfter.dragon.health === 100,
  wallResolvedToWorld: obstructedAfter.combat.lastCast?.resolution === 'WORLD',
  dragonSeparation: dragonDistance >= 1.42,
  dragonCollisionReported: separationAfter.player.collision.includes('DRAGON'),
  noRuntimeErrors: cdp.errors.length === 0
};

console.log(JSON.stringify({
  checks,
  evidence: {
    normal: normalAfter.combat.lastCast,
    close: closeAfter.combat.lastCast,
    offCenter: {
      cast: offCenterAfter.combat.lastCast,
      facingBefore: offCenterBefore.player.facingYaw,
      facingAfter: offCenterAfter.player.facingYaw,
      desiredFacing
    },
    obstructed: obstructedAfter.combat.lastCast,
    separation: {
      playerZ: separationAfter.player.z,
      dragonDistance,
      collision: separationAfter.player.collision
    },
    errors: cdp.errors
  }
}, null, 2));

cdp.close();
if (Object.values(checks).some(value => !value)) process.exitCode = 1;
