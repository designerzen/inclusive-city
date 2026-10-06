import type { SoundSequenceEntry } from './SoundEffect';

/** Resume held notes and future notes without replaying anything before the playhead. */
export function seekSequence(sequence: readonly SoundSequenceEntry[], offset: number, origin = sequence[0]?.at ?? 0): SoundSequenceEntry[] {
  if (!Number.isFinite(offset) || offset < 0) throw new RangeError('Invalid playback offset.');
  return sequence.flatMap(entry => {
    const relative = entry.at - origin - offset;
    const notes = entry.score.notes.flatMap(note => {
      const start = relative + note.start, end = start + note.duration;
      if (end <= 0) return [];
      return [{ ...note, start: Math.max(0, start - Math.max(0, relative)), duration: Math.max(.001, end - Math.max(0, start)) }];
    });
    return notes.length ? [{ ...entry, at: Math.max(0, relative), score: { ...entry.score, voice: { ...entry.score.voice }, notes } }] : [];
  });
}
