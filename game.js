(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const MAP = [
    '11111111111111111',
    '10000010000000001',
    '10111010111110101',
    '10001010000010101',
    '11101011101010101',
    '10001000101000101',
    '10111110101111101',
    '10000010100000101',
    '10111010111110101',
    '10100010001000101',
    '10101111101011101',
    '10100000001010001',
    '10111110111010111',
    '10000010000010001',
    '10111010111111101',
    '10000000000000002',
    '11111111111111111'
  ];
  const FOV = Math.PI / 3;
  const beastNames = ['Mirehorn', 'Glimmerimp', 'Mossback', 'Wispjaw', 'Moonmuzzle', 'Thornling', 'Grumblewing', 'Velvetusk', 'Starbelly', 'Duskantler', 'Glowgullet', 'Bramblebuck'];
  const beastSpawns = [
    [4.5,1.5], [11.5,1.5], [3.5,3.5], [13.5,5.5], [7.5,7.5],
    [3.5,9.5], [11.5,9.5], [5.5,11.5], [14.5,13.5], [10.5,15.5],
    [1.5,13.5], [15.5,1.5]
  ];

  const state = {
    running: false,
    paused: false,
    finished: false,
    lastTime: 0,
    player: { x: 1.6, y: 1.55, angle: 0, health: 100 },
    beasts: [],
    kills: 0,
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
    shake: 0,
    gateNotified: false,
  };

  function resetGame() {
    state.player = { x: 1.6, y: 1.55, angle: 0, health: 100 };
    state.beasts = beastSpawns.map(([x, y], index) => ({
      x, y, name: beastNames[index], health: 100, maxHealth: 100,
      alive: true, frozenUntil: 0, lastAttack: 0, phase: index * .67,
      hue: [285, 174, 322, 202, 42][index % 5]
    }));
    state.kills = 0; state.xp = 0; state.powered = false; state.finished = false;
    state.bubbleUntil = 0; state.gateNotified = false;
    state.cooldowns = { lightning: 0, frost: 0, bubble: 0 };
    state.target = null;
    updateHud();
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
    const row = MAP[Math.floor(y)];
    return row?.[Math.floor(x)] ?? '1';
  }

  function canWalk(x, y) {
    const pad = .2;
    for (const ox of [-pad, pad]) for (const oy of [-pad, pad]) {
      const tile = cell(x + ox, y + oy);
      if (tile === '1' || (tile === '2' && state.kills < state.beasts.length)) return false;
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
      if (tile === '1' || tile === '2') {
        const fx = x - Math.floor(x), fy = y - Math.floor(y);
        const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
        return { distance, tile, edge, x, y };
      }
      distance += .025;
    }
    return { distance: max, tile: '1', edge: 0 };
  }

  function renderWorld(time) {
    const w = innerWidth, h = innerHeight;
    const shakeX = state.shake ? (Math.random() - .5) * state.shake : 0;
    const shakeY = state.shake ? (Math.random() - .5) * state.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    const sky = ctx.createLinearGradient(0, 0, 0, h * .55);
    sky.addColorStop(0, '#090723'); sky.addColorStop(.55, '#28204b'); sky.addColorStop(1, '#4c3564');
    ctx.fillStyle = sky; ctx.fillRect(-10, -10, w + 20, h * .55 + 10);
    drawMoon(w, h);

    const floor = ctx.createLinearGradient(0, h * .48, 0, h);
    floor.addColorStop(0, '#181323'); floor.addColorStop(1, '#05040b');
    ctx.fillStyle = floor; ctx.fillRect(-10, h * .48, w + 20, h * .55);
    for (let y = h * .56; y < h; y += Math.max(8, (y - h * .5) * .12)) {
      ctx.strokeStyle = `rgba(151,113,183,${Math.min(.09, (y / h) * .08)})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const rayCount = Math.min(520, Math.ceil(w / 2));
    const strip = w / rayCount + .6;
    state.rayDepths.length = rayCount;
    for (let i = 0; i < rayCount; i++) {
      const rayAngle = state.player.angle - FOV / 2 + (i / rayCount) * FOV;
      const hit = raycast(rayAngle);
      const corrected = hit.distance * Math.cos(rayAngle - state.player.angle);
      state.rayDepths[i] = corrected;
      const wallH = Math.min(h * 1.45, h / Math.max(.08, corrected));
      const top = h * .5 - wallH / 2;
      const mist = Math.min(.8, corrected / 16);
      const sideShade = Math.min(1, hit.edge * 18);
      const baseHue = hit.tile === '2' ? 43 : 141;
      const sat = hit.tile === '2' ? 54 : 26 + sideShade * 12;
      const light = hit.tile === '2' ? 30 + Math.sin(time * .004) * 7 : 15 + sideShade * 9;
      ctx.fillStyle = `hsla(${baseHue}, ${sat}%, ${light}%, ${1 - mist * .58})`;
      ctx.fillRect(i * strip, top, strip + 1, wallH);
      if (hit.tile === '1') {
        ctx.fillStyle = `rgba(5,16,19,${.13 + (i % 5 === 0 ? .06 : 0)})`;
        const leafY = top + ((i * 37) % Math.max(12, wallH));
        ctx.fillRect(i * strip, leafY, strip + 1, Math.max(2, wallH * .035));
      } else {
        ctx.fillStyle = `rgba(255,224,126,${.2 + Math.sin(time * .006 + i) * .08})`;
        ctx.fillRect(i * strip, top + wallH * .12, strip + 1, wallH * .76);
      }
      if (mist > .18) {
        ctx.fillStyle = `rgba(38,28,60,${mist * .34})`;
        ctx.fillRect(i * strip, top, strip + 1, wallH);
      }
    }

    renderBeasts(time, w, h, rayCount);
    renderAtmosphere(time, w, h);
    ctx.restore();
    state.shake *= .86;
  }

  function drawMoon(w, h) {
    const x = w * .76, y = h * .14, r = Math.min(w, h) * .07;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    glow.addColorStop(0, 'rgba(239,226,255,.85)'); glow.addColorStop(.35, 'rgba(153,116,226,.22)'); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(x-r*2.5,y-r*2.5,r*5,r*5);
    ctx.fillStyle = '#d7d3ee'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(89,76,133,.24)'; ctx.beginPath(); ctx.arc(x-r*.22,y-r*.08,r*.24,0,Math.PI*2); ctx.fill();
  }

  function renderAtmosphere(time, w, h) {
    for (let i = 0; i < 28; i++) {
      const x = (i * 197 + time * .015 * (i % 3 + 1)) % (w + 80) - 40;
      const y = (i * 83) % h;
      const a = .15 + Math.sin(time * .002 + i) * .12;
      ctx.fillStyle = `rgba(${i%2?190:109},${i%2?132:205},255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 2 : .8, 0, Math.PI * 2); ctx.fill();
    }
    const fog = ctx.createLinearGradient(0,h*.38,0,h*.68);
    fog.addColorStop(0,'transparent'); fog.addColorStop(.5,'rgba(115,89,157,.09)'); fog.addColorStop(1,'transparent');
    ctx.fillStyle=fog; ctx.fillRect(0,h*.32,w,h*.44);
  }

  function hasLineOfSight(beast) {
    const dx = beast.x - state.player.x, dy = beast.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    const hit = raycast(Math.atan2(dy, dx), distance + .1);
    return hit.distance >= distance - .13;
  }

  function renderBeasts(time, w, h, rayCount) {
    const visible = [];
    state.target = null;
    for (const beast of state.beasts) {
      if (!beast.alive) continue;
      const dx = beast.x - state.player.x, dy = beast.y - state.player.y;
      const distance = Math.hypot(dx, dy);
      const relative = normalizeAngle(Math.atan2(dy, dx) - state.player.angle);
      if (Math.abs(relative) < FOV * .72 && hasLineOfSight(beast)) visible.push({ beast, distance, relative });
    }
    visible.sort((a,b) => b.distance - a.distance);
    for (const item of visible) {
      const { beast, distance, relative } = item;
      const screenX = w * (.5 + relative / FOV);
      const size = Math.min(h * .88, h / Math.max(.5, distance) * .82);
      const rayIndex = Math.max(0, Math.min(rayCount - 1, Math.floor(screenX / w * rayCount)));
      if (state.rayDepths[rayIndex] < distance - .3) continue;
      const frozen = beast.frozenUntil > performance.now();
      drawBeast(beast, screenX, h * .5 + size * .08, size, time, frozen);
      drawBeastHealth(beast, screenX, h * .5 - size * .93, Math.max(42, size * .58), frozen);
      if (Math.abs(relative) < .105 && distance < 10) {
        if (!state.target || distance < state.target.distance) state.target = item;
      }
    }
    $('#crosshair').classList.toggle('is-targeting', Boolean(state.target));
  }

  function drawBeastHealth(beast, x, y, width, frozen) {
    const barWidth = Math.min(118, width);
    ctx.save();
    ctx.translate(Math.round(x - barWidth / 2), Math.round(y));
    ctx.fillStyle = 'rgba(5, 3, 14, .76)';
    ctx.fillRect(-2, -2, barWidth + 4, 8);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(0, 0, barWidth, 4);
    ctx.fillStyle = frozen ? '#8eeeff' : '#f66baa';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 7;
    ctx.fillRect(0, 0, barWidth * (beast.health / beast.maxHealth), 4);
    ctx.restore();
  }

  function drawBeast(beast, x, groundY, size, time, frozen) {
    const bob = Math.sin(time * .004 + beast.phase) * size * .025;
    const s = size / 150;
    ctx.save(); ctx.translate(x, groundY + bob); ctx.scale(s,s);
    if (frozen) { ctx.shadowColor = '#8cecff'; ctx.shadowBlur = 26; }
    else { ctx.shadowColor = `hsla(${beast.hue},90%,65%,.65)`; ctx.shadowBlur = 18; }
    const body = ctx.createRadialGradient(-20,-70,5,0,-45,70);
    body.addColorStop(0, frozen ? '#b9f8ff' : `hsl(${beast.hue},48%,48%)`);
    body.addColorStop(.38, frozen ? '#3989a9' : `hsl(${beast.hue},42%,25%)`);
    body.addColorStop(1, '#090812');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-43,-2); ctx.quadraticCurveTo(-69,-62,-37,-105); ctx.quadraticCurveTo(0,-135,39,-104); ctx.quadraticCurveTo(67,-62,43,-2); ctx.quadraticCurveTo(0,20,-43,-2); ctx.fill();
    // antlers / ears
    ctx.strokeStyle = frozen ? '#d8ffff' : `hsl(${beast.hue},55%,60%)`; ctx.lineWidth = 7; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-29,-103);ctx.lineTo(-47,-132);ctx.lineTo(-65,-139);ctx.moveTo(-49,-130);ctx.lineTo(-41,-150);ctx.moveTo(29,-103);ctx.lineTo(47,-132);ctx.lineTo(65,-139);ctx.moveTo(49,-130);ctx.lineTo(41,-150);ctx.stroke();
    // eyes
    ctx.fillStyle = frozen ? '#edffff' : '#ffe690'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur=13;
    ctx.beginPath();ctx.ellipse(-17,-76,8,5,0,0,Math.PI*2);ctx.ellipse(17,-76,8,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#21142e';ctx.shadowBlur=0;ctx.beginPath();ctx.arc(-17,-76,2,0,Math.PI*2);ctx.arc(17,-76,2,0,Math.PI*2);ctx.fill();
    // muzzle and legs
    ctx.fillStyle = frozen ? '#8ad8e8' : `hsl(${beast.hue},35%,18%)`;
    ctx.beginPath();ctx.ellipse(0,-50,21,15,0,0,Math.PI*2);ctx.fill();
    ctx.fillRect(-33,-18,14,40);ctx.fillRect(19,-18,14,40);
    if (frozen) {
      ctx.strokeStyle='rgba(220,255,255,.8)';ctx.lineWidth=2;
      for(let i=0;i<7;i++){const a=i*.9;ctx.beginPath();ctx.moveTo(Math.cos(a)*54,-58+Math.sin(a)*47);ctx.lineTo(Math.cos(a)*69,-58+Math.sin(a)*61);ctx.stroke();}
    }
    ctx.restore();
  }

  function update(dt, now) {
    if (!state.running || state.paused || state.finished) return;
    const p = state.player;
    let forward = 0, strafe = 0;
    if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) forward += 1;
    if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) forward -= 1;
    if (state.keys.has('KeyD')) strafe += 1;
    if (state.keys.has('KeyA')) strafe -= 1;
    forward += -state.joystick.y; strafe += state.joystick.x;
    if (state.keys.has('ArrowLeft')) p.angle -= dt * 1.8;
    if (state.keys.has('ArrowRight')) p.angle += dt * 1.8;
    const length = Math.hypot(forward, strafe) || 1;
    forward /= length; strafe /= length;
    const speed = dt * 2.25;
    const nx = p.x + (Math.cos(p.angle) * forward + Math.cos(p.angle + Math.PI/2) * strafe) * speed;
    const ny = p.y + (Math.sin(p.angle) * forward + Math.sin(p.angle + Math.PI/2) * strafe) * speed;
    if (canWalk(nx, p.y)) p.x = nx;
    if (canWalk(p.x, ny)) p.y = ny;

    for (const beast of state.beasts) {
      if (!beast.alive || beast.frozenUntil > now) continue;
      const dx = p.x - beast.x, dy = p.y - beast.y;
      const distance = Math.hypot(dx,dy);
      if (distance < 5.7 && hasLineOfSight(beast)) {
        if (distance > .82) {
          const move = dt * (.55 + state.kills * .015);
          const bx = beast.x + dx / distance * move, by = beast.y + dy / distance * move;
          if (cell(bx, beast.y) === '0') beast.x = bx;
          if (cell(beast.x, by) === '0') beast.y = by;
        }
        if (distance < 1.05 && now - beast.lastAttack > 1100) {
          beast.lastAttack = now;
          if (now < state.bubbleUntil) { showMessage('Aegis absorbed the strike'); }
          else damagePlayer(8 + Math.floor(state.kills / 3));
        }
      }
    }

    if (cell(p.x,p.y) === '2') finish(true);
    updateHud(now);
  }

  function damagePlayer(amount) {
    state.player.health = Math.max(0, state.player.health - amount);
    state.shake = 10;
    const vignette = $('#damage-vignette'); vignette.classList.add('is-hit');
    setTimeout(() => vignette.classList.remove('is-hit'), 120);
    if (state.player.health <= 0) finish(false);
  }

  function cast(spell) {
    if (!state.running || state.paused || state.finished) return;
    const now = performance.now();
    if (now < state.cooldowns[spell]) { showMessage('Spell is gathering strength'); return; }
    const fx = $('#cast-fx'); fx.className = `cast-fx ${spell}`;
    setTimeout(() => { if (fx.classList.contains(spell)) fx.className='cast-fx'; }, 600);
    if (spell === 'bubble') {
      state.bubbleUntil = now + 5000;
      state.cooldowns.bubble = now + 12000;
      showMessage('Aegis Orb raised · 5 seconds');
    } else if (!state.target) {
      state.cooldowns[spell] = now + (spell === 'lightning' ? 320 : 1200);
      showMessage('No beast in your sights');
    } else {
      const beast = state.target.beast;
      if (spell === 'lightning') {
        const damage = state.powered ? 55 : 34;
        beast.health = Math.max(0, beast.health - damage);
        state.cooldowns.lightning = now + (state.powered ? 470 : 650);
        state.shake = 4;
        if (!beast.health) defeat(beast);
      } else {
        beast.frozenUntil = now + (state.powered ? 6000 : 4000);
        state.cooldowns.frost = now + 7800;
        showMessage(`${beast.name} frozen`);
      }
    }
    updateHud(now);
  }

  function defeat(beast) {
    beast.alive = false;
    state.kills++;
    state.xp = state.kills * 10;
    showMessage(`${beast.name} contained · +10 mastery`);
    if (state.xp >= 100 && !state.powered) {
      state.powered = true;
      setTimeout(() => showMessage('Mastery unlocked · spells overcharged'), 1000);
    }
    if (state.kills === state.beasts.length) {
      $('#objective-label').textContent = 'CELESTIAL GATE OPEN';
      $('#objective-text').textContent = 'Reach the golden light';
      showMessage('All beasts contained · the gate is open');
    }
  }

  function updateHud(now = performance.now()) {
    $('#health-fill').style.transform = `scaleX(${state.player.health/100})`;
    $('#health-text').textContent = state.player.health;
    $('#xp-fill').style.transform = `scaleX(${Math.min(1,state.xp/100)})`;
    $('#xp-text').textContent = `${state.xp} / 100`;
    $('#rank-label').textContent = state.powered ? 'SPELLWEAVER' : 'APPRENTICE';
    $('#bubble-overlay').classList.toggle('is-active', now < state.bubbleUntil);
    const target = state.target?.beast;
    $('#boss-card').classList.toggle('is-visible', Boolean(target));
    if (target) {
      $('#beast-name').textContent = target.name;
      $('#beast-state').textContent = target.frozenUntil > now ? 'FROZEN' : 'WILD';
      $('#beast-health-fill').style.transform = `scaleX(${target.health/target.maxHealth})`;
    }
    const durations = { lightning: state.powered ? 470 : 650, frost: 7800, bubble: 12000 };
    $$('.spell').forEach(button => {
      const spell = button.dataset.spell;
      const remaining = Math.max(0, state.cooldowns[spell] - now);
      button.classList.toggle('is-cooling', remaining > 0);
      button.style.setProperty('--cooldown', remaining / durations[spell]);
    });
  }

  function showMessage(copy) {
    const message = $('#message');
    message.textContent = copy; message.classList.add('is-visible');
    clearTimeout(state.messageTimer);
    state.messageTimer = setTimeout(() => message.classList.remove('is-visible'), 1800);
  }

  function finish(won) {
    state.finished = true; state.running = false;
    document.exitPointerLock?.();
    $('#end-eyebrow').innerHTML = `<span></span>${won ? 'Trial complete' : 'Field trial interrupted'}`;
    $('#end-title').innerHTML = won ? 'Maze<br>mastered.' : 'The maze<br>prevails.';
    $('#end-copy').textContent = won ? 'Every beast is safely contained. The celestial gate recognizes your mastery.' : 'The beasts overwhelmed your wards. Recover, then try the field trial again.';
    $('#stat-beasts').textContent = `${state.kills} / ${state.beasts.length}`;
    $('#stat-xp').textContent = state.xp;
    $('#end-screen').classList.add('screen--active');
  }

  function start() {
    resetGame(); state.running = true; state.paused = false; state.lastTime = performance.now();
    $('#start-screen').classList.remove('screen--active');
    $('#pause-screen').classList.remove('screen--active');
    $('#end-screen').classList.remove('screen--active');
    $('#hud').classList.add('is-active');
    showMessage(`Contain ${state.beasts.length} beasts · find the golden gate`);
    if (matchMedia('(pointer:fine)').matches) canvas.requestPointerLock?.();
  }

  function setPaused(paused) {
    if (!state.running || state.finished) return;
    state.paused = paused;
    $('#pause-screen').classList.toggle('screen--active', paused);
    if (paused) document.exitPointerLock?.();
    else { state.lastTime = performance.now(); if(matchMedia('(pointer:fine)').matches) canvas.requestPointerLock?.(); }
  }

  function frame(time) {
    const dt = Math.min(.05, (time - state.lastTime) / 1000 || 0); state.lastTime = time;
    update(dt, time); renderWorld(time); updateHud(time);
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('keydown', (event) => {
    state.keys.add(event.code);
    if (event.code === 'Digit1' || event.code === 'Space') cast('lightning');
    if (event.code === 'Digit2') cast('frost');
    if (event.code === 'Digit3') cast('bubble');
    if (event.code === 'Escape' && state.running) setPaused(!state.paused);
  });
  addEventListener('keyup', (event) => state.keys.delete(event.code));
  addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === canvas && state.running && !state.paused) state.player.angle += event.movementX * .0024;
  });
  canvas.addEventListener('click', () => {
    if (state.running && !state.paused && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0 && document.pointerLockElement === canvas) cast('lightning');
  });

  const joystick = $('#joystick'), stick = joystick.querySelector('i');
  joystick.addEventListener('pointerdown', (event) => { state.joystick.pointer = event.pointerId; joystick.setPointerCapture(event.pointerId); });
  joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== state.joystick.pointer) return;
    const r = joystick.getBoundingClientRect(); let x = event.clientX-(r.left+r.width/2), y=event.clientY-(r.top+r.height/2);
    const d=Math.hypot(x,y), max=30; if(d>max){x=x/d*max;y=y/d*max;}
    state.joystick.x=x/max;state.joystick.y=y/max;stick.style.transform=`translate(${x}px,${y}px)`;
  });
  const releaseStick = (event) => { if(event.pointerId===state.joystick.pointer){state.joystick={x:0,y:0,pointer:null};stick.style.transform='';} };
  joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);
  const look=$('#touch-look');
  look.addEventListener('pointerdown',(event)=>{state.lookPointer=event.pointerId;state.lookX=event.clientX;look.setPointerCapture(event.pointerId);});
  look.addEventListener('pointermove',(event)=>{if(event.pointerId!==state.lookPointer)return;state.player.angle+=(event.clientX-state.lookX)*.008;state.lookX=event.clientX;});
  look.addEventListener('pointerup',(event)=>{if(event.pointerId===state.lookPointer)state.lookPointer=null;});

  $$('.spell').forEach(button => button.addEventListener('pointerdown', (event) => { event.preventDefault(); $$('.spell').forEach(b=>b.classList.remove('is-selected'));button.classList.add('is-selected');cast(button.dataset.spell); }));
  $('#start-button').addEventListener('click', start);
  $('#pause-button').addEventListener('click', () => setPaused(true));
  $('#resume-button').addEventListener('click', () => setPaused(false));
  $('#restart-button').addEventListener('click', start);
  $('#play-again-button').addEventListener('click', start);

  resize(); resetGame(); requestAnimationFrame(frame);
})();
