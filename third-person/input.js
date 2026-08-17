import { CAMERA } from './config.js';
import { clamp } from './utils.js';

export class ProofInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this.actions = new Set();
    this.active = false;
    this.aiming = false;
    this.crouched = false;
    this.pointerLocked = false;
    this.onCast = () => {};
    this.onShoulder = () => {};
    this.onMessage = () => {};
    this.movePointer = null;
    this.lookPointer = null;
    this.bindDesktop();
    this.bindTouch();
  }

  bindDesktop() {
    addEventListener('keydown', event => {
      if (!this.active) return;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyC','ControlLeft','ControlRight','KeyV'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Space') this.actions.add('jump');
      if (event.code === 'KeyC' || event.code === 'ControlLeft' || event.code === 'ControlRight') this.toggleCrouch();
      if (event.code === 'KeyV') this.onShoulder();
      if (event.code === 'Digit1') this.onMessage('Lightning selected');
      if (event.code === 'Digit2' || event.code === 'Digit3') this.onMessage('Only lightning is implemented in this technical proof');
    });
    addEventListener('keyup', event => this.keys.delete(event.code));
    addEventListener('blur', () => this.clearHeldInput());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearHeldInput(); });
    document.addEventListener('mousemove', event => {
      if (!this.active || document.pointerLockElement !== this.canvas) return;
      this.lookDelta.x += event.movementX * CAMERA.mouseSensitivity;
      this.lookDelta.y += event.movementY * CAMERA.mouseSensitivity;
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) this.clearHeldInput();
    });
    document.addEventListener('pointerlockerror', () => this.clearHeldInput());
    this.canvas.addEventListener('click', () => this.requestPointerLock());
    this.canvas.addEventListener('mousedown', event => {
      if (!this.active || event.pointerType === 'touch') return;
      if (event.button === 0 && document.pointerLockElement === this.canvas) this.onCast();
      if (event.button === 2) this.aiming = true;
    });
    this.canvas.addEventListener('mouseup', event => { if (event.button === 2) this.aiming = false; });
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
  }

  bindTouch() {
    const moveStick = document.querySelector('#move-stick');
    const knob = moveStick.querySelector('i');
    const updateMove = event => {
      const bounds = moveStick.getBoundingClientRect();
      const maximum = bounds.width * .32;
      let x = event.clientX - (bounds.left + bounds.width / 2);
      let y = event.clientY - (bounds.top + bounds.height / 2);
      const distance = Math.hypot(x, y);
      if (distance > maximum) { x = x / distance * maximum; y = y / distance * maximum; }
      const normalized = Math.min(1, distance / maximum);
      const strength = normalized < .13 ? 0 : (normalized - .13) / .87;
      this.move.x = distance ? x / distance * strength : 0;
      this.move.y = distance ? -y / distance * strength : 0;
      knob.style.transform = `translate(${x}px, ${y}px)`;
    };
    const releaseMove = event => {
      if (event.pointerId !== this.movePointer) return;
      this.movePointer = null;
      this.move.x = 0;
      this.move.y = 0;
      knob.style.transform = '';
    };
    moveStick.addEventListener('pointerdown', event => {
      if (!this.active) return;
      event.preventDefault();
      this.movePointer = event.pointerId;
      moveStick.setPointerCapture(event.pointerId);
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
      if (!this.active) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      lookX = event.clientX;
      lookY = event.clientY;
      lookZone.setPointerCapture(event.pointerId);
    });
    lookZone.addEventListener('pointermove', event => {
      if (event.pointerId !== this.lookPointer) return;
      const dx = clamp(event.clientX - lookX, -48, 48);
      const dy = clamp(event.clientY - lookY, -42, 42);
      this.lookDelta.x += dx * CAMERA.touchSensitivity;
      this.lookDelta.y += dy * CAMERA.touchSensitivity;
      lookX = event.clientX;
      lookY = event.clientY;
    });
    lookZone.addEventListener('pointerup', releaseLook);
    lookZone.addEventListener('pointercancel', releaseLook);
    lookZone.addEventListener('lostpointercapture', releaseLook);

    document.querySelector('[data-spell="lightning"]').addEventListener('pointerdown', event => { event.preventDefault(); if (this.active) this.onCast(); });
    document.querySelector('#jump-control').addEventListener('pointerdown', event => { event.preventDefault(); if (this.active) this.actions.add('jump'); });
    document.querySelector('#crouch-control').addEventListener('pointerdown', event => { event.preventDefault(); if (this.active) this.toggleCrouch(); });
    document.querySelector('#shoulder-control').addEventListener('pointerdown', event => { event.preventDefault(); if (this.active) this.onShoulder(); });
  }

  start() {
    this.active = true;
    this.canvas.focus({ preventScroll: true });
    this.requestPointerLock();
  }

  requestPointerLock() {
    if (!this.active || !matchMedia('(pointer:fine)').matches || document.pointerLockElement === this.canvas) return;
    try {
      const request = this.canvas.requestPointerLock?.();
      request?.catch?.(() => this.clearHeldInput());
    } catch {
      this.clearHeldInput();
    }
  }

  toggleCrouch() {
    this.crouched = !this.crouched;
    this.actions.add('crouchChanged');
    document.querySelector('#crouch-control').classList.toggle('is-active', this.crouched);
  }

  clearHeldInput() {
    this.keys.clear();
    this.move.x = 0;
    this.move.y = 0;
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
    let x = this.move.x;
    let y = this.move.y;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    return { x, y };
  }

  get sprinting() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }
}
