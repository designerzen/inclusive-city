import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SoundEffect } from '../src/audio/SoundEffect';
import { seekSequence } from '../src/audio/seekSequence';

test('seeking trims held notes, keeps future notes in time and leaves the saved score intact', () => {
  const score = new SoundEffect({ intervals: [0], echoGain: 0 }).toScore();
  score.notes = [{ midi: 60, start: 0, duration: 1 }, { midi: 64, start: 2, duration: 4 }, { midi: 67, start: 7, duration: 1 }];
  const sequence = [{ at: 12, score }, { at: 22, score: new SoundEffect().toScore() }];
  const original = structuredClone(sequence);
  const sought = seekSequence(sequence, 3);
  assert.equal(sought[0]!.at, 0);
  assert.deepEqual(sought[0]!.score.notes, [{ midi: 64, start: 0, duration: 3 }, { midi: 67, start: 4, duration: 1 }]);
  assert.equal(sought[1]!.at, 7);
  sought.forEach(entry => assert.doesNotThrow(() => SoundEffect.fromScore(entry.score)));
  assert.deepEqual(sequence, original);
  assert.deepEqual(seekSequence(sequence, 0), sequence.map(entry => ({ ...entry, at: entry.at - 12 })));
  assert.deepEqual(seekSequence(sequence, 100), []);
  assert.throws(() => seekSequence(sequence, NaN), RangeError);
});
