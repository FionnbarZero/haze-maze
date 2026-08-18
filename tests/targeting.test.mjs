import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blockerPrecedesTarget,
  facingYawToward,
  raySphereEntryDistance
} from '../third-person/targeting.js';

const forward = Object.freeze({ x: 0, y: 0, z: 1 });
const target = Object.freeze({ x: 0, y: 1.12, z: 9 });

test('close-range crosshair ray enters the forgiving dragon aim volume', () => {
  const entry = raySphereEntryDistance(
    { x: 0, y: 1.12, z: 6.8 },
    forward,
    target,
    1.18,
    30
  );
  assert.ok(entry !== null);
  assert.ok(entry > 1 && entry < 1.1);
});

test('normal-range crosshair ray remains targetable', () => {
  const entry = raySphereEntryDistance(
    { x: 0, y: 1.12, z: 1 },
    forward,
    target,
    1.18,
    30
  );
  assert.ok(entry !== null);
  assert.ok(entry > 6.8 && entry < 6.9);
});

test('modestly off-center ray receives assistance but a wider miss does not', () => {
  const assisted = raySphereEntryDistance(
    { x: 1.02, y: 1.12, z: 5 },
    forward,
    target,
    1.18,
    30
  );
  const missed = raySphereEntryDistance(
    { x: 1.3, y: 1.12, z: 5 },
    forward,
    target,
    1.18,
    30
  );
  assert.notEqual(assisted, null);
  assert.equal(missed, null);
});

test('target behind the caster or beyond lightning range is rejected', () => {
  assert.equal(raySphereEntryDistance(
    { x: 0, y: 1.12, z: 10.5 },
    forward,
    target,
    1.18,
    30
  ), null);
  assert.equal(raySphereEntryDistance(
    { x: 0, y: 1.12, z: -30 },
    forward,
    target,
    1.18,
    20
  ), null);
});

test('world obstruction must precede the target by more than tolerance', () => {
  assert.equal(blockerPrecedesTarget(4, 6, 0.08), true);
  assert.equal(blockerPrecedesTarget(5.95, 6, 0.08), false);
  assert.equal(blockerPrecedesTarget(Infinity, 6, 0.08), false);
});

test('cast-facing yaw turns toward an off-center target', () => {
  const yaw = facingYawToward({ x: 1.5, z: 6 }, { x: 0, z: 9 });
  assert.ok(yaw < 0);
  assert.ok(Math.abs(yaw - Math.atan2(-1.5, 3)) < 1e-9);
  assert.equal(facingYawToward({ x: 1, z: 1 }, { x: 1, z: 1 }), null);
});
