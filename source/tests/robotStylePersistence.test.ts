import assert from 'node:assert/strict';
import { test } from 'node:test';
import { robotMusicalIdentity } from '../src/audio/robotMusicalIdentity';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { SoundEffect } from '../src/audio/SoundEffect';

const scale = [0, 2, 4, 5, 7, 9, 11], intervals = [0, 4, 7, 11];

test('identity shaping bounds pitch and articulation without moving onsets or offbeat passing pitches', () => {
  for (const beats of [3, 4, 7]) {
    for (const root of [0, 60, 120]) {
      const source = Array.from({ length: beats * 2 }, (_, i) => ({
        midi: Math.min(127, root + (i % 2 ? 1 : 4)), start: i * .25, duration: .18,
      }));
      const motif = [{ midi: Math.min(127, root + 12), start: 0, duration: .3 }];
      const saved = structuredClone(source);
      const identity = robotMusicalIdentity(42661);
      const context = { phrase: 41, beat: .5, root, scale, intervals };
      const shaped = identity.conditionMelody(source, motif, context);
      assert.deepEqual(identity.conditionMelody(source, motif, context), shaped);
      assert.deepEqual(source, saved);
      assert.equal(shaped.length, source.length);
      shaped.forEach((note, i) => {
        const original = source[i]!;
        assert.equal(note.start, original.start);
        assert.ok(Math.abs(note.midi - original.midi) <= 3);
        assert.ok(note.midi >= 0 && note.midi <= 127);
        assert.ok(note.duration >= original.duration * .85 && note.duration <= original.duration);
        assert.ok(note.start + note.duration <= beats * .5);
        if (i % 2) assert.equal(note.midi, original.midi, 'offbeat chromatic passing pitch survives');
        else assert.ok((i === 0 ? intervals : scale).some(interval => (root + interval) % 12 === note.midi % 12));
      });
      assert.deepEqual(identity.conditionMelody([], motif, context), []);
      const withoutMotif = identity.conditionMelody(source, [], context);
      assert.deepEqual(withoutMotif.map(note => note.midi), source.map(note => note.midi));
    }
  }
});

test('an on-beat note receives a bounded pull towards the motif while generated detail survives', () => {
  const identity = robotMusicalIdentity(42661);
  const source = [{ midi: 60, start: 0, duration: .3 }, { midi: 61, start: .25, duration: .1 }];
  const context = { phrase: 1, beat: .5, root: 60, scale, intervals: [0, 3, 7, 10] };
  const shaped = identity.conditionMelody(source, [{ midi: 84, start: 0, duration: .3 }], context);
  assert.equal(shaped[0]!.midi, 63, 'distant motifs can only pull a note three semitones');
  assert.equal(shaped[1]!.midi, 61, 'the weak passing tone remains chromatic');
  assert.ok(shaped[0]!.duration < source[0]!.duration);
  const other = robotMusicalIdentity(42).conditionMelody(source, [{ midi: 84, start: 0, duration: .3 }], context);
  assert.notDeepEqual(other.map(note => note.duration), shaped.map(note => note.duration), 'articulation carries identity even with identical model and motif');
  const shortest = identity.conditionMelody([{ midi: 60, start: 0, duration: .001 }], [], context);
  assert.equal(shortest[0]!.duration, .001, 'minimum-length score notes remain playable');
});

test('identical AI output retains robot-specific contours across twelve four-bar windows and studio replay', async () => {
  // A deliberately generic response controls for model variation, timbre, key and tempo.
  for (const style of ['jazz', 'waltz', 'balkan'] as const) {
    const beats = style === 'waltz' ? 3 : style === 'balkan' ? 7 : 4;
    const modelNotes = Array.from({ length: 4 }, (_, bar) => Array.from({ length: beats * 2 }, (_, i) => ({
      pitch: 72 + [0, 1, 4, 5, 7, 8, 4, 2][i % 8]!,
      quantizedStartStep: bar * beats * 4 + i * 2,
      quantizedEndStep: bar * beats * 4 + i * 2 + 1,
    }))).flat();
    const windows = Array.from({ length: 12 }, () => new Set<string>());
    const firstBarArticulations = new Set<string>();
    for (const seed of [1, 42, 42661, 91281]) {
      const composer = new JourneyMusicComposer(style, seed, 50, { get: () => modelNotes });
      const measure = composer.beats * 60 / composer.bpm;
      for (let section = 0; section < windows.length; section++) {
        const contours: number[][] = [];
        for (let slot = 1; slot <= 3; slot++) {
          const phrase = section * 4 + slot;
          const data = { at: phrase * measure, phrase, steps: phrase, edge: 0, blocked: false, harmony: true };
          const entries = composer.compose(data);
          const lead = entries[0]!;
          assert.ok(lead.label?.endsWith(':magenta'), `${style} bar ${phrase} uses the controlled AI response`);
          if (phrase === 1) firstBarArticulations.add(JSON.stringify(lead.score.notes.map(note => note.duration)));
          contours.push(lead.score.notes.map(note => note.midi - lead.score.notes[0]!.midi));
          assert.deepEqual(composer.compose(data), entries, 'out-of-order templates cannot advance identity');
          composer.remember(entries);
          for (const entry of entries) assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
        }
        windows[section]!.add(JSON.stringify(contours));
      }
      const studio = await composer.studioVerses(48 * measure, 48, 40, 0);
      assert.ok(studio.some(entry => entry.label?.endsWith(':magenta')));
      assert.ok(studio.every(entry => entry.score.notes.every(note => note.start + note.duration <= measure + 1e-8)));
      assert.equal(studio.filter(entry => entry.label?.includes(':melody:')).at(-1)!.score.notes.at(-1)!.midi % 12,
        studio.filter(entry => entry.label?.includes(':harmony:')).at(-1)!.score.notes[0]!.midi % 12);
    }
    assert.ok(firstBarArticulations.size > 1, `${style} AI lead bypasses the robot's articulation`);
    windows.forEach((window, index) => assert.ok(window.size > 1, `${style} window ${index} loses robot pitch identity`));
  }
});
