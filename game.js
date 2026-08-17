(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const mapCanvas = document.querySelector('#mini-map-canvas');
  const mapCtx = mapCanvas.getContext('2d');
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const dragonImage = new Image();
  const berryBushImage = new Image();
  const coarseControls = matchMedia('(pointer:coarse)').matches;
  const moonWitch = new window.MoonWitch3D($('#moon-witch-3d'));
  const introMoonWitch = new window.MoonWitch3D($('#moon-witch-intro-3d'), { compact: true });
  const wallSurfaces = {};
  const wallTextures = Object.fromEntries(Object.entries({
    brick: 'assets/ancient-brick-wall-v2.jpg',
    hedge: 'assets/moonflower-hedge-v2.jpg',
    crystal: 'assets/arcane-crystal-wall-v2.jpg',
    stone: 'assets/sunken-stone-wall-v2.jpg',
    mushroom: 'assets/spore-briar-wall-v2.jpg',
    thorn: 'assets/spore-briar-wall-v2.jpg',
    ice: 'assets/arcane-crystal-wall-v2.jpg',
    ember: 'assets/cinderstone-wall-v2.jpg',
    marble: 'assets/sunken-stone-wall-v2.jpg',
    starlight: 'assets/arcane-crystal-wall-v2.jpg'
  }).map(([type, source]) => {
    const image = new Image();
    image.addEventListener('load', () => prepareWallSurface(type, image));
    image.src = source;
    return [type, image];
  }));
  let dragonSprite = null;
  dragonImage.addEventListener('load', prepareDragonSprite);
  dragonImage.src = 'assets/dragon-beast.png';
  berryBushImage.src = 'assets/golden-berry-bush.png';

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
    introActive: false,
    introTimer: 0,
    level: 1,
    map: [],
    theme: levelThemes[0],
    lastTime: 0,
    simulationRemainder: 0,
    player: { x: 1.5, y: 1.5, angle: 0, health: 100, z: 0, verticalVelocity: 0, vx: 0, vy: 0, turnVelocity: 0, crouching: false, moving: false },
    beasts: [],
    berries: [],
    obstacles: [],
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
    mapOpen: false,
    pouchOpen: false,
    mobileCrouch: false,
    obstacleNoticeUntil: 0,
    lightningBoostUntil: 0,
    frostBoostUntil: 0,
    spellFx: { type: '', until: 0, seed: 0 },
    castPoseUntil: 0,
    castPoseSpell: '',
    inventory: { berry: 0, storm: 1, frost: 1, phoenix: 1 }
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
    const obstacleCount = 2 + Math.floor(level / 3);
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

    return { map: grid.map(row => row.join('')), beasts: takePositions(beastCount), berries: takePositions(berryCount), obstacles: takePositions(obstacleCount) };
  }

  function resetGame() {
    state.totalKills = 0;
    state.berriesEaten = 0;
    state.xp = 0;
    state.powered = false;
    state.finished = false;
    state.player.health = 100;
    state.inventory = { berry: 0, storm: 1, frost: 1, phoenix: 1 };
    state.lightningBoostUntil = 0;
    state.frostBoostUntil = 0;
    loadLevel(1, false);
  }

  function loadLevel(level, carryHealth = true) {
    const generated = generateLevel(level);
    state.level = level;
    state.map = generated.map;
    state.theme = levelThemes[level - 1];
    state.player = { x: 1.5, y: 1.5, angle: 0, health: carryHealth ? Math.min(100, state.player.health + 20) : 100, z: 0, verticalVelocity: 0, vx: 0, vy: 0, turnVelocity: 0, crouching: false, moving: false };
    state.kills = 0;
    state.bubbleUntil = 0;
    state.cooldowns = { lightning: 0, frost: 0, bubble: 0 };
    state.target = null;
    state.beasts = generated.beasts.map(([x,y], index) => {
      const maxHealth = 70 + level * 9;
      return {
        x, y, name: beastNames[(level * 3 + index) % beastNames.length], health: maxHealth, maxHealth,
        alive: true, frozenUntil: 0, lastAttack: 0, phase: index * .67, moving: false,
        hue: [285, 174, 322, 202, 42][(index + level) % 5]
      };
    });
    state.berries = generated.berries.map(([x,y], index) => ({ x, y, collected: false, phase: index * 1.13, notifiedUntil: 0 }));
    state.obstacles = generated.obstacles.map(([x,y], index) => ({ x, y, type: index % 2 ? 'moonArch' : 'fallenRelic', phase: index * .83 }));
    state.mapOpen = false;
    state.pouchOpen = false;
    state.mobileCrouch = false;
    $('#mini-map').classList.remove('is-visible');
    $('#map-button').classList.remove('is-active');
    $('#map-button').setAttribute('aria-expanded', 'false');
    $('#pouch').classList.remove('is-visible');
    $('#pouch-button').classList.remove('is-active');
    $('#pouch-button').setAttribute('aria-expanded', 'false');
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
    const radius = .18;
    if (isBlockingTile(cell(x, y))) return false;
    for (let sample = 0; sample < 8; sample++) {
      const angle = sample * Math.PI / 4;
      if (isBlockingTile(cell(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius))) return false;
    }
    for(const obstacle of state.obstacles){
      if(Math.hypot(x-obstacle.x,y-obstacle.y)>.5)continue;
      const canPass=obstacle.type==='fallenRelic'?state.player.z>.42:state.player.crouching;
      if(!canPass){const now=performance.now();if(now>state.obstacleNoticeUntil){showMessage(obstacle.type==='fallenRelic'?'Jump over the fallen rune relic':'Crouch beneath the moon arch');state.obstacleNoticeUntil=now+1800;}return false;}
    }
    return true;
  }

  function jump() {
    if(!state.running||state.paused||state.pouchOpen||state.introActive||state.player.z>.02)return;
    state.player.verticalVelocity=4.15;
    state.player.crouching=false;
    state.mobileCrouch=false;
    $('#crouch-button').classList.remove('is-active');
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function raycast(angle, max = 24) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let mapX = Math.floor(state.player.x), mapY = Math.floor(state.player.y);
    const deltaX = Math.abs(1 / (Math.abs(dx) < .000001 ? .000001 : dx));
    const deltaY = Math.abs(1 / (Math.abs(dy) < .000001 ? .000001 : dy));
    const stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
    let sideX = (dx < 0 ? state.player.x - mapX : mapX + 1 - state.player.x) * deltaX;
    let sideY = (dy < 0 ? state.player.y - mapY : mapY + 1 - state.player.y) * deltaY;
    let distance = 0, side = 0, tile = '1';

    while (distance < max) {
      if (sideX < sideY) {
        distance = sideX;
        sideX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        distance = sideY;
        sideY += deltaY;
        mapY += stepY;
        side = 1;
      }
      tile = state.map[mapY]?.[mapX] ?? '1';
      if (isBlockingTile(tile)) {
        const x = state.player.x + dx * distance;
        const y = state.player.y + dy * distance;
        let texture = side === 0 ? y - Math.floor(y) : x - Math.floor(x);
        if ((side === 0 && dx > 0) || (side === 1 && dy < 0)) texture = 1 - texture;
        return { distance, tile, side, cellX: mapX, cellY: mapY, x, y, texture };
      }
    }
    return { distance: max, tile: '1', side: 0, cellX: mapX, cellY: mapY, texture: 0 };
  }

  function renderWorld(time) {
    const w = innerWidth, h = innerHeight;
    const shakeX = state.shake ? (Math.random() - .5) * state.shake : 0;
    const shakeY = state.shake ? (Math.random() - .5) * state.shake : 0;
    const cameraOffset = state.player.z * 34 - (state.player.crouching ? 18 : 0);
    ctx.save();
    ctx.translate(shakeX, shakeY + cameraOffset);
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

    const rayCount = Math.min(coarseControls ? 300 : 480, Math.ceil(w / (coarseControls ? 2.7 : 2.25)));
    const strip = w / rayCount + .6;
    state.rayDepths.length = rayCount;
    for (let i = 0; i < rayCount; i++) {
      const rayAngle = state.player.angle - FOV / 2 + (i / rayCount) * FOV;
      const hit = raycast(rayAngle);
      const corrected = hit.distance * Math.cos(rayAngle - state.player.angle);
      state.rayDepths[i] = corrected;
      const wallH = Math.min(h * 1.28, h / Math.max(.08, corrected));
      drawWallStrip(hit, i * strip, strip, h * .5 - wallH / 2, wallH, time);
    }

    renderWorldObjects(time, w, h, rayCount);
    renderAtmosphere(time, w, h);
    renderSpellFx(time, w, h);
    ctx.restore();
    state.shake *= .86;
    if (state.mapOpen) renderMiniMap();
  }

  function drawWallStrip(hit, x, width, top, height, time) {
    const theme = state.theme;
    const mist = Math.min(.8, hit.distance / 16);
    const sideShade = hit.side ? .72 : 1;
    if (hit.tile === '2') {
      ctx.fillStyle = `hsl(43 60% ${30 + Math.sin(time * .004) * 7}%)`;
      ctx.fillRect(x, top, width + 1, height);
      ctx.fillStyle = `rgba(255,232,142,${.2 + Math.sin(time * .006 + x) * .08})`;
      ctx.fillRect(x, top + height * .1, width + 1, height * .8);
      return;
    }

    const variation = Math.abs((hit.cellX * 37 + hit.cellY * 71 + state.level * 13) % 11);
    const image = wallSurfaces[theme.wall] || wallTextures[theme.wall];
    const textureU = (hit.texture + variation * .0685) % 1;
    const imageWidth=image?.naturalWidth||image?.width||0,imageHeight=image?.naturalHeight||image?.height||0;
    if (imageWidth && imageHeight) {
      const sourceWidth = Math.max(2, Math.ceil(imageWidth / 520));
      const sourceX = Math.min(imageWidth - sourceWidth, Math.floor(textureU * (imageWidth - sourceWidth)));
      ctx.save();
      ctx.globalAlpha = 1 - mist * .48;
      ctx.drawImage(image, sourceX, 0, sourceWidth, imageHeight, x, top, width + 1, height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(3,2,8,${.055 + variation % 3 * .025 + (1 - sideShade) * .3 + mist * .15})`;
      ctx.fillRect(x, top, width + 1, height);
      const seam = Math.min(hit.texture, 1 - hit.texture);
      if (seam < .018) {
        ctx.fillStyle = `rgba(0,0,0,${.26 * (1 - seam / .018)})`;
        ctx.fillRect(x, top, width + 1, height);
      }
      ctx.restore();
      drawFantasyWallDetail(textureU, variation, x, width, top, height, time, mist);
    } else {
      const light = 18 + sideShade * 10;
      ctx.fillStyle = `hsl(${theme.hue} 34% ${light}%)`;
      ctx.fillRect(x, top, width + 1, height);
    }
    if (mist > .18) {
      ctx.fillStyle = `rgba(38,28,60,${mist * .34})`;
      ctx.fillRect(x, top, width + 1, height);
    }
  }

  function prepareWallSurface(wall, image) {
    const surface=document.createElement('canvas'),size=512,tile=size/2;
    surface.width=size;surface.height=size;
    const surfaceCtx=surface.getContext('2d');
    surfaceCtx.filter=wallTextureFilter(wall,5);
    for(let row=0;row<2;row++)for(let column=0;column<2;column++)surfaceCtx.drawImage(image,column*tile,row*tile,tile,tile);
    surfaceCtx.filter='none';
    wallSurfaces[wall]=surface;
  }

  function wallTextureFilter(wall, variation) {
    if (wall === 'brick') return `brightness(${.77 + variation * .018}) contrast(1.2) saturate(.9)`;
    if (wall === 'hedge') return `brightness(${.72 + variation * .022}) contrast(1.18) saturate(1.1)`;
    if (wall === 'crystal') return 'brightness(.87) contrast(1.22) saturate(1.16)';
    if (wall === 'stone') return `brightness(${.72 + variation * .014}) contrast(1.24) saturate(.68)`;
    if (wall === 'mushroom') return 'brightness(.76) contrast(1.2) saturate(1.18)';
    if (wall === 'thorn') return 'hue-rotate(38deg) brightness(.62) contrast(1.28) saturate(.9)';
    if (wall === 'ice') return 'hue-rotate(238deg) saturate(.62) brightness(1.18) contrast(1.08)';
    if (wall === 'ember') return 'brightness(.82) contrast(1.24) saturate(1.14)';
    if (wall === 'marble') return 'grayscale(.72) hue-rotate(175deg) brightness(1.06) contrast(1.08)';
    return 'hue-rotate(18deg) saturate(.72) brightness(.7) contrast(1.34)';
  }

  function drawFantasyWallDetail(u, variation, x, width, top, height, time, mist) {
    const wall = state.theme.wall;
    const alpha = Math.max(0, 1 - mist * .9);
    const thin = Math.max(1, height * .0035);
    const wave = (frequency, phase = 0) => .5 + Math.sin(u * Math.PI * 2 * frequency + variation + phase) * .18;
    const line = (v, color, thickness = thin) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, top + height * v, width + 1, thickness);
    };

    ctx.save();
    if ((wall === 'brick' || wall === 'stone' || wall === 'marble') && variation % 5 === 0) {
      const runeV = wave(1.35);
      if (u > .18 && u < .82) line(runeV, `rgba(191,128,255,${.24 * alpha})`);
      if (Math.abs(u - .3) < .018 || Math.abs(u - .7) < .018) {
        ctx.fillStyle = `rgba(219,172,255,${.19 * alpha})`;
        ctx.fillRect(x, top + height * .33, width + 1, height * .34);
      }
    }
    if (wall === 'brick' && variation % 3 === 1) {
      ctx.fillStyle = `rgba(42,75,31,${.2 * alpha})`;
      ctx.fillRect(x, top, width + 1, height * (.035 + .04 * Math.abs(Math.sin(u * 9 + variation))));
    } else if (wall === 'hedge') {
      if (Math.abs(Math.sin(u * 29 + variation)) > .985) {
        ctx.fillStyle = `rgba(190,224,255,${.38 * alpha})`;
        ctx.fillRect(x, top + height * wave(2.3), width + 1, Math.max(2, height * .012));
      }
    } else if (wall === 'mushroom' || wall === 'thorn') {
      line(wave(wall === 'thorn' ? 1.7 : 2.4), `rgba(${wall === 'thorn' ? '127,214,142' : '231,135,255'},${.28 * alpha})`, thin * 1.25);
      if ((Math.floor(u * 31) + variation) % 13 === 0) {
        ctx.fillStyle = `rgba(240,196,255,${.42 * alpha})`;
        ctx.fillRect(x, top + height * (.18 + ((variation * 17) % 57) / 100), width + 1, Math.max(2, height * .009));
      }
    } else if (wall === 'crystal' || wall === 'ice' || wall === 'starlight') {
      const color = wall === 'ice' ? '184,244,255' : wall === 'starlight' ? '240,222,255' : '204,145,255';
      line(wave(2.1, .8), `rgba(${color},${.3 * alpha})`);
      if (Math.abs(Math.sin(u * 37 + variation)) > .993) {
        ctx.fillStyle = `rgba(255,255,255,${.5 * alpha})`;
        ctx.fillRect(x, top + height * .22, width + 1, height * .5);
      }
    } else if (wall === 'ember') {
      const pulse = .62 + Math.sin(time * .003 + variation) * .2;
      line(wave(2.7), `rgba(255,92,24,${pulse * .46 * alpha})`, thin * 1.5);
    }
    ctx.restore();
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

  function renderSpellFx(time,w,h){
    if(time>state.spellFx.until)return;
    const life=Math.max(0,(state.spellFx.until-time)/420);
    if(state.spellFx.type==='lightning'){
      const startX=w*.575,startY=h*.81,endX=w*.5,endY=h*.5;
      ctx.save();ctx.globalCompositeOperation='screen';
      for(let stream=0;stream<5;stream++){
        const points=16,spread=(stream-2)*3.4;ctx.beginPath();ctx.moveTo(startX,startY);
        for(let i=1;i<=points;i++){const t=i/points;const jitter=Math.sin(i*12.73+stream*8.31+state.spellFx.seed)*((1-t)*14+3);const arc=Math.sin(t*Math.PI)*spread*4;ctx.lineTo(startX+(endX-startX)*t+jitter+arc,startY+(endY-startY)*t+Math.cos(i*7.1+stream)*7);}
        ctx.strokeStyle=stream===2?`rgba(255,255,255,${life})`:`rgba(${150+stream*18},${170+stream*11},255,${life*.72})`;ctx.lineWidth=stream===2?2.6:1.15;ctx.shadowColor=stream%2?'#8f53ff':'#75cfff';ctx.shadowBlur=stream===2?18:10;ctx.stroke();
      }
      for(let branch=0;branch<8;branch++){const t=.18+branch*.085,bx=startX+(endX-startX)*t,by=startY+(endY-startY)*t;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+(branch%2?1:-1)*(18+branch*3),by-12+branch*2);ctx.strokeStyle=`rgba(174,126,255,${life*.5})`;ctx.lineWidth=.8;ctx.stroke();}
      ctx.restore();
    }else if(state.spellFx.type==='frost'){
      ctx.save();ctx.translate(w*.5,h*.5);ctx.strokeStyle=`rgba(190,249,255,${life*.75})`;ctx.shadowColor='#7edfff';ctx.shadowBlur=14;for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(58*(1-life*.2),0);ctx.lineTo(47,-8);ctx.moveTo(47,0);ctx.lineTo(38,9);ctx.stroke();}ctx.restore();
    }
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
    for (const obstacle of state.obstacles) addVisibleObject(visible, obstacle, 'obstacle');
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
      } else if(item.type==='berry') {
        const size = Math.min(h * .52, h / Math.max(.6, item.distance) * .46);
        drawBerryBush(item.object, screenX, h * .5 + size * .53, size, time);
      } else {
        const size=Math.min(h*.82,h/Math.max(.55,item.distance)*.72);
        drawFantasyObstacle(item.object,screenX,h*.5+size*.42,size,time);
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
    if(berryBushImage.complete&&berryBushImage.naturalWidth){
      const sway=Math.sin(time*.0025+berry.phase)*size*.012;
      ctx.save();ctx.translate(x+sway,groundY);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=berry.collected?.35:1;
      ctx.filter=berry.collected?'grayscale(1) brightness(.35)':'saturate(1.16) contrast(1.08) drop-shadow(0 0 12px rgba(255,196,53,.38))';
      ctx.drawImage(berryBushImage,-size*.62,-size,size*1.24,size);ctx.filter='none';ctx.globalCompositeOperation='source-over';ctx.restore();return;
    }
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

  function drawFantasyObstacle(obstacle,x,groundY,size,time){
    const pulse=.65+Math.sin(time*.003+obstacle.phase)*.25;
    ctx.save();ctx.translate(x,groundY);
    if(obstacle.type==='fallenRelic'){
      const gradient=ctx.createLinearGradient(-size*.62,0,size*.62,0);gradient.addColorStop(0,'#160c17');gradient.addColorStop(.45,'#79556e');gradient.addColorStop(1,'#120914');
      ctx.fillStyle=gradient;ctx.shadowColor='#c062ff';ctx.shadowBlur=size*.05;ctx.beginPath();ctx.roundRect(-size*.68,-size*.23,size*1.36,size*.28,size*.06);ctx.fill();
      ctx.strokeStyle=`rgba(223,151,255,${pulse})`;ctx.lineWidth=Math.max(1,size*.012);for(let i=-2;i<=2;i++){const rx=i*size*.19;ctx.beginPath();ctx.moveTo(rx,-size*.2);ctx.lineTo(rx+size*.05,-size*.09);ctx.lineTo(rx-size*.02,-size*.03);ctx.stroke();}
    }else{
      ctx.strokeStyle='#35233c';ctx.lineWidth=size*.13;ctx.lineCap='round';ctx.shadowColor='#8d54cc';ctx.shadowBlur=size*.035;ctx.beginPath();ctx.moveTo(-size*.48,0);ctx.quadraticCurveTo(-size*.5,-size*.95,0,-size*.94);ctx.quadraticCurveTo(size*.5,-size*.95,size*.48,0);ctx.stroke();
      ctx.strokeStyle=`rgba(170,106,230,${pulse})`;ctx.lineWidth=Math.max(1,size*.016);ctx.beginPath();ctx.arc(0,-size*.68,size*.17,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='rgba(21,11,30,.84)';ctx.fillRect(-size*.39,-size*.72,size*.78,size*.22);
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
    const gait=frozen?0:Math.sin(time*(dragon.moving?.009:.0034)+dragon.phase);
    const tailSweep=frozen?0:Math.sin(time*.004+dragon.phase)*.035;
    const bob = frozen?0:Math.abs(gait) * size * (dragon.moving?.018:.008);
    const drawWidth = size * 1.62;
    const drawHeight = size * 1.08;
    ctx.save();
    ctx.translate(x, groundY + bob);
    ctx.rotate(tailSweep);
    ctx.transform(1,gait*.012,gait*.018,1,0,0);
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
    if(!frozen&&dragon.moving){
      ctx.save();ctx.globalAlpha=.18;ctx.beginPath();ctx.rect(-drawWidth*.42,-drawHeight*.34,drawWidth*.84,drawHeight*.38);ctx.clip();ctx.translate(gait*size*.028,Math.abs(gait)*size*.012);ctx.drawImage(dragonSprite,-drawWidth/2,-drawHeight,drawWidth,drawHeight);ctx.restore();
    }
    if(frozen){ctx.globalCompositeOperation='screen';ctx.fillStyle='rgba(70,185,255,.18)';ctx.fillRect(-drawWidth*.49,-drawHeight*.96,drawWidth*.98,drawHeight*.94);ctx.globalCompositeOperation='source-over';ctx.strokeStyle='rgba(216,255,255,.88)';ctx.lineWidth=Math.max(1,size*.008);for(let i=0;i<9;i++){const px=(i-4)*size*.13;ctx.beginPath();ctx.moveTo(px,-size*.05);ctx.lineTo(px+size*.08,-size*(.4+(i%3)*.17));ctx.stroke();}}
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

  function movePlayerWithCollision(player, deltaX, deltaY) {
    const distance = Math.hypot(deltaX, deltaY);
    const steps = Math.max(1, Math.ceil(distance / .075));
    const stepX = deltaX / steps, stepY = deltaY / steps;
    for (let step = 0; step < steps; step++) {
      if (canWalk(player.x + stepX, player.y + stepY)) {
        player.x += stepX;
        player.y += stepY;
      } else {
        if (canWalk(player.x + stepX, player.y)) player.x += stepX;
        if (canWalk(player.x, player.y + stepY)) player.y += stepY;
      }
    }
  }

  function update(dt, now) {
    if (!state.running || state.paused || state.pouchOpen || state.introActive || state.finished) return;
    const p = state.player;
    p.crouching=state.mobileCrouch||state.keys.has('KeyC')||state.keys.has('ControlLeft')||state.keys.has('ControlRight');
    p.verticalVelocity-=8.5*dt;p.z+=p.verticalVelocity*dt;if(p.z<=0){p.z=0;p.verticalVelocity=0;}
    let forward=0,strafe=0;
    if(state.keys.has('KeyW')||state.keys.has('ArrowUp'))forward++;
    if(state.keys.has('KeyS')||state.keys.has('ArrowDown'))forward--;
    if(state.keys.has('KeyD'))strafe++;
    if(state.keys.has('KeyA'))strafe--;
    forward+=-state.joystick.y;strafe+=state.joystick.x;
    const inputLength=Math.hypot(forward,strafe);
    if(inputLength>1){forward/=inputLength;strafe/=inputLength;}
    if(inputLength<.025){forward=0;strafe=0;}

    let turn=0;
    if(state.keys.has('ArrowLeft')||state.keys.has('KeyQ'))turn--;
    if(state.keys.has('ArrowRight')||state.keys.has('KeyE'))turn++;
    p.turnVelocity=turn*2.35;
    p.angle=normalizeAngle(p.angle+p.turnVelocity*dt);

    const sprinting=!p.crouching&&forward>.15&&(state.keys.has('ShiftLeft')||state.keys.has('ShiftRight'));
    const speed=(sprinting?3.45:2.55)*(p.crouching ? .58 : 1);
    p.vx=(Math.cos(p.angle)*forward+Math.cos(p.angle+Math.PI/2)*strafe)*speed;
    p.vy=(Math.sin(p.angle)*forward+Math.sin(p.angle+Math.PI/2)*strafe)*speed;
    movePlayerWithCollision(p,p.vx*dt,p.vy*dt);
    p.moving=Boolean(forward||strafe);

    collectBerries(now);
    for(const beast of state.beasts){
      beast.moving=false;if(!beast.alive||beast.frozenUntil>now)continue;
      const dx=p.x-beast.x,dy=p.y-beast.y,distance=Math.hypot(dx,dy);
      if(distance<5.7&&hasLineOfSight(beast)){
        if(distance>.82){beast.moving=true;const move=dt*(.48+state.level*.035);const bx=beast.x+dx/distance*move,by=beast.y+dy/distance*move;if(cell(bx,beast.y)==='0')beast.x=bx;if(cell(beast.x,by)==='0')beast.y=by;}
        if(distance<1.05&&now-beast.lastAttack>1100){beast.lastAttack=now;if(now<state.bubbleUntil)showMessage('Aegis absorbed the strike');else damagePlayer(6+state.level);}
      }
    }
    if(cell(p.x,p.y)==='2'&&!gateIsLocked())advanceLevel();
  }

  function collectBerries(now) {
    for (const berry of state.berries) {
      if (berry.collected || Math.hypot(berry.x-state.player.x,berry.y-state.player.y) > .58) continue;
      berry.collected=true;state.berriesEaten++;state.inventory.berry++;
      showMessage('Golden berry added to your pouch · press P');
      updateHud(now);
    }
  }

  function damagePlayer(amount) {
    state.player.health=Math.max(0,state.player.health-amount);state.shake=10;
    const vignette=$('#damage-vignette');vignette.classList.add('is-hit');setTimeout(()=>vignette.classList.remove('is-hit'),120);
    if(state.player.health<=0)finish(false);
  }

  function cast(spell) {
    if(!state.running||state.paused||state.pouchOpen||state.introActive||state.finished)return;
    const now=performance.now();
    if(now<state.cooldowns[spell]){showMessage('Spell is gathering strength');return;}
    state.spellFx={type:spell,until:now+(spell==='lightning'?420:620),seed:Math.random()*100};
    state.castPoseUntil=now+560;state.castPoseSpell=spell;
    const fx=$('#cast-fx');fx.className=`cast-fx ${spell}`;setTimeout(()=>{if(fx.classList.contains(spell))fx.className='cast-fx';},600);
    if(spell==='bubble'){
      state.bubbleUntil=now+5000;state.cooldowns.bubble=now+12000;showMessage('Aegis Orb raised · 5 seconds');
    }else if(!state.target){
      state.cooldowns[spell]=now+(spell==='lightning'?320:1200);showMessage('No beast in your sights');
    }else{
      const beast=state.target.beast;
      if(spell==='lightning'){
        const damage=(state.powered?55:34)+(now<state.lightningBoostUntil?28:0);beast.health=Math.max(0,beast.health-damage);state.cooldowns.lightning=now+(state.powered?470:650);state.shake=4;if(!beast.health)defeat(beast);
      }else{
        beast.frozenUntil=now+(now<state.frostBoostUntil?9000:(state.powered?6000:4000));state.cooldowns.frost=now+7800;showMessage(`${beast.name} frozen solid`);
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
    $('#character-shield').classList.toggle('is-active',now<state.bubbleUntil);
    $('#hud').classList.toggle('is-jumping',state.player.z>.08);
    $('#hud').classList.toggle('is-crouching',state.player.crouching);
    $('#hud').classList.toggle('is-moving',state.player.moving&&state.player.z<.08);
    const casting=now<state.castPoseUntil;$('#hud').classList.toggle('is-casting',casting);$('#hud').classList.toggle('is-casting-lightning',casting&&state.castPoseSpell==='lightning');$('#hud').classList.toggle('is-casting-frost',casting&&state.castPoseSpell==='frost');$('#hud').classList.toggle('is-casting-bubble',casting&&state.castPoseSpell==='bubble');
    $('#item-berry-count').textContent=state.inventory.berry;$('#item-storm-count').textContent=state.inventory.storm;$('#item-frost-count').textContent=state.inventory.frost;$('#item-phoenix-count').textContent=state.inventory.phoenix;
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
    for(const obstacle of state.obstacles){mapCtx.fillStyle=obstacle.type==='fallenRelic'?'#76dfff':'#bc78ff';mapCtx.fillRect(obstacle.x*cellSize-2.5,obstacle.y*cellSize-2.5,5,5);}
    for(const beast of state.beasts){if(!beast.alive)continue;mapCtx.fillStyle='#ff6da9';mapCtx.beginPath();mapCtx.arc(beast.x*cellSize,beast.y*cellSize,3,0,Math.PI*2);mapCtx.fill();}
    const px=state.player.x*cellSize,py=state.player.y*cellSize;
    mapCtx.save();mapCtx.translate(px,py);mapCtx.rotate(state.player.angle);
    mapCtx.fillStyle='rgba(201,151,255,.16)';mapCtx.beginPath();mapCtx.moveTo(38,-18);mapCtx.lineTo(38,18);mapCtx.lineTo(0,0);mapCtx.closePath();mapCtx.fill();
    mapCtx.fillStyle='#f4e9ff';mapCtx.shadowColor='#c997ff';mapCtx.shadowBlur=12;mapCtx.beginPath();mapCtx.moveTo(10,0);mapCtx.lineTo(-7,-6);mapCtx.lineTo(-4,0);mapCtx.lineTo(-7,6);mapCtx.closePath();mapCtx.fill();mapCtx.restore();
    mapCtx.shadowBlur=0;mapCtx.font='700 12px DM Sans, sans-serif';mapCtx.fillStyle='#f4e9ff';mapCtx.fillText('YOU ARE HERE',Math.min(size-92,px+12),Math.max(16,py-11));
  }

  function toggleMap() {
    if(!state.running||state.introActive||state.finished)return;
    if(state.pouchOpen){state.pouchOpen=false;$('#pouch').classList.remove('is-visible');$('#pouch-button').classList.remove('is-active');$('#pouch-button').setAttribute('aria-expanded','false');}
    state.mapOpen=!state.mapOpen;$('#mini-map').classList.toggle('is-visible',state.mapOpen);$('#map-button').classList.toggle('is-active',state.mapOpen);$('#map-button').setAttribute('aria-expanded',String(state.mapOpen));
    if(state.mapOpen)renderMiniMap();
  }

  function requestGamePointerLock() {
    if(!matchMedia('(pointer:fine)').matches||document.pointerLockElement===canvas)return;
    try {
      const request=canvas.requestPointerLock?.();
      if(request&&typeof request.catch==='function')request.catch(haltMovement);
    } catch {
      haltMovement();
    }
  }

  function togglePouch(force) {
    if(!state.running||state.introActive||state.finished)return;
    state.pouchOpen=force??!state.pouchOpen;
    $('#pouch').classList.toggle('is-visible',state.pouchOpen);$('#pouch-button').classList.toggle('is-active',state.pouchOpen);$('#pouch-button').setAttribute('aria-expanded',String(state.pouchOpen));
    if(state.pouchOpen){haltMovement();state.mapOpen=false;$('#mini-map').classList.remove('is-visible');$('#map-button').classList.remove('is-active');$('#map-button').setAttribute('aria-expanded','false');document.exitPointerLock?.();}
    else if(!state.paused)requestGamePointerLock();
  }

  function usePouchItem(item) {
    if(!state.inventory[item]){showMessage('That pouch pocket is empty');return;}
    const now=performance.now();
    if(item==='berry'){
      if(state.player.health>=100){showMessage('Health is already full');return;}
      const before=state.player.health;state.player.health=Math.min(100,state.player.health+30);state.inventory.berry--;
      const flash=$('#berry-flash');flash.querySelector('strong').textContent=`+${state.player.health-before} HEALTH`;flash.classList.remove('is-visible');requestAnimationFrame(()=>flash.classList.add('is-visible'));setTimeout(()=>flash.classList.remove('is-visible'),1100);showMessage('Golden berry eaten');
    }else if(item==='storm'){
      state.inventory.storm--;state.lightningBoostUntil=now+15000;showMessage('Storm crystal active · lightning empowered');
    }else if(item==='frost'){
      state.inventory.frost--;state.frostBoostUntil=now+15000;showMessage('Frost rune active · deep freeze empowered');
    }else{
      if(state.player.health>=100){showMessage('Health is already full');return;}state.inventory.phoenix--;state.player.health=100;showMessage('Phoenix feather restored full health');
    }
    updateHud(now);
  }

  function showMessage(copy) {
    const message=$('#message');message.textContent=copy;message.classList.add('is-visible');clearTimeout(state.messageTimer);state.messageTimer=setTimeout(()=>message.classList.remove('is-visible'),1800);
  }

  function finish(won) {
    clearTimeout(state.introTimer);state.introActive=false;$('#moon-arch-intro').classList.remove('is-active');$('#moon-arch-intro').setAttribute('aria-hidden','true');
    state.finished=true;state.running=false;document.exitPointerLock?.();
    $('#end-eyebrow').innerHTML=`<span></span>${won?'All trials complete':'Field trial interrupted'}`;
    $('#end-title').innerHTML=won?'Ten mazes<br>mastered.':'The maze<br>prevails.';
    $('#end-copy').textContent=won?'Every labyrinth is charted and every dragon safely contained. The celestial archive records your triumph.':'The dragons overwhelmed your wards. Recover, then return to the current field trial.';
    $('#stat-levels').textContent=won?TOTAL_LEVELS:state.level-1;$('#stat-beasts').textContent=state.totalKills;$('#stat-xp').textContent=state.xp;
    $('#end-screen').classList.add('screen--active');
  }

  function completeMoonArchIntro() {
    if(!state.introActive)return;
    state.introActive=false;state.lastTime=performance.now();state.simulationRemainder=0;
    const intro=$('#moon-arch-intro');intro.classList.remove('is-active');intro.setAttribute('aria-hidden','true');
    showLevelBanner();showMessage('Level 01 · contain the dragons and find the gate');canvas.focus({preventScroll:true});
  }

  function playMoonArchIntro() {
    clearTimeout(state.introTimer);state.introActive=true;
    const intro=$('#moon-arch-intro');intro.classList.remove('is-active');intro.setAttribute('aria-hidden','false');void intro.offsetWidth;intro.classList.add('is-active');
    state.introTimer=setTimeout(completeMoonArchIntro,3200);
  }

  function start() {
    haltMovement();resetGame();state.running=true;state.paused=false;state.lastTime=performance.now();state.simulationRemainder=0;
    $('#start-screen').classList.remove('screen--active');$('#pause-screen').classList.remove('screen--active');$('#end-screen').classList.remove('screen--active');$('#hud').classList.add('is-active');
    playMoonArchIntro();
    canvas.focus({preventScroll:true});
    requestGamePointerLock();
  }

  function setPaused(paused) {
    if(!state.running||state.introActive||state.finished)return;state.paused=paused;$('#pause-screen').classList.toggle('screen--active',paused);
    if(paused){haltMovement();state.simulationRemainder=0;if(state.pouchOpen)togglePouch(false);document.exitPointerLock?.();}else{state.lastTime=performance.now();requestGamePointerLock();}
  }

  function haltMovement() {
    state.keys.clear();
    state.player.vx=0;state.player.vy=0;state.player.turnVelocity=0;state.player.moving=false;
    state.joystick.x=0;state.joystick.y=0;state.joystick.pointer=null;
    const joystickKnob=$('#joystick i');if(joystickKnob)joystickKnob.style.transform='';
  }

  function frame(time) {
    const elapsed=Math.min(.1,(time-state.lastTime)/1000||0),step=1/120;state.lastTime=time;state.simulationRemainder+=elapsed;
    let updates=0;while(state.simulationRemainder>=step&&updates<12){update(step,time);state.simulationRemainder-=step;updates++;}
    if(updates===12)state.simulationRemainder=0;
    renderWorld(time);updateHud(time);
    const characterActive=state.running&&!state.paused&&!state.pouchOpen&&!state.introActive&&!state.finished;
    if(state.running&&!state.introActive)moonWitch.render({
      moving:characterActive&&state.player.moving,
      speed:characterActive?Math.hypot(state.player.vx,state.player.vy):0,
      forward:characterActive?(state.player.vx*Math.cos(state.player.angle)+state.player.vy*Math.sin(state.player.angle))/3.45:0,
      strafe:characterActive?(state.player.vx*-Math.sin(state.player.angle)+state.player.vy*Math.cos(state.player.angle))/3.45:0,
      crouching:characterActive&&state.player.crouching,
      jumpHeight:characterActive?state.player.z:0,
      verticalVelocity:characterActive?state.player.verticalVelocity:0,
      turnVelocity:characterActive?state.player.turnVelocity:0,
      casting:characterActive&&time<state.castPoseUntil,
      spell:state.castPoseSpell
    },time);
    if(state.introActive)introMoonWitch.render({moving:true,speed:2.55,forward:1,strafe:0,crouching:false,jumpHeight:0,verticalVelocity:0,turnVelocity:0,casting:false,spell:'lightning'},time);
    requestAnimationFrame(frame);
  }

  addEventListener('resize',resize);
  addEventListener('keydown',event=>{
    if(state.introActive){event.preventDefault();return;}
    if(state.running&&['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight'].includes(event.code))event.preventDefault();
    state.keys.add(event.code);
    if(event.code==='Digit1')cast('lightning');if(event.code==='Digit2')cast('frost');if(event.code==='Digit3')cast('bubble');if(event.code==='Space'&&!event.repeat){event.preventDefault();jump();}if(event.code==='KeyM'&&!event.repeat)toggleMap();if(event.code==='KeyP'&&!event.repeat)togglePouch();if(event.code==='Escape'&&state.running){if(state.pouchOpen)togglePouch(false);else setPaused(!state.paused);}
  });
  addEventListener('keyup',event=>state.keys.delete(event.code));
  addEventListener('blur',haltMovement);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)haltMovement();});
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas)canvas.focus({preventScroll:true});else haltMovement();});
  document.addEventListener('pointerlockerror',haltMovement);
  addEventListener('mousemove',event=>{if(document.pointerLockElement===canvas&&state.running&&!state.paused&&!state.pouchOpen&&!state.introActive)state.player.angle+=event.movementX*.0024;});
  canvas.addEventListener('click',()=>{canvas.focus({preventScroll:true});if(state.running&&!state.paused&&!state.pouchOpen)requestGamePointerLock();});
  canvas.addEventListener('mousedown',event=>{if(event.button===0&&document.pointerLockElement===canvas)cast('lightning');});

  const joystick=$('#joystick'),stick=joystick.querySelector('i');
  const updateStick=event=>{
    const r=joystick.getBoundingClientRect(),max=r.width*.31;
    let x=event.clientX-(r.left+r.width/2),y=event.clientY-(r.top+r.height/2),distance=Math.hypot(x,y);
    if(distance>max){x=x/distance*max;y=y/distance*max;distance=max;}
    const raw=Math.min(1,distance/max),deadZone=.12,strength=raw<=deadZone?0:(raw-deadZone)/(1-deadZone);
    state.joystick.x=distance?x/distance*strength:0;state.joystick.y=distance?y/distance*strength:0;
    stick.style.transform=`translate(${x}px,${y}px)`;
  };
  joystick.addEventListener('pointerdown',event=>{event.preventDefault();state.joystick.pointer=event.pointerId;joystick.setPointerCapture(event.pointerId);updateStick(event);});
  joystick.addEventListener('pointermove',event=>{if(event.pointerId===state.joystick.pointer)updateStick(event);});
  const releaseStick=event=>{if(event.pointerId===state.joystick.pointer){state.joystick.x=0;state.joystick.y=0;state.joystick.pointer=null;stick.style.transform='';}};
  joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);joystick.addEventListener('lostpointercapture',releaseStick);
  const look=$('#touch-look');
  look.addEventListener('pointerdown',event=>{event.preventDefault();state.lookPointer=event.pointerId;state.lookX=event.clientX;look.setPointerCapture(event.pointerId);});
  look.addEventListener('pointermove',event=>{if(event.pointerId!==state.lookPointer)return;const movement=Math.max(-42,Math.min(42,event.clientX-state.lookX));state.player.angle+=movement*.006;state.lookX=event.clientX;});
  const releaseLook=event=>{if(event.pointerId===state.lookPointer)state.lookPointer=null;};
  look.addEventListener('pointerup',releaseLook);look.addEventListener('pointercancel',releaseLook);look.addEventListener('lostpointercapture',releaseLook);

  $$('.spell').forEach(button=>button.addEventListener('pointerdown',event=>{event.preventDefault();$$('.spell').forEach(item=>item.classList.remove('is-selected'));button.classList.add('is-selected');cast(button.dataset.spell);}));
  $('#jump-button').addEventListener('pointerdown',event=>{event.preventDefault();jump();});
  $('#crouch-button').addEventListener('pointerdown',event=>{event.preventDefault();state.mobileCrouch=!state.mobileCrouch;event.currentTarget.classList.toggle('is-active',state.mobileCrouch);});
  $$('.pouch-item').forEach(button=>button.addEventListener('click',()=>usePouchItem(button.dataset.item)));
  $('#pouch-button').addEventListener('click',()=>togglePouch());$('#pouch-close').addEventListener('click',()=>togglePouch(false));$('#map-button').addEventListener('click',toggleMap);$('#start-button').addEventListener('click',start);$('#pause-button').addEventListener('click',()=>setPaused(true));$('#resume-button').addEventListener('click',()=>setPaused(false));$('#restart-button').addEventListener('click',start);$('#play-again-button').addEventListener('click',start);

  resize();resetGame();requestAnimationFrame(frame);
})();
