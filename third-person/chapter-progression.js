import {
  CHAPTER_ONE_FRAGMENT_IDS,
  CHAPTER_ONE_KEEPER_CLUES,
  CHAPTER_ONE_ROUTE_RUNE_ID
} from './chapter-level-plan.js';

export class ChapterOneProgression {
  #fragments;
  #completedRunes;
  #keeperClues;

  constructor() {
    this.reset();
  }

  reset() {
    this.#fragments = { [CHAPTER_ONE_ROUTE_RUNE_ID]: [] };
    this.#completedRunes = [];
    this.#keeperClues = [];
    this.sunkenGate = { unlocked: false, opened: false };
    this.rootboundCrossing = { state: 'LOCKED', complete: false };
    this.encounter = { state: 'LOCKED', complete: false };
    this.westTower = { accessible: false, complete: false };
    this.moonSeal = { state: 'DISTORTED' };
    this.chapter = { complete: false };
  }

  collectFragment({ runeId, fragmentId, clue }) {
    if (runeId !== CHAPTER_ONE_ROUTE_RUNE_ID) {
      return { accepted: false, completedNow: false, reason: 'INVALID_FRAGMENT' };
    }
    const fragments = this.#fragments[runeId];
    if (fragments.length >= 3 || this.hasCompletedRune(runeId)) {
      return { accepted: false, completedNow: false, reason: 'RUNE_ALREADY_COMPLETE' };
    }
    const fragmentIndex = CHAPTER_ONE_FRAGMENT_IDS.indexOf(fragmentId);
    if (fragmentIndex < 0) {
      return { accepted: false, completedNow: false, reason: 'INVALID_FRAGMENT' };
    }
    if (fragments.includes(fragmentId)) {
      return { accepted: false, completedNow: false, reason: 'DUPLICATE_FRAGMENT' };
    }
    const expectedClue = CHAPTER_ONE_KEEPER_CLUES[fragmentIndex];
    if (clue?.id !== expectedClue.id || this.#keeperClues.some(entry => entry.id === expectedClue.id)) {
      return { accepted: false, completedNow: false, reason: 'INVALID_OR_DUPLICATE_CLUE' };
    }
    fragments.push(fragmentId);
    this.#keeperClues.push({ ...expectedClue });
    const completedNow = fragments.length === 3 && !this.#completedRunes.includes(runeId);
    if (completedNow) this.#completedRunes.push(runeId);
    return {
      accepted: true,
      completedNow,
      runeId,
      fragmentCount: fragments.length,
      requiredFragments: 3,
      clueId: clue?.id || null
    };
  }

  hasCompletedRune(runeId = CHAPTER_ONE_ROUTE_RUNE_ID) {
    return this.#completedRunes.includes(runeId);
  }

  unlockSunkenGate() {
    if (!this.hasCompletedRune()) return false;
    this.sunkenGate.unlocked = true;
    return true;
  }

  markSunkenGateOpened() {
    if (!this.sunkenGate.unlocked) return false;
    this.sunkenGate.opened = true;
    this.rootboundCrossing.state = 'AVAILABLE';
    return true;
  }

  snapshot() {
    const fragmentIds = [...this.#fragments[CHAPTER_ONE_ROUTE_RUNE_ID]];
    return {
      kind: 'CHAPTER_ONE_PROGRESSION',
      routeRune: {
        id: CHAPTER_ONE_ROUTE_RUNE_ID,
        fragments: fragmentIds,
        fragmentCount: fragmentIds.length,
        requiredFragments: 3,
        completed: this.hasCompletedRune(),
        protected: true
      },
      completedRunes: [...this.#completedRunes],
      keeperClues: this.#keeperClues.map(clue => ({ ...clue })),
      expectedKeeperClues: CHAPTER_ONE_KEEPER_CLUES.map(clue => clue.id),
      sunkenGate: { ...this.sunkenGate },
      rootboundCrossing: { ...this.rootboundCrossing },
      encounter: { ...this.encounter },
      westTower: { ...this.westTower },
      moonSeal: { ...this.moonSeal },
      chapter: { ...this.chapter }
    };
  }
}
