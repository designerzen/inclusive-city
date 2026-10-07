import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioMix, instrumentGain, mixPart, mixLatencySeconds } from '../src/audio/AudioMix';
import { SoundEffect } from '../src/audio/SoundEffect';
import { CitySounds } from '../src/audio/CitySounds';

const single = () => new SoundEffect({ intervals: [0], release: .02 }).toScore();

test('adding sequential notes does not turn an instrument down', () => {
  const score = single(), repeated = structuredClone(score);
  repeated.notes = Array.from({ length: 32 }, (_, i) => ({ ...score.notes[0]!, start: i }));
  assert.equal(instrumentGain(score), instrumentGain(repeated));
});

test('chords reserve headroom by concurrent voices and unison layers, with comparable oscillator RMS', () => {
  const score = single(), chord = structuredClone(score);
  chord.notes = [0, 4, 7, 12].map(interval => ({ ...score.notes[0]!, midi: 60 + interval }));
  assert.equal(instrumentGain(chord), instrumentGain(score) / 2);
  chord.voice.layers = 2;
  assert.equal(instrumentGain(chord), instrumentGain(score) / 4);
  const sine = { ...score, voice: { ...score.voice, waveform: 'sine' as const } };
  const square = { ...score, voice: { ...score.voice, waveform: 'square' as const } };
  assert.ok(Math.abs(instrumentGain(sine) / Math.sqrt(2) - instrumentGain(square)) < 1e-10);
  score.voice.gain = 0;
  assert.equal(instrumentGain(score), 0);
});

test('saved track labels consistently select their musical roles', () => {
  for (const [label, part] of [
    ['journey:melody:0:magenta', 'lead'], ['journey:donk-bass:1', 'bass'],
    ['journey:hi-hat:1', 'rhythm'], ['journey:harmony:2', 'harmony'],
    ['journey:evolution-countermelody:5', 'backing'], ['journey:city-bed:5', 'bed'],
    ['journey:action:collision', 'effect'], ['attract:discovery', 'lead'],
  ] as const) assert.equal(mixPart(label), part);
});

function graph() {
  const nodes: any[] = [];
  const create = () => {
    const node: any = { connections: [], disconnected: false,
      connect(destination: unknown) { this.connections.push(destination); },
      disconnect() { this.disconnected = true; this.connections = []; } };
    for (const key of ['gain', 'frequency', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = { value: 0 };
    nodes.push(node); return node;
  };
  const context = { sampleRate: 8000, createGain: create, createBiquadFilter: create,
    createConvolver: create, createDynamicsCompressor: create, createWaveShaper: create,
    createBuffer: (channels: number, length: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { getChannelData: (channel: number) => data[channel] };
    } } as unknown as BaseAudioContext;
  return { context, nodes };
}

test('Stop discards buffered mix tails, rebuilds reusable buses and disposal releases all nodes', () => {
  const g = graph(); const mix = new AudioMix(g.context, {} as AudioNode);
  const lead = mix.input('journey:melody:0');
  assert.equal(lead, mix.input('journey:melody:1'));
  const oldNodes = [...g.nodes]; mix.reset();
  assert.ok(oldNodes.every(node => node.disconnected));
  assert.notEqual(lead, mix.input('journey:melody:2'));
  mix.dispose();
  assert.ok(g.nodes.every(node => node.disconnected));
});

test('shared compressor latency is accounted for in MIDI and the audible playback clock', t => {
  const sounds = new CitySounds();
  t.mock.method(performance, 'now', () => 1000);
  const context = { currentTime: 10, state: 'running', getOutputTimestamp: () => ({ contextTime: context.currentTime, performanceTime: 1000 }) };
  (sounds as any).context = context; (sounds as any).master = {};
  (sounds as any).mix = { input: () => (sounds as any).master, reset() {}, dispose() {} };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } });
  t.mock.method(SoundEffect, 'scheduleSequence', () => ({ stop() {} }));
  let midiStart = 0;
  t.mock.method(sounds.midi, 'schedule', (_sequence, when) => { midiStart = when; return { stop() {} }; });
  t.after(() => { (sounds as any).context = null; sounds.dispose(); if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else Reflect.deleteProperty(globalThis, 'document'); });
  const playback = sounds.perform([{ at: 0, score: single() }])!;
  assert.ok(Math.abs(midiStart - (1050 + mixLatencySeconds * 1000)) < 1e-8);
  context.currentTime = 10.2;
  assert.ok(Math.abs(playback.elapsed() - (.15 - mixLatencySeconds)) < 1e-8);
});
