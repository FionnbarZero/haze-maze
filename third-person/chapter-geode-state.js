const cloneContent = content => structuredClone(content);

const publicGeodeState = geode => ({
  id: geode.id,
  strikesRequired: geode.strikesRequired,
  strikes: geode.strikes,
  remaining: Math.max(0, geode.strikesRequired - geode.strikes),
  progress: geode.strikes / geode.strikesRequired,
  broken: geode.broken,
  revealed: geode.revealed,
  content: geode.revealed ? cloneContent(geode.content) : null
});

export class ChapterOneGeodeState {
  #definitions;
  #geodes;

  constructor({ geodes = [] } = {}) {
    this.#definitions = geodes.map(geode => cloneContent(geode));
    this.reset();
  }

  reset() {
    this.#geodes = this.#definitions.map(definition => ({
      id: definition.id,
      strikesRequired: definition.strikesRequired,
      strikes: 0,
      broken: false,
      revealed: false,
      content: cloneContent(definition.content)
    }));
  }

  strike(geodeId) {
    const geode = this.#geodes.find(entry => entry.id === geodeId);
    if (!geode) return { accepted: false, reason: 'UNKNOWN_GEODE' };
    if (geode.broken) {
      return { accepted: false, reason: 'ALREADY_BROKEN', geode: publicGeodeState(geode) };
    }

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
      content: brokenNow ? cloneContent(geode.content) : null
    };
  }

  snapshot() {
    return {
      kind: 'CHAPTER_ONE_GEODE_STATE',
      geodes: this.#geodes.map(publicGeodeState)
    };
  }
}
