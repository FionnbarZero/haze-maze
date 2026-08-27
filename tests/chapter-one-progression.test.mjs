import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAPTER_ONE_FRAGMENT_IDS,
  CHAPTER_ONE_KEEPER_CLUES,
  CHAPTER_ONE_ROUTE_RUNE_ID,
  createChapterOneLevelPlan,
  validateChapterOneLevelPlan
} from '../third-person/chapter-level-plan.js';
import { ChapterOneInteractions, EQUIPMENT_MODES } from '../third-person/chapter-interactions.js';
import { ChapterOneGeodeState } from '../third-person/chapter-geode-state.js';
import { ChapterOneProgression } from '../third-person/chapter-progression.js';
import { spellDamageMultiplier } from '../third-person/combat.js';
import { COMBAT, POUCH, WORLD } from '../third-person/config.js';
import { createMazeLayout } from '../third-person/maze-layout.js';

const createPlan = seed => {
  const layout = createMazeLayout({ seed });
  return { layout, plan: createChapterOneLevelPlan({ seed, layout }) };
};

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

const protectedChapterLayout = (seed, plan) => createMazeLayout({
  seed,
  width: WORLD.floorWidth,
  depth: WORLD.floorDepth,
  wallThickness: WORLD.wallThickness,
  protectedPositions: [...plan.requiredGeodes, ...plan.optionalGeodes].map(geode => geode.position),
  protectedRadius: expectedGeodeClearance
});

const assertChapterDragonSafety = (layout, plan, seed) => {
  const protectedPositions = [...plan.requiredGeodes, ...plan.optionalGeodes].map(geode => geode.position);
  const innerHalfWidth = layout.dimensions.width / 2 - WORLD.wallThickness;
  const innerHalfDepth = layout.dimensions.depth / 2 - WORLD.wallThickness;
  assert.equal(layout.dragonSpawns.length, WORLD.dragonCount, `${seed} dragon count`);
  assert.equal(layout.dragonSpawns.filter(dragon => dragon.aggressive).length, WORLD.dragonCount, `${seed} aggressive count`);
  assert.equal(layout.dragonSpawns.filter(dragon => dragon.patrolRadius > 0).length, 9, `${seed} patrol count`);
  for (const dragon of layout.dragonSpawns) {
    const collisionEnvelope = collisionEnvelopeRadius(dragon);
    assert.ok(Math.abs(dragon.x) + collisionEnvelope <= innerHalfWidth, `${seed} ${dragon.id} x boundary`);
    assert.ok(Math.abs(dragon.z) + collisionEnvelope <= innerHalfDepth, `${seed} ${dragon.id} z boundary`);
    assert.ok([...layout.walls, ...layout.outerWalls]
      .every(wall => !circleIntersectsWall(dragon, collisionEnvelope, wall)),
      `${seed} ${dragon.id} wall clearance`);
    assert.ok(protectedPositions.every(position => (
      Math.hypot(dragon.x - position.x, dragon.z - position.z) - dragon.patrolRadius >= expectedGeodeClearance
    )), `${seed} ${dragon.id} geode mining-area clearance`);
  }
};

test('250 deterministic seeds produce exactly three reachable required fragments before the gate', () => {
  for (let index = 0; index < 250; index += 1) {
    const seed = `chapter-one-validation-${index}`;
    const { layout, plan } = createPlan(seed);
    const repeated = createChapterOneLevelPlan({ seed, layout });
    const validation = validateChapterOneLevelPlan(plan, layout);
    assert.equal(validation.valid, true, `${seed}: ${validation.errors.join('; ')}`);
    assert.equal(validation.requiredFragmentCount, 3);
    assert.equal(validation.reachableRequiredGeodes, 3);
    assert.equal(plan.requiredGeodes.length, 3);
    assert.ok(plan.requiredGeodes.every(geode => geode.position.z < plan.sunkenGate.z));
    assert.deepEqual(repeated, plan, `${seed} should produce a repeatable plan`);

    const protectedLayout = protectedChapterLayout(seed, plan);
    const repeatedProtectedLayout = protectedChapterLayout(seed, plan);
    assert.deepEqual(repeatedProtectedLayout, protectedLayout, `${seed} protected layout should remain deterministic`);
    assertChapterDragonSafety(protectedLayout, plan, seed);
  }
});

test('1000 additional Chapter seeds construct complete safe deterministic dragon layouts', () => {
  for (let index = 0; index < 1000; index += 1) {
    const seed = `chapter-one-generation-sweep-${index}`;
    const { plan } = createPlan(seed);
    const protectedLayout = protectedChapterLayout(seed, plan);
    assertChapterDragonSafety(protectedLayout, plan, seed);
  }
});

test('optional randomness cannot replace or contain mandatory progression', () => {
  const { layout, plan } = createPlan('optional-separation');
  const requiredSockets = new Set(plan.requiredGeodes.map(geode => geode.socketId));
  assert.ok(plan.optionalGeodes.every(geode => !requiredSockets.has(geode.socketId)));
  assert.ok(plan.optionalGeodes.every(geode => geode.content.kind === 'raw-damage-crystal'));

  const invalid = structuredClone(plan);
  invalid.optionalGeodes[0].socketId = invalid.requiredGeodes[0].socketId;
  invalid.optionalGeodes[0].content = structuredClone(invalid.requiredGeodes[0].content);
  const validation = validateChapterOneLevelPlan(invalid, layout);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => error.includes('required socket')));
  assert.ok(validation.errors.some(error => error.includes('invalid optional content')));
});

test('required geodes preserve the three distinct canonical Keeper clues', () => {
  const { layout, plan } = createPlan('keeper-clue-validation');
  const invalid = structuredClone(plan);
  invalid.requiredGeodes[1].content.clue = structuredClone(invalid.requiredGeodes[0].content.clue);

  const validation = validateChapterOneLevelPlan(invalid, layout);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => error.includes('three distinct Keeper clues')));
});

test('accepted plans are deeply immutable and reject forged socket positions or contents', () => {
  const { layout, plan } = createPlan('plan-integrity');
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.requiredGeodes), true);
  assert.equal(Object.isFrozen(plan.requiredGeodes[0].position), true);
  assert.throws(() => { plan.requiredGeodes[0].position.x = 999; }, TypeError);

  const moved = structuredClone(plan);
  moved.requiredGeodes[0].position.x = 999;
  assert.equal(validateChapterOneLevelPlan(moved, layout).valid, false);

  const forged = structuredClone(plan);
  forged.requiredGeodes[0].content.fragmentId = 'forged-fragment';
  assert.equal(validateChapterOneLevelPlan(forged, layout).valid, false);

  const wrongOptionalSocket = structuredClone(plan);
  wrongOptionalSocket.optionalGeodes[0].socketId = 'not-an-approved-socket';
  assert.equal(validateChapterOneLevelPlan(wrongOptionalSocket, layout).valid, false);
});

test('exactly three unique matching fragments complete the permanent route-rune', () => {
  const progression = new ChapterOneProgression();
  const forged = progression.collectFragment({
    runeId: CHAPTER_ONE_ROUTE_RUNE_ID,
    fragmentId: 'forged-fragment',
    clue: CHAPTER_ONE_KEEPER_CLUES[0]
  });
  assert.equal(forged.accepted, false);
  assert.equal(forged.reason, 'INVALID_FRAGMENT');
  for (let index = 0; index < 2; index += 1) {
    const result = progression.collectFragment({
      runeId: CHAPTER_ONE_ROUTE_RUNE_ID,
      fragmentId: CHAPTER_ONE_FRAGMENT_IDS[index],
      clue: CHAPTER_ONE_KEEPER_CLUES[index]
    });
    assert.equal(result.accepted, true);
    assert.equal(result.completedNow, false);
    assert.equal(progression.hasCompletedRune(), false);
    assert.equal(progression.unlockSunkenGate(), false);
  }

  const third = progression.collectFragment({
    runeId: CHAPTER_ONE_ROUTE_RUNE_ID,
    fragmentId: CHAPTER_ONE_FRAGMENT_IDS[2],
    clue: CHAPTER_ONE_KEEPER_CLUES[2]
  });
  assert.equal(third.completedNow, true);
  assert.equal(progression.hasCompletedRune(), true);
  assert.equal(progression.unlockSunkenGate(), true);
  assert.equal(progression.markSunkenGateOpened(), true);
  assert.equal(progression.snapshot().completion.gardenMazeComplete, false,
    'opening the gate is not the same as crossing the Garden Maze boundary');
  assert.equal(progression.completeGardenMaze(), true);
  assert.equal(progression.snapshot().completion.gardenMazeComplete, true);
  assert.equal(progression.snapshot().completion.chapterComplete, false,
    'Garden Maze completion must not complete Chapter 1');
  assert.equal(progression.hasCompletedRune(), true, 'opening the gate must not consume the rune');
  assert.equal(progression.snapshot().keeperClues.length, 3);

  const escapedSnapshot = progression.snapshot();
  escapedSnapshot.completedRunes.length = 0;
  escapedSnapshot.routeRune.fragments.length = 0;
  escapedSnapshot.keeperClues.length = 0;
  assert.equal(progression.hasCompletedRune(), true, 'external state must not mutate the protected rune');
  assert.equal(progression.snapshot().routeRune.fragmentCount, 3);
  assert.equal(progression.snapshot().keeperClues.length, 3);

  const duplicate = progression.collectFragment({
    runeId: CHAPTER_ONE_ROUTE_RUNE_ID,
    fragmentId: `${CHAPTER_ONE_ROUTE_RUNE_ID}-fragment-3`,
    clue: CHAPTER_ONE_KEEPER_CLUES[2]
  });
  assert.equal(duplicate.accepted, false);
  assert.equal(progression.snapshot().routeRune.fragmentCount, 3);

  const extra = progression.collectFragment({
    runeId: CHAPTER_ONE_ROUTE_RUNE_ID,
    fragmentId: `${CHAPTER_ONE_ROUTE_RUNE_ID}-fragment-4`,
    clue: CHAPTER_ONE_KEEPER_CLUES[0]
  });
  assert.equal(extra.accepted, false);
  assert.equal(extra.reason, 'RUNE_ALREADY_COMPLETE');
});

test('staff and Mining Tools modes enforce their mutually exclusive actions', () => {
  const { plan } = createPlan('tool-mode');
  const interactions = new ChapterOneInteractions({ actorId: 'purple', geodes: plan.requiredGeodes });
  const geode = plan.requiredGeodes[0];

  assert.equal(interactions.canActorCast('purple'), true);
  assert.equal(interactions.canActorMine('purple'), false);
  assert.equal(interactions.strikeGeode(geode.id, 'purple').reason, 'WRONG_TOOL_MODE');
  interactions.setMode(EQUIPMENT_MODES.miningTools);
  assert.equal(interactions.snapshot().tools.pick.mode, EQUIPMENT_MODES.miningTools);
  assert.equal(interactions.snapshot().tools.hammer.mode, EQUIPMENT_MODES.miningTools);
  assert.equal(interactions.canActorCast('purple'), false);
  assert.equal(interactions.canActorMine('purple'), true);
  assert.equal(interactions.canActorMine('green'), false);
  assert.equal(interactions.strikeGeode(geode.id, 'purple').accepted, true);
});

test('geode damage belongs to shared world state and persists when a new Witch takes the tools', () => {
  const { plan } = createPlan('shared-geode-damage');
  const geode = structuredClone(plan.requiredGeodes[0]);
  geode.strikesRequired = 15;
  const geodeState = new ChapterOneGeodeState({ geodes: [geode] });
  const interactions = new ChapterOneInteractions({
    actorId: 'purple',
    geodes: [geode],
    geodeState
  });
  interactions.setMode(EQUIPMENT_MODES.miningTools);

  for (let strike = 0; strike < 14; strike += 1) {
    const result = interactions.strikeGeode(geode.id, 'purple');
    assert.equal(result.accepted, true);
    assert.equal(result.brokenNow, false);
  }
  assert.equal(geodeState.snapshot().geodes[0].strikes, 14);

  interactions.assignToolsToActor('green');
  assert.equal(interactions.canActorMine('purple'), false);
  assert.equal(interactions.canActorMine('green'), true);
  const finalStrike = interactions.strikeGeode(geode.id, 'green');
  assert.equal(finalStrike.accepted, true);
  assert.equal(finalStrike.strikes, 15);
  assert.equal(finalStrike.brokenNow, true);
  assert.deepEqual(finalStrike.content, geode.content);
  assert.equal(geodeState.snapshot().geodes[0].broken, true);
});

test('future Chapter 1 stages advance only through ordered controlled transitions', () => {
  const progression = new ChapterOneProgression();
  progression.rootboundCrossing = { state: 'COMPLETE', complete: true };
  progression.encounter = { state: 'COMPLETE', complete: true };
  progression.westTower = { accessible: true, complete: true };
  progression.moonSeal = { state: 'LIT' };
  progression.moonDoor = { active: true, crossed: true };
  progression.chapter = { complete: true };

  assert.equal(progression.completeRootboundCrossing(), false);
  assert.equal(progression.startBriarheartEncounter(), false);
  assert.equal(progression.completeBriarheartEncounter(), false);
  assert.equal(progression.advanceMoonSeal('LIT'), false);
  assert.equal(progression.completeChapter(), false);
  assert.deepEqual(progression.snapshot().rootboundCrossing, { state: 'LOCKED', complete: false });
  assert.deepEqual(progression.snapshot().encounter, { state: 'LOCKED', complete: false });
  assert.deepEqual(progression.snapshot().westTower, { accessible: false, complete: false });
  assert.deepEqual(progression.snapshot().moonSeal, { state: 'DISTORTED' });
  assert.deepEqual(progression.snapshot().moonDoor, { active: false, crossed: false });
  assert.equal(progression.snapshot().completion.chapterComplete, false);

  for (let index = 0; index < CHAPTER_ONE_FRAGMENT_IDS.length; index += 1) {
    progression.collectFragment({
      runeId: CHAPTER_ONE_ROUTE_RUNE_ID,
      fragmentId: CHAPTER_ONE_FRAGMENT_IDS[index],
      clue: CHAPTER_ONE_KEEPER_CLUES[index]
    });
  }
  assert.equal(progression.unlockSunkenGate(), true);
  assert.equal(progression.markSunkenGateOpened(), true);
  assert.equal(progression.completeGardenMaze(), true);
  assert.equal(progression.completeRootboundCrossing(), true);
  assert.equal(progression.startBriarheartEncounter(), true);
  assert.equal(progression.completeBriarheartEncounter(), true);
  for (const state of ['CORRUPTION_REMOVED', 'RINGS_ALIGNED', 'ATTUNED', 'LIT']) {
    assert.equal(progression.advanceMoonSeal(state), true);
  }
  assert.equal(progression.snapshot().westTower.complete, true);
  assert.deepEqual(progression.snapshot().moonDoor, { active: true, crossed: false });
  assert.equal(progression.snapshot().completion.chapterComplete, false);
  assert.equal(progression.completeChapter(), false, 'lighting the seal must not bypass the Moon Door exit');
  assert.equal(progression.markMoonDoorCrossed(), true);
  assert.equal(progression.completeChapter(), true);
  assert.equal(progression.snapshot().completion.chapterComplete, true);

  const escaped = progression.snapshot();
  escaped.rootboundCrossing.state = 'LOCKED';
  escaped.encounter.complete = false;
  escaped.westTower.accessible = false;
  escaped.moonSeal.state = 'DISTORTED';
  escaped.moonDoor.crossed = false;
  escaped.completion.chapterComplete = false;
  assert.equal(progression.snapshot().rootboundCrossing.complete, true);
  assert.equal(progression.snapshot().encounter.complete, true);
  assert.equal(progression.snapshot().westTower.accessible, true);
  assert.equal(progression.snapshot().moonSeal.state, 'LIT');
  assert.equal(progression.snapshot().moonDoor.crossed, true);
  assert.equal(progression.snapshot().completion.chapterComplete, true);
});

test('Raw Damage Crystals multiply every damaging Witch spell without changing legacy geode semantics', () => {
  for (const spell of ['lightning', 'iceLance', 'fireball']) {
    assert.equal(spellDamageMultiplier({ spell, damageCrystalMultiplier: 1.1 }), 1.1);
  }
  assert.equal(spellDamageMultiplier({ spell: 'freeze', damageCrystalMultiplier: 1.1 }), 1);
  assert.equal(spellDamageMultiplier({
    spell: 'lightning',
    damageCrystalMultiplier: 1.1,
    legacyGeodeMultiplier: 1.2,
    lightningPotionMultiplier: 2
  }), 2.64);
  assert.equal(spellDamageMultiplier({
    spell: 'fireball',
    damageCrystalMultiplier: 1.1,
    legacyGeodeMultiplier: 1.2,
    lightningPotionMultiplier: 2
  }), 1.1);
});

test('every selectable Witch can complete the required solo Garden Maze state loop', () => {
  const { plan } = createPlan('all-witches-solo');
  for (const actorId of ['purple', 'green', 'frost', 'fire']) {
    const progression = new ChapterOneProgression();
    const interactions = new ChapterOneInteractions({ actorId, geodes: plan.requiredGeodes });
    interactions.setMode(EQUIPMENT_MODES.miningTools);
    for (const geode of plan.requiredGeodes) {
      let result = null;
      for (let strike = 0; strike < geode.strikesRequired; strike += 1) {
        result = interactions.strikeGeode(geode.id, actorId);
      }
      assert.equal(result.brokenNow, true);
      progression.collectFragment(result.content);
    }
    assert.equal(progression.hasCompletedRune(), true, `${actorId} should complete the route-rune`);
    assert.equal(progression.unlockSunkenGate(), true);
    assert.equal(progression.markSunkenGateOpened(), true);
    assert.equal(progression.completeGardenMaze(), true);
    assert.equal(progression.snapshot().sunkenGate.opened, true);
    assert.equal(progression.snapshot().completion.gardenMazeComplete, true);
    assert.equal(progression.snapshot().completion.chapterComplete, false);
    assert.equal(progression.hasCompletedRune(), true);
  }
});
