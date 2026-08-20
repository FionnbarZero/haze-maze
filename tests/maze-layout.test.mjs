import assert from 'node:assert/strict';
import test from 'node:test';

import { POUCH, WORLD } from '../third-person/config.js';
import { createMazeLayout } from '../third-person/maze-layout.js';

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

test('exactly ten percent of the ten dragons are aggressive', () => {
  assert.equal(layout.dragonSpawns.length, WORLD.dragonCount);
  assert.equal(layout.dragonSpawns.filter(dragon => dragon.aggressive).length, 1);
  assert.equal(layout.dragonSpawns.filter(dragon => dragon.aggressive).length / layout.dragonSpawns.length, WORLD.aggressiveDragonRatio);
  assert.equal(layout.dragonSpawns.filter(dragon => dragon.patrolRadius > 0).length, 9);
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
