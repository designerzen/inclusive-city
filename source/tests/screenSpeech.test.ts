import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ScreenSpeech, screenIntroduction } from '../src/audio/ScreenSpeech';

function speechHarness(voices: SpeechSynthesisVoice[] = []) {
  const spoken: SpeechSynthesisUtterance[] = [];
  const calls: string[] = [];
  const speech = new ScreenSpeech({
    synthesis: { cancel: () => { calls.push('cancel'); }, getVoices: () => voices,
      speak: utterance => { calls.push('speak'); spoken.push(utterance); } },
    utterance: text => ({ text } as SpeechSynthesisUtterance),
  });
  return { speech, spoken, calls };
}

test('screen introductions use the requested phrases and current robot name', () => {
  const { speech, spoken, calls } = speechHarness();
  for (const screen of ['presets', 'editor', 'city', 'art'] as const) speech.introduce(screen, 'My Monet');
  assert.deepEqual(spoken.map(utterance => utterance.text), [
    'Hello, robot friends! Let’s choose your adventure buddy.', 'Let’s make a robot together! What will yours look like?',
    'Adventure time! Let’s help My Monet explore the city.', 'Look what your robot made! Let’s enjoy the art together.',
  ]);
  assert.deepEqual(calls, ['cancel', 'speak', 'cancel', 'speak', 'cancel', 'speak', 'cancel', 'speak']);
  assert.equal(screenIntroduction('city'), 'Adventure time! Let’s help your robot explore the city.');
});

test('muting, zero volume, stopping and disposal prevent stale narration', () => {
  const { speech, spoken, calls } = speechHarness();
  speech.introduce('editor');
  speech.setMuted(true); speech.introduce('presets');
  assert.equal(spoken.length, 1);
  assert.equal(calls.at(-1), 'cancel');
  speech.setMuted(false); speech.setVolume(0); speech.introduce('city');
  assert.equal(spoken.length, 1);
  speech.setVolume(0.3); speech.introduce('art');
  assert.equal(spoken[1]!.volume, 0.3);
  speech.setVolume(0.6); assert.equal(spoken[1]!.volume, 0.6);
  speech.stop(); speech.dispose(); speech.introduce('editor');
  assert.equal(spoken.length, 2);
});

test('late voice availability is handled on the next introduction with English fallback', () => {
  const voices: SpeechSynthesisVoice[] = [];
  const { speech, spoken } = speechHarness(voices);
  speech.introduce('editor');
  assert.equal(spoken[0]!.lang, 'en-GB');
  voices.push({ lang: 'fr-FR', localService: true } as SpeechSynthesisVoice,
    { lang: 'en-US', localService: true } as SpeechSynthesisVoice,
    { lang: 'en-GB', localService: true } as SpeechSynthesisVoice);
  speech.introduce('presets');
  assert.equal(spoken[1]!.voice, voices[2]);
  assert.equal(spoken[1]!.volume, 0.55);
  assert.equal(spoken[1]!.rate, 0.95);
});

test('speech can be independently disabled and re-enabled without overriding mute', () => {
  const { speech, spoken, calls } = speechHarness();
  speech.introduce('editor');
  speech.setEnabled(false);
  assert.equal(calls.at(-1), 'cancel');
  speech.introduce('presets'); assert.equal(spoken.length, 1);
  speech.setEnabled(true); speech.introduce('city', 'MonetBot');
  assert.equal(spoken.length, 2);
  speech.setMuted(true); speech.setEnabled(false); speech.setEnabled(true);
  speech.introduce('art'); assert.equal(spoken.length, 2);
});

test('missing or failing speech APIs do not interrupt screen navigation', () => {
  const speech = new ScreenSpeech(null);
  assert.equal(speech.supported, false);
  assert.doesNotThrow(() => { speech.introduce('editor'); speech.stop(); speech.dispose(); });
  const failing = new ScreenSpeech({ synthesis: {
    speak: () => { throw new Error('Unavailable'); }, cancel: () => { throw new Error('Unavailable'); }, getVoices: () => [],
  }, utterance: text => ({ text } as SpeechSynthesisUtterance) });
  assert.doesNotThrow(() => { failing.introduce('presets'); failing.dispose(); });
});

test('robot guidance follows speech start and ends on cancellation; stale callbacks are ignored', () => {
  const { speech, spoken } = speechHarness();
  let starts = 0, finishes = 0;
  assert.equal(speech.say('Please lower this curb.', () => starts++, () => finishes++), true);
  spoken[0]!.onstart?.({} as SpeechSynthesisEvent);
  assert.equal(starts, 1);
  speech.say('Thank you!', () => starts++, () => finishes++);
  assert.equal(finishes, 1);
  spoken[0]!.onstart?.({} as SpeechSynthesisEvent);
  spoken[0]!.onend?.({} as SpeechSynthesisEvent);
  assert.equal(starts, 1); assert.equal(finishes, 1);
  speech.setEnabled(false);
  assert.equal(finishes, 2); assert.equal(speech.canSpeak, false);
  assert.equal(speech.say('Silent guidance'), false);
});

test('cancelled neural generation cannot start playback or invoke system fallback', async () => {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = class { resume() { return Promise.resolve(); } close() { return Promise.resolve(); } } as unknown as typeof AudioContext;
  try {
    let reject!: (error: Error) => void;
    let spoken = 0, finished = 0;
    const speech = new ScreenSpeech({ synthesis: { cancel() {}, getVoices: () => [], speak() { spoken++; } },
      utterance: text => ({ text } as SpeechSynthesisUtterance) }, {
      generate: () => new Promise((_resolve, rejectGeneration) => { reject = rejectGeneration; }), dispose() {},
    });
    assert.equal(speech.say('Old screen', undefined, () => finished++), true);
    speech.setMuted(true);
    reject(new Error('Download failed'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(spoken, 0); assert.equal(finished, 1);
    speech.dispose();
  } finally { globalThis.AudioContext = previous; }
});

test('neural generation failure uses the system voice and preserves guidance callbacks', async () => {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = class { resume() { return Promise.resolve(); } close() { return Promise.resolve(); } } as unknown as typeof AudioContext;
  try {
    let utterance: SpeechSynthesisUtterance | undefined;
    let started = 0, finished = 0;
    const speech = new ScreenSpeech({ synthesis: { cancel() {}, getVoices: () => [], speak(value) { utterance = value; } },
      utterance: text => ({ text } as SpeechSynthesisUtterance) }, {
      generate: async () => { throw new Error('Unavailable'); }, dispose() {},
    });
    speech.say('Hello', () => started++, () => finished++);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(utterance?.text, 'Hello');
    utterance!.onstart?.({} as SpeechSynthesisEvent); utterance!.onend?.({} as SpeechSynthesisEvent);
    assert.equal(started, 1); assert.equal(finished, 1);
    speech.dispose();
  } finally { globalThis.AudioContext = previous; }
});

test('pre-generation uses role voices without speaking and respects disabled narration', async () => {
  const prepared: string[] = [];
  const speech = new ScreenSpeech(null, {
    generate: async () => { throw new Error('Pre-generation must not play'); },
    preload: async (text, voice, priority) => { prepared.push(`${voice}:${priority}:${text}`); }, dispose() {},
  });
  speech.precache(['Upcoming crossing', 'Upcoming crossing'], 'city', 1);
  assert.deepEqual(prepared, ['bf_emma:1:Upcoming crossing']);
  speech.setEnabled(false); speech.precache(['Silent']);
  assert.equal(prepared.length, 1);
  speech.dispose();
});

test('a resolved action discards audio that finishes generating late', async () => {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = class { resume() { return Promise.resolve(); } close() { return Promise.resolve(); } } as unknown as typeof AudioContext;
  try {
    let complete!: (value: { audio: Float32Array; sampling_rate: number }) => void;
    let started = 0, finished = 0, relevant = true;
    const speech = new ScreenSpeech(null, {
      generate: () => new Promise(resolve => { complete = resolve; }), dispose() {},
    });
    speech.say('Crossing blocked', () => started++, () => finished++, { shouldPlay: () => relevant });
    relevant = false; complete({ audio: new Float32Array(24), sampling_rate: 24000 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(started, 0); assert.equal(finished, 1);
    speech.dispose();
  } finally { globalThis.AudioContext = previous; }
});
