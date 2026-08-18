import { PERFORMANCE } from './config.js?v=20260818-rewards-v1';

const bytesToMiB = bytes => `${(bytes / 1024 / 1024).toFixed(1)}MiB`;

export class DebugTelemetry {
  constructor(engine, scene, sceneInstrumentation, moduleStartedAt) {
    this.engine = engine;
    this.scene = scene;
    this.sceneInstrumentation = sceneInstrumentation;
    this.moduleStartedAt = moduleStartedAt;
    this.firstPlayableAt = 0;
    this.firstRenderedFrameAt = 0;
    this.fps = document.querySelector('#debug-fps');
    this.frame = document.querySelector('#debug-frame');
    this.camera = document.querySelector('#debug-camera');
    this.player = document.querySelector('#debug-player');
    this.capsule = document.querySelector('#debug-capsule');
    this.collision = document.querySelector('#debug-collision');
    this.target = document.querySelector('#debug-target');
    this.sceneCopy = document.querySelector('#debug-scene');
    this.budget = document.querySelector('#debug-budget');
    this.render = document.querySelector('#debug-render');
    this.load = document.querySelector('#debug-load');
    this.cameraMode = document.querySelector('#camera-mode');
    this.samples = [];
    this.frameTimes = [];
    this.lastDomUpdate = 0;
    this.startedAt = performance.now();
    this.totalFrameTime = 0;
    this.totalFrames = 0;
    this.frameSpikesOver50 = 0;
    this.maximumFrameTime = 0;
    this.latestBudget = this.sceneBudget();
    this.lifecycle = {
      blur: 0,
      focus: 0,
      hidden: 0,
      visible: 0,
      contextLost: 0,
      contextRestored: 0
    };
  }

  markReady() {
    if (!this.firstPlayableAt) this.firstPlayableAt = performance.now();
  }

  markFirstRenderedFrame() {
    if (!this.firstRenderedFrameAt) this.firstRenderedFrameAt = performance.now();
  }

  recordLifecycle(event) {
    if (event in this.lifecycle) this.lifecycle[event] += 1;
  }

  update(time, deltaTime, playerState, cameraState, combatState, dragonState, worldState, witchState) {
    const frameTime = deltaTime * 1000;
    const instantaneous = deltaTime > 0 ? 1 / deltaTime : 0;
    if (instantaneous > 0 && instantaneous < 500) {
      this.samples.push(instantaneous);
      this.frameTimes.push(frameTime);
      if (this.samples.length > PERFORMANCE.telemetrySamples) this.samples.shift();
      if (this.frameTimes.length > PERFORMANCE.telemetrySamples) this.frameTimes.shift();
      this.totalFrameTime += frameTime;
      this.totalFrames += 1;
      if (frameTime > PERFORMANCE.frameSpikeThresholdMs) this.frameSpikesOver50 += 1;
      this.maximumFrameTime = Math.max(this.maximumFrameTime, frameTime);
    }
    if (time - this.lastDomUpdate < PERFORMANCE.telemetryDomInterval) return;
    this.lastDomUpdate = time;
    this.latestBudget = this.sceneBudget();
    const load = this.loadSnapshot();
    this.fps.textContent = `${this.engine.getFps().toFixed(0)} now · ${this.averageFps().toFixed(0)} avg · ${this.percentileFps(.01).toFixed(0)} 1%`;
    this.frame.textContent = `${this.averageFrameTime().toFixed(1)}ms avg · ${this.percentileFrameTime(.95).toFixed(1)}ms p95 · ${this.frameSpikesOver50} spikes`;
    this.camera.textContent = `${cameraState.actualBoom.toFixed(2)}m / ${cameraState.desiredBoom.toFixed(2)}m · ${Math.abs(cameraState.shoulderOffset).toFixed(2)}m shoulder`;
    this.player.textContent = `${playerState.state} · ${playerState.speed.toFixed(2)}m/s · y ${playerState.y.toFixed(2)}`;
    this.capsule.textContent = `${playerState.capsuleHeight.toFixed(2)}m · ${playerState.grounded ? 'GROUNDED' : `AIR ${playerState.verticalVelocity.toFixed(2)}`}`;
    this.collision.textContent = cameraState.colliding || cameraState.sideColliding
      ? `CAMERA · ${cameraState.collisionMesh || 'GEOMETRY'}${cameraState.occluded ? ' · OCCLUDED' : ''}`
      : playerState.collision;
    this.target.textContent = `${dragonState.state} · ${dragonState.health}/${dragonState.maximumHealth} · ${combatState.selectedSpell.toUpperCase()} · ${combatState.targeted ? 'LOCK' : 'FREE'}`;
    this.sceneCopy.textContent = `${this.latestBudget.meshCount} meshes · gate ${worldState.gate.state} · ${witchState.animationState}`;
    this.budget.textContent = `${this.latestBudget.drawCalls ?? '—'} draws · ${this.latestBudget.activeMaterials}/${this.latestBudget.materialCount} mats · ${this.latestBudget.textureCount} tex`;
    this.render.textContent = `${this.latestBudget.renderWidth}×${this.latestBudget.renderHeight} · ${this.latestBudget.hardwareScaling.toFixed(2)}x · ${bytesToMiB(this.latestBudget.estimatedTextureBytes)}`;
    this.load.textContent = `${load.firstPlayableMs ? `${load.firstPlayableMs.toFixed(0)}ms playable` : 'loading'} · ${bytesToMiB(load.visibleTransferBytes)}`;
    this.cameraMode.textContent = `${cameraState.side} shoulder · ${cameraState.mode}`;
  }

  averageFps() {
    const total = this.frameTimes.reduce((sum, value) => sum + value, 0);
    return total > 0 ? this.frameTimes.length * 1000 / total : 0;
  }

  percentileFps(percentile = .01) {
    if (!this.samples.length) return 0;
    const ordered = [...this.samples].sort((a, b) => a - b);
    return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * percentile))];
  }

  averageFrameTime() {
    if (!this.frameTimes.length) return 0;
    return this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
  }

  percentileFrameTime(percentile = .95) {
    if (!this.frameTimes.length) return 0;
    const ordered = [...this.frameTimes].sort((a, b) => a - b);
    return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * percentile))];
  }

  sceneBudget() {
    const enabledMeshes = this.scene.meshes.filter(mesh => mesh.isEnabled() && mesh.visibility > 0);
    const activeMaterials = new Set(enabledMeshes.map(mesh => mesh.material).filter(Boolean));
    const readyTextures = this.scene.textures.filter(texture => texture.isReady?.());
    const estimatedTextureBytes = readyTextures.reduce((sum, texture) => {
      const size = texture.getSize?.() || { width: 0, height: 0 };
      const faces = texture.isCube ? 6 : 1;
      const mipFactor = texture.generateMipMaps ? 4 / 3 : 1;
      return sum + size.width * size.height * 4 * faces * mipFactor;
    }, 0);
    return {
      meshCount: this.scene.meshes.length,
      activeMeshCount: this.scene.getActiveMeshes().length,
      triangleCount: Math.round(this.scene.getActiveIndices() / 3),
      drawCalls: Number.isFinite(this.sceneInstrumentation.drawCallsCounter?.current)
        ? this.sceneInstrumentation.drawCallsCounter.current
        : null,
      materialCount: this.scene.materials.length,
      activeMaterials: activeMaterials.size,
      textureCount: readyTextures.length,
      estimatedTextureBytes,
      renderWidth: this.engine.getRenderWidth(),
      renderHeight: this.engine.getRenderHeight(),
      cssWidth: this.engine.getRenderingCanvas()?.clientWidth || 0,
      cssHeight: this.engine.getRenderingCanvas()?.clientHeight || 0,
      hardwareScaling: this.engine.getHardwareScalingLevel(),
      devicePixelRatio: devicePixelRatio || 1
    };
  }

  loadSnapshot() {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const visibleTransferBytes = resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    const visibleEncodedBytes = resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0);
    const visibleDecodedBytes = resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0);
    const opaqueResources = resources.filter(entry => !entry.transferSize && !entry.encodedBodySize && !entry.decodedBodySize);
    const babylon = resources.find(entry => entry.name.includes('babylon.js'));
    return {
      navigationStartMs: navigation?.startTime || 0,
      moduleStartedMs: this.moduleStartedAt,
      firstRenderedFrameMs: this.firstRenderedFrameAt,
      firstPlayableMs: this.firstPlayableAt,
      moduleToFirstFrameMs: this.firstRenderedFrameAt
        ? Math.max(0, this.firstRenderedFrameAt - this.moduleStartedAt)
        : 0,
      babylonInitializationMs: this.firstPlayableAt
        ? Math.max(0, this.firstPlayableAt - this.moduleStartedAt)
        : 0,
      navigationResponseEndMs: navigation?.responseEnd || 0,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd || 0,
      loadEventMs: navigation?.loadEventEnd || 0,
      resourceCount: resources.length,
      visibleTransferBytes,
      visibleEncodedBytes,
      visibleDecodedBytes,
      opaqueResourceCount: opaqueResources.length,
      babylon: babylon ? {
        durationMs: babylon.duration,
        transferBytes: babylon.transferSize,
        encodedBytes: babylon.encodedBodySize,
        decodedBytes: babylon.decodedBodySize,
        sizeVisible: Boolean(babylon.transferSize || babylon.encodedBodySize || babylon.decodedBodySize)
      } : null,
      resources: resources.map(entry => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        durationMs: entry.duration,
        transferBytes: entry.transferSize || 0,
        encodedBytes: entry.encodedBodySize || 0,
        decodedBytes: entry.decodedBodySize || 0
      }))
    };
  }

  reset() {
    this.samples.length = 0;
    this.frameTimes.length = 0;
    this.startedAt = performance.now();
    this.totalFrameTime = 0;
    this.totalFrames = 0;
    this.frameSpikesOver50 = 0;
    this.maximumFrameTime = 0;
  }

  snapshot() {
    this.latestBudget = this.sceneBudget();
    const memory = performance.memory;
    return {
      sampleCount: this.samples.length,
      averageFps: this.averageFps(),
      onePercentLowFps: this.percentileFps(.01),
      lowFivePercentFps: this.percentileFps(.05),
      averageFrameTimeMs: this.averageFrameTime(),
      p95FrameTimeMs: this.percentileFrameTime(.95),
      maximumFrameTimeMs: this.maximumFrameTime,
      frameSpikesOver50Ms: this.frameSpikesOver50,
      frameSpikesOver50Percent: this.totalFrames ? this.frameSpikesOver50 / this.totalFrames * 100 : 0,
      lifetimeAverageFps: this.totalFrameTime ? this.totalFrames * 1000 / this.totalFrameTime : 0,
      elapsedSeconds: (performance.now() - this.startedAt) / 1000,
      engineFps: this.engine.getFps(),
      budget: this.latestBudget,
      load: this.loadSnapshot(),
      memory: memory ? {
        usedJSHeapBytes: memory.usedJSHeapSize,
        totalJSHeapBytes: memory.totalJSHeapSize,
        jsHeapLimitBytes: memory.jsHeapSizeLimit
      } : null,
      lifecycle: { ...this.lifecycle }
    };
  }
}
