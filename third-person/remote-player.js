import { GREEN_WITCH } from './config.js?v=20260818-witchselect-v1';
import { damp } from './utils.js?v=20260818-witchselect-v1';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

const lerpAngle = (current, target, response, deltaTime) => {
  const wrapped = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + wrapped * (1 - Math.exp(-deltaTime / Math.max(.0001, response)));
};

const normalizedSnapshot = (snapshot = {}, fallback, receivedAt) => ({
  sequence: Number.isFinite(snapshot.sequence) ? Math.floor(snapshot.sequence) : fallback.sequence + 1,
  sentAt: finite(snapshot.sentAt, receivedAt),
  position: {
    x: finite(snapshot.position?.x ?? snapshot.x, fallback.position.x),
    y: finite(snapshot.position?.y ?? snapshot.y, fallback.position.y),
    z: finite(snapshot.position?.z ?? snapshot.z, fallback.position.z)
  },
  facingYaw: finite(snapshot.facingYaw, fallback.facingYaw),
  speed: Math.max(0, finite(snapshot.speed, fallback.speed)),
  grounded: snapshot.grounded === undefined ? fallback.grounded : Boolean(snapshot.grounded),
  crouched: snapshot.crouched === undefined ? fallback.crouched : Boolean(snapshot.crouched),
  aiming: snapshot.aiming === undefined ? fallback.aiming : Boolean(snapshot.aiming),
  state: String(snapshot.state || fallback.state || 'IDLE').toUpperCase()
});

export class RemotePlayerReplica {
  constructor(BABYLON, presentation, initialSnapshot) {
    this.BABYLON = BABYLON;
    this.presentation = presentation;
    this.snapshotsReceived = 0;
    this.enabled = true;
    this.latest = normalizedSnapshot(initialSnapshot, {
      sequence: -1,
      sentAt: 0,
      position: { x: 0, y: 0, z: 0 },
      facingYaw: 0,
      speed: 0,
      grounded: true,
      crouched: false,
      aiming: false,
      state: 'IDLE'
    }, 0);
    this.renderPosition = new BABYLON.Vector3(
      this.latest.position.x,
      this.latest.position.y,
      this.latest.position.z
    );
    this.renderYaw = this.latest.facingYaw;
    this.interpolationError = 0;
  }

  receiveSnapshot(snapshot, receivedAt = performance.now() / 1000) {
    const next = normalizedSnapshot(snapshot, this.latest, receivedAt);
    if (next.sequence <= this.latest.sequence) return false;
    this.latest = next;
    this.snapshotsReceived += 1;
    this.interpolationError = Math.hypot(
      next.position.x - this.renderPosition.x,
      next.position.y - this.renderPosition.y,
      next.position.z - this.renderPosition.z
    );
    return true;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
  }

  setPresentation(presentation) {
    if (!presentation) return false;
    this.presentation = presentation;
    this.snapToLatest();
    return true;
  }

  snapToLatest() {
    this.renderPosition.set(
      this.latest.position.x,
      this.latest.position.y,
      this.latest.position.z
    );
    this.renderYaw = this.latest.facingYaw;
  }

  update(deltaTime, time) {
    if (!this.enabled) return;
    const target = this.latest.position;
    this.renderPosition.x = damp(this.renderPosition.x, target.x, GREEN_WITCH.interpolationResponse, deltaTime);
    this.renderPosition.y = damp(this.renderPosition.y, target.y, GREEN_WITCH.interpolationResponse, deltaTime);
    this.renderPosition.z = damp(this.renderPosition.z, target.z, GREEN_WITCH.interpolationResponse, deltaTime);
    this.renderYaw = lerpAngle(this.renderYaw, this.latest.facingYaw, GREEN_WITCH.interpolationResponse, deltaTime);
    this.interpolationError = Math.hypot(
      target.x - this.renderPosition.x,
      target.y - this.renderPosition.y,
      target.z - this.renderPosition.z
    );
    this.presentation.update({
      position: this.renderPosition,
      facingYaw: this.renderYaw,
      speed: this.latest.speed,
      grounded: this.latest.grounded,
      crouched: this.latest.crouched,
      stateLabel: this.latest.state
    }, { aiming: this.latest.aiming }, deltaTime, time);
  }

  reset(snapshot) {
    const resetSequence = Math.floor(finite(snapshot.sequence, this.latest.sequence + 1));
    this.latest = normalizedSnapshot(snapshot, {
      ...this.latest,
      sequence: resetSequence - 1
    }, performance.now() / 1000);
    this.snapshotsReceived = 0;
    this.snapToLatest();
  }

  snapshot() {
    return {
      kind: 'REMOTE_REPLICA',
      source: 'SIMULATED_LAN_SNAPSHOTS',
      presentation: this.presentation.snapshot().label,
      enabled: this.enabled,
      snapshotsReceived: this.snapshotsReceived,
      latestSequence: this.latest.sequence,
      snapshotInterval: GREEN_WITCH.snapshotInterval,
      interpolationResponse: GREEN_WITCH.interpolationResponse,
      interpolationError: this.interpolationError,
      position: {
        x: this.renderPosition.x,
        y: this.renderPosition.y,
        z: this.renderPosition.z
      },
      targetPosition: { ...this.latest.position },
      facingYaw: this.renderYaw,
      state: this.latest.state,
      speed: this.latest.speed,
      grounded: this.latest.grounded,
      crouched: this.latest.crouched
    };
  }
}

export class SimulatedTeammateFeed {
  constructor(replica, initialPlayerState) {
    this.replica = replica;
    this.enabled = true;
    this.sequence = 0;
    this.nextSnapshotAt = 0;
    this.previousPosition = this.companionPosition(initialPlayerState);
  }

  companionPosition(player) {
    const forwardX = Math.sin(player.facingYaw);
    const forwardZ = Math.cos(player.facingYaw);
    const rightX = Math.cos(player.facingYaw);
    const rightZ = -Math.sin(player.facingYaw);
    let x = player.x + rightX * GREEN_WITCH.companionSideOffset + forwardX * GREEN_WITCH.companionForwardOffset;
    const z = player.z + rightZ * GREEN_WITCH.companionSideOffset + forwardZ * GREEN_WITCH.companionForwardOffset;
    if (z < 4.25) x = Math.max(-1.45, Math.min(1.45, x));
    return { x, y: player.y, z };
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
  }

  update(time, player) {
    if (!this.enabled || time < this.nextSnapshotAt) return;
    const position = this.companionPosition(player);
    const distance = Math.hypot(position.x - this.previousPosition.x, position.z - this.previousPosition.z);
    const speed = distance / GREEN_WITCH.snapshotInterval;
    const state = player.crouched
      ? 'CROUCH'
      : !player.grounded
        ? 'JUMP'
        : speed > .08
          ? player.state === 'SPRINT' ? 'SPRINT' : 'WALK'
          : 'IDLE';
    this.sequence += 1;
    this.replica.receiveSnapshot({
      sequence: this.sequence,
      sentAt: time,
      position,
      facingYaw: player.facingYaw,
      speed,
      grounded: player.grounded,
      crouched: player.crouched,
      state
    }, time);
    this.previousPosition = position;
    this.nextSnapshotAt = time + GREEN_WITCH.snapshotInterval;
  }

  reset(player, time = performance.now() / 1000) {
    this.sequence += 1;
    this.nextSnapshotAt = time;
    this.previousPosition = this.companionPosition(player);
    this.replica.reset({
      sequence: this.sequence,
      sentAt: time,
      position: this.previousPosition,
      facingYaw: player.facingYaw,
      speed: 0,
      grounded: player.grounded,
      crouched: player.crouched,
      state: player.crouched ? 'CROUCH' : 'IDLE'
    });
  }

  snapshot() {
    return {
      enabled: this.enabled,
      sequence: this.sequence,
      nextSnapshotIn: Math.max(0, this.nextSnapshotAt - performance.now() / 1000)
    };
  }
}
