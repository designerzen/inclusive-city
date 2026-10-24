import type { SoundScore } from './SoundEffect';

interface MelodyContext {
  phrase: number; beat: number; root: number;
  scale: readonly number[]; intervals: readonly number[];
}

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
    resonance: Math.min(12, (base.resonance ?? .7) * (.8 + colour * .4)),
    layers: base.layers ?? (colour > .55 ? 2 : 1),
    spread: base.spread ?? 3 + colour * 21,
    vibratoDepth: base.vibratoDepth ?? colour * 7,
    vibratoRate: base.vibratoRate ?? 3 + colour * 4,
  });
  /** A bounded identity signal on every AI bar, alongside the recent-history primer.
   * Inspired by Edwards et al. (2026); this is score shaping, not learned cross-attention.
   */
  const conditionMelody = (source: SoundScore['notes'], motif: SoundScore['notes'], context: MelodyContext): SoundScore['notes'] => {
    return source.map(note => {
      let midi = note.midi;
      const beatPosition = note.start / context.beat;
      // Leave offbeat passing notes and the model's timing/rests intact.
      if (motif.length && Math.abs(beatPosition - Math.round(beatPosition)) < 1e-6) {
        const anchor = motif.reduce((best, candidate) => candidate.start <= note.start && candidate.start >= best.start ? candidate : best, motif[0]!);
        // A quarter-strength pull, limited to three semitones, keeps the continuation dominant.
        const target = midi + .25 * Math.max(-12, Math.min(12, anchor.midi - midi));
        const allowed = beatPosition === 0 ? context.intervals : context.scale;
        const classes = new Set(allowed.map(interval => ((context.root + interval) % 12 + 12) % 12));
        const candidates = Array.from({ length: 7 }, (_, i) => midi + i - 3)
          .filter(pitch => pitch >= 0 && pitch <= 127 && classes.has(pitch % 12));
        if (candidates.length) midi = candidates.reduce((best, candidate) =>
          Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best);
      }
      const index = ((context.phrase % 4) * 4 + Math.floor(beatPosition)) % articulation.length;
      // Shorten by at most 15%; never fill a generated rest or cross the bar boundary.
      const gate = .85 + .15 * (articulation[index]! - .65) / .7;
      return { ...note, midi, duration: Math.max(.001, note.duration * gate) };
    });
  };
  return { contour, articulation, voice, conditionMelody };
}
