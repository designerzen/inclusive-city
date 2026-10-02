import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAttractScore, attractBpm, attractLoopSeconds } from '../src/audio/attractMusic';
import { SoundEffect } from '../src/audio/SoundEffect';

test('attract soundtrack is a replayable four-bar score with bass, rhythm and game motifs', () => {
  const score = createAttractScore();
  assert.deepEqual(score, createAttractScore());
  assert.equal(attractLoopSeconds, 16 * 60 / attractBpm);
  assert.deepEqual(new Set(score.map(entry => entry.label)), new Set(['attract:bass', 'attract:tick', 'attract:discovery', 'attract:answer']));
  assert.equal(score.filter(entry => entry.label === 'attract:bass').length, 16);
  for (const [index, entry] of score.entries()) {
    assert.ok(entry.at >= 0 && entry.at < attractLoopSeconds);
    assert.ok(index === 0 || entry.at >= score[index - 1]!.at);
    const effect = SoundEffect.fromScore(entry.score);
    assert.ok(entry.at + effect.duration < attractLoopSeconds + .5, 'Voices should settle near the loop boundary');
  }
  score[0]!.score.notes[0]!.midi = 1;
  assert.notEqual(createAttractScore()[0]!.score.notes[0]!.midi, 1);
});
