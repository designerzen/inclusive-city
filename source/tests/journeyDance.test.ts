import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JourneyDance } from '../src/robot/journeyDance';
import { SoundEffect } from '../src/audio/SoundEffect';
import { CitySounds } from '../src/audio/CitySounds';

const score = () => [{ at: 10, score: new SoundEffect({ root: 72, intervals: [0, 4, 7], durationBeats: 8, release: .2 }).toScore() }];

test('dance follows the beat and note energy with no frame accumulation', () => {
  const a = new JourneyDance(score(), 120), b = new JourneyDance(JSON.parse(JSON.stringify(score())), 120);
  const pose = a.pose(.25);
  assert.ok(pose.energy > 0); assert.ok(pose.lift > a.pose(.5).lift);
  assert.notEqual(pose.leftArm, pose.rightArm);
  for (let i = 0; i < 120; i++) b.pose(i / 60);
  assert.deepEqual(a.pose(2), b.pose(2));
  assert.deepEqual(a.pose(.25), b.pose(.25));
  assert.ok(new JourneyDance(score(), 120, 3).pose(1).x !== a.pose(1).x);
});

test('stopping, silent gaps and reduced motion use a stable grounded presentation pose', () => {
  const dance = new JourneyDance(score(), 120);
  const rest = dance.pose(0, false);
  assert.equal(rest.lift, 0); assert.equal(rest.stretch, 1);
  assert.deepEqual(dance.pose(1, true, true), rest);
  assert.deepEqual(dance.pose(50), rest);
  assert.deepEqual(dance.pose(NaN), rest);
  assert.deepEqual(new JourneyDance([], 120).pose(1), rest);
});

test('playback exposes the audio output clock and freezes on suspension and stop', t => {
  const sounds = new CitySounds();
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const context = { currentTime: 10, state: 'running', getOutputTimestamp: () => ({ contextTime: context.currentTime - .1, performanceTime: now }) };
  (sounds as any).context = context; (sounds as any).master = {};
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } });
  t.mock.method(SoundEffect, 'scheduleSequence', () => ({ stop() {} }));
  t.mock.method(sounds.midi, 'schedule', () => ({ stop() {} }));
  t.after(() => { (sounds as any).context = null; sounds.dispose(); if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else Reflect.deleteProperty(globalThis, 'document'); });
  const playback = sounds.perform(score())!;
  assert.equal(playback.elapsed(), 0);
  now = 2000; context.currentTime = 11;
  assert.ok(Math.abs(playback.elapsed() - .85) < .001);
  context.state = 'suspended'; now = 10000;
  assert.ok(Math.abs(playback.elapsed() - .85) < .001);
  context.state = 'running'; context.currentTime = 12;
  assert.ok(Math.abs(playback.elapsed() - 1.85) < .001);
  playback.stop(); context.currentTime = 13;
  assert.ok(Math.abs(playback.elapsed() - 1.85) < .001);
});
