import { AudioMix, instrumentGain, mixTailSeconds, mixLatencySeconds } from './AudioMix';

/** A versioned, JSON-safe score. Times are seconds relative to the effect start. */
export interface SoundScore {
  version: 1;
  notes: { midi: number; start: number; duration: number }[];
  voice: {
    waveform: 'sine' | 'triangle' | 'square' | 'sawtooth';
    gain: number; attack: number; decay: number; sustain: number; release: number;
    detune: number; layers: number; spread: number; pitchBend: number;
    vibratoRate: number; vibratoDepth: number; cutoff: number; resonance: number;
    pan: number; echoTime: number; echoGain: number;
  };
}

export interface SoundEffectConfig extends Partial<SoundScore['voice']> {
  root?: number;
  intervals?: readonly number[];
  inversion?: number;
  pattern?: 'chord' | 'up' | 'down' | 'up-down';
  bpm?: number;
  stepBeats?: number;
  durationBeats?: number;
  repeats?: number;
}

export interface SoundSequenceEntry { at: number; score: SoundScore; label?: string }

const defaults: SoundScore['voice'] = {
  waveform: 'triangle', gain: 0.18, attack: 0.012, decay: 0.09, sustain: 0.35,
  release: 0.16, detune: 0, layers: 1, spread: 6, pitchBend: 0,
  vibratoRate: 5, vibratoDepth: 0, cutoff: 4200, resonance: 0.7,
  pan: 0, echoTime: 0.16, echoGain: 0.12,
};

function range(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${name} must be between ${min} and ${max}.`);
  return value;
}

export function midiFrequency(midi: number) { return 440 * 2 ** ((midi - 69) / 12); }

/** Deterministic oscillator instrument shared by live and offline playback. No random values. */
export class SoundEffect {
  private readonly data: SoundScore;

  constructor(config: SoundEffectConfig = {}) {
    const root = range(config.root ?? 60, 0, 127, 'root');
    const intervals = [...(config.intervals ?? [0, 4, 7])];
    range(intervals.length, 1, 16, 'chord size');
    intervals.forEach(note => range(note, -48, 48, 'interval'));
    const inversion = range(config.inversion ?? 0, 0, intervals.length - 1, 'inversion');
    if (!Number.isInteger(inversion)) throw new RangeError('inversion must be an integer.');
    intervals.sort((a, b) => a - b);
    for (let i = 0; i < inversion; i++) intervals.push(intervals.shift()! + 12);
    const pattern = config.pattern ?? 'chord';
    if (!['chord', 'up', 'down', 'up-down'].includes(pattern)) throw new RangeError('Unknown pattern.');
    const pitches = pattern === 'down' ? intervals.reverse() : pattern === 'up-down' ? [...intervals, ...intervals.slice(0, -1).reverse()] : intervals;
    const beat = 60 / range(config.bpm ?? 120, 20, 400, 'bpm');
    const step = beat * range(config.stepBeats ?? 0.25, 0.01, 8, 'stepBeats');
    const duration = beat * range(config.durationBeats ?? 0.5, 0.05, 16, 'durationBeats');
    const repeats = range(config.repeats ?? 1, 1, 8, 'repeats');
    if (!Number.isInteger(repeats)) throw new RangeError('repeats must be an integer.');
    const voice = { ...defaults, echoTime: config.bpm === undefined ? defaults.echoTime : beat / 2 };
    for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
      if (config[key] !== undefined) Object.assign(voice, { [key]: config[key] });
    }
    const notes = Array.from({ length: repeats }, (_, repeat) => pitches.map((pitch, i) => ({
      midi: root + pitch,
      start: repeat * (pattern === 'chord' ? duration : pitches.length * step) + (pattern === 'chord' ? 0 : i * step),
      duration,
    }))).flat();
    this.data = SoundEffect.validate({ version: 1, notes, voice });
  }

  static fromScore(score: SoundScore): SoundEffect {
    const effect = new SoundEffect();
    // Validate and copy data so caller mutations cannot change subsequent playback.
    return Object.assign(effect, { data: SoundEffect.validate(score) });
  }

  private static validate(score: SoundScore): SoundScore {
    if (score.version !== 1) throw new RangeError('Unsupported sound score version.');
    range(score.notes.length, 1, 256, 'note count');
    for (const note of score.notes) {
      range(note.midi, 0, 127, 'midi'); range(note.start, 0, 120, 'start'); range(note.duration, 0.001, 48, 'duration');
    }
    const v = score.voice;
    if (!['sine', 'triangle', 'square', 'sawtooth'].includes(v.waveform)) throw new RangeError('Unknown waveform.');
    const bounds: Record<Exclude<keyof typeof v, 'waveform'>, [number, number]> = {
      gain: [0, 0.5], attack: [0.001, 4], decay: [0.001, 4], sustain: [0, 1], release: [0.005, 8],
      detune: [-1200, 1200], layers: [1, 4], spread: [0, 100], pitchBend: [-24, 24],
      vibratoRate: [0.1, 20], vibratoDepth: [0, 100], cutoff: [40, 20000], resonance: [0, 12],
      pan: [-1, 1], echoTime: [0.01, 2], echoGain: [0, 0.5],
    };
    for (const [key, bound] of Object.entries(bounds)) range(v[key as keyof typeof bounds], ...bound, key);
    if (!Number.isInteger(v.layers)) throw new RangeError('layers must be an integer.');
    return JSON.parse(JSON.stringify(score)) as SoundScore;
  }

  toScore(): SoundScore { return JSON.parse(JSON.stringify(this.data)) as SoundScore; }
  get duration() { return Math.max(...this.data.notes.map(n => n.start + n.duration)) + this.data.voice.release + this.data.voice.echoTime; }

  /** Schedules against the audio clock, never JS timers. Caller owns the destination. */
  schedule(context: BaseAudioContext, destination: AudioNode, when = context.currentTime) {
    // Past onsets must be skipped rather than played immediately off the music clock.
    range(when, 0, Number.MAX_VALUE, 'when');
    const { notes, voice: v } = this.data;
    const output = context.createGain();
    output.gain.value = instrumentGain(this.data);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = Math.min(v.cutoff, context.sampleRate / 2); filter.Q.value = v.resonance;
    const pan = context.createStereoPanner(); pan.pan.value = v.pan;
    output.connect(filter); filter.connect(pan); pan.connect(destination);
    const echo = context.createDelay(2); echo.delayTime.value = v.echoTime;
    const echoGain = context.createGain(); echoGain.gain.value = v.echoGain;
    pan.connect(echo); echo.connect(echoGain); echoGain.connect(destination);
    const nodes: AudioNode[] = [output, filter, pan, echo, echoGain];
    const sources: OscillatorNode[] = [];
    const cleanup = () => nodes.forEach(node => node.disconnect());
    // Schedule cleanup with the audio clock, including the delay tail (also works offline).
    const tail = context.createOscillator(); const silence = context.createGain(); silence.gain.value = 0;
    tail.connect(silence); silence.connect(destination); nodes.push(tail, silence); sources.push(tail);
    tail.onended = cleanup;
    tail.start(when); tail.stop(when + this.duration + 0.01);
    for (const note of notes) {
      const start = when + note.start, end = start + note.duration;
      if (start < context.currentTime) continue;
      for (let layer = 0; layer < v.layers; layer++) {
        const oscillator = context.createOscillator(); oscillator.type = v.waveform;
        const hz = midiFrequency(note.midi);
        oscillator.frequency.setValueAtTime(hz, start);
        oscillator.frequency.exponentialRampToValueAtTime(hz * 2 ** (v.pitchBend / 12), end);
        oscillator.detune.value = v.detune + (layer - (v.layers - 1) / 2) * v.spread;
        const envelope = context.createGain();
        const attack = Math.min(v.attack, note.duration * 0.4), decay = Math.min(v.decay, note.duration * 0.4);
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(1, start + attack);
        envelope.gain.linearRampToValueAtTime(v.sustain, start + attack + decay);
        envelope.gain.setValueAtTime(v.sustain, end);
        envelope.gain.linearRampToValueAtTime(0, end + v.release);
        oscillator.connect(envelope); envelope.connect(output); nodes.push(oscillator, envelope);
        if (v.vibratoDepth > 0) {
          const lfo = context.createOscillator(); lfo.frequency.value = v.vibratoRate;
          const depth = context.createGain(); depth.gain.value = v.vibratoDepth;
          lfo.connect(depth); depth.connect(oscillator.detune); nodes.push(lfo, depth); sources.push(lfo);
          lfo.start(start); lfo.stop(end + v.release);
        }
        sources.push(oscillator);
        oscillator.start(start); oscillator.stop(end + v.release);
      }
    }
    return { stop: () => { sources.forEach(source => { source.onended = null; try { source.stop(); } catch { /* Already ended. */ } }); cleanup(); } };
  }

  static scheduleSequence(context: BaseAudioContext, destination: AudioNode, sequence: readonly SoundSequenceEntry[], when = context.currentTime, route?: (entry: SoundSequenceEntry) => AudioNode) {
    // Validate the entire sequence before creating any audio nodes.
    const effects = sequence.map(entry => ({ at: range(entry.at, 0, 86400, 'sequence offset'), effect: SoundEffect.fromScore(entry.score) }));
    const handles = effects.map(({ at, effect }, index) => effect.schedule(context, route?.(sequence[index]!) ?? destination, when + at));
    return { stop: () => handles.forEach(handle => handle.stop()) };
  }

  static async renderSequence(sequence: readonly SoundSequenceEntry[], sampleRate = 44100): Promise<AudioBuffer> {
    const duration = Math.max(0.01, ...sequence.map(entry => entry.at + SoundEffect.fromScore(entry.score).duration));
    const context = new OfflineAudioContext(2, Math.ceil((duration + mixTailSeconds + mixLatencySeconds) * sampleRate), sampleRate);
    const master = context.createGain(); master.gain.value = .55; master.connect(context.destination);
    const mix = new AudioMix(context, master);
    SoundEffect.scheduleSequence(context, master, sequence, 0, entry => mix.input(entry.label));
    try { return await context.startRendering(); } finally { mix.dispose(); }
  }
}
