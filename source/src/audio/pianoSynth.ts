import { SoundEffect } from './SoundEffect';
import type { SoundSequenceEntry } from './SoundEffect';

/** Keep the composition intact, played through a soft, percussive electric piano. */
export function pianoSynthScore(score: readonly SoundSequenceEntry[]): SoundSequenceEntry[] {
  const voice = new SoundEffect({ waveform: 'triangle', gain: .16, attack: .004, decay: .24,
    sustain: .12, release: .22, layers: 2, spread: 3, cutoff: 3200, vibratoDepth: 0,
    echoTime: .16, echoGain: .08 }).toScore().voice;
  return score.map(entry => ({ ...entry, score: { version: 1, notes: structuredClone(entry.score.notes),
    voice: { ...voice, gain: Math.min(.2, entry.score.voice.gain), pan: entry.score.voice.pan } } }));
}
