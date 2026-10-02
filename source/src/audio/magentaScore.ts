import type { SoundScore } from './SoundEffect';
import type { QuantizedNote } from './magentaProtocol';

/** Fold the response below the lead, resolve to the current chord, and clip it to one bar. */
export function magentaBackingNotes(notes: readonly QuantizedNote[], root: number, intervals: readonly number[], bpm: number): SoundScore['notes'] {
  const step = 60 / bpm / 4;
  return notes.slice(0, 64).flatMap(note => {
    if (![note.pitch, note.quantizedStartStep, note.quantizedEndStep].every(Number.isInteger)
      || note.pitch < 0 || note.pitch > 127 || note.quantizedStartStep < 0
      || note.quantizedStartStep >= 16 || note.quantizedEndStep <= note.quantizedStartStep) return [];
    const folded = root - 12 + ((note.pitch - root) % 12 + 12) % 12;
    const candidates = [-12, 0, 12].flatMap(octave => intervals.map(interval => root - 12 + octave + interval));
    const midi = candidates.reduce((best, candidate) => Math.abs(candidate - folded) < Math.abs(best - folded) ? candidate : best);
    return [{ midi, start: note.quantizedStartStep * step, duration: (Math.min(16, note.quantizedEndStep) - note.quantizedStartStep) * step }];
  });
}
