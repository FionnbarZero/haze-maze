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

await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.start(); true');

await resetAt(0, 4.8);
await aimAtDragon();
const lightningBefore = await snapshot();
await evaluate(`document.querySelector('#render-canvas').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); true`);
await delay(280);
const lightningAfter = await snapshot();
const lightningHud = await evaluate(`({ health: document.querySelector('#target-health-copy').textContent, spell: document.querySelector('#selected-spell-name').textContent })`);

await resetAt(0, 4.8);
await aimAtDragon();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castFrost()');
await delay(220);
const frostAfter = await snapshot();
const frostHud = await evaluate(`({ status: document.querySelector('#target-status').textContent, frozenClass: document.querySelector('#target-card').classList.contains('is-frozen') })`);

await resetAt(0, -1.2);
await aimAtDragon();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castFrost()');
await delay(220);
const blockedFrostAfter = await snapshot();

await resetAt(0, 7.35);
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castAegis()');
await delay(1350);
const aegisAfter = await snapshot();

await resetAt(0, 7.35);
await delay(1150);
const unshieldedAfter = await snapshot();

const berryRouteStart = await snapshot();
const firstBerryPosition = berryRouteStart.inventory.pickups[0].position;
await resetAt(firstBerryPosition.x, firstBerryPosition.z);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.healthBerries === 1');
const berryCollected = await snapshot();
const berryCollectedHud = await evaluate(`({
  count: document.querySelector('#hud-berry-count').textContent,
  pouchCount: document.querySelector('#pouch-berry-count').textContent
})`);
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.receiveDragonDamage(40); true');
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyP', key: 'p' })); true`);
await delay(100);
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyW', key: 'w' })); true`);
const pouchOpen = await snapshot();
const pouchOpenHud = await evaluate(`({
  hidden: document.querySelector('#pouch-overlay').getAttribute('aria-hidden'),
  openClass: document.querySelector('#pouch-overlay').classList.contains('is-open'),
  useDisabled: document.querySelector('#use-health-berry').disabled,
  action: document.querySelector('#berry-action-copy').textContent
})`);
await evaluate(`document.querySelector('#use-health-berry').click(); true`);
await delay(100);
const berryUsed = await snapshot();
const berryUsedHud = await evaluate(`({
  playerHealth: document.querySelector('#player-health-copy').textContent,
  count: document.querySelector('#hud-berry-count').textContent
})`);
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyP', key: 'p' })); true`);
await delay(80);
const pouchClosed = await snapshot();
const pouchClosedHud = await evaluate(`({
  hidden: document.querySelector('#pouch-overlay').getAttribute('aria-hidden'),
  openClass: document.querySelector('#pouch-overlay').classList.contains('is-open')
})`);

await resetAt(firstBerryPosition.x, firstBerryPosition.z);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.healthBerries === 1');
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyP', key: 'p' })); true`);
await delay(80);
await evaluate(`document.querySelector('#use-health-berry').click(); true`);
await delay(80);
const fullHealthBerry = await snapshot();

const rewardLayout = await snapshot();
const chestPosition = rewardLayout.inventory.chest.position;
await resetAt(chestPosition.x, chestPosition.z);
await waitFor(`window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.gold === ${rewardLayout.inventory.chest.amount}`);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.chest.openProgress > .8');
const chestCollected = await snapshot();
const chestHud = await evaluate(`({
  hud: document.querySelector('#hud-gold-count').textContent,
  pouch: document.querySelector('#pouch-gold-count').textContent
})`);

const lightningPotionPosition = rewardLayout.inventory.powerups.find(pickup => pickup.type === 'lightning').position;
await resetAt(lightningPotionPosition.x, lightningPotionPosition.z);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.lightningPotions === 1');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.togglePouch(); true');
await delay(80);
const lightningPotionStored = await snapshot();
const lightningPotionPouch = await evaluate(`({
  count: document.querySelector('#pouch-lightning-potion-count').textContent,
  disabled: document.querySelector('#use-lightning-potion').disabled
})`);
await evaluate(`document.querySelector('#use-lightning-potion').click(); true`);
await delay(80);
const lightningPotionUsed = await snapshot();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.togglePouch(); window.__HMW_THIRD_PERSON_PROOF__.teleport(0, 0, 4.8); true');
await aimAtDragon();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.castLightning(); true');
await delay(280);
const empoweredLightning = await snapshot();
const empoweredLightningHud = await evaluate(`document.querySelector('#powerup-status').textContent`);

const aegisPotionPosition = rewardLayout.inventory.powerups.find(pickup => pickup.type === 'aegis').position;
await resetAt(aegisPotionPosition.x, aegisPotionPosition.z);
await waitFor('window.__HMW_THIRD_PERSON_PROOF__.snapshot().inventory.aegisPotions === 1');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.togglePouch(); true');
await delay(80);
const aegisPotionStored = await snapshot();
const aegisPotionPouch = await evaluate(`({
  count: document.querySelector('#pouch-aegis-potion-count').textContent,
  disabled: document.querySelector('#use-aegis-potion').disabled
})`);
await evaluate(`document.querySelector('#use-aegis-potion').click(); true`);
await delay(80);
const aegisPotionUsed = await snapshot();
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.togglePouch(); window.__HMW_THIRD_PERSON_PROOF__.teleport(0, 0, 4.8); window.__HMW_THIRD_PERSON_PROOF__.castAegis(); true');
await delay(120);
const empoweredAegis = await snapshot();
const empoweredAegisHud = await evaluate(`document.querySelector('#aegis-status').textContent`);

await evaluate(`window.__HMW_THIRD_PERSON_PROOF__.selectSpell('frost'); true`);
const controls = await evaluate(`({
  enabledSpells: [...document.querySelectorAll('.spell-rack button[data-spell]')].filter(button => !button.disabled).map(button => button.dataset.spell),
  selectedButton: document.querySelector('.spell-rack button[data-spell].is-selected')?.dataset.spell,
  readout: document.querySelector('#selected-spell-name').textContent
})`);

await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 844,
  height: 390,
  deviceScaleFactor: 3,
  mobile: true,
  screenOrientation: { type: 'landscapePrimary', angle: 90 }
});
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await cdp.send('Page.navigate', { url: gameUrl });
await waitFor('window.__HMW_THIRD_PERSON_PROOF__?.snapshot().ready');
await evaluate('window.__HMW_THIRD_PERSON_PROOF__.start(); true');
await resetAt(0, 4.8);
await aimAtDragon();
const mobileBefore = await snapshot();
await evaluate(`document.querySelector('button[data-spell="lightning"]').dispatchEvent(new PointerEvent('pointerdown', {
  bubbles: true,
  pointerId: 81,
  pointerType: 'touch',
  clientX: 35,
  clientY: 340
})); true`);
await delay(280);
const mobileAfter = await snapshot();
const mobileLayout = await evaluate(`(() => {
  const rack = document.querySelector('.spell-rack');
  const move = document.querySelector('#move-stick');
  const rackRect = rack.getBoundingClientRect();
  const moveRect = move.getBoundingClientRect();
  return {
    coarsePointer: matchMedia('(pointer:coarse)').matches,
    landscape: matchMedia('(orientation: landscape)').matches,
    rackDisplay: getComputedStyle(rack).display,
    rackRight: rackRect.right,
    moveLeft: moveRect.left,
    viewportWidth: innerWidth,
    selectedButton: document.querySelector('.spell-rack button[data-spell].is-selected')?.dataset.spell
  };
})()`);

const targetResolution = value => value === 'TARGET' || value === 'TARGET_ASSISTED';
const checks = {
  lightningWasTargeted: lightningBefore.combat.targeted,
  firstGameplayClickDamaged: lightningAfter.dragon.health === 75,
  lightningResolvedTarget: lightningAfter.combat.lastCast?.spell === 'lightning'
    && targetResolution(lightningAfter.combat.lastCast?.resolution),
  lightningHealthVisible: lightningHud.health === '75 / 100' && lightningHud.spell === 'Lightning',
  frostDidNotDamage: frostAfter.dragon.health === 100,
  frostAppliedStatus: frostAfter.dragon.frozen && frostAfter.dragon.state === 'FROZEN',
  frostResolvedTarget: frostAfter.combat.lastCast?.spell === 'frost'
    && targetResolution(frostAfter.combat.lastCast?.resolution),
  frostFeedbackVisible: frostHud.frozenClass && frostHud.status.startsWith('Frozen'),
  blockedFrostRejected: !blockedFrostAfter.dragon.frozen
    && blockedFrostAfter.combat.lastCast?.resolution === 'WORLD',
  aegisVisible: aegisAfter.combat.aegis.active && aegisAfter.combat.aegis.visible,
  aegisAbsorbedStrike: aegisAfter.combat.aegis.absorbedHits >= 1
    && aegisAfter.combat.playerHealth === aegisAfter.combat.playerMaximumHealth,
  unshieldedStrikeDamaged: unshieldedAfter.combat.playerHealth < unshieldedAfter.combat.playerMaximumHealth
    && unshieldedAfter.combat.damageTaken >= 15,
  berryPickupCollected: berryCollected.inventory.healthBerries === 1
    && berryCollected.inventory.pickups[0].collected
    && berryCollectedHud.count === '1 berry'
    && berryCollectedHud.pouchCount === '1 berry',
  pKeyOpenedPouch: pouchOpen.inventory.open
    && pouchOpen.input.modalOpen
    && pouchOpenHud.hidden === 'false'
    && pouchOpenHud.openClass
    && !pouchOpenHud.useDisabled,
  pouchPausedMovement: pouchOpen.input.movement.y === 0
    && !pouchOpen.input.heldActions.includes('moveForward'),
  berryRestoredHealth: pouchOpen.combat.playerHealth === 60
    && berryUsed.combat.playerHealth === 90
    && berryUsed.inventory.healthBerries === 0
    && berryUsed.inventory.totalUsed === 1
    && berryUsedHud.playerHealth === '90 / 100'
    && berryUsedHud.count === '0 berries',
  pKeyClosedPouch: !pouchClosed.inventory.open
    && !pouchClosed.input.modalOpen
    && pouchClosedHud.hidden === 'true'
    && !pouchClosedHud.openClass,
  fullHealthPreservedBerry: fullHealthBerry.combat.playerHealth === 100
    && fullHealthBerry.inventory.healthBerries === 1
    && fullHealthBerry.inventory.totalUsed === 0,
  cornerChestAwardedGold: chestCollected.inventory.chest.opened
    && chestCollected.inventory.chest.openProgress > .8
    && chestCollected.inventory.gold === 50
    && chestHud.hud === '50 gold'
    && chestHud.pouch === '50 gold',
  lightningPotionStoredInPouch: lightningPotionStored.inventory.lightningPotions === 1
    && lightningPotionStored.inventory.powerups.find(pickup => pickup.type === 'lightning')?.collected
    && lightningPotionPouch.count === '1 potion'
    && !lightningPotionPouch.disabled,
  lightningPotionActivated: lightningPotionUsed.inventory.lightningPotions === 0
    && lightningPotionUsed.inventory.totalPotionsUsed === 1
    && lightningPotionUsed.combat.powerups.lightningActive
    && lightningPotionUsed.combat.powerups.lightningDamageMultiplier === 2,
  lightningPotionDoubledDamage: empoweredLightning.dragon.health === 50
    && empoweredLightning.combat.lastCast?.spell === 'lightning'
    && empoweredLightning.combat.lastCast?.damage === 50
    && empoweredLightning.combat.lastCast?.damageMultiplier === 2
    && empoweredLightningHud.startsWith('Lightning ×2'),
  aegisPotionStoredInPouch: aegisPotionStored.inventory.aegisPotions === 1
    && aegisPotionStored.inventory.powerups.find(pickup => pickup.type === 'aegis')?.collected
    && aegisPotionPouch.count === '1 potion'
    && !aegisPotionPouch.disabled,
  aegisPotionPrimed: aegisPotionUsed.inventory.aegisPotions === 0
    && aegisPotionUsed.inventory.totalPotionsUsed === 1
    && aegisPotionUsed.combat.powerups.aegisPrimed,
  aegisPotionDoubledDuration: empoweredAegis.combat.aegis.active
    && empoweredAegis.combat.aegis.duration === 10
    && empoweredAegis.combat.aegis.remaining > 9
    && !empoweredAegis.combat.aegis.boostPrimed
    && empoweredAegis.combat.lastCast?.durationMultiplier === 2
    && empoweredAegisHud.startsWith('Aegis active'),
  allMobileSpellsEnabled: ['aegis', 'frost', 'lightning'].every(spell => controls.enabledSpells.includes(spell)),
  spellSelectionVisible: controls.selectedButton === 'frost' && controls.readout === 'Frost',
  mobileLandscapeLayout: mobileLayout.coarsePointer && mobileLayout.landscape
    && mobileLayout.rackDisplay === 'flex'
    && mobileLayout.rackRight < mobileLayout.viewportWidth / 2
    && mobileLayout.moveLeft > mobileLayout.viewportWidth / 2,
  mobileImmediateCastDamaged: mobileBefore.combat.targeted
    && mobileAfter.dragon.health === 75
    && mobileAfter.combat.lastCast?.spell === 'lightning'
    && mobileLayout.selectedButton === 'lightning',
  noRuntimeErrors: cdp.errors.length === 0
};

console.log(JSON.stringify({
  checks,
  evidence: {
    lightning: { before: lightningBefore.combat, after: lightningAfter.combat, dragon: lightningAfter.dragon, hud: lightningHud },
    frost: { combat: frostAfter.combat, dragon: frostAfter.dragon, hud: frostHud },
    blockedFrost: { combat: blockedFrostAfter.combat, dragon: blockedFrostAfter.dragon },
    aegis: aegisAfter.combat,
    unshielded: unshieldedAfter.combat,
    pouch: {
      collected: berryCollected.inventory,
      collectedHud: berryCollectedHud,
      open: pouchOpen,
      openHud: pouchOpenHud,
      used: berryUsed,
      usedHud: berryUsedHud,
      closed: pouchClosed.inventory,
      closedHud: pouchClosedHud,
      fullHealth: fullHealthBerry.inventory
    },
    rewards: {
      chest: { inventory: chestCollected.inventory, hud: chestHud },
      lightningPotion: {
        stored: lightningPotionStored.inventory,
        pouch: lightningPotionPouch,
        used: lightningPotionUsed,
        cast: empoweredLightning,
        hud: empoweredLightningHud
      },
      aegisPotion: {
        stored: aegisPotionStored.inventory,
        pouch: aegisPotionPouch,
        used: aegisPotionUsed,
        cast: empoweredAegis,
        hud: empoweredAegisHud
      }
    },
    controls,
    mobile: { before: mobileBefore.combat, after: mobileAfter.combat, dragon: mobileAfter.dragon, layout: mobileLayout },
    errors: cdp.errors
  }
}, null, 2));

const failed = Object.values(checks).some(value => !value);
cdp.close();
await delay(50);
process.exit(failed ? 1 : 0);
