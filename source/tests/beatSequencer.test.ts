import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatStep, upcomingBeatSteps } from '../src/audio/beatSequencer';

test('eighth-note playhead follows song time across tempos, seeks and meters', () => {
  for (const bpm of [60, 120, 180]) {
    for (const beats of [3, 4, 7]) {
      const bar = beats * 60 / bpm;
      assert.equal(beatStep(bar, bpm) % (beats * 2), 0);
      assert.equal(beatStep(bar / 2, bpm), beats);
    }
  }
  assert.equal(beatStep(-1, 120), 0);
});

test('audio lookahead schedules each upcoming step once and skips stalls and song end', () => {
  assert.deepEqual(upcomingBeatSteps(.15, 120, -1, 10), [1]);
  assert.deepEqual(upcomingBeatSteps(.18, 120, 1, 10), []);
  assert.deepEqual(upcomingBeatSteps(4.15, 120, 1, 10), [17]);
  assert.deepEqual(upcomingBeatSteps(4.15, 120, 1, 4.25), []);
  assert.deepEqual(upcomingBeatSteps(4.3, 120, 1, 4.25), []);
  assert.deepEqual(upcomingBeatSteps(0, 120, -1, 10), [0]);
  assert.deepEqual(upcomingBeatSteps(10, 120, -1, 30), [40]);
});
