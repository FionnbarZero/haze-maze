const ROUTE_KEYS = ['arch', 'jump', 'crouch', 'arena', 'firstDragon', 'secondRoom', 'dragon', 'exit'];
const SESSION_STORAGE_KEY = 'hmw-mobile-qualification-draft-v1';

const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = values => {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : 'Not Available';
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

function safeAreaInsets() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const result = {
    top: style.paddingTop,
    right: style.paddingRight,
    bottom: style.paddingBottom,
    left: style.paddingLeft
  };
  probe.remove();
  return result;
}

function downloadFile(name, type, contents) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([contents], { type }));
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText && isSecureContext) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.style.cssText = 'position:fixed;left:-10000px;top:0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  return copied;
}

export class MobileQualificationRecorder {
  constructor({ canvas, telemetry, qualityController, getState, resetRoute }) {
    this.canvas = canvas;
    this.telemetry = telemetry;
    this.qualityController = qualityController;
    this.getState = getState;
    this.resetRouteCallback = resetRoute;
    this.enabled = new URLSearchParams(location.search).get('qualification') === '1';
    this.status = 'idle';
    this.session = null;
    this.lastSampleAt = 0;
    this.routeAttempt = 1;
    this.routeAttemptStartedAt = 0;
    this.seenRoute = new Set();
    this.lastDragonHealth = null;
    this.lastGateState = null;
    this.lastCastSignature = '';
    this.battery = null;
    this.listeners = [];
    if (!this.enabled) return;
    this.createInterface();
    this.restoreDraft();
    this.bindInterface();
    this.bindLifecycle();
    this.prepareBattery();
    this.refreshSummary();
  }

  createInterface() {
    const shell = document.createElement('div');
    shell.id = 'qualification-tools';
    shell.className = 'qualification-tools';
    shell.innerHTML = `
      <button class="qualification-launch" type="button" data-action="open">TEST <span>idle</span></button>
      <section class="qualification-panel" hidden aria-label="Real-device qualification recorder">
        <header><div><small>Real-device evidence</small><strong>Mobile qualification recorder</strong></div><button type="button" data-action="close" aria-label="Close recorder">×</button></header>
        <div class="qualification-scroll">
          <p class="qualification-warning">One exported file is one evidence session. Browser-only memory and temperature may be unavailable; use the manual fields instead of estimating them.</p>
          <details open>
            <summary>Session and device</summary>
            <div class="qualification-grid">
              <label>Run type<select data-meta="runType"><option value="cold-load">Cold load</option><option value="route">Complete route</option><option value="soak">10-minute soak</option><option value="recovery">Recovery</option></select></label>
              <label>Run number<input data-meta="runNumber" inputmode="numeric" value="1" /></label>
              <label>Device tier<select data-meta="deviceTier"><option value="low-ios">Low/old iPhone</option><option value="mid-android">Lower/mid Android</option><option value="current-ios">Current iPhone</option><option value="current-android">Current Android</option><option value="other">Other</option></select></label>
              <label>Device model<input data-meta="deviceModel" placeholder="Exact retail model" /></label>
              <label>Chipset<input data-meta="chipset" placeholder="If known" /></label>
              <label>RAM<input data-meta="ram" placeholder="If known" /></label>
              <label>OS version<input data-meta="osVersion" placeholder="Exact version" /></label>
              <label>Browser version<input data-meta="browserVersion" placeholder="Exact version" /></label>
              <label>Physical resolution<input data-meta="physicalResolution" placeholder="e.g. 2532×1170" /></label>
              <label>Network<input data-meta="networkType" placeholder="Wi-Fi model/band or cellular" /></label>
              <label>Case status<select data-meta="caseStatus"><option value="removed">Removed</option><option value="installed">Installed</option><option value="unknown">Unknown</option></select></label>
              <label>Brightness<input data-meta="brightness" placeholder="e.g. 50%" /></label>
            </div>
          </details>
          <details>
            <summary>Environment, battery, and temperature</summary>
            <div class="qualification-grid">
              <label>Room temperature<input data-meta="roomTemperature" placeholder="Value and unit" /></label>
              <label>Measurement method<input data-meta="temperatureMethod" placeholder="IR thermometer/location or unavailable" /></label>
              <label>Battery at 0 min<input data-meta="battery0" placeholder="%" inputmode="decimal" /></label>
              <label>Battery at 5 min<input data-meta="battery5" placeholder="%" inputmode="decimal" /></label>
              <label>Battery at 10 min<input data-meta="battery10" placeholder="%" inputmode="decimal" /></label>
              <label>Device temp at 0 min<input data-meta="temperature0" placeholder="Value and unit" /></label>
              <label>Device temp at 5 min<input data-meta="temperature5" placeholder="Value and unit" /></label>
              <label>Device temp at 10 min<input data-meta="temperature10" placeholder="Value and unit" /></label>
            </div>
          </details>
          <details>
            <summary>Quality and observations</summary>
            <div class="qualification-grid">
              <label>Quality preset<select data-quality><option value="low">Low · 0.70–0.85×</option><option value="balanced">Balanced · 0.85–1.0×</option><option value="high">High · 1.0–1.25×</option></select></label>
              <button type="button" data-action="apply-quality">Apply preset and reload</button>
            </div>
            <label>Touch and camera observations<textarea data-meta="touchObservations" placeholder="Dead zone, sensitivity, accidental input, occlusion, fatigue…"></textarea></label>
            <label>Notch and safe-area observations<textarea data-meta="safeAreaObservations" placeholder="Both landscape orientations and screenshots…"></textarea></label>
            <label>Thermal and stability observations<textarea data-meta="thermalObservations" placeholder="Dimming, heat, throttling, tab reloads, discomfort…"></textarea></label>
            <label>Additional notes<textarea data-meta="notes"></textarea></label>
          </details>
          <section class="qualification-actions">
            <button type="button" data-action="start">Start session</button>
            <button type="button" data-action="end" disabled>End session</button>
            <button type="button" data-action="reset-route" disabled>Reset route</button>
          </section>
          <section class="qualification-note"><input data-note placeholder="Manual event or observation" /><button type="button" data-action="note" disabled>Mark event</button></section>
          <section class="qualification-actions qualification-export">
            <button type="button" data-action="copy" disabled>Copy summary</button>
            <button type="button" data-action="json" disabled>Download JSON</button>
            <button type="button" data-action="csv" disabled>Download CSV</button>
          </section>
          <pre class="qualification-summary" aria-live="polite"></pre>
        </div>
      </section>`;
    document.body.append(shell);
    this.shell = shell;
    this.panel = shell.querySelector('.qualification-panel');
    this.launch = shell.querySelector('.qualification-launch');
    this.summary = shell.querySelector('.qualification-summary');
    this.qualitySelect = shell.querySelector('[data-quality]');
    this.qualitySelect.value = this.qualityController.name === 'baseline' ? 'balanced' : this.qualityController.name;
  }

  bindInterface() {
    this.shell.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'open') this.panel.hidden = false;
      if (action === 'close') this.panel.hidden = true;
      if (action === 'start') this.start();
      if (action === 'end') this.end();
      if (action === 'reset-route') this.resetRoute();
      if (action === 'note') this.addManualNote();
      if (action === 'copy') this.copySummary();
      if (action === 'json') this.downloadJson();
      if (action === 'csv') this.downloadCsv();
      if (action === 'apply-quality') this.applyQuality();
    });
    this.panel.addEventListener('input', () => this.saveDraft());
  }

  bindLifecycle() {
    const bind = (target, type, listener) => {
      target.addEventListener(type, listener);
      this.listeners.push(() => target.removeEventListener(type, listener));
    };
    bind(window, 'orientationchange', () => this.recordEvent('orientationchange', this.viewportSnapshot()));
    bind(window, 'blur', () => this.recordEvent('blur'));
    bind(window, 'focus', () => this.recordEvent('focus'));
    bind(document, 'visibilitychange', () => this.recordEvent(document.hidden ? 'hidden' : 'visible'));
    bind(this.canvas, 'webglcontextlost', () => this.recordEvent('webgl-context-lost'));
    bind(this.canvas, 'webglcontextrestored', () => this.recordEvent('webgl-context-restored'));
  }

  async prepareBattery() {
    if (!navigator.getBattery) return;
    try {
      this.battery = await navigator.getBattery();
    } catch {
      this.battery = null;
    }
  }

  metadata() {
    const result = {};
    for (const field of this.panel.querySelectorAll('[data-meta]')) result[field.dataset.meta] = field.value.trim();
    return result;
  }

  restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '{}');
      for (const field of this.panel.querySelectorAll('[data-meta]')) {
        if (draft[field.dataset.meta] != null) field.value = draft[field.dataset.meta];
      }
    } catch {}
  }

  saveDraft() {
    try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.metadata())); } catch {}
  }

  viewportSnapshot() {
    return {
      cssWidth: innerWidth,
      cssHeight: innerHeight,
      visualWidth: visualViewport?.width ?? innerWidth,
      visualHeight: visualViewport?.height ?? innerHeight,
      devicePixelRatio: devicePixelRatio || 1,
      screenCssWidth: screen.width,
      screenCssHeight: screen.height,
      estimatedPhysicalWidth: Math.round(screen.width * (devicePixelRatio || 1)),
      estimatedPhysicalHeight: Math.round(screen.height * (devicePixelRatio || 1)),
      orientation: screen.orientation?.type || (innerWidth > innerHeight ? 'landscape' : 'portrait'),
      orientationAngle: screen.orientation?.angle ?? null,
      safeAreaInsets: safeAreaInsets()
    };
  }

  runtimeSnapshot() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGiB: navigator.deviceMemory ?? 'Not Available',
      maxTouchPoints: navigator.maxTouchPoints,
      secureContext: isSecureContext,
      memoryApi: performance.memory ? 'Available (JavaScript heap only)' : 'Not Available',
      temperatureApi: 'Not Available in browser; manual measurement required',
      viewport: this.viewportSnapshot(),
      quality: this.qualityController.snapshot()
    };
  }

  start() {
    if (!this.enabled || this.status === 'recording') return;
    this.saveDraft();
    const now = performance.now();
    const date = new Date();
    this.telemetry.reset();
    this.status = 'recording';
    this.lastSampleAt = 0;
    this.routeAttempt = 1;
    this.routeAttemptStartedAt = now;
    this.seenRoute.clear();
    this.lastDragonHealth = null;
    this.lastGateState = null;
    this.lastCastSignature = '';
    this.session = {
      schemaVersion: 1,
      sessionId: `hmw-mobile-${date.toISOString().replaceAll(':', '-').replaceAll('.', '-')}`,
      status: 'recording',
      startedAtIso: date.toISOString(),
      startedAtPerformanceMs: now,
      endedAtIso: null,
      metadata: this.metadata(),
      runtime: this.runtimeSnapshot(),
      coldLoad: this.telemetry.loadSnapshot(),
      samples: [],
      events: [],
      routeAttempts: []
    };
    this.recordEvent('session-start', { routeAttempt: 1 });
    this.setRecordingControls(true);
    this.panel.hidden = true;
    this.refreshSummary();
  }

  end() {
    if (!this.enabled || this.status !== 'recording') return;
    this.captureSample(performance.now());
    this.recordEvent('session-end');
    this.status = 'ended';
    this.session.status = 'ended';
    this.session.endedAtIso = new Date().toISOString();
    this.session.metadata = this.metadata();
    this.session.runtimeEnd = this.runtimeSnapshot();
    this.session.final = this.getState();
    this.session.browserBatteryEnd = this.battery ? {
      levelPercent: this.battery.level * 100,
      charging: this.battery.charging
    } : 'Not Available';
    this.setRecordingControls(false);
    this.refreshSummary();
  }

  setRecordingControls(recording) {
    this.launch.querySelector('span').textContent = recording ? 'recording' : this.status;
    this.launch.classList.toggle('is-recording', recording);
    this.panel.querySelector('[data-action="start"]').disabled = recording;
    this.panel.querySelector('[data-action="end"]').disabled = !recording;
    this.panel.querySelector('[data-action="reset-route"]').disabled = !recording;
    this.panel.querySelector('[data-action="note"]').disabled = !recording;
    for (const action of ['copy', 'json', 'csv']) this.panel.querySelector(`[data-action="${action}"]`).disabled = !this.session;
  }

  recordEvent(type, detail = null) {
    if (this.status !== 'recording' || !this.session) return;
    this.session.events.push({
      atIso: new Date().toISOString(),
      elapsedSeconds: (performance.now() - this.session.startedAtPerformanceMs) / 1000,
      type,
      detail
    });
  }

  update(nowMilliseconds, state) {
    if (this.status !== 'recording' || !this.session) return;
    for (const key of ROUTE_KEYS) {
      if (state.world.route[key] && !this.seenRoute.has(key)) {
        this.seenRoute.add(key);
        this.recordEvent(`route-${key}`, { attempt: this.routeAttempt });
        if (key === 'exit') {
          this.session.routeAttempts.push({
            attempt: this.routeAttempt,
            completed: true,
            durationSeconds: (nowMilliseconds - this.routeAttemptStartedAt) / 1000,
            completedAtIso: new Date().toISOString()
          });
        }
      }
    }
    if (state.dragon.health !== this.lastDragonHealth) {
      if (this.lastDragonHealth != null) this.recordEvent('dragon-health', { health: state.dragon.health });
      this.lastDragonHealth = state.dragon.health;
    }
    if (state.world.gate.state !== this.lastGateState) {
      if (this.lastGateState != null) this.recordEvent('gate-state', { state: state.world.gate.state });
      this.lastGateState = state.world.gate.state;
    }
    const castSignature = state.combat.lastCast ? JSON.stringify(state.combat.lastCast) : '';
    if (castSignature && castSignature !== this.lastCastSignature) {
      this.lastCastSignature = castSignature;
      this.recordEvent(`${state.combat.lastCast.spell || 'lightning'}-cast`, state.combat.lastCast);
    }
    if (!this.lastSampleAt || nowMilliseconds - this.lastSampleAt >= 1000) this.captureSample(nowMilliseconds, state);
  }

  captureSample(nowMilliseconds, suppliedState = null) {
    if (!this.session) return;
    this.lastSampleAt = nowMilliseconds;
    const state = suppliedState || this.getState();
    const performanceState = suppliedState ? this.telemetry.snapshot() : state.performance;
    this.session.samples.push({
      elapsedSeconds: (nowMilliseconds - this.session.startedAtPerformanceMs) / 1000,
      engineFps: performanceState.engineFps,
      averageFps: performanceState.averageFps,
      onePercentLowFps: performanceState.onePercentLowFps,
      averageFrameTimeMs: performanceState.averageFrameTimeMs,
      p95FrameTimeMs: performanceState.p95FrameTimeMs,
      maximumFrameTimeMs: performanceState.maximumFrameTimeMs,
      frameSpikesOver50Ms: performanceState.frameSpikesOver50Ms,
      budget: { ...performanceState.budget },
      memory: performanceState.memory ? { ...performanceState.memory } : 'Not Available',
      battery: this.battery ? { levelPercent: this.battery.level * 100, charging: this.battery.charging } : 'Not Available',
      player: { x: state.player.x, y: state.player.y, z: state.player.z, state: state.player.state, collision: state.player.collision },
      camera: { mode: state.camera.mode, side: state.camera.side, actualBoom: state.camera.actualBoom, colliding: state.camera.colliding, occluded: state.camera.occluded },
      dragon: { health: state.dragon.health, state: state.dragon.state },
      gate: { ...state.world.gate },
      quality: {
        name: this.qualityController.name,
        currentScale: this.qualityController.currentScale,
        targetFps: this.qualityController.profile?.targetFps ?? null
      }
    });
  }

  resetRoute() {
    if (!this.enabled || this.status !== 'recording') return;
    if (!this.seenRoute.has('exit')) {
      this.session.routeAttempts.push({
        attempt: this.routeAttempt,
        completed: false,
        durationSeconds: (performance.now() - this.routeAttemptStartedAt) / 1000,
        reason: 'manual-reset'
      });
    }
    this.recordEvent('route-reset', { previousAttempt: this.routeAttempt });
    this.resetRouteCallback();
    this.routeAttempt += 1;
    this.routeAttemptStartedAt = performance.now();
    this.seenRoute.clear();
    this.lastDragonHealth = null;
    this.lastGateState = null;
    this.lastCastSignature = '';
    this.recordEvent('route-attempt-start', { attempt: this.routeAttempt });
    this.panel.hidden = true;
  }

  addManualNote() {
    const field = this.panel.querySelector('[data-note]');
    const note = field.value.trim();
    if (!note) return;
    this.recordEvent('operator-note', { note });
    field.value = '';
    this.refreshSummary();
  }

  applyQuality() {
    this.saveDraft();
    const url = new URL(location.href);
    url.searchParams.set('qualification', '1');
    url.searchParams.set('quality', this.qualitySelect.value);
    location.href = url.href;
  }

  aggregate() {
    if (!this.session) return null;
    const fps = this.session.samples.map(sample => sample.engineFps).filter(Number.isFinite);
    const finalPerformance = this.session.final?.performance || this.telemetry.snapshot();
    return {
      durationSeconds: this.status === 'recording'
        ? (performance.now() - this.session.startedAtPerformanceMs) / 1000
        : (new Date(this.session.endedAtIso) - new Date(this.session.startedAtIso)) / 1000,
      sampleCount: this.session.samples.length,
      sampledFpsAverage: average(fps),
      sampledFpsMedian: median(fps),
      sampledFpsWorst: fps.length ? Math.min(...fps) : 0,
      timeWeightedAverageFps: finalPerformance.averageFps,
      onePercentLowFps: finalPerformance.onePercentLowFps,
      averageFrameTimeMs: finalPerformance.averageFrameTimeMs,
      p95FrameTimeMs: finalPerformance.p95FrameTimeMs,
      maximumFrameTimeMs: finalPerformance.maximumFrameTimeMs,
      frameSpikesOver50Ms: finalPerformance.frameSpikesOver50Ms,
      routeAttempts: this.session.routeAttempts.map(attempt => ({ ...attempt })),
      finalBudget: finalPerformance.budget,
      memoryAvailability: finalPerformance.memory ? 'JavaScript heap only' : 'Not Available',
      finalMemory: finalPerformance.memory || null
    };
  }

  result() {
    if (!this.session) return null;
    this.session.metadata = this.metadata();
    return { ...this.session, aggregate: this.aggregate(), summary: this.summaryText() };
  }

  summaryText() {
    if (!this.session) {
      return [
        'No qualification session has been recorded.',
        `Current quality: ${this.qualityController.name}`,
        `Viewport: ${innerWidth}×${innerHeight} CSS · DPR ${devicePixelRatio || 1}`,
        'Open this recorder on a physical phone and enter exact device/environment metadata.'
      ].join('\n');
    }
    const data = this.aggregate();
    const metadata = this.metadata();
    const budget = data.finalBudget || {};
    return [
      `Session: ${this.session.sessionId} · ${this.status}`,
      `Device: ${metadata.deviceModel || 'Not entered'} · ${metadata.osVersion || 'OS not entered'} · ${metadata.browserVersion || 'browser not entered'}`,
      `Run: ${metadata.runType} ${metadata.runNumber} · tier ${metadata.deviceTier}`,
      `Quality: ${this.qualityController.name} · scale ${number(this.qualityController.currentScale, 2)} · render ${budget.renderWidth || '—'}×${budget.renderHeight || '—'}`,
      `Duration: ${number(data.durationSeconds)}s · ${data.sampleCount} samples`,
      `FPS: ${number(data.timeWeightedAverageFps)} avg · ${number(data.onePercentLowFps)} 1% low · ${number(data.sampledFpsMedian)} median · ${number(data.sampledFpsWorst)} worst sample`,
      `Frame: ${number(data.averageFrameTimeMs)}ms avg · ${number(data.p95FrameTimeMs)}ms p95 · ${number(data.maximumFrameTimeMs)}ms max · ${data.frameSpikesOver50Ms} spikes >50ms`,
      `Budget: ${budget.meshCount ?? '—'} meshes · ${budget.triangleCount ?? '—'} triangles · ${budget.drawCalls ?? '—'} draws · ${budget.activeMaterials ?? '—'} active materials · ${budget.textureCount ?? '—'} textures`,
      `Memory: ${data.memoryAvailability}`,
      `Routes: ${data.routeAttempts.length ? data.routeAttempts.map(attempt => `#${attempt.attempt} ${attempt.completed ? `${number(attempt.durationSeconds)}s` : 'incomplete'}`).join(' · ') : 'none completed yet'}`,
      `Battery 0/5/10: ${metadata.battery0 || '—'} / ${metadata.battery5 || '—'} / ${metadata.battery10 || '—'}`,
      `Temperature 0/5/10: ${metadata.temperature0 || '—'} / ${metadata.temperature5 || '—'} / ${metadata.temperature10 || '—'}`,
      `Safe area: ${JSON.stringify(this.viewportSnapshot().safeAreaInsets)}`
    ].join('\n');
  }

  refreshSummary() {
    if (!this.enabled) return;
    this.summary.textContent = this.summaryText();
  }

  async copySummary() {
    this.refreshSummary();
    try {
      const copied = await copyText(this.summary.textContent);
      this.launch.querySelector('span').textContent = copied ? 'copied' : 'copy failed';
    } catch {
      this.launch.querySelector('span').textContent = 'copy failed';
    }
  }

  downloadJson() {
    const data = this.result();
    if (!data) return;
    downloadFile(`${this.session.sessionId}.json`, 'application/json', `${JSON.stringify(data, null, 2)}\n`);
  }

  downloadCsv() {
    if (!this.session) return;
    const metadata = this.metadata();
    const headings = [
      'sessionId', 'deviceModel', 'deviceTier', 'runType', 'runNumber', 'quality', 'elapsedSeconds',
      'engineFps', 'averageFps', 'onePercentLowFps', 'averageFrameTimeMs', 'p95FrameTimeMs',
      'maximumFrameTimeMs', 'spikesOver50Ms', 'renderWidth', 'renderHeight', 'dpr', 'scale',
      'meshes', 'activeMeshes', 'triangles', 'drawCalls', 'materials', 'textures', 'textureBytes',
      'usedJsHeapBytes', 'batteryPercent', 'playerState', 'collision', 'cameraColliding', 'occluded',
      'dragonHealth', 'gateState'
    ];
    const rows = this.session.samples.map(sample => [
      this.session.sessionId, metadata.deviceModel, metadata.deviceTier, metadata.runType, metadata.runNumber,
      sample.quality.name, sample.elapsedSeconds, sample.engineFps, sample.averageFps, sample.onePercentLowFps,
      sample.averageFrameTimeMs, sample.p95FrameTimeMs, sample.maximumFrameTimeMs, sample.frameSpikesOver50Ms,
      sample.budget.renderWidth, sample.budget.renderHeight, sample.budget.devicePixelRatio, sample.quality.currentScale,
      sample.budget.meshCount, sample.budget.activeMeshCount, sample.budget.triangleCount, sample.budget.drawCalls,
      sample.budget.activeMaterials, sample.budget.textureCount, sample.budget.estimatedTextureBytes,
      typeof sample.memory === 'object' ? sample.memory.usedJSHeapBytes : 'Not Available',
      typeof sample.battery === 'object' ? sample.battery.levelPercent : 'Not Available', sample.player.state,
      sample.player.collision, sample.camera.colliding, sample.camera.occluded, sample.dragon.health, sample.gate.state
    ]);
    const csv = [headings, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
    downloadFile(`${this.session.sessionId}.csv`, 'text/csv', `${csv}\n`);
  }

  snapshot() {
    return {
      enabled: this.enabled,
      status: this.status,
      currentSummary: this.summaryText(),
      result: this.result()
    };
  }

  dispose() {
    for (const remove of this.listeners) remove();
    this.shell?.remove();
  }
}
