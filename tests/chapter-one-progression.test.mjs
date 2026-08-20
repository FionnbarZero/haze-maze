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
import { ChapterOneProgression } from '../third-person/chapter-progression.js';
import { spellDamageMultiplier } from '../third-person/combat.js';
import { createMazeLayout } from '../third-person/maze-layout.js';

const createPlan = seed => {
  const layout = createMazeLayout({ seed });
  return { layout, plan: createChapterOneLevelPlan({ seed, layout }) };
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
    assert.equal(progression.snapshot().sunkenGate.opened, true);
    assert.equal(progression.hasCompletedRune(), true);
  }
});
