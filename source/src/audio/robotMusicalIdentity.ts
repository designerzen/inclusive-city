import type { SoundScore } from './SoundEffect';

/** Repeatable musical DNA. Independent draws avoid tiny families of transposed hooks. */
export function robotMusicalIdentity(seed: number) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const contour = Array.from({ length: 16 }, () => Math.floor(random() * 7) - 3);
  const articulation = Array.from({ length: 16 }, () => .65 + random() * .7);
  const colour = random();
  const waveform = (['sine', 'triangle', 'square', 'sawtooth'] as const)[Math.floor(random() * 4)]!;
  const voice = (base: Partial<SoundScore['voice']>): Partial<SoundScore['voice']> => ({
    ...base,
    // Identity colours the instrument; it must not replace the selected genre's instrument family.
    waveform: base.waveform ?? waveform,
    attack: Math.max(.001, (base.attack ?? .012) * (.6 + colour * 2)),
    decay: (base.decay ?? .09) * (.65 + colour),
    sustain: Math.min(.8, (base.sustain ?? .35) * (.5 + colour)),
    release: Math.max(.005, (base.release ?? .16) * (.7 + colour)),
    cutoff: (base.cutoff ?? 4200) * (.55 + colour * .8),
    resonance: .4 + colour * 3,
    layers: colour > .55 ? 2 : 1,
    spread: 3 + colour * 21,
    vibratoDepth: colour * 7,
    vibratoRate: 3 + colour * 4,
  });
  return { contour, articulation, voice };
}
