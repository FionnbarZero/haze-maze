(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const mapCanvas = document.querySelector('#mini-map-canvas');
  const mapCtx = mapCanvas.getContext('2d');
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const dragonImage = new Image();
  const brickTexture = new Image();
  let dragonSprite = null;
  dragonImage.addEventListener('load', prepareDragonSprite);
  dragonImage.src = 'assets/dragon-beast.png';
  brickTexture.src = 'assets/ancient-brick-wall.png';

  const TOTAL_LEVELS = 10;
  const MAP_SIZE = 17;
  const FOV = Math.PI / 3;
  const beastNames = ['Ashwing Dragon', 'Brambletail Dragon', 'Mooncoil Dragon', 'Emberjaw Dragon', 'Gloamscale Dragon', 'Frostclaw Dragon', 'Cinderhorn Dragon', 'Velvetwing Dragon', 'Starback Dragon', 'Duskmaw Dragon', 'Goldcrest Dragon', 'Thornspine Dragon'];
  const levelThemes = [
    { name: 'The Brick Labyrinth', wall: 'brick', hue: 14, sky: ['#10081a','#47304f','#76505d'], floor: ['#241b20','#080609'] },
    { name: 'Moonleaf Passages', wall: 'hedge', hue: 141, sky: ['#080923','#242752','#3b5570'], floor: ['#141d1c','#050908'] },
    { name: 'Amethyst Hollows', wall: 'crystal', hue: 275, sky: ['#0d0622','#36205d','#63417b'], floor: ['#1b1028','#07030d'] },
    { name: 'The Sunken Cloister', wall: 'stone', hue: 194, sky: ['#06141c','#173848','#355561'], floor: ['#102327','#040a0c'] },
    { name: 'Sporelight Garden', wall: 'mushroom', hue: 319, sky: ['#17091e','#49294f','#6c4a67'], floor: ['#271723','#0c060b'] },
    { name: 'Briarwitch Turn', wall: 'thorn', hue: 107, sky: ['#07130e','#193c2f','#445f46'], floor: ['#111e15','#050905'] },
    { name: 'The Frost Archive', wall: 'ice', hue: 193, sky: ['#061521','#16445d','#6b91a5'], floor: ['#102535','#050a0e'] },
    { name: 'Cinderstone Ways', wall: 'ember', hue: 8, sky: ['#160708','#4b1c18','#8c4932'], floor: ['#29100e','#0b0303'] },
    { name: 'The Silver Menagerie', wall: 'marble', hue: 227, sky: ['#090b1b','#2c3151','#626983'], floor: ['#1b1c29','#07070c'] },
    { name: 'Celestial Heart', wall: 'starlight', hue: 256, sky: ['#050418','#211747','#5e397b'], floor: ['#171025','#05030a'] }
  ];

  const state = {
    running: false,
    paused: false,
    finished: false,
    level: 1,
    map: [],
    theme: levelThemes[0],
    lastTime: 0,
    player: { x: 1.5, y: 1.5, angle: 0, health: 100 },
    beasts: [],
    berries: [],
    kills: 0,
    totalKills: 0,
    berriesEaten: 0,
    xp: 0,
    powered: false,
    bubbleUntil: 0,
    cooldowns: { lightning: 0, frost: 0, bubble: 0 },
    keys: new Set(),
    joystick: { x: 0, y: 0, pointer: null },
    lookPointer: null,
    lookX: 0,
    target: null,
    rayDepths: [],
    messageTimer: 0,
    bannerTimer: 0,
    shake: 0,
    mapOpen: false
  };

  function prepareDragonSprite() {
    const buffer = document.createElement('canvas');
    buffer.width = dragonImage.naturalWidth;
    buffer.height = dragonImage.naturalHeight;
    const bufferCtx = buffer.getContext('2d');
    bufferCtx.drawImage(dragonImage, 0, 0);
    bufferCtx.globalCompositeOperation = 'destination-in';
    bufferCtx.save();
    bufferCtx.translate(buffer.width * .5, buffer.height * .5);
    bufferCtx.scale(1, .72);
    const matte = bufferCtx.createRadialGradient(0, 0, buffer.width * .42, 0, 0, buffer.width * .7);
    matte.addColorStop(0, '#fff');
    matte.addColorStop(.76, '#fff');
    matte.addColorStop(.94, 'rgba(255,255,255,.82)');
    matte.addColorStop(1, 'transparent');
    bufferCtx.fillStyle = matte;
    bufferCtx.fillRect(-buffer.width, -buffer.height, buffer.width * 2, buffer.height * 2);
    bufferCtx.restore();
    dragonSprite = buffer;
  }

  function createRng(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function shuffle(items, random) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function distancesFrom(map, startX, startY) {
    const queue = [[startX, startY]];
    const distances = new Map([[`${startX},${startY}`, 0]]);
    while (queue.length) {
      const [x, y] = queue.shift();
      const distance = distances.get(`${x},${y}`);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (!distances.has(key) && map[ny]?.[nx] === '0') {
          distances.set(key, distance + 1);
          queue.push([nx, ny]);
        }
      }
    }
    return distances;
  }

  function generateLevel(level) {
    const random = createRng(0xC0FFEE + level * 7919);
    const grid = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill('1'));
    const stack = [[1, 1]];
    grid[1][1] = '0';
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const choices = shuffle([[2,0],[-2,0],[0,2],[0,-2]], random).filter(([dx,dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx > 0 && ny > 0 && nx < MAP_SIZE - 1 && ny < MAP_SIZE - 1 && grid[ny][nx] === '1';
      });
      if (!choices.length) { stack.pop(); continue; }
      const [dx, dy] = choices[0];
      grid[y + dy / 2][x + dx / 2] = '0';
      grid[y + dy][x + dx] = '0';
      stack.push([x + dx, y + dy]);
    }

    // Later trials add loops while preserving a guaranteed route through the maze.
    let loops = level + 1;
    let attempts = 0;
    while (loops > 0 && attempts++ < 600) {
      const x = 1 + Math.floor(random() * (MAP_SIZE - 2));
      const y = 1 + Math.floor(random() * (MAP_SIZE - 2));
      if (grid[y][x] !== '1') continue;
      const horizontal = grid[y][x - 1] === '0' && grid[y][x + 1] === '0';
      const vertical = grid[y - 1][x] === '0' && grid[y + 1][x] === '0';
      if (horizontal !== vertical) { grid[y][x] = '0'; loops--; }
    }

    const distances = distancesFrom(grid, 1, 1);
    const ranked = [...distances.entries()].sort((a,b) => b[1] - a[1]);
    const [gateKey] = ranked[0];
    const [gateX, gateY] = gateKey.split(',').map(Number);
    grid[gateY][gateX] = '2';

    const occupied = new Set(['1,1', gateKey]);
    const candidates = shuffle(ranked.filter(([,distance]) => distance > 7).map(([key]) => key), random);
    const beastCount = 3 + Math.floor((level - 1) / 2);
    const berryCount = 3 + Math.floor(level / 2);
    const takePositions = (count) => {
      const positions = [];
      while (positions.length < count && candidates.length) {
        const key = candidates.pop();
        if (occupied.has(key)) continue;
        occupied.add(key);
        positions.push(key.split(',').map(value => Number(value) + .5));
      }
      return positions;
    };

    return { map: grid.map(row => row.join('')), beasts: takePositions(beastCount), berries: takePositions(berryCount) };
  }

  function resetGame() {
    state.totalKills = 0;
    state.berriesEaten = 0;
    state.xp = 0;
    state.powered = false;
    state.finished = false;
    state.player.health = 100;
    loadLevel(1, false);
  }

  function loadLevel(level, carryHealth = true) {
    const generated = generateLevel(level);
    state.level = level;
    state.map = generated.map;
    state.theme = levelThemes[level - 1];
    state.player = { x: 1.5, y: 1.5, angle: 0, health: carryHealth ? Math.min(100, state.player.health + 20) : 100 };
    state.kills = 0;
    state.bubbleUntil = 0;
    state.cooldowns = { lightning: 0, frost: 0, bubble: 0 };
    state.target = null;
    state.beasts = generated.beasts.map(([x,y], index) => {
      const maxHealth = 70 + level * 9;
      return {
        x, y, name: beastNames[(level * 3 + index) % beastNames.length], health: maxHealth, maxHealth,
        alive: true, frozenUntil: 0, lastAttack: 0, phase: index * .67,
        hue: [285, 174, 322, 202, 42][(index + level) % 5]
      };
    });
    state.berries = generated.berries.map(([x,y], index) => ({ x, y, collected: false, phase: index * 1.13, notifiedUntil: 0 }));
    state.mapOpen = false;
    $('#mini-map').classList.remove('is-visible');
    $('#map-button').classList.remove('is-active');
    $('#map-button').setAttribute('aria-expanded', 'false');
    $('#map-level').textContent = `LEVEL ${String(level).padStart(2,'0')}`;
    $('#objective-label').textContent = `LEVEL ${String(level).padStart(2,'0')} / ${TOTAL_LEVELS}`;
    $('#objective-text').textContent = `Contain dragons · 0 / ${state.beasts.length}`;
    updateHud();
    showLevelBanner();
  }

  function showLevelBanner() {
    const banner = $('#level-banner');
    banner.querySelector('strong').textContent = String(state.level).padStart(2, '0');
    banner.querySelector('small').textContent = state.theme.name;
    banner.classList.remove('is-visible');
    requestAnimationFrame(() => banner.classList.add('is-visible'));
    clearTimeout(state.bannerTimer);
    state.bannerTimer = setTimeout(() => banner.classList.remove('is-visible'), 2300);
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cell(x, y) {
    const row = state.map[Math.floor(y)];
    return row?.[Math.floor(x)] ?? '1';
  }

  function gateIsLocked() {
    return state.kills < state.beasts.length;
  }

  function isBlockingTile(tile) {
    return tile === '1' || (tile === '2' && gateIsLocked());
  }

  function canWalk(x, y) {
    const pad = .2;
    for (const ox of [-pad, pad]) for (const oy of [-pad, pad]) {
      if (isBlockingTile(cell(x + ox, y + oy))) return false;
    }
    return true;
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function raycast(angle, max = 24) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let distance = .02;
    while (distance < max) {
      const x = state.player.x + dx * distance;
      const y = state.player.y + dy * distance;
      const tile = cell(x, y);
      if (isBlockingTile(tile)) {
        const fx = x - Math.floor(x), fy = y - Math.floor(y);
        const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
        return { distance, tile, edge, x, y, texture: fx < .03 || fx > .97 ? fy : fx };
      }
      distance += .025;
    }
    return { distance: max, tile: '1', edge: 0, texture: 0 };
  }

  function renderWorld(time) {
    const w = innerWidth, h = innerHeight;
    const shakeX = state.shake ? (Math.random() - .5) * state.shake : 0;
    const shakeY = state.shake ? (Math.random() - .5) * state.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    const theme = state.theme;
    const sky = ctx.createLinearGradient(0, 0, 0, h * .55);
    sky.addColorStop(0, theme.sky[0]); sky.addColorStop(.55, theme.sky[1]); sky.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = sky; ctx.fillRect(-10, -10, w + 20, h * .55 + 10);
    drawMoon(w, h);
    const floor = ctx.createLinearGradient(0, h * .48, 0, h);
    floor.addColorStop(0, theme.floor[0]); floor.addColorStop(1, theme.floor[1]);
    ctx.fillStyle = floor; ctx.fillRect(-10, h * .48, w + 20, h * .55);
    for (let y = h * .56; y < h; y += Math.max(8, (y - h * .5) * .12)) {
      ctx.strokeStyle = `hsla(${theme.hue},40%,72%,${Math.min(.09, (y / h) * .08)})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const rayCount = Math.min(560, Math.ceil(w / 2));
    const strip = w / rayCount + .6;
    state.rayDepths.length = rayCount;
    for (let i = 0; i < rayCount; i++) {
      const rayAngle = state.player.angle - FOV / 2 + (i / rayCount) * FOV;
      const hit = raycast(rayAngle);
      const corrected = hit.distance * Math.cos(rayAngle - state.player.angle);
      state.rayDepths[i] = corrected;
      const wallH = Math.min(h * 1.5, h / Math.max(.08, corrected));
      drawWallStrip(hit, i * strip, strip, h * .5 - wallH / 2, wallH, time);
    }

    renderWorldObjects(time, w, h, rayCount);
    renderAtmosphere(time, w, h);
    ctx.restore();
    state.shake *= .86;
    if (state.mapOpen) renderMiniMap();
  }

  function drawWallStrip(hit, x, width, top, height, time) {
    const theme = state.theme;
    const mist = Math.min(.8, hit.distance / 16);
    const sideShade = Math.min(1, hit.edge * 18);
    if (hit.tile === '2') {
      ctx.fillStyle = `hsl(43 60% ${30 + Math.sin(time * .004) * 7}%)`;
      ctx.fillRect(x, top, width + 1, height);
      ctx.fillStyle = `rgba(255,232,142,${.2 + Math.sin(time * .006 + x) * .08})`;
      ctx.fillRect(x, top + height * .1, width + 1, height * .8);
      return;
    }

    const texturedWall = ['brick','stone','ember','marble'].includes(theme.wall) && brickTexture.complete && brickTexture.naturalWidth;
    if (texturedWall) {
      const sourceX = Math.max(0, Math.min(brickTexture.naturalWidth - 2, Math.floor(hit.texture * brickTexture.naturalWidth)));
      const filters = {
        brick: 'brightness(.9) contrast(1.12) saturate(.9)',
        stone: 'grayscale(.78) hue-rotate(145deg) brightness(.76) contrast(1.18)',
        ember: 'hue-rotate(342deg) saturate(1.3) brightness(.78) contrast(1.2)',
        marble: 'grayscale(.9) hue-rotate(190deg) brightness(1.15) contrast(.9)'
      };
      ctx.save();
      ctx.filter = filters[theme.wall];
      ctx.globalAlpha = 1 - mist * .48;
      ctx.drawImage(brickTexture, sourceX, 0, 2, brickTexture.naturalHeight, x, top, width + 1, height);
      ctx.filter = 'none';
      ctx.fillStyle = `rgba(3,2,8,${.12 + (1-sideShade)*.23 + mist*.12})`;
      ctx.fillRect(x, top, width + 1, height);
      ctx.restore();
      return;
    }

    const light = 19 + sideShade * 10;
    ctx.fillStyle = `hsl(${theme.hue} ${theme.wall === 'brick' ? 31 : 34}% ${light}%)`;
    ctx.fillRect(x, top, width + 1, height);
    if (theme.wall === 'brick') {
      const mortar = Math.max(1, height * .006);
      ctx.fillStyle = 'rgba(225,184,157,.18)';
      for (let row = 1; row < 8; row++) ctx.fillRect(x, top + height * row / 8, width + 1, mortar);
      const brickBand = Math.floor((hit.texture * 12 + Math.floor(x / Math.max(1,width))) % 6);
      if (brickBand === 0) { ctx.fillStyle = 'rgba(35,13,13,.34)'; ctx.fillRect(x, top, Math.max(1,width*.35), height); }
    } else if (theme.wall === 'hedge' || theme.wall === 'thorn') {
      ctx.fillStyle = `rgba(4,18,12,${.14 + (Math.floor(x) % 5 === 0 ? .08 : 0)})`;
      ctx.fillRect(x, top + ((x * 17) % Math.max(10,height)), width + 1, Math.max(2,height*.03));
    } else if (theme.wall === 'crystal' || theme.wall === 'ice' || theme.wall === 'starlight') {
      const glint = Math.abs((hit.texture * 10) % 1 - .5) < .08;
      if (glint) { ctx.fillStyle = 'rgba(223,239,255,.19)'; ctx.fillRect(x, top, width + 1, height); }
    } else {
      ctx.fillStyle = `rgba(255,255,255,${Math.floor(hit.texture*9)%4===0 ? .045 : .012})`;
      ctx.fillRect(x, top, width + 1, height);
    }
    if (mist > .18) {
      ctx.fillStyle = `rgba(38,28,60,${mist * .34})`;
      ctx.fillRect(x, top, width + 1, height);
    }
  }

  function drawMoon(w, h) {
    const x = w * .76, y = h * .14, r = Math.min(w, h) * .065;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
    glow.addColorStop(0, 'rgba(239,226,255,.85)'); glow.addColorStop(.35, `hsla(${state.theme.hue},70%,72%,.22)`); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(x-r*2.5,y-r*2.5,r*5,r*5);
    ctx.fillStyle = '#d7d3ee'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(89,76,133,.24)'; ctx.beginPath(); ctx.arc(x-r*.22,y-r*.08,r*.24,0,Math.PI*2); ctx.fill();
  }

  function renderAtmosphere(time, w, h) {
    for (let i = 0; i < 28; i++) {
      const x = (i * 197 + time * .015 * (i % 3 + 1)) % (w + 80) - 40;
      const y = (i * 83) % h;
      const a = .15 + Math.sin(time * .002 + i) * .12;
      ctx.fillStyle = `hsla(${state.theme.hue + i * 2},80%,75%,${a})`;
      ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 2 : .8, 0, Math.PI * 2); ctx.fill();
    }
    const fog = ctx.createLinearGradient(0,h*.38,0,h*.68);
    fog.addColorStop(0,'transparent'); fog.addColorStop(.5,`hsla(${state.theme.hue},35%,55%,.09)`); fog.addColorStop(1,'transparent');
    ctx.fillStyle=fog; ctx.fillRect(0,h*.32,w,h*.44);
  }

  function hasLineOfSight(object) {
    const dx = object.x - state.player.x, dy = object.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    const hit = raycast(Math.atan2(dy, dx), distance + .1);
    return hit.distance >= distance - .13;
  }

  function renderWorldObjects(time, w, h, rayCount) {
    const visible = [];
    state.target = null;
    for (const beast of state.beasts) {
      if (!beast.alive) continue;
      addVisibleObject(visible, beast, 'beast');
    }
    for (const berry of state.berries) addVisibleObject(visible, berry, 'berry');
    visible.sort((a,b) => b.distance - a.distance);
    for (const item of visible) {
      const screenX = w * (.5 + item.relative / FOV);
      const rayIndex = Math.max(0, Math.min(rayCount - 1, Math.floor(screenX / w * rayCount)));
      if (state.rayDepths[rayIndex] < item.distance - .3) continue;
      if (item.type === 'beast') {
        const size = Math.min(h * .88, h / Math.max(.5, item.distance) * .82);
        const frozen = item.object.frozenUntil > performance.now();
        drawDragon(item.object, screenX, h * .5 + size * .08, size, time, frozen);
        drawBeastHealth(item.object, screenX, h * .5 - size * .93, Math.max(42, size * .58), frozen);
        if (Math.abs(item.relative) < .105 && item.distance < 10 && (!state.target || item.distance < state.target.distance)) state.target = { beast: item.object, distance: item.distance };
      } else {
        const size = Math.min(h * .52, h / Math.max(.6, item.distance) * .46);
        drawBerryBush(item.object, screenX, h * .5 + size * .53, size, time);
      }
    }
    $('#crosshair').classList.toggle('is-targeting', Boolean(state.target));
  }

  function addVisibleObject(visible, object, type) {
    const dx = object.x - state.player.x, dy = object.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    const relative = normalizeAngle(Math.atan2(dy, dx) - state.player.angle);
    if (Math.abs(relative) < FOV * .72 && hasLineOfSight(object)) visible.push({ object, type, distance, relative });
  }

  function drawBerryBush(berry, x, groundY, size, time) {
    const s = size / 120;
    const sway = Math.sin(time * .0025 + berry.phase) * 2;
    ctx.save(); ctx.translate(x, groundY); ctx.scale(s,s);
    ctx.strokeStyle = '#332817'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(-18,-43); ctx.moveTo(0,-18); ctx.lineTo(26,-53); ctx.moveTo(-9,-27); ctx.lineTo(-35,-59); ctx.stroke();
    const leaves = [[-32,-50,25],[0,-59,30],[31,-48,25],[-13,-31,27],[18,-27,24]];
    for (const [lx,ly,r] of leaves) {
      const leaf = ctx.createRadialGradient(lx-7,ly-8,2,lx,ly,r);
      leaf.addColorStop(0, berry.collected ? '#45583c' : '#648947'); leaf.addColorStop(1,'#14251a');
      ctx.fillStyle=leaf; ctx.beginPath();ctx.arc(lx+sway,ly,r,0,Math.PI*2);ctx.fill();
    }
    if (!berry.collected) {
      for (const [bx,by,r] of [[-29,-53,6],[-7,-67,7],[19,-57,6],[33,-42,7],[-7,-32,6],[12,-25,5]]) {
        ctx.shadowColor='#ffd85e';ctx.shadowBlur=18;ctx.fillStyle='#fff0a1';ctx.beginPath();ctx.arc(bx+sway,by,r,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;ctx.fillStyle='#f1a927';ctx.beginPath();ctx.arc(bx+sway+2,by+2,r*.58,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBeastHealth(beast, x, y, width, frozen) {
    const barWidth = Math.min(118, width);
    ctx.save(); ctx.translate(Math.round(x - barWidth / 2), Math.round(y));
    ctx.fillStyle = 'rgba(5,3,14,.76)'; ctx.fillRect(-2,-2,barWidth+4,8);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0,0,barWidth,4);
    ctx.fillStyle = frozen ? '#8eeeff' : '#f66baa'; ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=7;
    ctx.fillRect(0,0,barWidth*(beast.health/beast.maxHealth),4); ctx.restore();
  }

  function drawDragon(dragon, x, groundY, size, time, frozen) {
    if (!dragonSprite) { drawDragonFallback(dragon, x, groundY, size, time, frozen); return; }
    const bob = Math.sin(time * .0034 + dragon.phase) * size * .018;
    const drawWidth = size * 1.62;
    const drawHeight = size * 1.08;
    ctx.save();
    ctx.translate(x, groundY + bob);
    const aura = ctx.createRadialGradient(0,-size*.42,size*.08,0,-size*.42,size*.8);
    aura.addColorStop(0, frozen ? 'rgba(133,239,255,.2)' : `hsla(${dragon.hue},75%,54%,.16)`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.fillRect(-drawWidth*.62,-drawHeight*1.08,drawWidth*1.24,drawHeight*1.18);
    const colorShift = Math.round((dragon.hue - 285) * .16);
    ctx.filter = frozen
      ? 'hue-rotate(150deg) saturate(.55) brightness(1.42) drop-shadow(0 0 13px #8deeff)'
      : `hue-rotate(${colorShift}deg) saturate(1.08) brightness(.95) drop-shadow(0 10px 12px rgba(0,0,0,.68))`;
    ctx.drawImage(dragonSprite,-drawWidth/2,-drawHeight,drawWidth,drawHeight);
    ctx.filter='none';
    if(frozen){ctx.strokeStyle='rgba(216,255,255,.82)';ctx.lineWidth=Math.max(1,size*.008);for(let i=0;i<7;i++){const px=(i-3)*size*.16;ctx.beginPath();ctx.moveTo(px,-size*.1);ctx.lineTo(px+size*.08,-size*(.48+(i%3)*.14));ctx.stroke();}}
    ctx.restore();
  }

  function drawDragonFallback(beast, x, groundY, size, time, frozen) {
    const bob = Math.sin(time * .004 + beast.phase) * size * .025;
    const s = size / 150;
    ctx.save(); ctx.translate(x, groundY + bob); ctx.scale(s,s);
    ctx.shadowColor = frozen ? '#8cecff' : `hsla(${beast.hue},90%,65%,.65)`; ctx.shadowBlur = frozen ? 26 : 18;
    ctx.strokeStyle=frozen?'#aeefff':`hsl(${beast.hue},42%,24%)`;ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(-30,-40);ctx.bezierCurveTo(-85,-30,-94,-8,-120,-45);ctx.stroke();
    ctx.fillStyle=frozen?'#82d3e2':`hsl(${beast.hue},40%,22%)`;ctx.beginPath();ctx.moveTo(-28,-78);ctx.lineTo(-88,-132);ctx.lineTo(-72,-49);ctx.closePath();ctx.moveTo(28,-78);ctx.lineTo(88,-132);ctx.lineTo(72,-49);ctx.closePath();ctx.fill();
    const body = ctx.createRadialGradient(-20,-70,5,0,-45,70);
    body.addColorStop(0, frozen ? '#b9f8ff' : `hsl(${beast.hue},48%,48%)`);
    body.addColorStop(.38, frozen ? '#3989a9' : `hsl(${beast.hue},42%,25%)`); body.addColorStop(1,'#090812');
    ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-43,-2);ctx.quadraticCurveTo(-69,-62,-37,-105);ctx.quadraticCurveTo(0,-135,39,-104);ctx.quadraticCurveTo(67,-62,43,-2);ctx.quadraticCurveTo(0,20,-43,-2);ctx.fill();
    ctx.strokeStyle=frozen?'#d8ffff':`hsl(${beast.hue},55%,60%)`;ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-29,-103);ctx.lineTo(-47,-132);ctx.lineTo(-65,-139);ctx.moveTo(-49,-130);ctx.lineTo(-41,-150);ctx.moveTo(29,-103);ctx.lineTo(47,-132);ctx.lineTo(65,-139);ctx.moveTo(49,-130);ctx.lineTo(41,-150);ctx.stroke();
    ctx.fillStyle=frozen?'#edffff':'#ffe690';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=13;ctx.beginPath();ctx.ellipse(-17,-76,8,5,0,0,Math.PI*2);ctx.ellipse(17,-76,8,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#21142e';ctx.shadowBlur=0;ctx.beginPath();ctx.arc(-17,-76,2,0,Math.PI*2);ctx.arc(17,-76,2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=frozen?'#8ad8e8':`hsl(${beast.hue},35%,18%)`;ctx.beginPath();ctx.ellipse(0,-50,21,15,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-33,-18,14,40);ctx.fillRect(19,-18,14,40);
    if(frozen){ctx.strokeStyle='rgba(220,255,255,.8)';ctx.lineWidth=2;for(let i=0;i<7;i++){const a=i*.9;ctx.beginPath();ctx.moveTo(Math.cos(a)*54,-58+Math.sin(a)*47);ctx.lineTo(Math.cos(a)*69,-58+Math.sin(a)*61);ctx.stroke();}}
    ctx.restore();
  }

  function update(dt, now) {
    if (!state.running || state.paused || state.finished) return;
    const p = state.player;
    let forward=0,strafe=0;
    if(state.keys.has('KeyW')||state.keys.has('ArrowUp'))forward++;
    if(state.keys.has('KeyS')||state.keys.has('ArrowDown'))forward--;
    if(state.keys.has('KeyD'))strafe++;
    if(state.keys.has('KeyA'))strafe--;
    forward+=-state.joystick.y;strafe+=state.joystick.x;
    if(state.keys.has('ArrowLeft'))p.angle-=dt*1.8;if(state.keys.has('ArrowRight'))p.angle+=dt*1.8;
    const length=Math.hypot(forward,strafe)||1;forward/=length;strafe/=length;
    const speed=dt*2.25;
    const nx=p.x+(Math.cos(p.angle)*forward+Math.cos(p.angle+Math.PI/2)*strafe)*speed;
    const ny=p.y+(Math.sin(p.angle)*forward+Math.sin(p.angle+Math.PI/2)*strafe)*speed;
    if(canWalk(nx,p.y))p.x=nx;if(canWalk(p.x,ny))p.y=ny;

    collectBerries(now);
    for(const beast of state.beasts){
      if(!beast.alive||beast.frozenUntil>now)continue;
      const dx=p.x-beast.x,dy=p.y-beast.y,distance=Math.hypot(dx,dy);
      if(distance<5.7&&hasLineOfSight(beast)){
        if(distance>.82){const move=dt*(.48+state.level*.035);const bx=beast.x+dx/distance*move,by=beast.y+dy/distance*move;if(cell(bx,beast.y)==='0')beast.x=bx;if(cell(beast.x,by)==='0')beast.y=by;}
        if(distance<1.05&&now-beast.lastAttack>1100){beast.lastAttack=now;if(now<state.bubbleUntil)showMessage('Aegis absorbed the strike');else damagePlayer(6+state.level);}
      }
    }
    if(cell(p.x,p.y)==='2'&&!gateIsLocked())advanceLevel();
    updateHud(now);
  }

  function collectBerries(now) {
    for (const berry of state.berries) {
      if (berry.collected || Math.hypot(berry.x-state.player.x,berry.y-state.player.y) > .58) continue;
      if (state.player.health >= 100) {
        if (now > berry.notifiedUntil) { showMessage('Health full · berries left on the bush'); berry.notifiedUntil=now+2500; }
        continue;
      }
      berry.collected=true;state.berriesEaten++;const before=state.player.health;state.player.health=Math.min(100,state.player.health+30);
      const berryFlash=$('#berry-flash');berryFlash.querySelector('strong').textContent=`+${state.player.health-before} HEALTH`;berryFlash.classList.remove('is-visible');requestAnimationFrame(()=>berryFlash.classList.add('is-visible'));setTimeout(()=>berryFlash.classList.remove('is-visible'),1100);
      showMessage(`Golden berries eaten · +${state.player.health-before} health`);
      updateHud(now);
    }
  }

  function damagePlayer(amount) {
    state.player.health=Math.max(0,state.player.health-amount);state.shake=10;
    const vignette=$('#damage-vignette');vignette.classList.add('is-hit');setTimeout(()=>vignette.classList.remove('is-hit'),120);
    if(state.player.health<=0)finish(false);
  }

  function cast(spell) {
    if(!state.running||state.paused||state.finished)return;
    const now=performance.now();
    if(now<state.cooldowns[spell]){showMessage('Spell is gathering strength');return;}
    const fx=$('#cast-fx');fx.className=`cast-fx ${spell}`;setTimeout(()=>{if(fx.classList.contains(spell))fx.className='cast-fx';},600);
    if(spell==='bubble'){
      state.bubbleUntil=now+5000;state.cooldowns.bubble=now+12000;showMessage('Aegis Orb raised · 5 seconds');
    }else if(!state.target){
      state.cooldowns[spell]=now+(spell==='lightning'?320:1200);showMessage('No beast in your sights');
    }else{
      const beast=state.target.beast;
      if(spell==='lightning'){
        const damage=state.powered?55:34;beast.health=Math.max(0,beast.health-damage);state.cooldowns.lightning=now+(state.powered?470:650);state.shake=4;if(!beast.health)defeat(beast);
      }else{
        beast.frozenUntil=now+(state.powered?6000:4000);state.cooldowns.frost=now+7800;showMessage(`${beast.name} frozen`);
      }
    }
    updateHud(now);
  }

  function defeat(beast) {
    beast.alive=false;state.kills++;state.totalKills++;state.xp+=10;
    showMessage(`${beast.name} contained · +10 mastery`);
    if(state.xp>=100&&!state.powered){state.powered=true;setTimeout(()=>showMessage('Mastery unlocked · spells overcharged'),1000);}
    if(state.kills===state.beasts.length){$('#objective-text').textContent='Gate open · follow the golden light';showMessage('All dragons contained · the gate is open');}
  }

  function advanceLevel() {
    if(state.level>=TOTAL_LEVELS){finish(true);return;}
    const nextLevel=state.level+1;
    showMessage(`Level ${String(state.level).padStart(2,'0')} complete`);
    loadLevel(nextLevel,true);
  }

  function updateHud(now=performance.now()) {
    $('#health-fill').style.transform=`scaleX(${state.player.health/100})`;$('#health-text').textContent=state.player.health;
    $('#xp-fill').style.transform=`scaleX(${Math.min(1,state.xp/100)})`;$('#xp-text').textContent=`${state.xp} / 100`;
    $('#rank-label').textContent=state.powered?'SPELLWEAVER':'APPRENTICE';
    $('#bubble-overlay').classList.toggle('is-active',now<state.bubbleUntil);
    if(state.kills<state.beasts.length)$('#objective-text').textContent=`Contain dragons · ${state.kills} / ${state.beasts.length}`;
    const target=state.target?.beast;$('#boss-card').classList.toggle('is-visible',Boolean(target));
    if(target){$('#beast-name').textContent=target.name;$('#beast-state').textContent=target.frozenUntil>now?'FROZEN':'WILD';$('#beast-health-fill').style.transform=`scaleX(${target.health/target.maxHealth})`;}
    const durations={lightning:state.powered?470:650,frost:7800,bubble:12000};
    $$('.spell').forEach(button=>{const spell=button.dataset.spell,remaining=Math.max(0,state.cooldowns[spell]-now);button.classList.toggle('is-cooling',remaining>0);button.style.setProperty('--cooldown',remaining/durations[spell]);});
  }

  function renderMiniMap() {
    const size=mapCanvas.width,cellSize=size/MAP_SIZE;
    mapCtx.clearRect(0,0,size,size);
    for(let y=0;y<MAP_SIZE;y++)for(let x=0;x<MAP_SIZE;x++){
      const tile=state.map[y][x];
      if(tile==='1'){mapCtx.fillStyle=state.level===1?'rgba(130,74,62,.68)':'rgba(66,91,82,.62)';mapCtx.fillRect(x*cellSize,y*cellSize,cellSize+.5,cellSize+.5);}
      if(tile==='2'){mapCtx.fillStyle='#ffd869';mapCtx.shadowColor='#ffd869';mapCtx.shadowBlur=8;mapCtx.fillRect(x*cellSize+2,y*cellSize+2,cellSize-4,cellSize-4);mapCtx.shadowBlur=0;}
    }
    for(const berry of state.berries){if(berry.collected)continue;mapCtx.fillStyle='#ffd44f';mapCtx.beginPath();mapCtx.arc(berry.x*cellSize,berry.y*cellSize,2.5,0,Math.PI*2);mapCtx.fill();}
    for(const beast of state.beasts){if(!beast.alive)continue;mapCtx.fillStyle='#ff6da9';mapCtx.beginPath();mapCtx.arc(beast.x*cellSize,beast.y*cellSize,3,0,Math.PI*2);mapCtx.fill();}
    const px=state.player.x*cellSize,py=state.player.y*cellSize;
    mapCtx.save();mapCtx.translate(px,py);mapCtx.rotate(state.player.angle);
    mapCtx.fillStyle='rgba(201,151,255,.16)';mapCtx.beginPath();mapCtx.moveTo(38,-18);mapCtx.lineTo(38,18);mapCtx.lineTo(0,0);mapCtx.closePath();mapCtx.fill();
    mapCtx.fillStyle='#f4e9ff';mapCtx.shadowColor='#c997ff';mapCtx.shadowBlur=12;mapCtx.beginPath();mapCtx.moveTo(10,0);mapCtx.lineTo(-7,-6);mapCtx.lineTo(-4,0);mapCtx.lineTo(-7,6);mapCtx.closePath();mapCtx.fill();mapCtx.restore();
    mapCtx.shadowBlur=0;mapCtx.font='700 12px DM Sans, sans-serif';mapCtx.fillStyle='#f4e9ff';mapCtx.fillText('YOU ARE HERE',Math.min(size-92,px+12),Math.max(16,py-11));
  }

  function toggleMap() {
    if(!state.running||state.finished)return;
    state.mapOpen=!state.mapOpen;$('#mini-map').classList.toggle('is-visible',state.mapOpen);$('#map-button').classList.toggle('is-active',state.mapOpen);$('#map-button').setAttribute('aria-expanded',String(state.mapOpen));
    if(state.mapOpen)renderMiniMap();
  }

  function showMessage(copy) {
    const message=$('#message');message.textContent=copy;message.classList.add('is-visible');clearTimeout(state.messageTimer);state.messageTimer=setTimeout(()=>message.classList.remove('is-visible'),1800);
  }

  function finish(won) {
    state.finished=true;state.running=false;document.exitPointerLock?.();
    $('#end-eyebrow').innerHTML=`<span></span>${won?'All trials complete':'Field trial interrupted'}`;
    $('#end-title').innerHTML=won?'Ten mazes<br>mastered.':'The maze<br>prevails.';
    $('#end-copy').textContent=won?'Every labyrinth is charted and every dragon safely contained. The celestial archive records your triumph.':'The dragons overwhelmed your wards. Recover, then return to the current field trial.';
    $('#stat-levels').textContent=won?TOTAL_LEVELS:state.level-1;$('#stat-beasts').textContent=state.totalKills;$('#stat-xp').textContent=state.xp;
    $('#end-screen').classList.add('screen--active');
  }

  function start() {
    resetGame();state.running=true;state.paused=false;state.lastTime=performance.now();
    $('#start-screen').classList.remove('screen--active');$('#pause-screen').classList.remove('screen--active');$('#end-screen').classList.remove('screen--active');$('#hud').classList.add('is-active');
    showMessage('Level 01 · contain the dragons and find the gate');
    if(matchMedia('(pointer:fine)').matches)canvas.requestPointerLock?.();
  }

  function setPaused(paused) {
    if(!state.running||state.finished)return;state.paused=paused;$('#pause-screen').classList.toggle('screen--active',paused);
    if(paused)document.exitPointerLock?.();else{state.lastTime=performance.now();if(matchMedia('(pointer:fine)').matches)canvas.requestPointerLock?.();}
  }

  function frame(time) {
    const dt=Math.min(.05,(time-state.lastTime)/1000||0);state.lastTime=time;update(dt,time);renderWorld(time);updateHud(time);requestAnimationFrame(frame);
  }

  addEventListener('resize',resize);
  addEventListener('keydown',event=>{
    state.keys.add(event.code);
    if(event.code==='Digit1'||event.code==='Space')cast('lightning');if(event.code==='Digit2')cast('frost');if(event.code==='Digit3')cast('bubble');if(event.code==='KeyM'&&!event.repeat)toggleMap();if(event.code==='Escape'&&state.running)setPaused(!state.paused);
  });
  addEventListener('keyup',event=>state.keys.delete(event.code));
  addEventListener('mousemove',event=>{if(document.pointerLockElement===canvas&&state.running&&!state.paused)state.player.angle+=event.movementX*.0024;});
  canvas.addEventListener('click',()=>{if(state.running&&!state.paused&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
  canvas.addEventListener('mousedown',event=>{if(event.button===0&&document.pointerLockElement===canvas)cast('lightning');});

  const joystick=$('#joystick'),stick=joystick.querySelector('i');
  joystick.addEventListener('pointerdown',event=>{state.joystick.pointer=event.pointerId;joystick.setPointerCapture(event.pointerId);});
  joystick.addEventListener('pointermove',event=>{if(event.pointerId!==state.joystick.pointer)return;const r=joystick.getBoundingClientRect();let x=event.clientX-(r.left+r.width/2),y=event.clientY-(r.top+r.height/2);const d=Math.hypot(x,y),max=30;if(d>max){x=x/d*max;y=y/d*max;}state.joystick.x=x/max;state.joystick.y=y/max;stick.style.transform=`translate(${x}px,${y}px)`;});
  const releaseStick=event=>{if(event.pointerId===state.joystick.pointer){state.joystick={x:0,y:0,pointer:null};stick.style.transform='';}};
  joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);
  const look=$('#touch-look');
  look.addEventListener('pointerdown',event=>{state.lookPointer=event.pointerId;state.lookX=event.clientX;look.setPointerCapture(event.pointerId);});
  look.addEventListener('pointermove',event=>{if(event.pointerId!==state.lookPointer)return;state.player.angle+=(event.clientX-state.lookX)*.008;state.lookX=event.clientX;});
  look.addEventListener('pointerup',event=>{if(event.pointerId===state.lookPointer)state.lookPointer=null;});

  $$('.spell').forEach(button=>button.addEventListener('pointerdown',event=>{event.preventDefault();$$('.spell').forEach(item=>item.classList.remove('is-selected'));button.classList.add('is-selected');cast(button.dataset.spell);}));
  $('#map-button').addEventListener('click',toggleMap);$('#start-button').addEventListener('click',start);$('#pause-button').addEventListener('click',()=>setPaused(true));$('#resume-button').addEventListener('click',()=>setPaused(false));$('#restart-button').addEventListener('click',start);$('#play-again-button').addEventListener('click',start);

  resize();resetGame();requestAnimationFrame(frame);
})();
