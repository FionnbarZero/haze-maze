import assert from 'node:assert/strict';
import test from 'node:test';

import { SimulationClock, runSimulationSteps } from '../third-person/simulation-clock.js';

const approximately = (actual, expected, message) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, message || `expected ${actual} to equal ${expected}`);
};

test('a normal 60 FPS frame advances gameplay by the measured frame duration', () => {
  const clock = new SimulationClock();
  clock.reset(10);
  const steps = clock.advance(10 + 1 / 60);
  assert.equal(steps.length, 1);
  assert.ok(Math.abs(steps[0].deltaTime - 1 / 60) < 1e-9);
  assert.equal(clock.time, 0, 'planning must not advance the authoritative clock');
  runSimulationSteps(clock, steps, () => {});
  approximately(clock.time, 1 / 60);
  assert.equal(clock.snapshot().lastAdvance.droppedDelta, 0);
});

test('a 328 ms rendered frame uses bounded substeps instead of a single 50 ms simulation slice', () => {
  const clock = new SimulationClock();
  clock.reset(4);
  const steps = clock.advance(4.328);
  assert.equal(steps.length, 7);
  assert.ok(steps.every(step => step.deltaTime <= .05));
  assert.equal(clock.time, 0, 'planning a catch-up frame must not advance the authoritative clock');
  assert.ok(Math.abs(clock.snapshot().lastAdvance.simulatedDelta - .328) < 1e-9);
  runSimulationSteps(clock, steps, () => {});
  assert.ok(Math.abs(clock.time - .328) < 1e-9);
});

test('an extreme pause is safely capped and records discarded wall time', () => {
  const clock = new SimulationClock();
  clock.reset(0);
  const steps = clock.advance(10);
  assert.equal(steps.length, 7);
  assert.equal(clock.time, 0, 'dropped-time accounting must not pre-advance simulation');
  runSimulationSteps(clock, steps, () => {});
  approximately(clock.time, .35);
  assert.ok(Math.abs(clock.snapshot().lastAdvance.droppedDelta - 9.65) < 1e-9);
});

test('the maximum step count caps a catch-up frame and discards its unconsumed remainder', () => {
  const clock = new SimulationClock({ maximumStep: .05, maximumCatchUp: 1, maximumSteps: 2 });
  clock.reset(0);
  const steps = clock.advance(1);
  assert.equal(steps.length, 2);
  assert.ok(steps.every(step => step.deltaTime <= .05));
  assert.equal(clock.time, 0);
  assert.ok(Math.abs(clock.snapshot().lastAdvance.simulatedDelta - .1) < 1e-9);
  assert.ok(Math.abs(clock.snapshot().lastAdvance.droppedDelta - .9) < 1e-9);
  runSimulationSteps(clock, steps, () => {});
  approximately(clock.time, .1);
});

test('slow rendering does not multiply attack exposure relative to movement time', () => {
  const clock = new SimulationClock();
  clock.reset(0);
  const steps = clock.advance(.328);
  const movementDistance = steps.reduce((distance, step) => distance + 3 * step.deltaTime, 0);
  const attackTime = steps.reduce((time, step) => time + step.deltaTime, 0);
  assert.ok(Math.abs(movementDistance / 3 - attackTime) < 1e-9);
});

test('reset establishes a fresh valid timing baseline', () => {
  const clock = new SimulationClock();
  clock.advance(.2);
  clock.reset(25, 3);
  assert.deepEqual(clock.snapshot(), {
    time: 3,
    wallTime: 25,
    generation: 2,
    maximumStep: .05,
    maximumCatchUp: .35,
    maximumSteps: 8,
    droppedTime: 0,
    lastAdvance: { rawDelta: 0, simulatedDelta: 0, droppedDelta: 0, stepCount: 0 }
  });
  assert.equal(clock.advance(25).length, 0);
});

test('each catch-up consumer observes its active simulation step, never the planned frame end', () => {
  const clock = new SimulationClock();
  clock.reset(10);
  const observed = [];
  runSimulationSteps(clock, clock.advance(10.35), step => {
    observed.push({ stepTime: step.time, clockTime: clock.time });
  });
  const expectedTimes = [.05, .1, .15, .2, .25, .3, .35];
  observed.forEach((entry, index) => {
    approximately(entry.stepTime, expectedTimes[index]);
    approximately(entry.clockTime, entry.stepTime,
      'the public gameplay clock must equal the step being consumed');
  });
  approximately(clock.time, .35);
});

test('a reset during catch-up aborts stale steps and resumes gameplay deadlines on the new clock', () => {
  const clock = new SimulationClock();
  clock.reset(10);
  const appliedTimes = [];
  let cooldownUntil = null;
  const result = runSimulationSteps(clock, clock.advance(10.25), step => {
    appliedTimes.push(step.time);
    cooldownUntil = step.time + .5;
    if (appliedTimes.length === 2) clock.reset(10.25);
  });

  assert.deepEqual(result, { applied: 2, aborted: true });
  assert.deepEqual(appliedTimes, [.05, .1]);
  assert.equal(cooldownUntil, .6);

  runSimulationSteps(clock, clock.advance(10.3), step => {
    cooldownUntil = step.time + .5;
  });
  assert.equal(cooldownUntil, .55,
    'the next gameplay deadline must derive from the new simulation epoch, never the stale pre-reset time');
});

test('an early-step defeat schedules reset from that step and prevents abandoned steps from advancing the new clock', () => {
  const clock = new SimulationClock();
  clock.reset(20);
  const recoveryDelay = .85;
  let defeatResetAt = 0;
  let resets = 0;
  const observed = [];

  const initial = runSimulationSteps(clock, clock.advance(20.35), step => {
    observed.push(step.time);
    if (step.time === .05) defeatResetAt = clock.time + recoveryDelay;
    if (defeatResetAt && clock.time >= defeatResetAt) {
      resets += 1;
      clock.reset(20.35);
    }
  });
  assert.equal(defeatResetAt, .9);
  assert.equal(resets, 0);
  assert.deepEqual(initial, { applied: 7, aborted: false });

  const beforeRecovery = runSimulationSteps(clock, clock.advance(20.7), () => {});
  assert.deepEqual(beforeRecovery, { applied: 7, aborted: false });
  approximately(clock.time, .7);

  const recovery = runSimulationSteps(clock, clock.advance(21.05), step => {
    observed.push(step.time);
    if (clock.time + 1e-9 >= defeatResetAt) {
      resets += 1;
      clock.reset(21.05);
    }
  });
  assert.deepEqual(recovery, { applied: 4, aborted: true });
  assert.equal(resets, 1);
  assert.equal(clock.time, 0, 'the abandoned recovery batch must not advance the reset clock');
  assert.ok(observed.some(time => Math.abs(time - .9) < 1e-9),
    'recovery must become due at the early-step deadline');
});
