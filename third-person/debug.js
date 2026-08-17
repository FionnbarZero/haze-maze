export class DebugTelemetry {
  constructor(engine) {
    this.engine = engine;
    this.fps = document.querySelector('#debug-fps');
    this.camera = document.querySelector('#debug-camera');
    this.player = document.querySelector('#debug-player');
    this.collision = document.querySelector('#debug-collision');
    this.cameraMode = document.querySelector('#camera-mode');
    this.samples = [];
    this.lastDomUpdate = 0;
    this.startedAt = performance.now();
  }

  update(time, deltaTime, playerState, cameraState) {
    const instantaneous = deltaTime > 0 ? 1 / deltaTime : 0;
    if (instantaneous > 0 && instantaneous < 500) {
      this.samples.push(instantaneous);
      if (this.samples.length > 900) this.samples.shift();
    }
    if (time - this.lastDomUpdate < .12) return;
    this.lastDomUpdate = time;
    this.fps.textContent = `${this.engine.getFps().toFixed(0)} current · ${this.averageFps().toFixed(0)} avg`;
    this.camera.textContent = `${cameraState.actualDistance.toFixed(2)}m / ${cameraState.desiredDistance.toFixed(2)}m · ${cameraState.fov.toFixed(0)}°`;
    this.player.textContent = `${playerState.state} · ${playerState.speed.toFixed(2)}m/s · y ${playerState.y.toFixed(2)}`;
    this.collision.textContent = cameraState.colliding
      ? `CAMERA · ${cameraState.collisionMesh || 'GEOMETRY'}`
      : playerState.collision;
    this.cameraMode.textContent = `${cameraState.side} shoulder · ${cameraState.mode}`;
  }

  averageFps() {
    if (!this.samples.length) return 0;
    return this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
  }

  percentileFps(percentile = .05) {
    if (!this.samples.length) return 0;
    const ordered = [...this.samples].sort((a, b) => a - b);
    return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * percentile))];
  }

  snapshot() {
    return {
      sampleCount: this.samples.length,
      averageFps: this.averageFps(),
      lowFivePercentFps: this.percentileFps(.05),
      elapsedSeconds: (performance.now() - this.startedAt) / 1000,
      engineFps: this.engine.getFps()
    };
  }
}
