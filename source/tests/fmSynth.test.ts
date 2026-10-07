import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fmPatches } from '../src/audio/fmSynth';
import { SoundEffect } from '../src/audio/SoundEffect';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { pianoSynthScore } from '../src/audio/pianoSynth';
import { worldMusicStyles } from '../src/art/worldMusicStyles';

test('FM patches survive JSON and studio playback without aliasing; old scores stay unchanged', () => {
  const old = new SoundEffect().toScore();
  assert.equal(old.voice.fm, undefined);
  assert.deepEqual(SoundEffect.fromScore(old).toScore(), old);
  for (const fm of Object.values(fmPatches)) {
    const score = new SoundEffect({ waveform: 'sine', fm }).toScore();
    assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(score))).toScore(), score);
    const studio = pianoSynthScore([{ at: 0, score }]);
    assert.deepEqual(studio[0]!.score, score);
    studio[0]!.score.voice.fm!.index = 0;
    assert.equal(score.voice.fm!.index, fm.index);
  }
});

test('unsafe or incomplete FM patches are rejected before audio node creation', () => {
  for (const invalid of [{ ratio: 0 }, { index: NaN }, { index: 9 }, { attack: -1 }, { sustain: 2 }, { release: Infinity }])
    assert.throws(() => new SoundEffect({ fm: { ...fmPatches.warm, ...invalid } }), RangeError);
  const score = new SoundEffect().toScore();
  score.voice.fm = {} as any;
  assert.throws(() => SoundEffect.fromScore(score), /fm.ratio/);
});

test('generated arrangements include FM, with distinct lead patches and deterministic saved voices', () => {
  const noAI = { get: () => undefined };
  for (const style of ['melodic', 'classical', 'chiptune', 'jazz', 'lofi', 'electronic', 'chimes', 'synthwave', ...worldMusicStyles.map(s => s.id)] as const) {
    const preview = new JourneyMusicComposer(style, 42, 50, noAI).preview();
    assert.ok(preview.some(entry => entry.score.voice.fm), style);
    assert.deepEqual(preview, new JourneyMusicComposer(style, 42, 50, noAI).preview());
    for (const entry of preview) assert.deepEqual(SoundEffect.fromScore(entry.score).toScore(), entry.score);
  }
  for (const [style, patch] of [['jazz', fmPatches.electricPiano], ['chimes', fmPatches.bell], ['electronic', fmPatches.bright]] as const)
    assert.deepEqual(new JourneyMusicComposer(style, 42, 50, noAI).preview()[0]!.score.voice.fm, patch);
});

test('FM modulators follow note timing and are stopped and disconnected with their carriers', () => {
  const nodes: any[] = [];
  const create = () => {
    const param = () => ({ value: 0, events: [] as number[][],
      setValueAtTime(value: number, time: number) { this.events.push([value, time]); },
      linearRampToValueAtTime(value: number, time: number) { this.events.push([value, time]); },
      exponentialRampToValueAtTime(value: number, time: number) { this.events.push([value, time]); } });
    const node: any = { gain: param(), frequency: param(), detune: param(), Q: param(), pan: param(), delayTime: param(),
      connections: [], stops: [], disconnected: false,
      connect(target: unknown) { this.connections.push(target); }, disconnect() { this.disconnected = true; },
      start(time: number) { this.started = time; }, stop(time?: number) { this.stops.push(time); } };
    nodes.push(node); return node;
  };
  const context = { currentTime: 0, sampleRate: 44100, createGain: create, createOscillator: create,
    createBiquadFilter: create, createStereoPanner: create, createDelay: create } as unknown as BaseAudioContext;
  const effect = new SoundEffect({ root: 69, intervals: [0], waveform: 'sine', fm: fmPatches.bright, layers: 2 });
  const handle = effect.schedule(context, {} as AudioNode, 3);
  const modulators = nodes.filter(node => node.connections.some((target: unknown) => nodes.some(carrier => carrier.frequency === target)));
  assert.equal(modulators.length, 2, 'each layer has its own modulation depth node');
  for (const depth of modulators) {
    const modulator = nodes.find(node => node.connections.includes(depth));
    assert.equal(modulator.frequency.events[0][0], 880);
    assert.equal(modulator.started, 3);
    assert.equal(modulator.stops[0], 3 + .25 + effect.toScore().voice.release);
    assert.equal(depth.gain.events.at(-1)[0], 0);
  }
  handle.stop();
  assert.ok(nodes.every(node => node.disconnected));
  assert.ok(nodes.filter(node => node.started !== undefined).every(node => node.stops.includes(undefined)));
});
