import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SoundEffect } from '../src/audio/SoundEffect';
import { timbres } from '../src/audio/timbres';
import { robotMusicalIdentity } from '../src/audio/robotMusicalIdentity';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { voiceCityObject } from '../src/audio/cityInstruments';

test('all timbres roundtrip with detached spectra and filter envelopes, including legacy scores', () => {
  for (const voice of Object.values(timbres)) {
    const score = new SoundEffect(voice).toScore();
    const restored = SoundEffect.fromScore(JSON.parse(JSON.stringify(score)));
    assert.deepEqual(restored.toScore(), score);
    if (score.voice.partials) score.voice.partials[0] = 0;
    if (score.voice.filterEnvelope) score.voice.filterEnvelope.octaves = 0;
    assert.deepEqual(restored.toScore(), new SoundEffect(voice).toScore());
  }
  const legacy = new SoundEffect().toScore();
  assert.equal(legacy.voice.partials, undefined);
  assert.equal(legacy.voice.filterEnvelope, undefined);
  assert.deepEqual(SoundEffect.fromScore(legacy).toScore(), legacy);
});

test('invalid spectra and filter sweeps fail before any audio nodes can be created', () => {
  for (const partials of [[], [0, 0], [NaN], [Infinity], [-1], [1.1], Array(33).fill(1)])
    assert.throws(() => new SoundEffect({ partials }), RangeError);
  for (const filterEnvelope of [{ octaves: 5, decay: .1 }, { octaves: NaN, decay: .1 }, { octaves: 1, decay: 0 }])
    assert.throws(() => new SoundEffect({ filterEnvelope }), RangeError);
});

test('overlapping notes share a periodic wave but have independent filter sweeps and cleanup', () => {
  const nodes: any[] = [], waves: any[] = [];
  const create = () => {
    const param = () => ({ value: 0, events: [] as number[][],
      setValueAtTime(value: number, time: number) { this.events.push([value, time]); },
      linearRampToValueAtTime(value: number, time: number) { this.events.push([value, time]); },
      exponentialRampToValueAtTime(value: number, time: number) { this.events.push([value, time]); } });
    const node: any = { frequency: param(), gain: param(), detune: param(), Q: param(), pan: param(), delayTime: param(),
      connections: [], disconnected: false, stopped: false,
      connect(target: unknown) { this.connections.push(target); }, disconnect() { this.disconnected = true; },
      start() {}, stop() { this.stopped = true; }, setPeriodicWave(wave: unknown) { this.wave = wave; } };
    nodes.push(node); return node;
  };
  const context = { currentTime: 0, sampleRate: 24000, createGain: create, createOscillator: create,
    createBiquadFilter: create, createStereoPanner: create, createDelay: create,
    createPeriodicWave(real: Float32Array, imaginary: Float32Array) {
      const wave = { real, imaginary }; waves.push(wave); return wave;
    } } as unknown as BaseAudioContext;
  const effect = new SoundEffect({ ...timbres.nylon, intervals: [0, 4], pattern: 'up', stepBeats: .1, layers: 2 });
  const handle = effect.schedule(context, {} as AudioNode, 3);
  assert.equal(waves.length, 1);
  assert.deepEqual(Array.from(waves[0].imaginary), [0, ...timbres.nylon.partials].map(Math.fround));
  assert.equal(nodes.filter(node => node.wave === waves[0]).length, 4);
  const filters = nodes.filter(node => node.type === 'lowpass' && node.frequency.events.length);
  assert.equal(filters.length, 2);
  assert.equal(filters[0].frequency.events[0][1], 3);
  assert.equal(filters[1].frequency.events[0][1], 3.05);
  assert.equal(filters[0].frequency.events.at(-1)[0], timbres.nylon.cutoff);
  handle.stop();
  assert.ok(nodes.every(node => node.disconnected));
});

test('robot identity retains instrument-specific unison, articulation and vibrato', () => {
  for (let seed = 0; seed < 64; seed++) {
    const identity = robotMusicalIdentity(seed);
    for (const voice of Object.values(timbres)) {
      const resolved = identity.voice(voice);
      assert.equal(resolved.layers, voice.layers);
      assert.equal(resolved.vibratoDepth, voice.vibratoDepth);
      assert.deepEqual(resolved.partials, 'partials' in voice ? voice.partials : undefined);
    }
  }
});

test('arrangements contrast their roles and city objects discard the source instrument spectrum', () => {
  for (const style of ['classical', 'folk', 'jazz', 'cinematic', 'irish', 'calypso', 'reggae'] as const) {
    const entries = new JourneyMusicComposer(style, 42, 50, { get: () => undefined }).preview(1);
    const lead = entries[0]!.score.voice;
    const harmony = entries.find(entry => entry.label?.includes(':harmony:'))!.score.voice;
    const spectrum = (voice: typeof lead) => JSON.stringify([voice.partials, voice.fm, voice.waveform]);
    assert.notEqual(spectrum(lead), spectrum(harmony), style);
  }
  const source = new SoundEffect(timbres.strings).toScore();
  const bell = voiceCityObject(source, 'bell', 'test', .5);
  assert.equal(bell.voice.partials, undefined);
  assert.equal(bell.voice.filterEnvelope, undefined);
  assert.deepEqual(bell.voice.fm, timbres.glass.fm);
  const whistle = voiceCityObject(bell, 'whistle', 'test', .5);
  assert.equal(whistle.voice.fm, undefined);
  assert.deepEqual(whistle.voice.partials, timbres.flute.partials);
});
