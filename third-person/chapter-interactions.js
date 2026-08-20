export const CHAPTER_ONE_TOOL_IDS = Object.freeze({
  pick: 'unique-geode-pick',
  hammer: 'unique-geode-hammer'
});

export const EQUIPMENT_MODES = Object.freeze({
  staff: 'staff',
  miningTools: 'mining-tools'
});

const ownedTool = (id, ownerId, mode) => ({ id, ownerId, worldSocketId: null, mode });

export class ChapterOneInteractions {
  constructor({ actorId = 'purple', geodes = [] } = {}) {
    this.geodeDefinitions = geodes.map(geode => structuredClone(geode));
    this.reset(actorId);
  }

  reset(actorId = this.actorId || 'purple') {
    this.actorId = actorId;
    this.mode = EQUIPMENT_MODES.staff;
    this.tools = {
      pick: ownedTool(CHAPTER_ONE_TOOL_IDS.pick, actorId, this.mode),
      hammer: ownedTool(CHAPTER_ONE_TOOL_IDS.hammer, actorId, this.mode)
    };
    this.geodes = this.geodeDefinitions.map(definition => ({
      id: definition.id,
      strikesRequired: definition.strikesRequired,
      strikes: 0,
      broken: false,
      revealed: false,
      content: structuredClone(definition.content)
    }));
  }

  assignToolsToActor(actorId) {
    if (!actorId) return false;
    this.actorId = actorId;
    for (const tool of Object.values(this.tools)) {
      tool.ownerId = actorId;
      tool.worldSocketId = null;
    }
    return true;
  }

  setMode(mode) {
    if (!Object.values(EQUIPMENT_MODES).includes(mode)) return false;
    this.mode = mode;
    for (const tool of Object.values(this.tools)) tool.mode = mode;
    return true;
  }

  ownsBothTools(actorId = this.actorId) {
    return Object.values(this.tools).every(tool => tool.ownerId === actorId && tool.worldSocketId === null);
  }

  canActorCast(actorId = this.actorId) {
    return actorId === this.actorId && this.mode === EQUIPMENT_MODES.staff;
  }

  canActorMine(actorId = this.actorId) {
    return actorId === this.actorId
      && this.mode === EQUIPMENT_MODES.miningTools
      && this.ownsBothTools(actorId);
  }

  strikeGeode(geodeId, actorId = this.actorId) {
    const geode = this.geodes.find(entry => entry.id === geodeId);
    if (!geode) return { accepted: false, reason: 'UNKNOWN_GEODE' };
    if (geode.broken) return { accepted: false, reason: 'ALREADY_BROKEN', geode: { ...geode } };
    if (!this.canActorMine(actorId)) return { accepted: false, reason: 'WRONG_TOOL_MODE', geode: { ...geode } };
    geode.strikes += 1;
    const brokenNow = geode.strikes >= geode.strikesRequired;
    if (brokenNow) {
      geode.broken = true;
      geode.revealed = true;
    }
    return {
      accepted: true,
      brokenNow,
      strikes: geode.strikes,
      strikesRequired: geode.strikesRequired,
      remaining: Math.max(0, geode.strikesRequired - geode.strikes),
      content: brokenNow ? structuredClone(geode.content) : null
    };
  }

  snapshot() {
    return {
      actorId: this.actorId,
      mode: this.mode,
      tools: Object.fromEntries(Object.entries(this.tools).map(([key, tool]) => [key, { ...tool }])),
      ownsBothTools: this.ownsBothTools(),
      canCast: this.canActorCast(),
      canMine: this.canActorMine(),
      geodes: this.geodes.map(geode => ({
        id: geode.id,
        strikesRequired: geode.strikesRequired,
        strikes: geode.strikes,
        remaining: Math.max(0, geode.strikesRequired - geode.strikes),
        progress: geode.strikes / geode.strikesRequired,
        broken: geode.broken,
        revealed: geode.revealed,
        content: geode.revealed ? structuredClone(geode.content) : null
      }))
    };
  }
}
