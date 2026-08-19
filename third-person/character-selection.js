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

export const COVEN_BRIEFING_LINES = Object.freeze([
  '“Witches, attend me. Three nights ago, the ancient wards encircling Moonhollow began to fail.”',
  '“The cause remains unknown. Creatures are already crossing the Rift. The outlying farms stand abandoned, and the nearest villages prepare to flee.”',
  '“No ordinary soldier can endure passage through the failing barrier. Only witches of your power may enter.”',
  '“Find the source of the breach. Destroy what has crossed into our world. Seal the Rift.”',
  '“Should you fail, Moonhollow will be merely the first to fall.”',
  '“Who among you will enter the Hollow?”'
]);

const BRIEFING_TAGLINE = 'Moonhollow has fallen silent. The Coven has not.';
const preferredVoicePattern = /samantha|victoria|karen|moira|serena|ava|fiona|female/i;

const characterIds = Object.keys(PLAYABLE_WITCHES);

export class CharacterSelectionFlow {
  constructor({ onConfirm = () => {}, onPreviewChange = () => {}, onNarrationLine = () => {} } = {}) {
    this.overlay = document.querySelector('#start-overlay');
    this.shell = document.querySelector('.opening-shell');
    this.briefing = document.querySelector('#coven-briefing');
    this.selection = document.querySelector('#witch-selection');
    this.continueButton = document.querySelector('#briefing-continue');
    this.fallbackButton = document.querySelector('#briefing-fallback');
    this.subtitle = document.querySelector('#briefing-subtitle');
    this.lineLabel = document.querySelector('#briefing-line-label');
    this.progress = document.querySelector('#briefing-progress');
    this.soundStatus = document.querySelector('#briefing-sound-status');
    this.backButton = document.querySelector('#selection-back');
    this.confirmButton = document.querySelector('#confirm-witch');
    this.cards = [...document.querySelectorAll('[data-character]')];
    this.step = 'BRIEFING';
    this.focusedCharacter = 'purple';
    this.selectedCharacter = null;
    this.completed = false;
    this.onConfirm = onConfirm;
    this.onPreviewChange = onPreviewChange;
    this.onNarrationLine = onNarrationLine;
    this.narrationMode = new URLSearchParams(location.search).get('narration');
    this.audioSupported = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
    this.narrationStatus = 'READY';
    this.narrationLineIndex = -1;
    this.narrationVoiceName = null;
    this.narrationRun = 0;
    this.narrationTimer = 0;
    this.activeUtterance = null;
    this.onKeyDown = event => this.handleKeyDown(event);

    this.continueButton?.addEventListener('click', () => this.startNarration());
    this.fallbackButton?.addEventListener('click', () => this.showSelection());
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

  resolveVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const englishVoices = voices.filter(voice => /^en([_-]|$)/i.test(voice.lang));
    return englishVoices.find(voice => preferredVoicePattern.test(voice.name))
      || englishVoices.find(voice => /GB|IE/i.test(voice.lang))
      || englishVoices[0]
      || voices[0]
      || null;
  }

  clearNarrationTimer() {
    clearTimeout(this.narrationTimer);
    this.narrationTimer = 0;
  }

  stopNarration({ reset = false } = {}) {
    this.narrationRun += 1;
    this.clearNarrationTimer();
    if (this.activeUtterance) window.speechSynthesis?.cancel?.();
    this.activeUtterance = null;
    if (reset) {
      this.narrationStatus = 'READY';
      this.narrationLineIndex = -1;
      this.narrationVoiceName = null;
      if (this.subtitle) this.subtitle.textContent = BRIEFING_TAGLINE;
    }
  }

  startNarration() {
    if (this.completed || this.step !== 'BRIEFING' || this.narrationStatus === 'SPEAKING' || this.narrationStatus === 'COMPLETE') return false;
    this.stopNarration();
    const run = this.narrationRun;
    if (this.narrationMode === 'instant') {
      this.narrationStatus = 'SPEAKING';
      this.narrationLineIndex = COVEN_BRIEFING_LINES.length - 1;
      if (this.subtitle) this.subtitle.textContent = COVEN_BRIEFING_LINES[this.narrationLineIndex];
      this.onNarrationLine(COVEN_BRIEFING_LINES[this.narrationLineIndex], this.narrationLineIndex);
      this.render();
      queueMicrotask(() => { if (run === this.narrationRun) this.finishNarration(); });
      return true;
    }
    if (!this.audioSupported) {
      this.narrationStatus = 'UNAVAILABLE';
      if (this.subtitle) this.subtitle.textContent = 'The Coven’s voice is unavailable in this browser.';
      this.render();
      return false;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume?.();
    this.narrationStatus = 'SPEAKING';
    this.narrationVoiceName = this.resolveVoice()?.name || 'System voice';
    this.speakLine(0, run);
    return true;
  }

  speakLine(index, run) {
    if (run !== this.narrationRun || this.step !== 'BRIEFING') return;
    if (index >= COVEN_BRIEFING_LINES.length) {
      this.finishNarration();
      return;
    }
    const line = COVEN_BRIEFING_LINES[index];
    const Utterance = window.SpeechSynthesisUtterance;
    const utterance = new Utterance(line.replace(/[“”]/g, ''));
    const voice = this.resolveVoice();
    if (voice) {
      utterance.voice = voice;
      this.narrationVoiceName = voice.name;
    }
    utterance.lang = voice?.lang || 'en-US';
    utterance.rate = .9;
    utterance.pitch = .86;
    utterance.volume = 1;
    this.narrationLineIndex = index;
    this.activeUtterance = utterance;
    if (this.subtitle) this.subtitle.textContent = line;
    this.onNarrationLine(line, index);
    this.render();

    const advance = () => {
      if (run !== this.narrationRun || this.activeUtterance !== utterance) return;
      this.clearNarrationTimer();
      this.activeUtterance = null;
      this.narrationTimer = setTimeout(() => this.speakLine(index + 1, run), 180);
    };
    utterance.onend = advance;
    utterance.onerror = event => {
      if (run !== this.narrationRun) return;
      this.clearNarrationTimer();
      this.activeUtterance = null;
      this.narrationStatus = 'ERROR';
      if (this.subtitle) this.subtitle.textContent = `The Coven’s voice was interrupted${event.error ? ` (${event.error})` : ''}. Check your computer audio and try again.`;
      this.render();
    };
    const wordCount = line.split(/\s+/).length;
    this.clearNarrationTimer();
    this.narrationTimer = setTimeout(() => {
      if (run !== this.narrationRun || this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this.narrationStatus = 'ERROR';
      window.speechSynthesis.cancel();
      if (this.subtitle) this.subtitle.textContent = 'The Coven’s voice paused unexpectedly. Check your computer audio and try again.';
      this.render();
    }, Math.max(12000, wordCount * 850));
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      this.clearNarrationTimer();
      this.activeUtterance = null;
      this.narrationStatus = 'ERROR';
      if (this.subtitle) this.subtitle.textContent = 'The Coven’s voice could not begin. Check your computer audio and try again.';
      this.render();
    }
  }

  finishNarration() {
    if (this.step !== 'BRIEFING') return false;
    this.clearNarrationTimer();
    this.activeUtterance = null;
    this.narrationStatus = 'COMPLETE';
    this.narrationLineIndex = COVEN_BRIEFING_LINES.length - 1;
    this.render();
    this.narrationTimer = setTimeout(() => this.showSelection(), this.narrationMode === 'instant' ? 0 : 420);
    return true;
  }

  showBriefing() {
    if (this.completed) return false;
    this.stopNarration({ reset: true });
    this.step = 'BRIEFING';
    this.selectedCharacter = null;
    this.render();
    this.continueButton?.focus({ preventScroll: true });
    return true;
  }

  showSelection() {
    if (this.completed) return false;
    if (this.narrationStatus === 'SPEAKING') this.stopNarration();
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
      if (action === 'selectOrConfirm') this.startNarration();
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
    this.shell?.classList.toggle('is-briefing', this.step === 'BRIEFING');
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
    if (this.continueButton) {
      this.continueButton.disabled = this.narrationStatus === 'SPEAKING';
      this.continueButton.textContent = this.narrationStatus === 'SPEAKING'
        ? 'The Coven leader is speaking…'
        : this.narrationStatus === 'ERROR'
          ? 'Try the briefing again'
          : this.narrationStatus === 'UNAVAILABLE'
            ? 'Computer voice unavailable'
            : 'Hear the Coven briefing';
    }
    if (this.fallbackButton) this.fallbackButton.hidden = !['ERROR', 'UNAVAILABLE'].includes(this.narrationStatus);
    if (this.lineLabel) this.lineLabel.textContent = this.narrationStatus === 'SPEAKING'
      ? `Coven briefing · ${this.narrationLineIndex + 1} of ${COVEN_BRIEFING_LINES.length}`
      : this.narrationStatus === 'COMPLETE'
        ? 'The summons has been given'
        : 'The Coven awaits';
    if (this.progress) {
      const progress = this.narrationStatus === 'COMPLETE'
        ? 1
        : Math.max(0, (this.narrationLineIndex + 1) / COVEN_BRIEFING_LINES.length);
      this.progress.style.transform = `scaleX(${progress})`;
    }
    if (this.soundStatus) this.soundStatus.textContent = this.narrationStatus === 'SPEAKING'
      ? `Speaking through computer audio · ${this.narrationVoiceName || 'System voice'}`
      : ['ERROR', 'UNAVAILABLE'].includes(this.narrationStatus)
        ? 'Sound could not play · retry or continue without narration'
        : 'Press Enter or choose Hear the Coven briefing · sound will play through your computer';
    this.onPreviewChange(this.selectedCharacter, this.focusedCharacter, this.step);
  }

  complete(characterId = this.selectedCharacter || 'purple') {
    if (!PLAYABLE_WITCHES[characterId]) return false;
    this.stopNarration();
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
      narration: {
        status: this.narrationStatus,
        lineIndex: this.narrationLineIndex,
        lineCount: COVEN_BRIEFING_LINES.length,
        voiceName: this.narrationVoiceName,
        audioSupported: this.audioSupported
      },
      actions: { ...OPENING_ACTIONS }
    };
  }

  dispose() {
    this.stopNarration();
    removeEventListener('keydown', this.onKeyDown);
  }
}
