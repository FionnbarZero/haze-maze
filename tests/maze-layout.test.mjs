import assert from 'node:assert/strict';
import test from 'node:test';

import { COMBAT, POUCH, WORLD } from '../third-person/config.js';
import { createChapterOneLevelPlan } from '../third-person/chapter-level-plan.js';
import { createMazeLayout } from '../third-person/maze-layout.js';

const expectedGeodeClearance = COMBAT.dragonAttackRange
  + POUCH.geodeMineRadius
  + WORLD.chapterGeodeDragonSafetyMargin;

const collisionEnvelopeRadius = dragon => dragon.patrolRadius
  + COMBAT.dragonCollisionRadius
  + WORLD.dragonPlacementSafetyMargin;

const circleIntersectsWall = (dragon, radius, wall) => {
  const nearestX = Math.max(wall.x - wall.width / 2, Math.min(wall.x + wall.width / 2, dragon.x));
  const nearestZ = Math.max(wall.z - wall.depth / 2, Math.min(wall.z + wall.depth / 2, dragon.z));
  return (dragon.x - nearestX) ** 2 + (dragon.z - nearestZ) ** 2 <= radius ** 2;
};

const assertSafeDragonEnvelopes = (candidateLayout, protectedPositions = [], label = candidateLayout.seed) => {
  const innerHalfWidth = candidateLayout.dimensions.width / 2 - WORLD.wallThickness;
  const innerHalfDepth = candidateLayout.dimensions.depth / 2 - WORLD.wallThickness;
  assert.equal(candidateLayout.dragonSpawns.length, WORLD.dragonCount, `${label} dragon count`);
  assert.equal(candidateLayout.dragonSpawns.filter(dragon => dragon.aggressive).length, WORLD.dragonCount,
    `${label} aggressive dragon count`);
  assert.equal(candidateLayout.dragonSpawns.filter(dragon => dragon.patrolRadius > 0).length, 9,
    `${label} patrol count`);
  for (const dragon of candidateLayout.dragonSpawns) {
    const collisionEnvelope = collisionEnvelopeRadius(dragon);
    assert.ok(Math.abs(dragon.x) + collisionEnvelope <= innerHalfWidth,
      `${label} ${dragon.id} must remain inside east/west playable bounds`);
    assert.ok(Math.abs(dragon.z) + collisionEnvelope <= innerHalfDepth,
      `${label} ${dragon.id} must remain inside north/south playable bounds`);
    assert.ok([...candidateLayout.walls, ...candidateLayout.outerWalls]
      .every(wall => !circleIntersectsWall(dragon, collisionEnvelope, wall)),
      `${label} ${dragon.id} full patrol/collision envelope must avoid every wall`);
    for (const position of protectedPositions) {
      assert.ok(
        Math.hypot(dragon.x - position.x, dragon.z - position.z) - dragon.patrolRadius >= expectedGeodeClearance,
        `${label} ${dragon.id} must keep the complete legal mining area outside attack range`
      );
    }
  }
};

const layout = createMazeLayout({
  seed: WORLD.defaultMazeSeed,
  width: WORLD.floorWidth,
  depth: WORLD.floorDepth,
  wallThickness: WORLD.wallThickness
});

test('expanded maze has at least three times the former floor area', () => {
  assert.equal(layout.dimensions.width, 28);
  assert.equal(layout.dimensions.depth, 52);
  assert.ok(layout.dimensions.areaMultiplier >= 3);
  assert.ok(layout.walls.length >= 20, 'room partitions should remain maze-like');
});

test('seeded room walls and dragon placements are repeatable but variable', () => {
  const repeat = createMazeLayout({ seed: WORLD.defaultMazeSeed });
  const variant = createMazeLayout({ seed: 'moonhollow-expanded-variant' });
  assert.deepEqual(repeat.walls, layout.walls);
  assert.deepEqual(repeat.dragonSpawns, layout.dragonSpawns);
  assert.notDeepEqual(variant.walls, layout.walls);
  assert.notDeepEqual(variant.dragonSpawns, layout.dragonSpawns);
});

test('all ten dragons are aggressive while nine patrol', () => {
  assert.equal(layout.dragonSpawns.length, WORLD.dragonCount);
  assert.equal(layout.dragonSpawns.filter(dragon => dragon.aggressive).length, 10);
  assert.equal(layout.dragonSpawns.filter(dragon => dragon.aggressive).length / layout.dragonSpawns.length, WORLD.aggressiveDragonRatio);
  assert.equal(layout.dragonSpawns.filter(dragon => dragon.patrolRadius > 0).length, 9);
  assert.ok(layout.dragonSpawns.slice(1).every(dragon => Number.isFinite(dragon.patrolAngle)));
  assert.ok(layout.dragonSpawns.slice(1).every(dragon => dragon.patrolPause >= .85));
});

test('seeded protected sockets remain clear of complete dragon patrol envelopes', () => {
  const protectedPositions = [
    { x: -10.4, z: -22.8 },
    { x: 10.5, z: -14.5 },
    { x: 7.4, z: -8.6 }
  ];
  const protectedLayout = createMazeLayout({
    seed: 'protected-progression-sockets',
    protectedPositions,
    protectedRadius: expectedGeodeClearance
  });

  assert.equal(WORLD.chapterGeodeDragonClearance, expectedGeodeClearance,
    'configured clearance must remain derived from attack range, mining radius, and the named margin');
  assertSafeDragonEnvelopes(protectedLayout, protectedPositions);
});

test('chapter-one-validation-0 rejects the historical outer-east-wall patrol overlap', () => {
  const seed = 'chapter-one-validation-0';
  const planningLayout = createMazeLayout({
    seed,
    width: WORLD.floorWidth,
    depth: WORLD.floorDepth,
    wallThickness: WORLD.wallThickness
  });
  const plan = createChapterOneLevelPlan({ seed, layout: planningLayout });
  const protectedPositions = [...plan.requiredGeodes, ...plan.optionalGeodes].map(geode => geode.position);
  const protectedLayout = createMazeLayout({
    seed,
    width: WORLD.floorWidth,
    depth: WORLD.floorDepth,
    wallThickness: WORLD.wallThickness,
    protectedPositions,
    protectedRadius: expectedGeodeClearance
  });

  assertSafeDragonEnvelopes(protectedLayout, protectedPositions, seed);
  assert.ok(protectedLayout.dragonSpawns.every(dragon => (
    Math.abs(dragon.x - 12.5564) > .01 || Math.abs(dragon.z - -6.447) > .01
  )), 'the known dragon-9 outer-east-wall placement must not survive validation');
});

test('collectible and fountain populations are four times their original counts', () => {
  assert.equal(POUCH.berryBushes.length, 12);
  assert.equal(layout.fountainPositions.length, 8);
  assert.equal(POUCH.geodeRocks.length, 4);
  assert.equal(POUCH.powerups.length, 8);
});

test('four found runes gate the two doors in sequence', () => {
  assert.equal(POUCH.runes.length, 4);
  assert.equal(POUCH.firstDoorRunes, 2);
  assert.equal(POUCH.requiredRunes, 4);
  assert.equal(POUCH.runes.filter(rune => rune.available).length, 4);
  assert.equal(POUCH.runes.filter(rune => rune.z < WORLD.firstDoorZ).length, 2);
  assert.equal(POUCH.runes.filter(rune => rune.z > WORLD.firstDoorZ).length, 2);
});

test('new populations stay within the playable floor and span the maze', () => {
  const populations = [
    POUCH.berryBushes,
    POUCH.powerups,
    POUCH.geodeRocks,
    POUCH.runes,
    layout.fountainPositions,
    layout.dragonSpawns
  ];
  for (const entries of populations) {
    for (const entry of entries) {
      assert.ok(Math.abs(entry.x) < WORLD.floorWidth / 2, `${entry.id} x should be inside the maze`);
      assert.ok(Math.abs(entry.z) < WORLD.floorDepth / 2, `${entry.id} z should be inside the maze`);
    }
    const zValues = entries.map(entry => entry.z);
    assert.ok(Math.min(...zValues) < -5, 'population should reach southern rooms');
    assert.ok(Math.max(...zValues) > 5, 'population should reach northern rooms');
  }
});
