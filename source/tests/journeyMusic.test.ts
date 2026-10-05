import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { musicianStyles } from '../src/art/artistStyles';
import { worldMusicStyles, worldArrangements } from '../src/art/worldMusicStyles';
import { normaliseArtist } from '../src/art/artistStyles';
import type { MusicianStyle } from '../src/art/artistStyles';
import { SoundEffect } from '../src/audio/SoundEffect';
import { BotHistory } from '../src/robot/botHistory';
import { createRobotProfile, defaultFunctions } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';
import type { RobotEvent, RobotEventType } from '../src/robot/robotState';

const phrase = { at: 0, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: false };

test('studio verses wait for Magenta, add chord-matched backing and preserve each genre groove', async () => {
  let ready = false, requests = 0;
  const provider = {
    get(request: { steps?: number }) { requests++; return ready ? Array.from({ length: 4 }, (_, i) =>
      ({ pitch: 67, quantizedStartStep: i * (request.steps ?? 64) / 4, quantizedEndStep: i * (request.steps ?? 64) / 4 + 4 })) : undefined; },
    async whenIdle() { ready = true; },
  };
  const composer = new JourneyMusicComposer('techno', 42661, 50, provider);
  const verses = await composer.studioVerses(10, 4, 30, 5);
  assert.equal(requests, 4, 'eight bars share two section requests and two cached responses');
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

test('world styles retain modal palettes and dance meters with and without AI accompaniment', () => {
  for (const { id } of worldMusicStyles) {
    assert.equal(normaliseArtist({ musician: id }).musician, id, `${id} survives saved preferences`);
    const grammar = worldArrangements[id];
    const provider = { get: () => [{ pitch: 67, quantizedStartStep: 16, quantizedEndStep: 20 }] };
    const composer = new JourneyMusicComposer(id, 42661, 50, { get: () => undefined });
    const enhanced = new JourneyMusicComposer(id, 42661, 50, provider);
    const original = composer.compose(phrase);
    const root = grammar.roots[0] + ((42661 >>> 5) % 12) - 5;
    assert.ok(original[0]!.score.notes.every(note => grammar.scale.includes(((note.midi - root) % 12 + 12) % 12)), id);
    const later = { ...phrase, phrase: 1 };
    const groove = (entries: ReturnType<JourneyMusicComposer['compose']>) => entries.filter(entry => !entry.label?.includes(':melody:'));
    assert.deepEqual(groove(enhanced.compose(later)), groove(composer.compose(later)), `${id}: AI preserves accompaniment`);
  }
  for (const id of ['turkish', 'balkan'] as const) {
    assert.equal(new JourneyMusicComposer(id, 42661).beats, 7);
    assert.deepEqual(part(id, 'pulse').starts, [0, 2, 4]);
    assert.deepEqual(part(id, 'harmony').starts, [1, 3, 5, 6]);
  }
  assert.equal(new JourneyMusicComposer('irish', 42661).beats, 3);
  assert.equal(new JourneyMusicComposer('korean', 42661).beats, 3);
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
  assert.deepEqual(live[0]!.score.notes, preview[0]!.score.notes);
  assert.deepEqual(live.find(entry => entry.label === 'journey:bass:0')!.score.notes, preview.find(entry => entry.label === 'journey:bass:0')!.score.notes);
});

test('all genres have an uninterrupted bed and distinct, valid chord-matched action responses', () => {
  const actions = ['step', 'turn', 'climb', 'descend', 'blocked', 'intervention', 'pickup', 'achievement',
    'arrived', 'segment', 'exploration', 'city_edit', 'journey_started', 'journey_ended', 'state_changed'];
  for (const style of musicianStyles) {
    const composer = new JourneyMusicComposer(style.id, 42661, 50, { get: () => undefined });
    const data = { ...phrase, expression: { moving: false, turning: 0, slope: 0, paused: true, speed: 0 } };
    const idle = composer.compose(data);
    const bed = idle.find(entry => entry.label?.includes('city-bed'))!;
    assert.ok(Math.abs(bed.score.notes[0]!.duration - composer.beats * 60 / composer.bpm) < 1e-10);
    const moving = composer.compose({ ...data, expression: { ...data.expression, moving: true, paused: false, speed: 2 } });
    assert.ok(moving.some(entry => entry.label?.includes('travel-pulse')));
    assert.ok(moving[0]!.score.voice.gain > idle[0]!.score.voice.gain);
    const chord = composer.compose({ ...data, harmony: true }).find(entry => entry.label?.includes(':harmony:'))!;
    const classes = new Set(chord.score.notes.map(note => note.midi % 12));
    for (const action of actions) {
      const entry = composer.react(action, data);
      assert.deepEqual(SoundEffect.fromScore(entry.score).toScore(), entry.score);
      assert.ok(entry.score.notes.every(note => classes.has(note.midi % 12)), `${style.id}: ${action} follows harmony`);
    }
    assert.notDeepEqual(composer.react('turn', data, -1).score, composer.react('turn', data, 1).score);
    assert.notDeepEqual(composer.react('climb', data).score.notes, composer.react('descend', data).score.notes);
  }
});

test('city waiting, motion, obstacles and arrival are recorded once on a continuous musical timeline', () => {
  const creation = new JourneyCreativity(new BotHistory(['Curie', 'Einstein']).current);
  const initial = creation.advance(0);
  assert.ok(initial.some(entry => entry.label?.includes('city-bed')));
  const event = (type: RobotEventType, sequence: number, state: RobotEvent['state'] = 'following'): RobotEvent => ({
    type, sequence, state, botId: 1, runId: 1, time: .5, runTime: .5, edge: 0,
    position: { x: 0, y: 0, z: 0 }, data: type === 'step' ? { step: 1 } : {},
  });
  creation.observeMotion({ x: 0, y: 0, z: 0 }, 0, 0);
  creation.observeMotion({ x: .1, y: .04, z: 0 }, .2, .1);
  creation.consume(event('step', 1));
  const travel = creation.advance(.1);
  for (const kind of ['step', 'turn', 'climb']) assert.ok(travel.some(entry => entry.label === `journey:action:${kind}`));
  const beat = 60 / creation.bpm;
  assert.ok(travel.every(entry => Math.abs(entry.at / (beat / 2) - Math.round(entry.at / (beat / 2))) < 1e-8));
  creation.consume(event('step', 1));
  assert.deepEqual(creation.advance(.1), []);
  creation.consume(event('blocked', 2, 'blocked'));
  assert.ok(creation.advance(.2).some(entry => entry.label === 'journey:action:blocked'));
  const measure = 4 * beat;
  assert.ok(creation.advance(measure - .1).some(entry => entry.label?.includes('city-bed')));
  creation.consume(event('state_changed', 3, 'paused'));
  assert.ok(creation.advance(measure).some(entry => entry.label === 'journey:action:state_changed'));
  assert.ok(creation.advance(measure * 2 - .1).some(entry => entry.label?.includes('city-bed')));
  creation.consume(event('arrived', 4, 'arrived'));
  assert.ok(creation.advance(measure * 2, false, true).some(entry => entry.label === 'journey:action:arrived'));
  assert.deepEqual(creation.score, JSON.parse(JSON.stringify(creation.score)));
  assert.ok(creation.score.every((entry, i, entries) => i === 0 || entry.at >= entries[i - 1]!.at));
  const before = creation.score.length;
  creation.advance(100);
  assert.ok(creation.score.length - before < 10, 'Returning after an interruption never schedules a burst');
});
