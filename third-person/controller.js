import { PERFORMANCE, PLAYER } from './config.js?v=20260818-rewards-v1';
import { circleIntersectsBox, dampAngle, verticalRangesOverlap } from './utils.js';
import { facingYawToward } from './targeting.js?v=20260818-rewards-v1';

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
    this.jumpBufferRemaining = 0;
    this.coyoteRemaining = PLAYER.coyoteTime;
    this.landingRemaining = 0;
    this.landedThisFrame = false;
    this.lastLandingSpeed = 0;
    this.maximumAirHeight = 0;
    this.didJump = false;
    this.didCrouch = false;
    this.sprinting = false;
    this.dynamicObstacles = [];
    this.castFacingYaw = null;
    this.castFacingRemaining = 0;
  }

  get height() {
    return this.crouched ? PLAYER.crouchingHeight : PLAYER.standingHeight;
  }

  addDynamicObstacle(obstacle) {
    if (!this.dynamicObstacles.includes(obstacle)) this.dynamicObstacles.push(obstacle);
  }

  requestCastFacing(target) {
    const yaw = facingYawToward(this.position, target);
    if (yaw === null) return false;
    this.castFacingYaw = yaw;
    this.castFacingRemaining = PLAYER.castFacingDuration;
    return true;
  }

  update(input, cameraYaw, deltaTime) {
    const dt = Math.min(PERFORMANCE.maximumSimulationDelta, deltaTime);
    this.castFacingRemaining = Math.max(0, this.castFacingRemaining - dt);
    this.landedThisFrame = false;
    this.landingRemaining = Math.max(0, this.landingRemaining - dt);
    if (input.consume('jump')) this.jumpBufferRemaining = PLAYER.jumpBuffer;
    else this.jumpBufferRemaining = Math.max(0, this.jumpBufferRemaining - dt);

    if (input.crouched) {
      this.crouched = true;
      this.didCrouch = true;
    } else if (this.canOccupy(this.position.x, this.position.y, this.position.z, PLAYER.standingHeight)) {
      this.crouched = false;
    } else {
      input.setCrouched(true);
      this.crouched = true;
    }

    if (this.grounded) this.coyoteRemaining = PLAYER.coyoteTime;
    else this.coyoteRemaining = Math.max(0, this.coyoteRemaining - dt);

    const axes = input.active && !input.blocked ? input.movementAxes() : { x: 0, y: 0 };
    const forward = new this.BABYLON.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    const right = new this.BABYLON.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const desiredDirection = forward.scale(axes.y).add(right.scale(axes.x));
    if (desiredDirection.lengthSquared() > 1) desiredDirection.normalize();

    this.sprinting = input.sprinting && axes.y > .15 && !this.crouched;
    let targetSpeed = this.crouched ? PLAYER.crouchSpeed : this.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (input.aiming && axes.y < -.1) targetSpeed *= PLAYER.backpedalMultiplier;

    const horizontalDistance = targetSpeed * dt * Math.min(1, desiredDirection.length());
    const verticalDistance = Math.abs(this.velocityY * dt);
    const steps = Math.max(1, Math.ceil(Math.max(horizontalDistance, verticalDistance) / PLAYER.maximumSweepStep));
    const stepTime = dt / steps;
    const before = this.position.clone();
    let collided = false;
    let collisionName = '';

    for (let index = 0; index < steps; index += 1) {
      if (this.jumpBufferRemaining > 0 && (this.grounded || this.coyoteRemaining > 0) && !this.crouched) {
        this.velocityY = PLAYER.jumpVelocity;
        this.grounded = false;
        this.coyoteRemaining = 0;
        this.jumpBufferRemaining = 0;
        this.maximumAirHeight = this.position.y;
        this.didJump = true;
      }
      this.integrateVertical(stepTime);
      const collision = this.moveHorizontal(
        desiredDirection.x * targetSpeed * stepTime,
        desiredDirection.z * targetSpeed * stepTime
      );
      collided ||= collision.collided;
      if (collision.name) collisionName = collision.name;
    }

    const travelled = Math.hypot(this.position.x - before.x, this.position.z - before.z);
    this.speed = dt ? travelled / dt : 0;
    this.collisionState = collided ? `SLIDING · ${collisionName || 'GEOMETRY'}` : 'CLEAR';

    if (this.castFacingRemaining > 0 && this.castFacingYaw !== null) {
      this.facingYaw = dampAngle(this.facingYaw, this.castFacingYaw, PLAYER.castTurnResponse, dt);
    } else if (desiredDirection.lengthSquared() > .001) {
      const targetYaw = input.aiming ? cameraYaw : Math.atan2(desiredDirection.x, desiredDirection.z);
      this.facingYaw = dampAngle(
        this.facingYaw,
        targetYaw,
        input.aiming ? PLAYER.aimTurnResponse : PLAYER.turnResponse,
        dt
      );
    } else if (input.aiming) {
      this.facingYaw = dampAngle(this.facingYaw, cameraYaw, PLAYER.aimTurnResponse, dt);
    }

    if (!this.grounded) this.stateLabel = this.velocityY > 0 ? 'JUMP · RISING' : 'JUMP · FALLING';
    else if (this.landingRemaining > 0) this.stateLabel = 'LAND';
    else if (this.crouched && this.speed > .05) this.stateLabel = 'CROUCH WALK';
    else if (this.crouched) this.stateLabel = 'CROUCH';
    else if (this.sprinting && this.speed > .05) this.stateLabel = 'SPRINT';
    else if (input.aiming && this.speed > .05) this.stateLabel = 'AIM STRAFE';
    else if (input.aiming) this.stateLabel = 'AIM';
    else if (this.speed > .05) this.stateLabel = 'WALK';
    else this.stateLabel = 'IDLE';
  }

  integrateVertical(deltaTime) {
    const wasGrounded = this.grounded;
    const previousY = this.position.y;
    const previousVelocity = this.velocityY;
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
        if (top <= previousY + PLAYER.groundProbe && top >= nextY - PLAYER.groundProbe) support = Math.max(support, top);
      }
      if (nextY <= support) {
        nextY = support;
        this.velocityY = 0;
        this.grounded = true;
        if (!wasGrounded) {
          this.landedThisFrame = true;
          this.lastLandingSpeed = Math.abs(previousVelocity);
          this.landingRemaining = PLAYER.landingDuration;
        }
      } else {
        this.grounded = false;
      }
    } else {
      this.grounded = false;
    }

    this.position.y = nextY;
    if (!this.grounded) this.maximumAirHeight = Math.max(this.maximumAirHeight, this.position.y);
    if (this.position.y < -3) this.teleport(PLAYER.start.x, PLAYER.start.y, PLAYER.start.z);
  }

  moveHorizontal(deltaX, deltaZ) {
    let collided = false;
    this.lastCollision = '';
    if (this.canOccupy(this.position.x + deltaX, this.position.y, this.position.z + deltaZ, this.height)) {
      this.position.x += deltaX;
      this.position.z += deltaZ;
      return { collided, name: '' };
    }
    collided = true;
    if (this.canOccupy(this.position.x + deltaX, this.position.y, this.position.z, this.height)) this.position.x += deltaX;
    if (this.canOccupy(this.position.x, this.position.y, this.position.z + deltaZ, this.height)) this.position.z += deltaZ;
    return { collided, name: this.lastCollision };
  }

  canOccupy(x, y, z, height) {
    for (const collider of this.colliders) {
      if (!verticalRangesOverlap(y, height, collider)) continue;
      if (circleIntersectsBox(x, z, PLAYER.radius, collider)) {
        this.lastCollision = collider.kind || collider.name;
        return false;
      }
    }
    for (const obstacle of this.dynamicObstacles) {
      if (!obstacle.alive || !obstacle.root?.isEnabled()) continue;
      const obstacleY = obstacle.root.position.y;
      const obstacleHeight = obstacle.collisionHeight || Infinity;
      if (y >= obstacleY + obstacleHeight - .015 || y + height <= obstacleY + .015) continue;
      const minimumDistance = PLAYER.radius + (obstacle.collisionRadius || 0);
      const deltaX = x - obstacle.root.position.x;
      const deltaZ = z - obstacle.root.position.z;
      if (deltaX * deltaX + deltaZ * deltaZ >= minimumDistance * minimumDistance) continue;
      this.lastCollision = obstacle.collisionName || obstacle.root.name || 'ACTOR';
      return false;
    }
    return true;
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocityY = 0;
    this.grounded = y <= .001;
    this.coyoteRemaining = this.grounded ? PLAYER.coyoteTime : 0;
    this.jumpBufferRemaining = 0;
    this.landingRemaining = 0;
    this.collisionState = 'CLEAR';
    this.castFacingYaw = null;
    this.castFacingRemaining = 0;
  }

  reset(x = PLAYER.start.x, y = PLAYER.start.y, z = PLAYER.start.z) {
    this.teleport(x, y, z);
    this.crouched = false;
    this.facingYaw = 0;
    this.speed = 0;
    this.stateLabel = 'IDLE';
    this.lastCollision = '';
    this.lastLandingSpeed = 0;
    this.maximumAirHeight = 0;
    this.didJump = false;
    this.didCrouch = false;
    this.sprinting = false;
    this.castFacingYaw = null;
    this.castFacingRemaining = 0;
  }

  snapshot() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      speed: this.speed,
      verticalVelocity: this.velocityY,
      grounded: this.grounded,
      crouched: this.crouched,
      capsuleHeight: this.height,
      state: this.stateLabel,
      collision: this.collisionState,
      facingYaw: this.facingYaw,
      landedThisFrame: this.landedThisFrame,
      lastLandingSpeed: this.lastLandingSpeed,
      maximumAirHeight: this.maximumAirHeight,
      didJump: this.didJump,
      didCrouch: this.didCrouch,
      castFacingActive: this.castFacingRemaining > 0,
      castFacingYaw: this.castFacingYaw,
      dynamicObstacleCount: this.dynamicObstacles.filter(obstacle => obstacle.alive).length
    };
  }
}
