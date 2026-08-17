import { PLAYER } from './config.js';
import { circleIntersectsBox, dampAngle, verticalRangesOverlap } from './utils.js';

export class CharacterController {
  constructor(BABYLON, world) {
    this.BABYLON = BABYLON;
    this.colliders = world.colliders;
    this.position = world.startPosition.clone();
    this.velocityY = 0;
    this.grounded = true;
    this.crouched = false;
    this.facingYaw = 0;
    this.speed = 0;
    this.stateLabel = 'IDLE';
    this.collisionState = 'CLEAR';
    this.lastCollision = '';
  }

  get height() {
    return this.crouched ? PLAYER.crouchingHeight : PLAYER.standingHeight;
  }

  update(input, cameraYaw, deltaTime) {
    const dt = Math.min(.05, deltaTime);
    if (input.consume('jump') && this.grounded && !this.crouched) {
      this.velocityY = PLAYER.jumpVelocity;
      this.grounded = false;
    }

    if (input.crouched) {
      this.crouched = true;
    } else if (this.canOccupy(this.position.x, this.position.y, this.position.z, PLAYER.standingHeight)) {
      this.crouched = false;
    } else {
      input.crouched = true;
      document.querySelector('#crouch-control').classList.add('is-active');
    }

    this.integrateVertical(dt);

    const axes = input.active ? input.movementAxes() : { x: 0, y: 0 };
    const forward = new this.BABYLON.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    const right = new this.BABYLON.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const desiredDirection = forward.scale(axes.y).add(right.scale(axes.x));
    if (desiredDirection.lengthSquared() > 1) desiredDirection.normalize();

    const sprinting = input.sprinting && axes.y > .15 && !this.crouched;
    const targetSpeed = this.crouched ? PLAYER.crouchSpeed : sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const displacement = desiredDirection.scale(targetSpeed * dt);
    const before = this.position.clone();
    this.moveHorizontal(displacement.x, displacement.z);
    const travelled = this.position.subtract(before).length();
    this.speed = dt ? travelled / dt : 0;

    if (desiredDirection.lengthSquared() > .001) {
      const targetYaw = input.aiming ? cameraYaw : Math.atan2(desiredDirection.x, desiredDirection.z);
      this.facingYaw = dampAngle(this.facingYaw, targetYaw, input.aiming ? .065 : PLAYER.turnResponse, dt);
    } else if (input.aiming) {
      this.facingYaw = dampAngle(this.facingYaw, cameraYaw, .065, dt);
    }

    if (!this.grounded) this.stateLabel = this.velocityY > 0 ? 'JUMP · RISING' : 'JUMP · FALLING';
    else if (this.crouched && this.speed > .05) this.stateLabel = 'CROUCH WALK';
    else if (this.crouched) this.stateLabel = 'CROUCH';
    else if (sprinting && this.speed > .05) this.stateLabel = 'SPRINT';
    else if (this.speed > .05) this.stateLabel = 'WALK';
    else this.stateLabel = 'IDLE';
  }

  integrateVertical(deltaTime) {
    const previousY = this.position.y;
    this.velocityY -= PLAYER.gravity * deltaTime;
    let nextY = previousY + this.velocityY * deltaTime;

    if (this.velocityY > 0) {
      const nextTop = nextY + this.height;
      const previousTop = previousY + this.height;
      for (const collider of this.colliders) {
        if (!circleIntersectsBox(this.position.x, this.position.z, PLAYER.radius, collider)) continue;
        if (previousTop <= collider.min.y + .03 && nextTop >= collider.min.y) {
          nextY = collider.min.y - this.height - .015;
          this.velocityY = 0;
          break;
        }
      }
    }

    if (this.velocityY <= 0) {
      let support = 0;
      for (const collider of this.colliders) {
        if (!circleIntersectsBox(this.position.x, this.position.z, PLAYER.radius * .9, collider)) continue;
        const top = collider.max.y;
        if (top <= previousY + .08 && top >= nextY - .05) support = Math.max(support, top);
      }
      if (nextY <= support) {
        nextY = support;
        this.velocityY = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    } else {
      this.grounded = false;
    }

    this.position.y = nextY;
    if (this.position.y < -3) {
      this.position.set(PLAYER.start.x, PLAYER.start.y, PLAYER.start.z);
      this.velocityY = 0;
      this.grounded = true;
    }
  }

  moveHorizontal(deltaX, deltaZ) {
    const distance = Math.hypot(deltaX, deltaZ);
    const steps = Math.max(1, Math.ceil(distance / .07));
    const stepX = deltaX / steps;
    const stepZ = deltaZ / steps;
    let collided = false;
    this.lastCollision = '';
    for (let index = 0; index < steps; index += 1) {
      if (this.canOccupy(this.position.x + stepX, this.position.y, this.position.z + stepZ, this.height)) {
        this.position.x += stepX;
        this.position.z += stepZ;
        continue;
      }
      collided = true;
      if (this.canOccupy(this.position.x + stepX, this.position.y, this.position.z, this.height)) this.position.x += stepX;
      if (this.canOccupy(this.position.x, this.position.y, this.position.z + stepZ, this.height)) this.position.z += stepZ;
    }
    this.collisionState = collided ? `SLIDING · ${this.lastCollision || 'GEOMETRY'}` : 'CLEAR';
  }

  canOccupy(x, y, z, height) {
    for (const collider of this.colliders) {
      if (!verticalRangesOverlap(y, height, collider)) continue;
      if (circleIntersectsBox(x, z, PLAYER.radius, collider)) {
        this.lastCollision = collider.kind || collider.name;
        return false;
      }
    }
    return true;
  }

  snapshot() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      speed: this.speed,
      grounded: this.grounded,
      crouched: this.crouched,
      state: this.stateLabel,
      collision: this.collisionState,
      facingYaw: this.facingYaw
    };
  }
}
