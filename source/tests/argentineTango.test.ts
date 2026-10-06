import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { musicianStyles, normaliseArtist } from '../src/art/artistStyles';
import { SoundEffect } from '../src/audio/SoundEffect';

test('Argentine tango has an orchestral arrangement distinct from the existing rhythmic sketch', () => {
  const data = { at: 0, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: true };
  const provider = { get: () => undefined };
  const composer = new JourneyMusicComposer('argentineTango', 42661, 50, provider);
  const score = composer.compose(data);
  const sketch = new JourneyMusicComposer('tango', 42661, 50, provider).compose(data);
  assert.equal(normaliseArtist({ musician: 'argentineTango' }).musician, 'argentineTango');
  assert.ok(musicianStyles.some(style => style.id === 'tango'));
  assert.ok(score.some(entry => entry.label?.includes('tango-piano')));
  const strings = score.find(entry => entry.label?.includes('tango-strings'))!.score;
  assert.ok(strings.notes.every(note => note.duration > .8 * 60 / composer.bpm));
  assert.ok(!score.some(entry => /pulse|percussion|backbeat|hi-hat/.test(entry.label ?? '')));
  const bass = score.find(entry => entry.label?.includes(':bass:'))!.score;
  assert.deepEqual(bass.notes.map(note => Math.round(note.start * composer.bpm / 60)), [0,1,2,3]);
  assert.notDeepEqual(score[0]!.score, sketch[0]!.score);
  assert.deepEqual(composer.compose(data), score);
  for (const entry of score) assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
});
