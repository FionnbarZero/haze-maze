import { PERFORMANCE, QUALITY_TIERS } from './config.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function resolveQualityRequest() {
  const requested = new URLSearchParams(location.search).get('quality')?.toLowerCase() || '';
  const profile = QUALITY_TIERS[requested] || null;
  return {
    requested: profile ? requested : 'baseline',
    profile,
    qualificationEnabled: new URLSearchParams(location.search).get('qualification') === '1'
  };
}

export function initialHardwareScaling(qualityRequest) {
  if (qualityRequest.profile) return 1 / qualityRequest.profile.initialScale;
  return Math.max(1, (devicePixelRatio || 1) / PERFORMANCE.renderScaleDivisor);
}

export class AdaptiveQualityController {
  constructor(engine, qualityRequest) {
    this.engine = engine;
    this.name = qualityRequest.requested;
    this.profile = qualityRequest.profile;
    this.enabled = Boolean(this.profile);
    this.currentScale = this.enabled
      ? this.profile.initialScale
      : 1 / this.engine.getHardwareScalingLevel();
    this.lastEvaluationAt = performance.now();
    this.highFpsIntervals = 0;
    this.history = [{
      atMs: performance.now(),
      scale: this.currentScale,
      reason: this.enabled ? 'profile-start' : 'baseline'
    }];
  }

  update(nowMilliseconds) {
    if (!this.enabled || nowMilliseconds - this.lastEvaluationAt < 2000) return false;
    this.lastEvaluationAt = nowMilliseconds;
    const fps = this.engine.getFps();
    let nextScale = this.currentScale;
    let reason = '';
    if (fps < this.profile.targetFps - 3) {
      nextScale = this.currentScale - 0.05;
      this.highFpsIntervals = 0;
      reason = 'fps-below-target';
    } else if (fps > this.profile.targetFps + 4) {
      this.highFpsIntervals += 1;
      if (this.highFpsIntervals >= 3) {
        nextScale = this.currentScale + 0.05;
        this.highFpsIntervals = 0;
        reason = 'fps-headroom';
      }
    } else {
      this.highFpsIntervals = 0;
    }
    nextScale = clamp(nextScale, this.profile.minimumScale, this.profile.maximumScale);
    if (Math.abs(nextScale - this.currentScale) < 0.001) return false;
    this.currentScale = nextScale;
    this.engine.setHardwareScalingLevel(1 / this.currentScale);
    this.engine.resize();
    this.history.push({ atMs: nowMilliseconds, scale: this.currentScale, fps, reason });
    return true;
  }

  snapshot() {
    return {
      name: this.name,
      enabled: this.enabled,
      currentScale: this.currentScale,
      targetFps: this.profile?.targetFps ?? null,
      minimumScale: this.profile?.minimumScale ?? null,
      maximumScale: this.profile?.maximumScale ?? null,
      shadowMapSize: this.profile?.shadowMapSize ?? 1024,
      history: this.history.map(entry => ({ ...entry }))
    };
  }
}
