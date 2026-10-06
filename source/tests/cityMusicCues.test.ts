import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CityMusicCues } from '../src/ui/cityMusicCues';
import { SoundEffect } from '../src/audio/SoundEffect';

test('every scheduled note has a visual cue at its onset, including simultaneous chords and actions', () => {
  const cues = new CityMusicCues();
  const score = new SoundEffect().toScore();
  score.notes = [{ midi: 60, start: 0, duration: .2 }, { midi: 64, start: 0, duration: .2 }, { midi: 67, start: .5, duration: .2 }];
  cues.add([{ at: 2, label: 'journey:action:pickup', score }]);
  assert.equal(cues.advance(1.9).notes, '');
  assert.equal(cues.advance(2).notes, 'Discovery collected: C4, E4');
  assert.equal(cues.advance(2.5).notes, 'Discovery collected: G4');
  assert.equal(cues.advance(3).notes, '');
});

test('key cues preserve the city action and appear at the actual scheduled change time', () => {
  const cues = new CityMusicCues();
  cues.key({ at: 3, tonic: 9, mode: 'minor', cause: 'blocked' });
  assert.equal(cues.advance(2.9).key, undefined);
  assert.equal(cues.advance(3).key, 'Obstacle encountered → A · minor');
  cues.key({ at: 5, tonic: 0, mode: 'major', cause: 'intervention' });
  cues.clear();
  assert.equal(cues.advance(6).key, undefined, 'restarting removes old pending cues');
});
