import { SoundEffect } from './SoundEffect';
import type { SoundSequenceEntry } from './SoundEffect';
import type { AccompanimentRequest } from './magentaProtocol';

/** Use the actual recorded chord, including modulations and suspended voicings. */
export function jamHarmony(score: readonly SoundSequenceEntry[], seconds: number) {
  const at = (score[0]?.at ?? 0) + seconds;
  const chords = score.filter(entry => entry.label?.includes(':harmony:') || entry.label?.includes(':city-bed:'));
  const chord = chords.filter(entry => entry.at <= at).sort((a, b) => b.at - a.at)[0] ?? chords[0];
  const pitches = chord?.score.notes.map(note => Math.round(note.midi)) ?? [60, 64, 67];
  const root = pitches[0]!;
  const intervals = [...new Set(pitches.map(pitch => ((pitch - root) % 12 + 12) % 12))];
  const name = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][root % 12]!;
  const suffix = intervals.includes(3) ? intervals.includes(6) ? 'dim' : 'm'
    : intervals.includes(4) ? '' : intervals.includes(2) ? 'sus2' : 'sus4';
  return { root, intervals, chord: name + suffix };
}

/** Conservative harmony assist: nearest chord tone, retaining the player's register. */
export function tuneJamNote(note: number, harmony: ReturnType<typeof jamHarmony>) {
  const allowed = new Set(harmony.intervals.map(interval => (harmony.root + interval) % 12));
  return Array.from({ length: 128 }, (_, pitch) => pitch).filter(pitch => allowed.has(pitch % 12))
    .reduce((best, pitch) => Math.abs(pitch - note) < Math.abs(best - note) ? pitch : best);
}

export function jamKeyboardNote(index: number, harmony: ReturnType<typeof jamHarmony>) {
  const intervals = [...harmony.intervals].sort((a, b) => a - b);
  return Math.min(127, 60 + harmony.root % 12 + intervals[index % intervals.length]! + 12 * Math.floor(index / intervals.length));
}

export interface JamNote { pitch: number; at: number }
/** A bounded two-bar melody, excluding percussion, with simultaneous notes reduced to one. */
export function jamPrimer(notes: readonly JamNote[], bpm: number, beats: number, chord: string): AccompanimentRequest | undefined {
  if (!notes.length) return;
  const step = 60 / bpm / 4, steps = Math.min(32, beats * 8);
  const latest = Math.round(notes[notes.length - 1]!.at / step);
  const origin = Math.max(0, latest - steps + 1);
  const byStep = new Map<number, number>();
  for (const note of notes.slice(-128)) {
    const at = Math.round(note.at / step) - origin;
    let pitch = note.pitch;
    while (pitch < 48) pitch += 12;
    while (pitch > 83) pitch -= 12;
    if (at >= 0 && at < steps) byStep.set(at, pitch);
  }
  const melody = [...byStep].sort((a, b) => a[0] - b[0]);
  return { chord, chords: Array(6).fill(chord), primerSteps: steps, steps: Math.min(64, beats * 16), temperature: .7,
    notes: melody.map(([at, pitch], i) => ({ pitch, quantizedStartStep: at,
      quantizedEndStep: Math.min(at + 2, melody[i + 1]?.[0] ?? steps) })) };
}

/** Repeat the closing sixteen bars on bar boundaries, preserving the robot's voices. */
export function extendExhibitionSong(score: SoundSequenceEntry[], bpm: number, seconds = 180, beats = 4) {
  if (!score.length) return;
  const bar = beats * 60 / bpm, origin = score[0]!.at;
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
