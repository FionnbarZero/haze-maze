import { DESKTOP_ACTIONS, INPUT } from './config.js?v=20260819-solo-cast-v1';
import { clamp } from './utils.js';

export class ProofInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this.actions = new Set();
    this.active = false;
    this.blocked = false;
    this.playerActionsBlocked = false;
    this.aiming = false;
    this.crouched = false;
    this.touchSprinting = false;
    this.pointerLocked = false;
    this.modalOpen = false;
    this.onCast = () => {};
    this.onSelectSpell = () => {};
    this.onShoulder = () => {};
    this.onPouch = () => {};
    this.onGreenVine = () => {};
    this.onGreenRestore = () => {};
    this.onMessage = () => {};
    this.movePointer = null;
    this.lookPointer = null;
    this.moveKnob = null;
    this.bindDesktop();
    this.bindTouch();
    this.updateBlockedState();
    addEventListener('resize', () => this.updateBlockedState());
    addEventListener('orientationchange', () => this.updateBlockedState());
  }

  bindDesktop() {
    addEventListener('keydown', event => {
      if (!this.active || this.blocked || this.playerActionsBlocked) return;
      const action = DESKTOP_ACTIONS[event.code];
      if (!action) return;
      event.preventDefault();
      if (action === 'pouch') {
        if (!event.repeat) this.onPouch();
        return;
      }
      if (this.modalOpen) return;
      if (action === 'cast') {
        if (!event.repeat) this.onCast();
        return;
      }
      this.keys.add(event.code);
      if (event.repeat) return;
      if (action === 'jump') this.actions.add('jump');
      if (action === 'crouch') this.toggleCrouch();
      if (action === 'shoulderSwitch') this.onShoulder();
      if (action === 'selectLightning') this.onSelectSpell('lightning');
      if (action === 'selectFrost') this.onSelectSpell('frost');
      if (action === 'selectAegis') this.onSelectSpell('aegis');
      if (action === 'greenVineDemo') this.onGreenVine();
      if (action === 'greenRestoreDemo') this.onGreenRestore();
    });
    addEventListener('keyup', event => this.keys.delete(event.code));
    addEventListener('blur', () => this.clearHeldInput());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearHeldInput(); });
    document.addEventListener('mousemove', event => {
      if (!this.active || this.blocked || this.playerActionsBlocked || this.modalOpen || document.pointerLockElement !== this.canvas) return;
      this.lookDelta.x += event.movementX * INPUT.mouseSensitivity;
      this.lookDelta.y += event.movementY * INPUT.mouseSensitivity * (INPUT.invertVertical ? -1 : 1);
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) this.clearHeldInput();
    });
    document.addEventListener('pointerlockerror', () => this.clearHeldInput());
    this.canvas.addEventListener('click', () => this.requestPointerLock());
    this.canvas.addEventListener('mousedown', event => {
      if (!this.active || this.blocked || this.playerActionsBlocked || this.modalOpen || event.pointerType === 'touch') return;
      if (event.button === 0) {
        this.requestPointerLock();
      }
      if (event.button === 2) this.aiming = true;
    });
    addEventListener('mouseup', event => { if (event.button === 2) this.aiming = false; });
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
  }

  bindTouch() {
    const moveStick = document.querySelector('#move-stick');
    const knob = moveStick.querySelector('i');
    this.moveKnob = knob;
    const updateMove = event => {
      const bounds = moveStick.getBoundingClientRect();
      const maximum = bounds.width * .32;
      let x = event.clientX - (bounds.left + bounds.width / 2);
      let y = event.clientY - (bounds.top + bounds.height / 2);
      const distance = Math.hypot(x, y);
      if (distance > maximum) { x = x / distance * maximum; y = y / distance * maximum; }
      const normalized = Math.min(1, distance / maximum);
      const strength = normalized < INPUT.joystickDeadZone
        ? 0
        : (normalized - INPUT.joystickDeadZone) / (1 - INPUT.joystickDeadZone);
      this.move.x = distance ? x / distance * strength : 0;
      this.move.y = distance ? -y / distance * strength : 0;
      this.touchSprinting = normalized >= INPUT.touchSprintThreshold && this.move.y > .15;
      knob.style.transform = `translate(${x}px, ${y}px)`;
    };
    const releaseMove = event => {
      if (event.pointerId !== this.movePointer) return;
      this.movePointer = null;
      this.move.x = 0;
      this.move.y = 0;
      this.touchSprinting = false;
      knob.style.transform = '';
    };
    moveStick.addEventListener('pointerdown', event => {
      if (!this.active || this.blocked || this.playerActionsBlocked || this.modalOpen) return;
      event.preventDefault();
      this.movePointer = event.pointerId;
      try { moveStick.setPointerCapture(event.pointerId); } catch {}
      updateMove(event);
    });
    moveStick.addEventListener('pointermove', event => { if (event.pointerId === this.movePointer) updateMove(event); });
    moveStick.addEventListener('pointerup', releaseMove);
    moveStick.addEventListener('pointercancel', releaseMove);
    moveStick.addEventListener('lostpointercapture', releaseMove);

    const lookZone = document.querySelector('#look-zone');
    let lookX = 0;
    let lookY = 0;
    const releaseLook = event => { if (event.pointerId === this.lookPointer) this.lookPointer = null; };
    lookZone.addEventListener('pointerdown', event => {
      if (!this.active || this.blocked || this.playerActionsBlocked || this.modalOpen) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      lookX = event.clientX;
      lookY = event.clientY;
      try { lookZone.setPointerCapture(event.pointerId); } catch {}
    });
    lookZone.addEventListener('pointermove', event => {
      if (event.pointerId !== this.lookPointer) return;
      const dx = clamp(event.clientX - lookX, -48, 48);
      const dy = clamp(event.clientY - lookY, -42, 42);
      this.lookDelta.x += dx * INPUT.touchHorizontalSensitivity;
      this.lookDelta.y += dy * INPUT.touchVerticalSensitivity * (INPUT.invertVertical ? -1 : 1);
      lookX = event.clientX;
      lookY = event.clientY;
    });
    lookZone.addEventListener('pointerup', releaseLook);
    lookZone.addEventListener('pointercancel', releaseLook);
    lookZone.addEventListener('lostpointercapture', releaseLook);

    for (const button of document.querySelectorAll('[data-spell]')) {
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (!this.active || this.blocked || this.playerActionsBlocked || this.modalOpen) return;
        const spell = button.dataset.spell;
        this.onSelectSpell(spell);
        this.onCast(spell);
      });
    }
    document.querySelector('#jump-control').addEventListener('pointerdown', event => { event.preventDefault(); if (this.active && !this.blocked && !this.playerActionsBlocked && !this.modalOpen) this.actions.add('jump'); });
    document.querySelector('#crouch-control').addEventListener('pointerdown', event => { event.preventDefault(); if (this.active && !this.blocked && !this.playerActionsBlocked && !this.modalOpen) this.toggleCrouch(); });
    document.querySelector('#shoulder-control').addEventListener('pointerdown', event => { event.preventDefault(); if (this.active && !this.blocked && !this.playerActionsBlocked && !this.modalOpen) this.onShoulder(); });
  }

  start() {
    this.active = true;
    this.updateBlockedState();
    this.canvas.focus({ preventScroll: true });
    this.requestPointerLock();
  }

  requestPointerLock() {
    if (!this.active || this.blocked || this.playerActionsBlocked || this.modalOpen || !matchMedia('(pointer:fine)').matches || document.pointerLockElement === this.canvas) return;
    try {
      const request = this.canvas.requestPointerLock?.();
      request?.catch?.(() => this.clearHeldInput());
    } catch {
      this.clearHeldInput();
    }
  }

  toggleCrouch() {
    this.setCrouched(!this.crouched);
    this.actions.add('crouchChanged');
  }

  setCrouched(value) {
    this.crouched = Boolean(value);
    document.querySelector('#crouch-control').classList.toggle('is-active', this.crouched);
  }

  setModalOpen(value) {
    this.modalOpen = Boolean(value);
    this.clearHeldInput();
    if (this.modalOpen && document.pointerLockElement) document.exitPointerLock?.();
  }

  setPlayerActionsBlocked(value) {
    this.playerActionsBlocked = Boolean(value);
    if (this.playerActionsBlocked) this.clearHeldInput();
  }

  updateBlockedState() {
    this.blocked = matchMedia('(pointer:coarse)').matches && matchMedia('(orientation:portrait)').matches;
    if (this.blocked) this.clearHeldInput();
  }

  clearHeldInput() {
    this.keys.clear();
    this.actions.clear();
    this.move.x = 0;
    this.move.y = 0;
    this.touchSprinting = false;
    this.movePointer = null;
    this.lookPointer = null;
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    if (this.moveKnob) this.moveKnob.style.transform = '';
    this.aiming = false;
  }

  consume(action) {
    const present = this.actions.has(action);
    this.actions.delete(action);
    return present;
  }

  consumeLook() {
    const result = { x: this.lookDelta.x, y: this.lookDelta.y };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return result;
  }

  movementAxes() {
    if (this.playerActionsBlocked) return { x: 0, y: 0 };
    let x = this.move.x;
    let y = this.move.y;
    if (this.isHeld('moveRight')) x += 1;
    if (this.isHeld('moveLeft')) x -= 1;
    if (this.isHeld('moveForward')) y += 1;
    if (this.isHeld('moveBackward')) y -= 1;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    return { x, y };
  }

  get sprinting() {
    return !this.playerActionsBlocked && (this.touchSprinting || this.isHeld('sprint'));
  }

  isHeld(action) {
    return [...this.keys].some(code => DESKTOP_ACTIONS[code] === action);
  }

  heldActionNames() {
    return [...new Set([...this.keys].map(code => DESKTOP_ACTIONS[code]).filter(Boolean))];
  }

  pendingActionNames() {
    return [...this.actions];
  }
}
