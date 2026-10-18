import type { SoundScore } from './SoundEffect';

export type CityInstrument = 'bell' | 'pluck' | 'water' | 'drum' | 'whistle' | 'robot';

export function objectSeed(id: string) {
  let seed = 2166136261;
  for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  return seed;
}

export const instrumentNames: Record<CityInstrument, string> = {
  bell: 'bell melody', pluck: 'plucked notes', water: 'rippling notes',
  drum: 'soft percussion', whistle: 'whistle phrase', robot: 'robot greeting',
};

/** Revoice a chord-aligned answer; object identity keeps its own rhythm and register. */
export function voiceCityObject(score: SoundScore, kind: CityInstrument, id: string, beat: number, automatic = false): SoundScore {
  const result = structuredClone(score), seed = objectSeed(id);
  const palettes = {
    bell: { waveform: 'sine', attack: .003, decay: .18, sustain: .08, release: .5, cutoff: 4800 },
    pluck: { waveform: 'triangle', attack: .004, decay: .08, sustain: .1, release: .12, cutoff: 2000 },
    water: { waveform: 'sine', attack: .035, decay: .16, sustain: .2, release: .4, cutoff: 1600 },
    drum: { waveform: 'sine', attack: .002, decay: .05, sustain: .02, release: .06, cutoff: 500 },
    whistle: { waveform: 'sine', attack: .04, decay: .09, sustain: .5, release: .2, cutoff: 2600 },
    robot: { waveform: 'triangle', attack: .012, decay: .08, sustain: .3, release: .15, cutoff: 3200 },
  } as const;
  Object.assign(result.voice, palettes[kind], { gain: automatic ? .045 : .12, layers: 1,
    echoGain: kind === 'water' ? .18 : .06, echoTime: beat / 2 });
  delete result.voice.fm;
  const pitches = [...new Set(score.notes.map(n => n.midi))].slice(0, 3);
  result.notes = Array.from({ length: automatic ? 2 : 3 + seed % 2 }, (_, i) => ({
    midi: Math.max(24, Math.min(108, pitches[(i + seed) % pitches.length]! + (kind === 'drum' ? -36 : kind === 'bell' ? 12 : 0))),
    start: i * beat * (seed % 2 ? .25 : .5), duration: beat * (kind === 'whistle' ? .6 : .22),
  }));
  return result;
}

/** Stable eighth-note slots across four bars. Skipped frames never produce a catch-up burst. */
export function objectRhythmSlot(id: string) { return objectSeed(id) % 32; }

export function encounterVariation(id: string) { return objectSeed(id) % 3 + 1; }
export const encounterMelodies = ['rising melody', 'falling melody', 'playful answering melody'] as const;
