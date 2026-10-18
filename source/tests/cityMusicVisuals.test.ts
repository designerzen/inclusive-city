import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visualNoteState } from '../src/ui/cityMusicVisuals';

test('visual responses wait for the audio onset and follow individual notes', () => {
  const notes = [0, .25, .5, 1];
  assert.equal(visualNoteState(9.9, 10, notes).index, -1);
  assert.equal(visualNoteState(9.9, 10, notes).energy, 0);
  assert.equal(visualNoteState(10, 10, notes).index, 0);
  assert.equal(visualNoteState(10, 10, notes).energy, 1);
  assert.equal(visualNoteState(10.4, 10, notes).index, 1);
  assert.equal(visualNoteState(10.5, 10, notes).index, 2);
  assert.equal(visualNoteState(10.5, 10, notes).energy, 1);
  assert.ok(visualNoteState(10.8, 10, notes).energy < .2);
});

test('labels linger long enough to read and expire by audio time after a stalled frame', () => {
  assert.equal(visualNoteState(12.8, 10, [0, .2]).expired, false);
  assert.equal(visualNoteState(13.1, 10, [0, .2]).expired, true);
  assert.equal(visualNoteState(15.9, 10, [0, 4]).expired, false);
  assert.equal(visualNoteState(16.1, 10, [0, 4]).expired, true);
  assert.equal(visualNoteState(999, 10, [0]).expired, true);
});
