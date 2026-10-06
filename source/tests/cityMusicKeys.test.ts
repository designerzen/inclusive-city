import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityMusicKey, cityMoodKeys } from '../src/audio/cityMusicKeys';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { BotHistory } from '../src/robot/botHistory';
import { SoundEffect } from '../src/audio/SoundEffect';
import type { RobotEvent } from '../src/robot/robotState';

const seed = 42661;
const data = { at: 0, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: true };
const harmony = (score: ReturnType<JourneyMusicComposer['compose']>) => score.find(entry => entry.label?.includes(':harmony:'))
  ?? score.find(entry => entry.label?.includes(':city-bed:'))!;
const root = (score: ReturnType<JourneyMusicComposer['compose']>) => harmony(score).score.notes[0]!.midi;

test('time, section numbers and cadences never initiate a key change', () => {
  const home = cityMusicKey(seed, 0);
  for (let phrase = 0; phrase < 1000; phrase++) {
    assert.equal(cityMusicKey(seed, phrase).tonic, home.tonic);
    assert.equal(cityMusicKey(seed, phrase, 'sad').tonic, cityMusicKey(seed, 0, 'sad').tonic);
    assert.equal(cityMusicKey(seed, phrase, 'sad', true).tonic, cityMusicKey(seed, 0, 'sad').tonic);
  }
  assert.equal(cityMusicKey(seed + 32, 0).tonic, (home.tonic + 1) % 12);
});

test('city moods select relative key areas and harmonic modes without overriding world melody palettes', () => {
  const home = cityMusicKey(seed, 0).tonic;
  assert.equal(cityMusicKey(seed, 0, 'sad').tonic, (home + 9) % 12);
  assert.equal(cityMusicKey(seed, 0, 'calm').tonic, (home + 5) % 12);
  assert.equal(cityMusicKey(seed, 0, 'determined').tonic, (home + 7) % 12);
  assert.equal(cityMusicKey(seed, 0, 'relieved').tonic, home);
  assert.equal(cityMusicKey(seed, 0, 'celebrating').tonic, (home + 2) % 12);
  for (const mood of Object.keys(cityMoodKeys) as (keyof typeof cityMoodKeys)[]) {
    const composer = new JourneyMusicComposer('melodic', seed, 50, { get: () => undefined });
    const score = composer.compose({ ...data, mood });
    assert.equal(root(score) % 12, cityMusicKey(seed, 0, mood).tonic);
    for (const entry of score) assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
  }
});

test('Magenta chord requests and action notes follow the modulated key, and the ending resolves home', () => {
  const chords: string[][] = [];
  const composer = new JourneyMusicComposer('classical', seed, 50, { get: request => { chords.push([...(request.chords ?? [])]); return undefined; } });
  composer.compose(data);
  const opening = chords[0]!;
  const later = composer.compose({ ...data, phrase: 4, keyMood: 'calm', mood: 'calm' });
  assert.notDeepEqual(chords.at(-1), opening);
  const classes = new Set(later.find(entry => entry.label?.includes(':harmony:'))!.score.notes.map(note => note.midi % 12));
  const reaction = composer.react('pickup', { ...data, phrase: 4, keyMood: 'calm', mood: 'calm' });
  assert.ok(reaction.score.notes.every(note => classes.has(note.midi % 12)));
  const ending = composer.compose({ ...data, phrase: 11, mood: 'celebrating', cadence: true });
  assert.equal(ending[0]!.score.notes.at(-1)!.midi % 12, cityMusicKey(seed, 0, 'celebrating').tonic);
});

test('only consumed city actions request keys, and each applied change has a timed visual cause', () => {
  const creation = new JourneyCreativity(new BotHistory(['Curie', 'Einstein']).current, seed);
  const measure = 4 * 60 / creation.bpm;
  creation.advance(0);
  for (let bar = 1; bar <= 12; bar++) {
    creation.observeMotion({ x: bar, y: 0, z: 0 }, 0, bar * measure, bar > 6);
    creation.advance(bar * measure - .1);
  }
  assert.deepEqual(creation.keyChanges, [], 'elapsed time, movement samples and inferred pause cannot modulate');
  const event: RobotEvent = { type: 'state_changed', sequence: 1, state: 'paused', botId: 1, runId: 1,
    time: 12 * measure, runTime: 12 * measure, edge: 0, position: { x: 12, y: 0, z: 0 }, data: {} };
  creation.consume(event);
  creation.advance(12 * measure + .2);
  assert.equal(creation.keyChanges.length, 0, 'wait for the next unplayed bar');
  const changed = creation.advance(13 * measure - .1);
  assert.equal(root(changed) % 12, (cityMusicKey(seed, 13, 'calm').tonic + 7) % 12);
  assert.ok(Math.abs(creation.keyChanges[0]!.at - 13 * measure) < 1e-8);
  assert.deepEqual({ ...creation.keyChanges[0], at: 0 }, { at: 0, tonic: cityMusicKey(seed, 13, 'calm').tonic, mode: 'major', cause: 'paused' });
  for (let bar = 14; bar <= 24; bar++) creation.advance(bar * measure - .1);
  assert.equal(creation.keyChanges.length, 1, 'no automatic return or mood expiry');
  creation.consume({ ...event, sequence: 2, type: 'intervention', state: 'following', time: 24 * measure });
  creation.advance(25 * measure - .1);
  assert.equal(creation.keyChanges.at(-1)!.cause, 'intervention');
  assert.equal(creation.keyChanges.at(-1)!.tonic, cityMusicKey(seed, 0).tonic);
});
