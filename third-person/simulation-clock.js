const finiteNonNegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * Keeps gameplay progression coherent when rendering is slow without allowing
 * a background-tab pause to turn into an unbounded simulation burst.
 */
export class SimulationClock {
  constructor({
    maximumStep = .05,
    maximumCatchUp = .35,
    maximumSteps = 8
  } = {}) {
    this.maximumStep = maximumStep;
    this.maximumCatchUp = maximumCatchUp;
    this.maximumSteps = maximumSteps;
    this.reset(0);
  }

  reset(wallTime = 0, simulationTime = 0) {
    this.generation = (this.generation || 0) + 1;
    this.wallTime = finiteNonNegative(wallTime);
    this.time = finiteNonNegative(simulationTime);
    this.lastWallTime = this.wallTime;
    this.droppedTime = 0;
    this.lastAdvance = {
      rawDelta: 0,
      simulatedDelta: 0,
      droppedDelta: 0,
      stepCount: 0
    };
  }

  advance(wallTime) {
    const nextWallTime = finiteNonNegative(wallTime);
    const rawDelta = Math.max(0, nextWallTime - this.lastWallTime);
    this.wallTime = nextWallTime;
    this.lastWallTime = nextWallTime;
    const acceptedDelta = Math.min(rawDelta, this.maximumCatchUp);
    let remaining = acceptedDelta;
    const steps = [];

    while (remaining > 1e-9 && steps.length < this.maximumSteps) {
      const deltaTime = Math.min(this.maximumStep, remaining);
      remaining -= deltaTime;
      steps.push({ deltaTime, generation: this.generation });
    }

    const droppedDelta = rawDelta - acceptedDelta + remaining;
    this.droppedTime += droppedDelta;
    this.lastAdvance = {
      rawDelta,
      simulatedDelta: acceptedDelta - remaining,
      droppedDelta,
      stepCount: steps.length
    };
    return steps;
  }

  consumeStep(step) {
    if (!step || step.generation !== this.generation) return null;
    this.time += step.deltaTime;
    return { ...step, time: this.time };
  }

  snapshot() {
    return {
      time: this.time,
      wallTime: this.wallTime,
      generation: this.generation,
      maximumStep: this.maximumStep,
      maximumCatchUp: this.maximumCatchUp,
      maximumSteps: this.maximumSteps,
      droppedTime: this.droppedTime,
      lastAdvance: { ...this.lastAdvance }
    };
  }
}

/**
 * Applies one rendered frame's prepared steps, stopping as soon as a consumer
 * resets the clock. This prevents stale pre-reset timestamps from leaking into
 * later actor or gameplay updates during a catch-up frame.
 */
export function runSimulationSteps(clock, steps, consumeStep) {
  let applied = 0;
  for (const step of steps) {
    if (step.generation !== clock.generation) return { applied, aborted: true };
    const consumedStep = clock.consumeStep(step);
    if (!consumedStep) return { applied, aborted: true };
    consumeStep(consumedStep);
    applied += 1;
    if (step.generation !== clock.generation) return { applied, aborted: true };
  }
  return { applied, aborted: false };
}
