import { ChapterOneGeodeState } from './chapter-geode-state.js';

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
  #geodeState;

  constructor({ actorId = 'purple', geodes = [], geodeState = null } = {}) {
    this.#geodeState = geodeState || new ChapterOneGeodeState({ geodes });
    this.reset(actorId);
  }

  reset(actorId = this.actorId || 'purple') {
    this.actorId = actorId;
    this.mode = EQUIPMENT_MODES.staff;
    this.tools = {
      pick: ownedTool(CHAPTER_ONE_TOOL_IDS.pick, actorId, this.mode),
      hammer: ownedTool(CHAPTER_ONE_TOOL_IDS.hammer, actorId, this.mode)
    };
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
    const geode = this.#geodeState.snapshot().geodes.find(entry => entry.id === geodeId);
    if (!geode) return { accepted: false, reason: 'UNKNOWN_GEODE' };
    if (geode.broken) return { accepted: false, reason: 'ALREADY_BROKEN', geode: { ...geode } };
    if (!this.canActorMine(actorId)) return { accepted: false, reason: 'WRONG_TOOL_MODE', geode: { ...geode } };
    return this.#geodeState.strike(geodeId);
  }

  snapshot() {
    return {
      actorId: this.actorId,
      mode: this.mode,
      tools: Object.fromEntries(Object.entries(this.tools).map(([key, tool]) => [key, { ...tool }])),
      ownsBothTools: this.ownsBothTools(),
      canCast: this.canActorCast(),
      canMine: this.canActorMine(),
      geodes: this.#geodeState.snapshot().geodes
    };
  }
}
