import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extendExhibitionSong, jamEffect, jamPads, jamHarmony, tuneJamNote, jamKeyboardNote, jamPrimer } from '../src/audio/exhibitionJam';
import { SoundEffect } from '../src/audio/SoundEffect';
import { musicDuration } from '../src/art/finishedJourney';
test('jam adds three minutes without changing existing notes and can extend again', () => {
 const score = [{at: 10, score: jamEffect(60).toScore()}];
 const before = structuredClone(score); const duration = musicDuration(score);
 extendExhibitionSong(score, 120);
 assert.deepEqual(score[0], before[0]);
 assert.ok(musicDuration(score) - duration >= 179);
 const extended = musicDuration(score); extendExhibitionSong(score, 120);
 assert.ok(musicDuration(score) - extended >= 179);
 assert.ok(score.every((entry, i) => !i || entry.at >= score[i-1]!.at));
});

test('harmony assist follows recorded non-C chords and changes at the actual chord onset', () => {
 const score = [
  { at: 10, label: 'studio:harmony:0', score: new SoundEffect({ root: 61, intervals: [0, 3, 7] }).toScore() },
  { at: 12, label: 'studio:harmony:1', score: new SoundEffect({ root: 66, intervals: [0, 2, 7] }).toScore() },
 ];
 assert.equal(jamHarmony(score, 0).chord, 'Dbm');
 assert.equal(jamHarmony(score, 1.99).chord, 'Dbm');
 assert.equal(jamHarmony(score, 2).chord, 'Gbsus2');
 for (const at of [0, 2]) {
  const harmony = jamHarmony(score, at);
  const allowed = harmony.intervals.map(interval => (harmony.root + interval) % 12);
  const keys = Array.from({length: 8}, (_, i) => jamKeyboardNote(i, harmony));
  assert.equal(new Set(keys).size, 8);
  assert.ok(keys.every((pitch, i) => allowed.includes(pitch % 12) && (!i || pitch > keys[i-1]!)));
  for (let note = 0; note <= 127; note++) {
   const tuned = tuneJamNote(note, harmony);
   assert.ok(tuned >= 0 && tuned <= 127 && allowed.includes(tuned % 12));
   if (allowed.includes(note % 12)) assert.equal(tuned, note);
  }
 }
});

test('Magenta primer retains the recent user phrase on a bounded grid in different meters', () => {
 assert.equal(jamPrimer([], 120, 4, 'C'), undefined);
 for (const beats of [3, 4, 7]) {
  const played = Array.from({length: 180}, (_, i) => ({ pitch: 60 + i % 12, at: i / 8 }));
  played.push({pitch: 80, at: played.at(-1)!.at});
  const request = jamPrimer(played, 120, beats, 'Dbm')!;
  assert.equal(request.primerSteps, Math.min(32, beats * 8));
  assert.equal(request.steps, Math.min(64, beats * 16));
  assert.equal(request.notes.at(-1)!.pitch, 80);
  assert.ok(request.notes.every((note, i) => note.quantizedStartStep >= 0
   && note.quantizedEndStep > note.quantizedStartStep && note.quantizedEndStep <= request.primerSteps!
   && (!i || request.notes[i-1]!.quantizedEndStep <= note.quantizedStartStep)));
 }
});
test('percussion voices are distinct, velocity sensitive and valid at MIDI bounds', () => {
 assert.equal(new Set(jamPads.map(p => JSON.stringify(jamEffect(p.midi, 100, true).toScore()))).size, 4);
 assert.ok(jamEffect(60, 127).toScore().voice.gain > jamEffect(60, 1).toScore().voice.gain);
 for (const note of [0, 127]) assert.doesNotThrow(() => jamEffect(note));
 const empty: any[] = []; extendExhibitionSong(empty,120); assert.equal(empty.length,0);
});
