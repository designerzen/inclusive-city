import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CitySounds } from '../src/audio/CitySounds';
import { SoundEffect } from '../src/audio/SoundEffect';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { musicianStyles } from '../src/art/artistStyles';
import { createAttractScore, attractBpm } from '../src/audio/attractMusic';

function clock(t: Parameters<Parameters<typeof test>[1]>[0]) {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } });
  const context = { currentTime: 10, state: 'running' };
  const sounds = new CitySounds();
  (sounds as any).context = context; (sounds as any).master = {};
  const batches: { sequence: any[]; when: number }[] = [];
  const timers: (() => void)[] = [];
  t.mock.method(globalThis, 'setInterval', (callback: any) => { timers.push(callback); return 1 as any; });
  t.mock.method(globalThis, 'clearInterval', () => {});
  t.mock.method(globalThis, 'setTimeout', () => 1 as any);
  t.mock.method(SoundEffect, 'scheduleSequence', (_ctx, _dest, sequence, when) => {
    batches.push({ sequence: structuredClone(sequence), when: when! }); return { stop() {} };
  });
  t.after(() => {
    (sounds as any).context = null; sounds.dispose();
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  return { context, sounds, batches, pump: () => timers.forEach(timer => timer()) };
}
const entry = (at: number) => ({ at, score: new SoundEffect({ pattern: 'up', intervals: [0, 4, 7] }).toScore() });

test('interaction notes and echoes follow the current song tempo and phase', t => {
  const c = clock(t); c.sounds.startMusic(90);
  c.context.currentTime = 10.237;
  c.sounds.button('city-repair');
  const batch = c.batches[0]!;
  const step = 60 / 90 / 4;
  for (const note of batch.sequence[0].score.notes) {
    const tick = (batch.when + note.start - 10.05) / step;
    assert.ok(Math.abs(tick - Math.round(tick)) < 1e-8);
    assert.ok(batch.when + note.start >= c.context.currentTime + .05);
  }
  assert.ok(Math.abs(batch.sequence[0].score.voice.echoTime / step - Math.round(batch.sequence[0].score.voice.echoTime / step)) < 1e-8);
});

test('live batches share an epoch even when callbacks arrive at different times', t => {
  const c = clock(t); c.sounds.startMusic(120);
  c.sounds.performLive([entry(0)]);
  c.context.currentTime = 10.41;
  c.sounds.performLive([entry(.5)]);
  assert.ok(Math.abs(c.batches[0]!.when - 10.05) < 1e-8);
  const second = c.batches[1]!;
  assert.ok(Math.abs(second.when + second.sequence[0]!.at - 10.55) < 1e-8);
  assert.ok(Math.abs(c.sounds.musicTime(120) - .36) < 1e-8);
});

test('a delayed playback callback drops missed onsets and preserves future notes', t => {
  const c = clock(t);
  c.sounds.perform([entry(1)], 0);
  c.context.currentTime = 11.12;
  c.pump();
  const batch = c.batches[0]!;
  assert.deepEqual(batch.sequence[0]!.score.notes.map((note: any) => note.midi), [64, 67]);
  assert.ok(Math.abs(batch.when + batch.sequence[0]!.at - 11.175) < 1e-8);
});

test('loop callback stalls retain the original measure phase and stop cancels pumping', t => {
  const c = clock(t); const stop = c.sounds.loop([entry(0)], 2, 120);
  assert.ok(Math.abs(c.batches[0]!.when - 10.05) < 1e-8);
  c.context.currentTime = 12.4; c.pump();
  assert.equal(c.batches.length, 1);
  c.context.currentTime = 13.95; c.pump();
  assert.ok(Math.abs(c.batches[1]!.when - 14.05) < 1e-8);
  stop(); c.context.currentTime = 15.95; c.pump();
  assert.equal(c.batches.length, 2);
});


test('audition and soundtrack echoes use musical subdivisions at each style tempo', () => {
  for (const style of musicianStyles) {
    const composer = new JourneyMusicComposer(style.id, 42, 50);
    for (const entry of composer.preview()) {
      if (!entry.score.voice.echoGain) continue;
      const ticks = entry.score.voice.echoTime / (60 / composer.bpm / 4);
      assert.ok(Math.abs(ticks - Math.round(ticks)) < 1e-8, `${style.id}: ${entry.label}`);
    }
  }
  for (const entry of createAttractScore()) {
    const ticks = entry.score.voice.echoTime / (60 / attractBpm / 4);
    assert.ok(Math.abs(ticks - Math.round(ticks)) < 1e-8);
  }
});
