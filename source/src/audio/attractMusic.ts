import { interactionSound, robotMoodSound } from './soundPresets';
import type { SoundSequenceEntry } from './SoundEffect';

export const attractBpm = 112;
export const attractLoopSeconds = 16 * 60 / attractBpm;

/** Four bars of syncopated game voices: bass, glassy taps and discovery arpeggios. */
export function createAttractScore(): SoundSequenceEntry[] {
  const beat = 60 / attractBpm;
  const sequence: SoundSequenceEntry[] = [];
  for (const [bar, root] of [48, 45, 53, 55].entries()) {
    const add = (offset: number, score: SoundSequenceEntry['score'], label: string) =>
      sequence.push({ at: (bar * 4 + offset) * beat, score, label });
    for (const offset of [0, 1.5, 2, 3.5]) {
      add(offset, interactionSound('tune', { root: root - 12, bpm: attractBpm, waveform: 'triangle', gain: .3, durationBeats: .35, cutoff: 850, release: .09 }).toScore(), 'attract:bass');
    }
    for (let step = 0; step < 8; step++) {
      add(step / 2, interactionSound('tap', { root: 84, intervals: [0], bpm: attractBpm, durationBeats: .06, gain: step % 2 ? .04 : .07, pitchBend: -12, cutoff: 6500 }).toScore(), 'attract:tick');
    }
    add(.75, interactionSound('next', { root: root + 12, intervals: bar === 1 ? [0, 3, 7] : [0, 4, 7], bpm: attractBpm, stepBeats: .25, durationBeats: .22, gain: .19, pan: -.25 }).toScore(), 'attract:discovery');
    add(2.5, robotMoodSound('curious', { root: root + 24, intervals: [0, 7, 12], bpm: attractBpm, stepBeats: .125, durationBeats: .15, gain: .12, pan: .3 }).toScore(), 'attract:answer');
  }
  return sequence.sort((a, b) => a.at - b.at);
}
