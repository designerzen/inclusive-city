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
    'Greet your robot', 'Design your robot', 'Help My Monet navigate the city', 'Enjoy this amazing robot art',
  ]);
  assert.deepEqual(calls, ['cancel', 'speak', 'cancel', 'speak', 'cancel', 'speak', 'cancel', 'speak']);
  assert.equal(screenIntroduction('city'), 'Help your robot navigate the city');
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
