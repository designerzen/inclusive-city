import type { SoundScore } from './SoundEffect';

export type MixPart = 'lead' | 'bass' | 'rhythm' | 'harmony' | 'backing' | 'bed' | 'effect';
export const mixTailSeconds = .65;
// Web Audio compressors each use a 6 ms lookahead. Both stages affect all parts equally.
export const mixLatencySeconds = .012;

export function mixPart(label = ''): MixPart {
  if (label.includes('city-bed')) return 'bed';
  if (label.includes('bass')) return 'bass';
  if (/pulse|kick|backbeat|hi-hat|percussion|attract:tick/.test(label)) return 'rhythm';
  if (label.includes('harmony')) return 'harmony';
  if (/counter|tango-piano|tango-strings/.test(label)) return 'backing';
  if (/melody|attract:discovery|attract:answer/.test(label)) return 'lead';
  return 'effect';
}

/** Sequential notes do not consume headroom together; overlapping notes do. */
export function instrumentGain(score: SoundScore) {
  const edges = score.notes.flatMap(note => [
    { at: note.start, change: 1 },
    { at: note.start + note.duration + score.voice.release, change: -1 },
  ]).sort((a, b) => a.at - b.at || a.change - b.change);
  let active = 0, peak = 1;
  for (const edge of edges) { active += edge.change; peak = Math.max(peak, active); }
  // Match oscillator RMS to a sine. Unison layers are correlated, so average them.
  const waveform = { sine: 1, triangle: Math.sqrt(1.5), sawtooth: Math.sqrt(1.5), square: Math.SQRT1_2 };
  return score.voice.gain * waveform[score.voice.waveform] / (Math.sqrt(peak) * score.voice.layers);
}

const parts: Record<MixPart, { level: number; room: number }> = {
  lead: { level: .65, room: .12 },
  bass: { level: .75, room: .025 },
  rhythm: { level: .85, room: .045 },
  harmony: { level: .95, room: .16 },
  backing: { level: .9, room: .12 },
  bed: { level: .8, room: .12 },
  effect: { level: .5, room: .06 },
};

/** Shared room, tone and dynamics for live playback and downloads. Volume follows the mix. */
export class AudioMix {
  private nodes: AudioNode[] = [];
  private buses = new Map<MixPart, GainNode>();
  private readonly impulse: AudioBuffer;
  private dry!: GainNode;
  private room!: ConvolverNode;

  constructor(private readonly context: BaseAudioContext, private readonly destination: AudioNode) {
    this.impulse = context.createBuffer(2, Math.ceil(context.sampleRate * mixTailSeconds), context.sampleRate);
    // Repeatable stereo room, without external samples or a random replay/export mismatch.
    for (let channel = 0; channel < 2; channel++) {
      const data = this.impulse.getChannelData(channel);
      let seed = 12345 + channel * 65537, energy = 0;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const t = i / data.length;
        data[i] = i < context.sampleRate * .012 ? 0 : (seed / 0xffffffff * 2 - 1) * Math.exp(-7 * t) * (1 - t);
        energy += data[i]! ** 2;
      }
      const scale = 1 / Math.sqrt(energy);
      for (let i = 0; i < data.length; i++) data[i] *= scale;
    }
    this.build();
  }

  private keep<T extends AudioNode>(node: T): T { this.nodes.push(node); return node; }
  private filter(type: BiquadFilterType, frequency: number, gain = 0, q = .7) {
    const node = this.keep(this.context.createBiquadFilter());
    node.type = type; node.frequency.value = Math.min(frequency, this.context.sampleRate * .45);
    node.gain.value = gain; node.Q.value = q;
    return node;
  }

  private build() {
    this.dry = this.keep(this.context.createGain());
    this.room = this.keep(this.context.createConvolver());
    this.room.normalize = false; this.room.buffer = this.impulse;
    const roomLowCut = this.filter('highpass', 180);
    const roomHighCut = this.filter('lowpass', 4800);
    this.room.connect(roomLowCut); roomLowCut.connect(roomHighCut); roomHighCut.connect(this.dry);
    const lowCut = this.filter('highpass', 28);
    const lowMid = this.filter('peaking', 320, -1.5, .8);
    const air = this.filter('highshelf', 4200, -1.5);
    const glue = this.keep(this.context.createDynamicsCompressor());
    glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2;
    glue.attack.value = .02; glue.release.value = .18;
    const makeup = this.keep(this.context.createGain()); makeup.gain.value = 1.7;
    const limiter = this.keep(this.context.createDynamicsCompressor());
    limiter.threshold.value = -4; limiter.knee.value = 3; limiter.ratio.value = 12;
    limiter.attack.value = .003; limiter.release.value = .1;
    // Transparent below .8; a final soft ceiling protects unusually dense arrangements.
    const ceiling = this.keep(this.context.createWaveShaper());
    const curve = new Float32Array(8193);
    for (let i = 0; i < curve.length; i++) {
      const x = i * 2 / (curve.length - 1) - 1, magnitude = Math.abs(x);
      curve[i] = Math.sign(x) * (magnitude <= .8 ? magnitude : .8 + .15 * (1 - Math.exp(-(magnitude - .8) / .15)));
    }
    ceiling.curve = curve;
    this.dry.connect(lowCut); lowCut.connect(lowMid); lowMid.connect(air);
    air.connect(glue); glue.connect(makeup); makeup.connect(limiter); limiter.connect(ceiling); ceiling.connect(this.destination);
  }

  input(label?: string) {
    const part = mixPart(label);
    let bus = this.buses.get(part);
    if (bus) return bus;
    bus = this.keep(this.context.createGain()); bus.gain.value = parts[part].level;
    const tone = part === 'lead' ? this.filter('peaking', 2400, -2, .7)
      : part === 'bass' ? this.filter('lowpass', 1800)
      : part === 'rhythm' ? this.filter('highshelf', 6500, -2)
      : this.filter('highpass', part === 'effect' ? 70 : 110);
    const send = this.keep(this.context.createGain()); send.gain.value = parts[part].room;
    bus.connect(tone); tone.connect(this.dry); tone.connect(send); send.connect(this.room);
    this.buses.set(part, bus);
    return bus;
  }

  /** Drop buffered room/dynamics tails immediately on Stop or navigation. */
  reset() { this.dispose(); this.build(); }
  dispose() { this.nodes.forEach(node => node.disconnect()); this.nodes = []; this.buses.clear(); }
}
