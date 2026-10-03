import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CityMidiOutput } from '../src/audio/MidiOutput';
import { SoundEffect } from '../src/audio/SoundEffect';
import { createAttractScore } from '../src/audio/attractMusic';
import { CitySounds } from '../src/audio/CitySounds';

function device(t: Parameters<Parameters<typeof test>[1]>[0]) {
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const sent: { data: number[]; at?: number }[] = [];
  let clears = 0;
  const port = { id: 'synth', name: 'Test synth', state: 'connected', send: (data: number[], at?: number) => sent.push({ data: [...data], at }), clear: () => { clears++; } };
  const access = { outputs: new Map([[port.id, port]]), onstatechange: null as (() => void) | null };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { requestMIDIAccess: async (options: unknown) => { assert.deepEqual(options, { sysex: false }); return access; } } });
  const midi = new CityMidiOutput();
  t.after(() => { midi.dispose(); if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else Reflect.deleteProperty(globalThis, 'navigator'); });
  return { midi, port, access, sent, get clears() { return clears; }, advance(value: number) { now = value; (midi as any).pump(); } };
}

const phrase = (duration = .2) => [{ at: 0, score: new SoundEffect({ intervals: [0], durationBeats: duration * 2 }).toScore() }];

test('MIDI preserves pitch, sequence offset and duration with timestamped lookahead', async t => {
  const d = device(t); await d.midi.connect(); d.midi.select('synth'); d.midi.setChannel(4);
  const score = phrase();
  d.midi.schedule([{ ...score[0]!, at: .5 }], 1050, .55);
  assert.equal(d.sent.length, 0);
  d.advance(1480);
  assert.deepEqual(d.sent[0], { data: [0x93, 60, 42], at: 1550 });
  d.advance(1680);
  assert.deepEqual(d.sent[1], { data: [0x83, 60, 0], at: 1750 });
});

test('stop cancels queued notes and silences the selected channel', async t => {
  const d = device(t); await d.midi.connect(); d.midi.select('synth');
  d.midi.schedule(phrase(5), 1050, 1);
  const clears = d.clears;
  d.midi.stop();
  assert.ok(d.clears > clears);
  assert.deepEqual(d.sent.slice(-3).map(message => message.data), [[0xb0, 64, 0], [0xb0, 123, 0], [0xb0, 120, 0]]);
  const count = d.sent.length; d.advance(10000); assert.equal(d.sent.length, count);
});

test('overlapping pitches stay held until the surviving voice ends when one handle stops', async t => {
  const d = device(t); await d.midi.connect(); d.midi.select('synth');
  const first = d.midi.schedule(phrase(.3), 1050, 1);
  d.midi.schedule(phrase(.5), 1100, 1);
  d.advance(1200); d.sent.length = 0; first.stop();
  assert.equal(d.sent.length, 0);
  d.advance(1530);
  assert.deepEqual(d.sent, [{ data: [0x80, 60, 0], at: 1600 }]);
});

test('all theme notes remain scheduled locally until their musical moment', async t => {
  const d = device(t); await d.midi.connect(); d.midi.select('synth');
  const score = createAttractScore();
  d.midi.schedule(score, 1050, 1);
  assert.ok(d.sent.length > 0);
  assert.ok(d.sent.every(message => message.at! <= 1075));
  for (let time = 1025; time <= 10000; time += 25) d.advance(time);
  const pitches = new Set(d.sent.filter(message => message.data[0] === 0x90).map(message => message.data[1]));
  for (const entry of score) for (const note of entry.score.notes) assert.ok(pitches.has(note.midi));
  assert.equal(d.sent.filter(message => message.data[0] === 0x90).length, score.reduce((sum, entry) => sum + entry.score.notes.length, 0));
});

test('device removal retains enabled MIDI and automatically restores the selected output', async t => {
  const d = device(t); await d.midi.connect(); d.midi.select('synth'); d.midi.schedule(phrase(), 1050, 1);
  d.port.state = 'disconnected'; d.access.onstatechange?.();
  assert.equal(d.midi.outputId, 'synth'); assert.equal(d.midi.outputs.length, 0);
  assert.equal(d.midi.isEnabled, true);
  d.port.state = 'connected'; d.access.onstatechange?.();
  assert.match(d.midi.status, /Sending/);
  d.sent.length = 0; d.midi.schedule(phrase(), 1050, 1);
  assert.equal(d.sent[0]!.data[0], 0x90);
});

test('denied access can be retried without disabling browser audio controls', async t => {
  const d = device(t);
  t.mock.method(navigator, 'requestMIDIAccess', async () => { throw new Error('denied'); });
  await d.midi.connect(); assert.match(d.midi.status, /denied/);
  assert.equal(d.midi.isEnabled, false);
});

test('MIDI stays enabled through stop, refresh and channel changes until explicit disconnect', async t => {
  const d = device(t); await d.midi.connect();
  assert.equal(d.midi.outputId, 'synth'); assert.equal(d.midi.isEnabled, true);
  d.midi.stop(); d.midi.setChannel(8); await d.midi.connect();
  assert.equal(d.midi.isEnabled, true); assert.equal(d.midi.outputId, 'synth');
  assert.equal(d.midi.midiChannel, 8);
  d.midi.disconnect();
  assert.equal(d.midi.isEnabled, false);
  d.access.onstatechange?.(); d.sent.length = 0;
  d.midi.schedule(phrase(), 1050, 1); assert.equal(d.sent.length, 0);
  await d.midi.connect(); d.midi.schedule(phrase(), 1050, 1);
  assert.equal(d.sent[0]!.data[0], 0x97);
});

test('disconnect while permission is pending prevents late automatic activation', async t => {
  const d = device(t);
  let resolve!: (access: unknown) => void;
  t.mock.method(navigator, 'requestMIDIAccess', () => new Promise(done => { resolve = done; }));
  const pending = d.midi.connect(); d.midi.disconnect(); resolve(d.access); await pending;
  assert.equal(d.midi.isEnabled, false); assert.equal(d.midi.status, 'MIDI is off.');
  d.midi.schedule(phrase(), 1050, 1); assert.equal(d.sent.length, 0);
});

test('mute, zero volume, stop and disposal clear MIDI as well as browser playback', t => {
  const sounds = new CitySounds(); let stops = 0;
  t.mock.method(sounds.midi, 'stop', () => { stops++; });
  sounds.setMuted(true); sounds.setVolume(0); sounds.stop(); sounds.dispose();
  assert.equal(stops, 5);
});

test('robot cues and replay translate the same audio start into the performance clock', t => {
  const sounds = new CitySounds();
  const context = { currentTime: 10, state: 'running', getOutputTimestamp: () => ({ contextTime: 9.98, performanceTime: 1000 }) };
  (sounds as any).context = context; (sounds as any).master = {};
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } });
  t.after(() => { (sounds as any).context = null; sounds.dispose(); if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else Reflect.deleteProperty(globalThis, 'document'); });
  const audioStarts: number[] = []; const midiStarts: number[] = []; const offsets: number[][] = [];
  t.mock.method(SoundEffect, 'scheduleSequence', (_context, _destination, sequence, when) => { audioStarts.push(when!); offsets.push(sequence.map(entry => entry.at)); return { stop() {} }; });
  t.mock.method(sounds.midi, 'schedule', (_sequence, when) => { midiStarts.push(when); return { stop() {} }; });
  sounds.mood('happy'); sounds.perform([{ ...phrase()[0]!, at: 5 }]);
  assert.deepEqual(audioStarts, [10.015, 10.05]);
  assert.ok(Math.abs(midiStarts[0]! - 1035) < .001);
  assert.ok(Math.abs(midiStarts[1]! - 1070) < .001);
  sounds.perform([{ ...phrase()[0]!, at: 5.1 }, { ...phrase()[0]!, at: 5.4 }], 5);
  assert.ok(Math.abs(offsets[2]![0]! - .1) < 1e-8);
  assert.ok(Math.abs(offsets[2]![1]! - .4) < 1e-8);
  assert.ok(Math.abs(midiStarts[2]! - 1070) < .001);
});
