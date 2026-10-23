import { SoundEffect } from './SoundEffect';
import type { SoundSequenceEntry } from './SoundEffect';

/** Repeat the closing sixteen bars on bar boundaries, preserving the robot's voices. */
export function extendExhibitionSong(score: SoundSequenceEntry[], bpm: number, seconds = 180) {
  if (!score.length) return;
  const bar = 240 / bpm, origin = score[0]!.at;
  const end = Math.max(...score.map(entry => entry.at + Math.max(...entry.score.notes.map(note => note.start + note.duration))));
  const start = origin + Math.ceil((end - origin) / bar) * bar;
  const length = Math.min(16 * bar, Math.max(bar, start - origin));
  const phrase = score.filter(entry => entry.at >= start - length && entry.at < start);
  for (let offset = 0; offset < seconds; offset += length) {
    for (const entry of phrase) {
      const at = start + offset + entry.at - (start - length);
      if (at < start + seconds) score.push({ ...structuredClone(entry), at });
    }
  }
}

export const jamPads = [
  { name: 'Kick', key: 'z', midi: 36, root: 43, waveform: 'sine' as const, pitchBend: -24, cutoff: 600 },
  { name: 'Snare', key: 'x', midi: 38, root: 57, waveform: 'triangle' as const, pitchBend: -12, cutoff: 6500 },
  { name: 'Hi-hat', key: 'c', midi: 42, root: 108, waveform: 'square' as const, pitchBend: -2, cutoff: 12000 },
  { name: 'Tom', key: 'v', midi: 45, root: 50, waveform: 'sine' as const, pitchBend: -12, cutoff: 1600 },
];

export function jamEffect(note: number, velocity = 100, percussion = false) {
  const pad = percussion ? jamPads.find(pad => pad.midi === note) ?? jamPads[3]! : undefined;
  return new SoundEffect({ root: pad?.root ?? note, intervals: [0], waveform: pad?.waveform ?? 'triangle',
    pitchBend: pad?.pitchBend ?? 0, cutoff: pad?.cutoff ?? 4200, gain: .24 * Math.max(1, Math.min(127, velocity)) / 127,
    attack: .001, decay: .08, sustain: percussion ? 0 : .35, release: .08,
    durationBeats: percussion ? .15 : .5, echoGain: 0 });
}
