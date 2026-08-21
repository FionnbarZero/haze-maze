import assert from 'node:assert/strict';
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
  params: { mazeSeed: LEGACY_SMOKE_SEED, purpleProgression: Date.now() }
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
const teleport = async position => {
  await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.teleport(${position.x}, 0, ${position.z}); true`);
  await delay(220);
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
    await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.setLook(${Math.atan2(deltaX, deltaZ)}, ${Math.asin(deltaY / distance)}); true`);
    await delay(180);
  }
};

await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
await evaluate("window.__HMW_THIRD_PERSON_PROOF__.start('purple'); true");
const initial = await snapshot();

await evaluate("window.__HMW_THIRD_PERSON_PROOF__.equipPurpleItem('staff'); true");
const staffStored = await snapshot();
await teleport({ x: 0, z: 4.8 });
await aimAtDragon();
const storedCastResult = await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castLightning()');
await delay(250);
const castWithoutStaff = await snapshot();
await evaluate("window.__HMW_THIRD_PERSON_PROOF__.equipPurpleItem('staff'); true");

const pickPosition = initial.inventory.equipmentPickups.find(item => item.type === 'geodePick').position;
const hammerPosition = initial.inventory.equipmentPickups.find(item => item.type === 'geodeHammer').position;
const rockPosition = initial.inventory.geodeRocks[0].position;
await teleport(pickPosition);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.equipment.owned.geodePick');
const pickFound = await snapshot();
await teleport(hammerPosition);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.equipment.owned.geodeHammer');
const toolsFound = await snapshot();

await evaluate("window.__HMW_THIRD_PERSON_PROOF__.equipPurpleItem('geodePick'); true");
const pickHeld = await snapshot();
await evaluate("window.__HMW_THIRD_PERSON_PROOF__.equipPurpleItem('geodeHammer'); true");
const hammerHeld = await snapshot();
await evaluate("window.__HMW_THIRD_PERSON_PROOF__.equipPurpleItem('staff'); true");
const staffReequipped = await snapshot();

await teleport(rockPosition);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.geodes === 1');
const geodeMined = await snapshot();
await teleport({ x: 0, z: 4.8 });
await aimAtDragon();
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().combat.targeted');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castLightning(); true');
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().combat.lastCast?.spell === 'lightning'");
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().dragon.health < 100');
const geodeAttack = await snapshot();

const roomRunes = initial.inventory.runePickups;
assert.deepEqual(roomRunes.map(rune => rune.source), [
  'southwestRoom',
  'southeastRoom',
  'northwestRoom',
  'northeastRoom'
]);
await teleport(roomRunes[0].position);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.runes === 1');
const firstRoomRune = await snapshot();
await teleport(roomRunes[1].position);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.runes === 2');
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.doors.first.state === 'OPEN'");
const southernRunes = await snapshot();
await teleport(roomRunes[2].position);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.runes === 3');
const thirdRoomRune = await snapshot();
await teleport(roomRunes[3].position);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.runes === 4');
await waitFor("window.__HMW_THIRD_PERSON_PROOF__.snapshot().world.doors.final.state === 'OPEN'");
const allRunes = await snapshot();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.togglePouch(); true');
await delay(100);
const pouch = await evaluate(`({
  staff: document.querySelector('#pouch-staff-state').textContent,
  pick: document.querySelector('#pouch-geode-pick-state').textContent,
  hammer: document.querySelector('#pouch-geode-hammer-state').textContent,
  geodes: document.querySelector('#pouch-geode-count').textContent,
  runes: document.querySelector('#pouch-rune-count').textContent,
  geodePower: document.querySelector('#geode-power-copy').textContent,
  route: document.querySelector('#route-progress').textContent
})`);

const checks = {
  staffStartsEquipped: initial.inventory.equipment.equipped === 'staff'
    && initial.witch.heldItem === 'staff'
    && initial.witch.staffAttached,
  staffCanBeStored: staffStored.inventory.equipment.staffStored
    && staffStored.inventory.equipment.equipped === null
    && staffStored.witch.heldItem === null
    && !staffStored.witch.staffAttached,
  storedStaffPreventsCasting: storedCastResult === false
    && castWithoutStaff.dragon.health === 100
    && castWithoutStaff.combat.lastCast === null,
  miningToolsFoundSeparately: pickFound.inventory.equipment.owned.geodePick
    && !pickFound.inventory.equipment.owned.geodeHammer
    && toolsFound.inventory.equipment.owned.geodePick
    && toolsFound.inventory.equipment.owned.geodeHammer,
  toolsCanBeHeldIndividually: pickHeld.inventory.equipment.equipped === 'geodePick'
    && pickHeld.witch.heldItem === 'geodePick'
    && hammerHeld.inventory.equipment.equipped === 'geodeHammer'
    && hammerHeld.witch.heldItem === 'geodeHammer'
    && staffReequipped.witch.heldItem === 'staff',
  pairedToolsMineOneGeode: geodeMined.inventory.geodes === 1
    && geodeMined.inventory.geodeRocks[0].mined
    && geodeMined.combat.powerups.geodeCount === 1
    && geodeMined.combat.powerups.geodeDamageMultiplier === 1.1,
  geodeAddsTenPercentAttackPower: Math.abs(geodeAttack.combat.lastCast?.damage - 27.5) < 1e-9
    && Math.abs(geodeAttack.dragon.health - 72.5) < 1e-9,
  roomRunesOpenDoorsInSequence: firstRoomRune.inventory.runes === 1
    && southernRunes.inventory.runes === 2
    && southernRunes.world.doors.first.state === 'OPEN'
    && southernRunes.world.doors.final.state === 'LOCKED'
    && thirdRoomRune.inventory.runes === 3
    && allRunes.inventory.runes === 4
    && allRunes.world.gate.runes === 4
    && allRunes.world.doors.final.state === 'OPEN'
    && allRunes.inventory.runePickups.every(rune => rune.collected),
  pouchReportsProgress: pouch.staff === 'Held'
    && pouch.pick === 'Stored'
    && pouch.hammer === 'Stored'
    && pouch.geodes === '1 geode'
    && pouch.runes === '4 / 4'
    && pouch.geodePower.includes('+10%')
    && pouch.route.includes('4 / 4 runes'),
  noRuntimeErrors: cdp.errors.length === 0
};

console.log(JSON.stringify({
  checks,
  evidence: {
    initial: { witch: initial.witch, inventory: initial.inventory },
    staffStored: { witch: staffStored.witch, inventory: staffStored.inventory, castResult: storedCastResult },
    tools: { pickFound: pickFound.inventory, toolsFound: toolsFound.inventory, pickHeld: pickHeld.witch, hammerHeld: hammerHeld.witch },
    geode: { mined: geodeMined.inventory, combat: geodeAttack.combat, dragon: geodeAttack.dragon },
    runes: {
      sources: roomRunes.map(rune => rune.source),
      afterFirst: firstRoomRune.inventory,
      afterSouthern: southernRunes.inventory,
      afterThird: thirdRoomRune.inventory,
      complete: allRunes
    },
    pouch,
    errors: cdp.errors
  }
}, null, 2));

cdp.close();
if (Object.values(checks).some(value => !value)) process.exitCode = 1;
