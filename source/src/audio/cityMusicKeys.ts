import type { RobotMood } from './robotHarmony';

/** Compositional choices for this fictional city, not universal mood/key associations.
 * Intervals are relative to each composition's own tonic, so mood never forces every robot into C.
 */
export const cityMoodKeys: Record<RobotMood, { offset: number; mode: string }> = {
  calm: { offset: 5, mode: 'major' },
  curious: { offset: 2, mode: 'major with suspended colour' },
  determined: { offset: 7, mode: 'mixolydian' },
  uncertain: { offset: 7, mode: 'suspended' },
  frustrated: { offset: -3, mode: 'minor with diminished colour' },
  sad: { offset: -3, mode: 'minor' },
  relieved: { offset: 0, mode: 'major' },
  wonder: { offset: 5, mode: 'lydian' },
  happy: { offset: 0, mode: 'major' },
  celebrating: { offset: 2, mode: 'major' },
};

export function cityMusicKey(seed: number, phrase: number, mood?: RobotMood, cadence = false) {
  const home = ((seed >>> 5) % 12) - 5;
  const section = Math.max(0, Math.floor(phrase / 4));
  // Neither elapsed sections nor a closing cadence may initiate a modulation.
  const offset = mood ? cityMoodKeys[mood].offset : 0;
  const shift = ((offset + 6) % 12 + 12) % 12 - 6;
  return { transpose: home + shift, tonic: ((60 + home + shift) % 12 + 12) % 12,
    mode: mood ? cityMoodKeys[mood].mode : 'genre', section };
}
