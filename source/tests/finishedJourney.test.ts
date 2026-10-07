import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureFinishedJourney, musicDuration } from '../src/art/finishedJourney';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { CityJourney } from '../src/simulation/cityJourney';
import { BotHistory } from '../src/robot/botHistory';
import { SoundEffect } from '../src/audio/SoundEffect';
import { mixTailSeconds, mixLatencySeconds } from '../src/audio/AudioMix';

test('exhibitions capture the completed robot’s artwork and stay intact across another journey', () => {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current;
  const journey = new CityJourney(bot), creativity = new JourneyCreativity(bot);
  assert.throws(() => captureFinishedJourney(journey.machine.run), /Finish/);
  journey.explore('music-seed');
  for (let i = 0; i < 15 && !journey.complete; i++) {
    journey.update(1000);
    if (journey.blocked) journey.intervene(journey.blocked.id);
  }
  assert.ok(journey.complete);
  for (const event of journey.machine.record.events) creativity.consume(event);
  creativity.advance(1000, false);
  journey.machine.run.creative = { seed: creativity.seed, bpm: creativity.bpm, music: true, art: true, harmony: false, colour: false, marks: creativity.marks, score: creativity.score };
  const exhibition = captureFinishedJourney(journey.machine.run);
  assert.deepEqual(exhibition.robot.appearance, journey.machine.run.metadata.appearance);
  assert.deepEqual(exhibition.robot.profile, journey.machine.run.metadata.profile);
  assert.deepEqual(exhibition.artworkTitle, journey.machine.run.creative.title);
  const savedTitle = structuredClone(exhibition.artworkTitle);
  assert.equal(exhibition.name, bot.name); assert.equal(exhibition.steps, journey.metrics.stepsTaken);
  assert.deepEqual(exhibition.marks, creativity.marks); assert.deepEqual(exhibition.score, creativity.score);
  const before = structuredClone(exhibition);
  creativity.marks[0]!.pigment = '#000'; creativity.score.length = 0;
  assert.deepEqual(captureFinishedJourney(journey.machine.run).artworkTitle, savedTitle);
  journey.restart(); journey.bot.name = 'Another name';
  assert.deepEqual(exhibition, before);
});

test('playback duration includes later phrases, release and shared room tails, relative to the first phrase', () => {
  const effect = new SoundEffect({ durationBeats: 2, release: .4 });
  const score = [{ at: 20, score: effect.toScore() }, { at: 30, score: effect.toScore() }];
  assert.equal(musicDuration(score), 10 + effect.duration + mixTailSeconds + mixLatencySeconds);
  assert.equal(musicDuration([]), 0);
});
