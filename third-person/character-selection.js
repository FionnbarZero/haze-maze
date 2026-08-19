export const OPENING_ACTIONS = Object.freeze({
  ArrowLeft: 'previousCharacter',
  KeyA: 'previousCharacter',
  ArrowRight: 'nextCharacter',
  KeyD: 'nextCharacter',
  Enter: 'selectOrConfirm',
  Escape: 'previousOpeningStep'
});

export const PLAYABLE_WITCHES = Object.freeze({
  purple: Object.freeze({
    id: 'purple',
    name: 'Purple Witch',
    discipline: 'Storm magic',
    role: 'Damage and protection',
    startingSpell: 'Lightning'
  }),
  green: Object.freeze({
    id: 'green',
    name: 'Green Witch',
    discipline: 'Plant magic',
    role: 'Control and restoration',
    startingSpell: 'Vine Trap',
    nextUnlock: 'Restore'
  })
});

const characterIds = Object.keys(PLAYABLE_WITCHES);

export class CharacterSelectionFlow {
  constructor({ onConfirm = () => {}, onPreviewChange = () => {} } = {}) {
    this.overlay = document.querySelector('#start-overlay');
    this.briefing = document.querySelector('#coven-briefing');
    this.selection = document.querySelector('#witch-selection');
    this.continueButton = document.querySelector('#briefing-continue');
    this.backButton = document.querySelector('#selection-back');
    this.confirmButton = document.querySelector('#confirm-witch');
    this.cards = [...document.querySelectorAll('[data-character]')];
    this.step = 'BRIEFING';
    this.focusedCharacter = 'purple';
    this.selectedCharacter = null;
    this.completed = false;
    this.onConfirm = onConfirm;
    this.onPreviewChange = onPreviewChange;
    this.onKeyDown = event => this.handleKeyDown(event);

    this.continueButton?.addEventListener('click', () => this.showSelection());
    this.backButton?.addEventListener('click', () => this.showBriefing());
    this.confirmButton?.addEventListener('click', () => this.confirm());
    for (const card of this.cards) {
      card.addEventListener('focus', () => {
        this.focusedCharacter = card.dataset.character;
        this.render();
      });
      card.addEventListener('click', () => this.select(card.dataset.character));
    }
    addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  showBriefing() {
    if (this.completed) return false;
    this.step = 'BRIEFING';
    this.selectedCharacter = null;
    this.render();
    this.continueButton?.focus({ preventScroll: true });
    return true;
  }

  showSelection() {
    if (this.completed) return false;
    this.step = 'SELECTION';
    this.render();
    this.focusedCard()?.focus({ preventScroll: true });
    return true;
  }

  focusedCard() {
    return this.cards.find(card => card.dataset.character === this.focusedCharacter) || this.cards[0];
  }

  moveFocus(direction) {
    const currentIndex = Math.max(0, characterIds.indexOf(this.focusedCharacter));
    const nextIndex = (currentIndex + direction + characterIds.length) % characterIds.length;
    this.focusedCharacter = characterIds[nextIndex];
    this.render();
    this.focusedCard()?.focus({ preventScroll: true });
    return this.focusedCharacter;
  }

  select(characterId) {
    if (this.completed || this.step !== 'SELECTION' || !PLAYABLE_WITCHES[characterId]) return false;
    this.focusedCharacter = characterId;
    this.selectedCharacter = characterId;
    this.render();
    return true;
  }

  clearSelection() {
    this.selectedCharacter = null;
    this.render();
  }

  confirm() {
    if (this.completed || this.step !== 'SELECTION' || !this.selectedCharacter) return false;
    const characterId = this.selectedCharacter;
    this.completed = true;
    this.step = 'COMPLETE';
    this.render();
    this.onConfirm(characterId);
    return true;
  }

  handleKeyDown(event) {
    if (this.completed || this.overlay?.classList.contains('is-hidden')) return;
    const action = OPENING_ACTIONS[event.code];
    if (!action) return;
    event.preventDefault();
    if (this.step === 'BRIEFING') {
      if (action === 'selectOrConfirm') this.showSelection();
      return;
    }
    if (action === 'previousCharacter') this.moveFocus(-1);
    if (action === 'nextCharacter') this.moveFocus(1);
    if (action === 'selectOrConfirm') {
      if (this.selectedCharacter === this.focusedCharacter) this.confirm();
      else this.select(this.focusedCharacter);
    }
    if (action === 'previousOpeningStep') {
      if (this.selectedCharacter) this.clearSelection();
      else this.showBriefing();
    }
  }

  render() {
    const selecting = this.step === 'SELECTION';
    this.briefing?.classList.toggle('is-current', this.step === 'BRIEFING');
    this.briefing?.setAttribute('aria-hidden', String(this.step !== 'BRIEFING'));
    this.selection?.classList.toggle('is-current', selecting);
    this.selection?.setAttribute('aria-hidden', String(!selecting));
    for (const card of this.cards) {
      const characterId = card.dataset.character;
      const selected = characterId === this.selectedCharacter;
      const focused = characterId === this.focusedCharacter;
      card.classList.toggle('is-selected', selected);
      card.classList.toggle('is-focused', focused);
      card.setAttribute('aria-pressed', String(selected));
      card.tabIndex = selecting && focused ? 0 : -1;
    }
    if (this.confirmButton) {
      const character = PLAYABLE_WITCHES[this.selectedCharacter];
      this.confirmButton.disabled = !character;
      this.confirmButton.textContent = character
        ? `Enter Moonhollow as the ${character.name}`
        : 'Choose a Witch to enter Moonhollow';
    }
    this.onPreviewChange(this.selectedCharacter, this.focusedCharacter, this.step);
  }

  complete(characterId = this.selectedCharacter || 'purple') {
    if (!PLAYABLE_WITCHES[characterId]) return false;
    this.selectedCharacter = characterId;
    this.focusedCharacter = characterId;
    this.completed = true;
    this.step = 'COMPLETE';
    this.render();
    return true;
  }

  snapshot() {
    return {
      step: this.step,
      selectedCharacter: this.selectedCharacter,
      focusedCharacter: this.focusedCharacter,
      awaitingConfirmation: this.step === 'SELECTION' && Boolean(this.selectedCharacter),
      completed: this.completed,
      actions: { ...OPENING_ACTIONS }
    };
  }

  dispose() {
    removeEventListener('keydown', this.onKeyDown);
  }
}
