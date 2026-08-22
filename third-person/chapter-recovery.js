const finiteTime = value => Number.isFinite(value) ? Math.max(0, value) : 0;

const dragonId = value => typeof value === 'string' && value ? value : null;

/**
 * Captures only the threat evidence that exists at the lethal hit. Keeping
 * this separate from combat diagnostics prevents recovery from later trying
 * to infer engagement from a dragon's changed position or patrol state.
 */
export function createDefeatContext({ defeatedAt, finalDamageDragonId, threatDragonId } = {}) {
  const finalDragonId = dragonId(finalDamageDragonId);
  const engagedDragonIds = new Set([finalDragonId, dragonId(threatDragonId)].filter(Boolean));
  return Object.freeze({
    defeatedAt: finiteTime(defeatedAt),
    finalDamageDragonId: finalDragonId,
    engagedDragonIds: Object.freeze([...engagedDragonIds])
  });
}

/**
 * Owns the short Chapter-only interval between defeat and ordinary respawn.
 * It preserves live Chapter state; full-route reset remains owned by main.
 */
export class ChapterRespawnState {
  constructor({ recoveryDelay = .85 } = {}) {
    this.recoveryDelay = recoveryDelay;
    this.pending = false;
    this.context = null;
    this.respawnAt = 0;
    this.respawnCount = 0;
    this.lastDefeatAt = null;
    this.lastRespawnAt = null;
    this.lastFinalDamageDragonId = null;
    this.lastEngagedDragonIds = [];
    this.lastResetDragonIds = [];
    this.lastRespawnPosition = null;
    this.lastResetKind = null;
  }

  begin(context) {
    if (this.pending) return false;
    this.context = createDefeatContext(context);
    this.pending = true;
    this.respawnAt = this.context.defeatedAt + this.recoveryDelay;
    this.lastDefeatAt = this.context.defeatedAt;
    this.lastFinalDamageDragonId = this.context.finalDamageDragonId;
    this.lastEngagedDragonIds = [...this.context.engagedDragonIds];
    return true;
  }

  isDue(time) {
    return this.pending && finiteTime(time) + 1e-9 >= this.respawnAt;
  }

  complete(time, resetDragonIds = [], respawnPosition = null) {
    if (!this.pending) return false;
    this.pending = false;
    this.lastRespawnAt = finiteTime(time);
    this.lastResetDragonIds = [...new Set(resetDragonIds.filter(dragonId))];
    this.lastRespawnPosition = respawnPosition && Number.isFinite(respawnPosition.x) && Number.isFinite(respawnPosition.z)
      ? { x: respawnPosition.x, y: respawnPosition.y || 0, z: respawnPosition.z }
      : null;
    this.lastResetKind = 'ORDINARY_RESPAWN';
    this.respawnCount += 1;
    this.context = null;
    this.respawnAt = 0;
    return true;
  }

  cancelForFullRestart() {
    this.pending = false;
    this.context = null;
    this.respawnAt = 0;
    this.respawnCount = 0;
    this.lastDefeatAt = null;
    this.lastRespawnAt = null;
    this.lastFinalDamageDragonId = null;
    this.lastEngagedDragonIds = [];
    this.lastResetDragonIds = [];
    this.lastRespawnPosition = null;
    this.lastResetKind = 'FULL_ROUTE_RESTART';
  }

  snapshot() {
    return {
      pending: this.pending,
      respawnCount: this.respawnCount,
      lastDefeatAt: this.lastDefeatAt,
      lastRespawnAt: this.lastRespawnAt,
      finalDamageDragonId: this.context?.finalDamageDragonId || this.lastFinalDamageDragonId,
      engagedDragonIds: [...(this.context?.engagedDragonIds || this.lastEngagedDragonIds)],
      respawnAt: this.pending ? this.respawnAt : null,
      lastResetDragonIds: [...this.lastResetDragonIds],
      respawnPosition: this.lastRespawnPosition ? { ...this.lastRespawnPosition } : null,
      lastResetKind: this.lastResetKind
    };
  }
}
