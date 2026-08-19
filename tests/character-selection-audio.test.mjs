import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterSelectionFlow } from '../third-person/character-selection.js';

const originalGlobals = {
  addEventListener: globalThis.addEventListener,
  document: globalThis.document,
  location: globalThis.location,
  removeEventListener: globalThis.removeEventListener,
  speechSynthesis: globalThis.speechSynthesis,
  SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance,
  window: globalThis.window
};

class MockUtterance {
  constructor(text) {
    this.text = text;
    this.onend = null;
    this.onerror = null;
  }
}

const createFlow = () => {
  const audio = {
    cancelCount: 0,
    pending: false,
    speaking: false,
    cancel() {
      this.cancelCount += 1;
      this.pending = false;
      this.speaking = false;
    },
    getVoices: () => [{ name: 'Test Voice', lang: 'en-US' }],
    resume() {},
    speak(utterance) {
      this.lastUtterance = utterance;
      this.speaking = true;
    }
  };
  globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
  globalThis.location = { search: '' };
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.SpeechSynthesisUtterance = MockUtterance;
  globalThis.speechSynthesis = audio;
  globalThis.window = globalThis;
  return { audio, flow: new CharacterSelectionFlow() };
};

test.after(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

test('finishing the Coven briefing releases the system speech audio session', () => {
  const { audio, flow } = createFlow();
  assert.equal(flow.startNarration(), true);
  assert.equal(audio.speaking, true);
  const cancelCountBeforeFinish = audio.cancelCount;

  assert.equal(flow.finishNarration(), true);

  assert.equal(audio.cancelCount, cancelCountBeforeFinish + 1);
  assert.equal(audio.speaking, false);
  assert.equal(audio.pending, false);
  assert.equal(flow.activeUtterance, null);
  flow.dispose();
});

test('leaving an interrupted briefing also releases the speech audio session', () => {
  const { audio, flow } = createFlow();
  assert.equal(flow.startNarration(), true);
  const cancelCountBeforeSelection = audio.cancelCount;

  assert.equal(flow.showSelection(), true);

  assert.equal(audio.cancelCount, cancelCountBeforeSelection + 1);
  assert.equal(audio.speaking, false);
  assert.equal(flow.activeUtterance, null);
  flow.dispose();
});
