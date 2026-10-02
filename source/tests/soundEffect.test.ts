import assert from 'node:assert/strict';
import { test } from 'node:test';
import { midiFrequency, SoundEffect } from '../src/audio/SoundEffect';
import { robotMoodSound } from '../src/audio/soundPresets';
import { CitySounds } from '../src/audio/CitySounds';
import { buttonSound, buttonSoundNames, isButtonSound } from '../src/audio/soundPresets';
import { readFileSync } from 'node:fs';
import { robotFunctions } from '../src/robot/functions';
import { cityPowerups } from '../src/city/cityLayout';

test('every workshop and city button has a registered musical signature', () => {
  for (const file of ['main.ts', 'ui/attractScreen.ts', 'ui/abilityDesigner.ts', 'ui/cityScreen.ts', 'ui/exhibitionScreen.ts']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const [tag] of source.matchAll(/<button\b[^>]*>/g)) {
      if (tag.includes('data-function=')) {
        for (const item of robotFunctions) assert.ok(isButtonSound(`function-${item.id}`));
        continue;
      }
      if (tag.includes('data-powerup=')) {
        for (const pickup of cityPowerups) assert.ok(isButtonSound(`explore-${pickup.id}`));
        continue;
      }
      const map = tag.match(/data-map="([^"]+)"/)?.[1];
      const view = tag.match(/data-view="([^"]+)"/)?.[1];
      const id = tag.match(/id="([^"]+)"/)?.[1];
      assert.ok(isButtonSound(map ? `map-${map}` : view ? `view-${view}` : id ?? ''), `Missing signature: ${tag}`);
    }
  }
});

test('button signatures are distinct and reproduce the same score on each press', () => {
  const scores = buttonSoundNames.map(name => {
    const effect = buttonSound(name);
    assert.deepEqual(buttonSound(name).toScore(), effect.toScore());
    assert.deepEqual(SoundEffect.fromScore(effect.toScore()).toScore(), effect.toScore());
    return JSON.stringify(effect.toScore());
  });
  assert.equal(new Set(scores).size, buttonSoundNames.length);
  for (const name of buttonSoundNames.filter(name => name.startsWith('function-') || ['city-pause', 'rotation-toggle', 'sound-mute'].includes(name))) {
    assert.notDeepEqual(buttonSound(name, false).toScore(), buttonSound(name, true).toScore());
  }
});

test('robot moods use minor sadness and ascending major happiness', () => {
  const sad = robotMoodSound('sad').toScore();
  assert.deepEqual(sad.notes.map(n => n.midi), [48, 51, 55]);
  assert.ok(sad.notes.every(n => n.start === 0));
  const happy = robotMoodSound('happy').toScore();
  assert.deepEqual(happy.notes.map(n => n.midi), [60, 64, 67, 72]);
  assert.deepEqual(happy.notes.map(n => n.start), [0, 0.125, 0.25, 0.375]);
  assert.equal(midiFrequency(69), 440);
});

test('JSON roundtrip preserves every note and synthesis parameter without mutable aliases', () => {
  const effect = new SoundEffect({ root: 62, intervals: [0, 3, 7], inversion: 1, pattern: 'up-down', bpm: 90, repeats: 2, layers: 3, pan: -0.4, vibratoDepth: 9, pitchBend: -2, waveform: 'sawtooth' });
  const score = effect.toScore();
  const restored = SoundEffect.fromScore(JSON.parse(JSON.stringify(score)));
  assert.deepEqual(restored.toScore(), score);
  assert.equal(restored.duration, effect.duration);
  score.notes[0]!.midi = 1; score.voice.gain = 0;
  assert.deepEqual(restored.toScore(), effect.toScore());
  assert.deepEqual(effect.toScore().notes.slice(0, 5).map(n => n.midi), [65, 69, 74, 69, 65]);
});

test('rejects invalid scores and unsafe synthesis parameters before playback', () => {
  for (const config of [{ bpm: NaN }, { root: Infinity }, { intervals: [] }, { layers: 2.5 }, { gain: 4 }, { root: 127, intervals: [12] }, { repeats: 1.5 }]) {
    assert.throws(() => new SoundEffect(config), RangeError);
  }
  const score = new SoundEffect().toScore();
  assert.throws(() => SoundEffect.fromScore({ ...score, version: 2 } as any), /version/);
  score.notes[0]!.start = -1;
  assert.throws(() => SoundEffect.fromScore(score), /start/);
});

test('sequence offsets and all scores are validated before scheduling any nodes', () => {
  const effect = new SoundEffect();
  let creations = 0;
  const context = { currentTime: 0, createGain: () => { creations++; } } as unknown as BaseAudioContext;
  assert.throws(() => SoundEffect.scheduleSequence(context, {} as AudioNode, [
    { at: 0, score: effect.toScore() }, { at: -1, score: effect.toScore() },
  ]), /offset/);
  assert.equal(creations, 0);
});

test('muted and unavailable audio still records complete detached scores for replay', () => {
  const sounds = new CitySounds();
  sounds.setMuted(true);
  sounds.mood('sad');
  sounds.mood('happy');
  const sequence = sounds.sequence;
  assert.deepEqual(sequence.map(entry => entry.label), ['mood:sad', 'mood:happy']);
  assert.ok(sequence[1]!.at >= sequence[0]!.at);
  sequence[0]!.score.notes[0]!.midi = 1;
  assert.equal(sounds.sequence[0]!.score.notes[0]!.midi, 48);
  sounds.setVolume(0);
  assert.equal(sounds.sequence.length, 2);
  sounds.dispose();
  sounds.mood('curious');
  assert.equal(sounds.sequence.length, 2);
});
