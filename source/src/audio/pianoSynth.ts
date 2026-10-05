import type { SoundSequenceEntry } from './SoundEffect';

/** The studio keyboard plays each robot's saved synth patches, including its percussion. */
export function pianoSynthScore(score: readonly SoundSequenceEntry[]): SoundSequenceEntry[] {
  return structuredClone([...score]);
}
