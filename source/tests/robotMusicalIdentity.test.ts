import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { musicianStyles } from '../src/art/artistStyles';
import { robotHarmonies } from '../src/audio/robotHarmony';
import type { RobotMood } from '../src/audio/robotHarmony';
import { SoundEffect } from '../src/audio/SoundEffect';
import { pianoSynthScore } from '../src/audio/pianoSynth';
import { BotHistory } from '../src/robot/botHistory';
import type { RobotEvent } from '../src/robot/robotState';

const phrase = { at: 0, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: true };
const noAI = { get: () => undefined };

test('128 robots in each genre have distinct melodic contours and synth timbres, including studio replay', () => {
  for (const style of musicianStyles) {
    const contours = new Set<string>(), timbres = new Set<string>();
    for (let id = 1; id <= 128; id++) {
      const composer = new JourneyMusicComposer(style.id, Math.imul(id, 2654435761) >>> 0, 50, noAI);
      const lead = composer.compose(phrase)[0]!.score;
      // Ignore key, tempo and articulation: pitch contours themselves must differ.
      const motif = composer.preview().filter(entry => entry.label?.includes(':melody:')).flatMap(entry => entry.score.notes);
      contours.add(JSON.stringify(motif.map(note => note.midi - motif[0]!.midi)));
      const { gain, pan, echoTime, echoGain, ...timbre } = lead.voice;
      timbres.add(JSON.stringify(timbre));
      assert.deepEqual(composer.compose(phrase)[0]!.score, lead);
      assert.deepEqual(pianoSynthScore(composer.compose(phrase)), composer.compose(phrase));
      assert.doesNotThrow(() => SoundEffect.fromScore(lead));
    }
    assert.equal(contours.size, 128, `${style.id} repeats a melodic contour`);
    assert.equal(timbres.size, 128, `${style.id} repeats a timbre`);
  }
});

test('every emotional chord is distinct, replayable and shared by harmony, bed and reactions', () => {
  assert.equal(new Set(Object.values(robotHarmonies).map(value => JSON.stringify(value.intervals))).size, 10);
  for (const style of musicianStyles) {
    const composer = new JourneyMusicComposer(style.id, 42661, 50, noAI);
    for (const mood of Object.keys(robotHarmonies) as RobotMood[]) {
      const data = { ...phrase, mood, expression: { moving: false, turning: 0, slope: 0, paused: false, speed: 0 } };
      const score = composer.compose(data);
      const harmony = score.find(entry => entry.label?.includes(':harmony:'))!.score;
      const root = Math.min(...harmony.notes.map(note => note.midi));
      assert.deepEqual([...new Set(harmony.notes.map(note => note.midi - root))], [...robotHarmonies[mood].intervals]);
      const classes = new Set(harmony.notes.map(note => note.midi % 12));
      const reaction = composer.react('arrived', data).score;
      assert.ok(reaction.notes.filter(note => note.start === 0).length >= 4, 'Encounter has an audible chord');
      assert.ok(reaction.notes.every(note => classes.has(note.midi % 12)));
      for (const entry of [...score, { score: reaction }]) assert.doesNotThrow(() => SoundEffect.fromScore(entry.score));
    }
  }
});

test('blocked, repaired and arrived events change the live harmony and save the final celebration chord', () => {
  const creation = new JourneyCreativity(new BotHistory(['Curie', 'Einstein']).current);
  const event = (type: RobotEvent['type'], state: RobotEvent['state'], sequence: number): RobotEvent => ({
    type, state, sequence, botId: 1, runId: 1, time: 0, runTime: 0, edge: 0,
    position: { x: 0, y: 0, z: 0 }, data: {},
  });
  const measure = 4 * 60 / creation.bpm;
  const intervals = (score: ReturnType<JourneyCreativity['advance']>) => {
    const notes = score.find(entry => entry.label?.includes(':city-bed:'))!.score.notes;
    return notes.map(note => note.midi - notes[0]!.midi);
  };
  creation.consume(event('blocked', 'blocked', 1));
  assert.deepEqual(intervals(creation.advance(0)), [...robotHarmonies.frustrated.intervals]);
  creation.consume(event('intervention', 'following', 2));
  assert.deepEqual(intervals(creation.advance(measure)), [...robotHarmonies.relieved.intervals]);
  creation.consume(event('arrived', 'arrived', 3));
  const arrival = creation.advance(measure + .2, false, true).find(entry => entry.label === 'journey:action:arrived')!;
  assert.ok(arrival.score.notes.filter(note => note.start === 0).length >= 6);
  assert.ok(creation.score.some(entry => entry.label === arrival.label));
});
