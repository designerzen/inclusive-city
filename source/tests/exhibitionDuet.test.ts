import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SoundEffect } from '../src/audio/SoundEffect';
import { ExhibitionDuet } from '../src/robot/exhibitionDuet';

const entry = (at: number, midi: number, duration = .4) => {
  const score = new SoundEffect({ root: midi, intervals: [0], release: .01 }).toScore();
  score.notes[0]!.duration = duration;
  return { at, score };
};

test('duet tells the story on the audible timeline and animates the actual reply pitches', () => {
  const duet = new ExhibitionDuet(120, 4, [entry(10, 55, 20)]);
  assert.equal(duet.frame(0, true).phase, 'song');
  duet.hear(entry(1, 72));
  assert.equal(duet.frame(1.1, true).phase, 'listening');
  assert.deepEqual(duet.frame(.9, true).userKeys, []);
  assert.deepEqual(duet.frame(1.1, true).userKeys, [72]);
  duet.think(true); assert.equal(duet.frame(2, true).phase, 'thinking');
  duet.answer([entry(4, 74), entry(5, 81)], 4, 8);
  assert.equal(duet.frame(3.99, true).phase, 'queued');
  assert.deepEqual(duet.frame(3.99, true).robotKeys, [55], 'future reply notes must not light early');
  const answer = duet.frame(4.01, true);
  assert.equal(answer.phase, 'answer'); assert.deepEqual(answer.robotKeys, [74]);
  assert.notEqual(answer.leftSwing, answer.rightSwing, 'the active right hand strikes its own notes');
  assert.deepEqual(duet.frame(4.8, true).robotKeys, [], 'reply rests are real rests');
  assert.notEqual(duet.frame(5.01, true).pose.rightArm, answer.pose.rightArm, 'pitch moves the hand across the keyboard');
  assert.equal(duet.frame(8, true).phase, 'song');
  assert.deepEqual(duet.frame(8, true).robotKeys, [55]);
});

test('stop, seek reset, reduced motion and a longer song cannot leave phantom notes or gestures', () => {
  const duet = new ExhibitionDuet(120, 3, [entry(0, 60)]);
  duet.answer([entry(4, 72)], 4, 10);
  duet.hear(entry(4, 64));
  const stopped = duet.frame(4.1, false);
  assert.equal(stopped.phase, 'stopped'); assert.deepEqual(stopped.robotKeys, []); assert.deepEqual(stopped.userKeys, []);
  assert.deepEqual(duet.frame(4.1, true, true).pose, duet.frame(5, true, true).pose);
  assert.deepEqual(duet.frame(4.1, true, true).robotKeys, []);
  assert.equal(duet.frame(4.1, true, true).phase, 'answer', 'textual story still works with reduced motion');
  duet.reset(); assert.equal(duet.frame(4.1, true).phase, 'song');
  assert.deepEqual(duet.frame(4.1, true).userKeys, []);
  duet.setSong([entry(0, 60), entry(120, 67)]);
  assert.deepEqual(duet.frame(120.1, true).robotKeys, [67], 'extended music must update choreography too');
});

test('percussion is acknowledged without pretending the user played a pitched keyboard note', () => {
  const duet = new ExhibitionDuet(120, 4, []);
  duet.hear({ ...entry(2, 36), label: 'percussion' }, true);
  assert.equal(duet.frame(2.1, true).phase, 'listening');
  assert.deepEqual(duet.frame(2.1, true).userKeys, []);
});
