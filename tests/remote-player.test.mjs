import assert from 'node:assert/strict';
import test from 'node:test';

import { RemotePlayerReplica, SimulatedTeammateFeed } from '../third-person/remote-player.js';

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

const BABYLON = { Vector3 };

const createPresentation = () => ({
  updates: [],
  update(state) {
    this.updates.push({ x: state.position.x, y: state.position.y, z: state.position.z });
  },
  snapshot() {
    return { label: 'Green Witch' };
  }
});

const initialSnapshot = {
  sequence: 0,
  sentAt: 0,
  position: { x: 0, y: 0, z: 0 },
  facingYaw: 0,
  speed: 0,
  grounded: true,
  crouched: false,
  state: 'IDLE'
};

test('remote replica rejects duplicate and out-of-order snapshots', () => {
  const replica = new RemotePlayerReplica(BABYLON, createPresentation(), initialSnapshot);

  assert.equal(replica.receiveSnapshot({ sequence: 2, position: { x: 2, y: 0, z: 0 } }, 1), true);
  assert.equal(replica.receiveSnapshot({ sequence: 1, position: { x: -10, y: 0, z: 0 } }, 2), false);
  assert.equal(replica.receiveSnapshot({ sequence: 2, position: { x: -20, y: 0, z: 0 } }, 3), false);

  const state = replica.snapshot();
  assert.equal(state.latestSequence, 2);
  assert.deepEqual(state.targetPosition, { x: 2, y: 0, z: 0 });
});

test('remote replica generates a next sequence only when one is omitted', () => {
  const replica = new RemotePlayerReplica(BABYLON, createPresentation(), initialSnapshot);

  assert.equal(replica.receiveSnapshot({ position: { x: 3, y: 0, z: 0 } }, 1), true);
  assert.equal(replica.snapshot().latestSequence, 1);
  assert.deepEqual(replica.snapshot().targetPosition, { x: 3, y: 0, z: 0 });
});

test('disabled remote replica does not move or update its presentation', () => {
  const presentation = createPresentation();
  const replica = new RemotePlayerReplica(BABYLON, presentation, initialSnapshot);
  replica.receiveSnapshot({ sequence: 1, position: { x: 10, y: 0, z: 0 } }, 1);
  replica.setEnabled(false);

  replica.update(1, 1);
  assert.deepEqual(replica.snapshot().position, { x: 0, y: 0, z: 0 });
  assert.equal(presentation.updates.length, 0);

  replica.setEnabled(true);
  replica.update(1, 2);
  assert.ok(replica.snapshot().position.x > 0);
  assert.equal(presentation.updates.length, 1);
});

test('pausing the simulated feed keeps the replica available for network snapshots', () => {
  const replica = new RemotePlayerReplica(BABYLON, createPresentation(), initialSnapshot);
  const feed = new SimulatedTeammateFeed(replica, {
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    grounded: true,
    crouched: false,
    state: 'IDLE'
  });

  feed.setEnabled(false);

  assert.equal(feed.snapshot().enabled, false);
  assert.equal(replica.snapshot().enabled, true);
  assert.equal(replica.receiveSnapshot({ sequence: 1, position: { x: 4, y: 0, z: 0 } }, 1), true);
  replica.update(1, 1);
  assert.ok(replica.snapshot().position.x > 0);
});

test('resetting a simulated feed without a timestamp stays in its current simulation-time epoch', () => {
  const replica = new RemotePlayerReplica(BABYLON, createPresentation(), initialSnapshot);
  const player = {
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    grounded: true,
    crouched: false,
    state: 'IDLE'
  };
  const feed = new SimulatedTeammateFeed(replica, player);

  feed.update(.4, player);
  feed.reset(player);
  assert.equal(feed.snapshot().nextSnapshotIn, 0);

  feed.update(.4, player);
  assert.equal(replica.snapshot().latestSequence, 3);
});
