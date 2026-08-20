import {
  CHAPTER_ONE_FRAGMENT_IDS,
  CHAPTER_ONE_KEEPER_CLUES,
  CHAPTER_ONE_ROUTE_RUNE_ID
} from './chapter-level-plan.js';

export const MOON_SEAL_STATES = Object.freeze([
  'DISTORTED',
  'CORRUPTION_REMOVED',
  'RINGS_ALIGNED',
  'ATTUNED',
  'LIT'
]);

export class ChapterOneProgression {
  #fragments;
  #completedRunes;
  #keeperClues;
  #sunkenGate;
  #gardenMaze;
  #rootboundCrossing;
  #encounter;
  #westTower;
  #moonSeal;
  #moonDoor;
  #chapter;

  constructor() {
    this.reset();
  }

  reset() {
    this.#fragments = { [CHAPTER_ONE_ROUTE_RUNE_ID]: [] };
    this.#completedRunes = [];
    this.#keeperClues = [];
    this.#sunkenGate = { unlocked: false, opened: false };
    this.#gardenMaze = { complete: false };
    this.#rootboundCrossing = { state: 'LOCKED', complete: false };
    this.#encounter = { state: 'LOCKED', complete: false };
    this.#westTower = { accessible: false, complete: false };
    this.#moonSeal = { state: MOON_SEAL_STATES[0] };
    this.#moonDoor = { active: false, crossed: false };
    this.#chapter = { complete: false };
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
    this.#sunkenGate.unlocked = true;
    return true;
  }

  markSunkenGateOpened() {
    if (!this.#sunkenGate.unlocked) return false;
    this.#sunkenGate.opened = true;
    return true;
  }

  completeGardenMaze() {
    if (!this.#sunkenGate.opened) return false;
    this.#gardenMaze.complete = true;
    if (!this.#rootboundCrossing.complete) this.#rootboundCrossing.state = 'AVAILABLE';
    return true;
  }

  completeRootboundCrossing() {
    if (!this.#gardenMaze.complete || this.#rootboundCrossing.state !== 'AVAILABLE') return false;
    this.#rootboundCrossing = { state: 'COMPLETE', complete: true };
    if (!this.#encounter.complete) this.#encounter.state = 'AVAILABLE';
    return true;
  }

  startBriarheartEncounter() {
    if (!this.#rootboundCrossing.complete || this.#encounter.state !== 'AVAILABLE') return false;
    this.#encounter.state = 'ACTIVE';
    return true;
  }

  completeBriarheartEncounter() {
    if (this.#encounter.state !== 'ACTIVE') return false;
    this.#encounter = { state: 'COMPLETE', complete: true };
    this.#westTower.accessible = true;
    return true;
  }

  advanceMoonSeal(nextState) {
    if (!this.#westTower.accessible) return false;
    const currentIndex = MOON_SEAL_STATES.indexOf(this.#moonSeal.state);
    if (nextState !== MOON_SEAL_STATES[currentIndex + 1]) return false;
    this.#moonSeal.state = nextState;
    if (nextState === 'LIT') {
      this.#westTower.complete = true;
      this.#moonDoor.active = true;
    }
    return true;
  }

  markMoonDoorCrossed() {
    if (!this.#moonDoor.active) return false;
    this.#moonDoor.crossed = true;
    return true;
  }

  completeChapter() {
    if (!this.#westTower.complete || this.#moonSeal.state !== 'LIT' || !this.#moonDoor.crossed) return false;
    this.#chapter.complete = true;
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
      sunkenGate: { ...this.#sunkenGate },
      gardenMaze: { ...this.#gardenMaze },
      rootboundCrossing: { ...this.#rootboundCrossing },
      encounter: { ...this.#encounter },
      westTower: { ...this.#westTower },
      moonSeal: { ...this.#moonSeal },
      moonDoor: { ...this.#moonDoor },
      chapter: { ...this.#chapter },
      completion: {
        gardenMazeComplete: this.#gardenMaze.complete,
        chapterComplete: this.#chapter.complete
      }
    };
  }
}
