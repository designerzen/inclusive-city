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

test('related keys hold for four bars, vary across sections and return home at a cadence', () => {
  const home = cityMusicKey(seed, 0);
  for (let phrase = 0; phrase < 4; phrase++) assert.equal(cityMusicKey(seed, phrase).tonic, home.tonic);
  assert.equal(cityMusicKey(seed, 4).tonic, (home.tonic + 5) % 12);
  assert.equal(cityMusicKey(seed, 8).tonic, (home.tonic + 7) % 12);
  assert.equal(cityMusicKey(seed, 12).tonic, home.tonic);
  assert.equal(cityMusicKey(seed, 11, 'celebrating', true).tonic, home.tonic);
  assert.equal(cityMusicKey(seed + 32, 0).tonic, (home.tonic + 1) % 12);
  for (let phrase = 0; phrase < 1000; phrase++) assert.ok(Math.abs(cityMusicKey(seed, phrase, 'wonder').transpose - home.transpose) <= 6);
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
  assert.equal(ending[0]!.score.notes.at(-1)!.midi % 12, cityMusicKey(seed, 0).tonic);
});

test('live mood changes keep the section key until its boundary and reactions use the audible key', () => {
  const creation = new JourneyCreativity(new BotHistory(['Curie', 'Einstein']).current, seed);
  const measure = 4 * 60 / creation.bpm;
  const first = creation.advance(0);
  const homeRoot = root(first);
  const event: RobotEvent = { type: 'pickup', sequence: 1, state: 'following', botId: 1, runId: 1,
    time: .2, runTime: .2, edge: 0, position: { x: 0, y: 0, z: 0 }, data: { kind: 'music' } };
  creation.consume(event);
  const reaction = creation.advance(.2).find(entry => entry.label?.includes('action:pickup'))!;
  const originalClasses = new Set(harmony(first).score.notes.map(note => note.midi % 12));
  assert.ok(reaction.score.notes.every(note => originalClasses.has(note.midi % 12)));
  // A pause changes colour immediately but must not change tonic in the middle of a section.
  creation.observeMotion({ x: 0, y: 0, z: 0 }, 0, .3, true);
  assert.equal(root(creation.advance(measure - .1)) - 7, homeRoot);
  creation.advance(2 * measure - .1);
  creation.advance(3 * measure - .1);
  const changed = creation.advance(4 * measure - .1);
  assert.equal(root(changed) % 12, cityMusicKey(seed, 4, 'calm').tonic);
  assert.notEqual(root(changed) % 12, homeRoot % 12);
});
