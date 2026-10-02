import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { musicianStyles } from '../src/art/artistStyles';
import type { MusicianStyle } from '../src/art/artistStyles';
import { SoundEffect } from '../src/audio/SoundEffect';
import { BotHistory } from '../src/robot/botHistory';
import { createRobotProfile, defaultFunctions } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';

const phrase = { at: 0, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: false };

test('studio verses wait for Magenta, add chord-matched backing and preserve each genre groove', async () => {
  let ready = false, requests = 0;
  const provider = {
    get() { requests++; return ready ? [{ pitch: 67, quantizedStartStep: 0, quantizedEndStep: 4 }] : undefined; },
    async whenIdle() { ready = true; },
  };
  const composer = new JourneyMusicComposer('techno', 42661, 50, provider);
  const verses = await composer.studioVerses(10, 4, 30, 5);
  assert.equal(requests, 16);
  assert.equal(new Set(verses.map(entry => entry.at)).size, 8);
  assert.equal(verses[0]!.at, 10);
  assert.equal(verses.filter(entry => entry.label?.includes('magenta-countermelody')).length, 8);
  assert.equal(verses.filter(entry => entry.label?.includes('donk-bass')).length, 8);
  assert.equal(verses.filter(entry => entry.label?.includes(':harmony:')).length, 8);
  for (const entry of verses) assert.deepEqual(SoundEffect.fromScore(entry.score).toScore(), entry.score);
  const fallback = await new JourneyMusicComposer('waltz', 42661, 50, { get: () => undefined }).studioVerses(0, 4, 0, 0);
  assert.equal(new Set(fallback.map(entry => entry.at)).size, 8);
  assert.ok(fallback.some(entry => entry.label?.includes(':harmony:')));
});
function part(style: MusicianStyle, name: string) {
  const composer = new JourneyMusicComposer(style, 42661);
  const score = composer.compose(phrase).find(entry => entry.label === `journey:${name}:0`)!.score;
  const beat = 60 / composer.bpm;
  return { score, starts: [...new Set(score.notes.map(note => Math.round(note.start / beat * 1000) / 1000))] };
}

test('familiar grooves retain their defining bass, backbeat and chord placement', () => {
  assert.deepEqual(part('disco', 'pulse').starts, [0, 1, 2, 3]);
  assert.deepEqual(part('disco', 'hi-hat').starts, [.5, 1.5, 2.5, 3.5]);
  assert.deepEqual(part('reggae', 'pulse').starts, [2]);
  assert.deepEqual(part('reggae', 'harmony').starts, [.5, 1.5, 2.5, 3.5]);
  assert.deepEqual(part('ragtime', 'bass').starts, [0, 1, 2, 3]);
  assert.deepEqual(part('ragtime', 'harmony').starts, [.5, 1.5, 2.5, 3.5]);
  assert.ok(part('funk', 'bass').starts.some(start => start % .5 !== 0));
  assert.deepEqual(part('dnb', 'pulse').starts, [0, 1.5, 2.75]);
  assert.deepEqual(part('dnb', 'backbeat').starts, [1, 3, 3.75]);
  assert.ok(part('jazz', 'melody').starts.includes(.667), 'Jazz eighths have a triplet swing');
  const alberti = part('classical', 'bass').score.notes.map(note => note.midi);
  assert.deepEqual(alberti.slice(0, 4).map(note => note - alberti[0]!), [0, 7, 4, 7]);
  assert.notDeepEqual(part('baroque', 'counterpoint').score.notes, part('baroque', 'melody').score.notes);
});

test('robot motifs recur across steps, differ between identities, and develop at phrase endings', () => {
  for (const style of musicianStyles) {
    const composer = new JourneyMusicComposer(style.id, 42661);
    const a = composer.compose(phrase)[0]!.score;
    const b = composer.compose({ ...phrase, steps: 51, edge: 3 })[0]!.score;
    assert.deepEqual(a, b, `${style.label}: steps preserve the motif`);
    assert.notDeepEqual(a, new JourneyMusicComposer(style.id, 72519).compose(phrase)[0]!.score);
    const answer = composer.compose({ ...phrase, phrase: 3, harmony: true, steps: 1 })[0]!.score;
    const changed = composer.compose({ ...phrase, phrase: 3, harmony: true, steps: 2 })[0]!.score;
    assert.deepEqual(answer.notes.slice(0, -1), changed.notes.slice(0, -1));
    assert.notEqual(answer.notes.at(-1)!.midi, changed.notes.at(-1)!.midi);
  }
});

test('four-bar auditions are valid replayable scores at the selected tempo and meter', () => {
  for (const style of musicianStyles) {
    const composer = new JourneyMusicComposer(style.id, 42661);
    const score = composer.preview();
    const measure = composer.beats * 60 / composer.bpm;
    assert.deepEqual([...new Set(score.map(entry => entry.at))], [0, measure, 2 * measure, 3 * measure]);
    assert.deepEqual(score, composer.preview());
    for (const entry of score) assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
  }
});

test('designer audition and city composition use the same robot key and motif', () => {
  const history = new BotHistory(['Curie', 'Einstein']);
  history.updateProfile(createRobotProfile(defaultAbilities(), defaultFunctions(), { painter: 'surrealist', musician: 'reggae' }));
  const creativity = new JourneyCreativity(history.current);
  creativity.music = true;
  const preview = creativity.previewMusic();
  const live = creativity.advance(0);
  assert.deepEqual(live[0]!.score, preview[0]!.score);
  assert.deepEqual(live.find(entry => entry.label === 'journey:bass:0'), preview.find(entry => entry.label === 'journey:bass:0'));
});
