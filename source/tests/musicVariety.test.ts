import assert from 'node:assert/strict';
import { test } from 'node:test';
import { robotMusicalIdentity } from '../src/audio/robotMusicalIdentity';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { JourneyCreativity, freshCompositionSeed } from '../src/art/JourneyCreativity';
import { BotHistory } from '../src/robot/botHistory';
import { worldMusicStyles, worldArrangements } from '../src/art/worldMusicStyles';
import { SoundEffect } from '../src/audio/SoundEffect';
import { cityMusicKey } from '../src/audio/cityMusicKeys';

const base = { at: 0, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: true };
const moving = { moving: true, turning: 0, slope: 0, paused: false, speed: 1 };
const noAI = { get: () => undefined };

test('robot identity preserves the selected instrument waveform and contrasting genre envelopes', () => {
  for (let seed = 1; seed <= 64; seed++) {
    for (const waveform of ['sine', 'triangle', 'square', 'sawtooth'] as const)
      assert.equal(robotMusicalIdentity(seed).voice({ waveform }).waveform, waveform);
    const piano = new JourneyMusicComposer('classical', seed, 50, noAI).compose(base)[0]!.score.voice;
    const arcade = new JourneyMusicComposer('chiptune', seed, 50, noAI).compose(base)[0]!.score.voice;
    const pad = new JourneyMusicComposer('ambient', seed, 50, noAI).compose(base)[0]!.score.voice;
    assert.equal(piano.waveform, 'triangle');
    assert.equal(arcade.waveform, 'square');
    assert.equal(pad.waveform, 'sine');
    assert.ok(pad.attack > piano.attack * 10 && pad.release > piano.release * 3);
  }
});

test('ordinary city moods retain world modal palettes rather than homogenising their lead notes', () => {
  const seed = 42661;
  for (const style of worldMusicStyles) {
    const grammar = worldArrangements[style.id];
    const composer = new JourneyMusicComposer(style.id, seed, 50, noAI);
    for (const mood of ['calm', 'determined', 'happy'] as const) {
      const score = composer.compose({ ...base, mood, expression: moving });
      const root = grammar.roots[0] + cityMusicKey(seed, 0, mood).transpose;
      assert.ok(score[0]!.score.notes.every(note => grammar.scale.includes(((note.midi - root) % 12 + 12) % 12)), style.id);
      const bed = score.find(entry => entry.label?.includes('city-bed'))!.score;
      assert.equal(bed.voice.waveform, 'sine');
      assert.ok(bed.voice.gain < score[0]!.score.voice.gain / 4, 'the generic continuity bed stays behind the genre lead');
    }
  }
});

test('new journey seeds change compositions for the same robot, while saved seeds reproduce the exact score', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  const first = new JourneyCreativity(bot, 42), second = new JourneyCreativity(bot, 314159);
  assert.equal(first.seed, 42);
  assert.notDeepEqual(first.previewMusic()[0]!.score.notes.map(note => note.midi), second.previewMusic()[0]!.score.notes.map(note => note.midi));
  assert.deepEqual(new JourneyCreativity(bot, first.seed).previewMusic(), first.previewMusic());
  assert.equal(freshCompositionSeed(42, () => 42), 43, 'a draw cannot repeat the previous composition seed');
  assert.equal(freshCompositionSeed(0xffffffff, () => 0xffffffff), 0);
  assert.equal(freshCompositionSeed(42, () => 314159), 314159);
  const saved = JSON.parse(JSON.stringify(first.advance(0)));
  for (const entry of saved) assert.deepEqual(SoundEffect.fromScore(entry.score).toScore(), entry.score);
});
