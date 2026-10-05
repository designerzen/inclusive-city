import type { SoundScore, SoundSequenceEntry } from './SoundEffect';
import type { QuantizedNote } from './magentaProtocol';

export interface MagentaPhraseOptions {
  beats?: number; offsetSteps?: number; role?: 'lead' | 'backing';
  scale?: readonly number[]; centre?: number; swing?: boolean;
}

/** Preserve contour and passing notes; constrain register and resolve strong downbeats. */
export function magentaPhraseNotes(notes: readonly QuantizedNote[], root: number, intervals: readonly number[], bpm: number,
  options: MagentaPhraseOptions = {}): SoundScore['notes'] {
  const steps = (options.beats ?? 4) * 4, offset = options.offsetSteps ?? 0, step = 60 / bpm / 4;
  const valid = notes.slice(0, 256).filter(note =>
    [note.pitch, note.quantizedStartStep, note.quantizedEndStep].every(Number.isInteger)
    && note.pitch >= 0 && note.pitch <= 127 && note.quantizedStartStep >= 0
    && note.quantizedEndStep > note.quantizedStartStep);
  const phrase = valid.filter(note => note.quantizedStartStep < offset + steps && note.quantizedEndStep > offset);
  if (!phrase.length) return [];
  const centre = options.centre ?? root + (options.role === 'lead' ? 18 : -6);
  // One octave translation for the phrase retains intervals, unlike folding every pitch class.
  const average = phrase.reduce((sum, note) => sum + note.pitch, 0) / phrase.length;
  const shift = Math.round((centre - average) / 12) * 12;
  const scale = options.scale ?? [0, 2, intervals.includes(3) ? 3 : 4, 5, 7, intervals.includes(3) ? 8 : 9, 10];
  const nearest = (pitch: number, allowed: readonly number[]) => {
    const octave = Math.floor((pitch - root) / 12);
    const candidates = [octave - 1, octave, octave + 1].flatMap(o => allowed.map(interval => root + o * 12 + interval));
    return candidates.reduce((best, candidate) => Math.abs(candidate - pitch) < Math.abs(best - pitch) ? candidate : best);
  };
  const swingStep = (value: number) => options.swing && value % 4 === 2 ? value + 2 / 3 : value;
  return phrase.map(note => {
    const start = Math.max(0, note.quantizedStartStep - offset), end = Math.min(steps, note.quantizedEndStep - offset);
    let midi = note.pitch + shift;
    while (midi < Math.max(0, centre - 18)) midi += 12;
    while (midi > Math.min(127, centre + 18)) midi -= 12;
    // Short weak-beat passing notes survive. Sustained notes stay in the selected scale.
    if (start === 0) midi = nearest(midi, intervals);
    else if (end - start >= 4) midi = nearest(midi, scale);
    const onset = swingStep(start), finish = swingStep(end);
    return { midi: Math.max(0, Math.min(127, midi)), start: onset * step, duration: Math.max(.001, (finish - onset) * step) };
  }).sort((a, b) => a.start - b.start);
}

export function magentaBackingNotes(notes: readonly QuantizedNote[], root: number, intervals: readonly number[], bpm: number,
  options: MagentaPhraseOptions = {}): SoundScore['notes'] {
  return magentaPhraseNotes(notes, root, intervals, bpm, { ...options, role: 'backing' });
}

/** Quantize actual lead phrases into a bounded, monophonic two-bar primer. */
export function magentaPrimer(score: readonly SoundSequenceEntry[], bpm: number, beats: number) {
  const lead = score.filter(entry => entry.label?.includes(':melody:'));
  const bars = [...new Set(lead.map(entry => entry.at))].sort((a, b) => a - b).slice(-2);
  const steps = Math.max(1, bars.length) * beats * 4, origin = bars[0] ?? 0, step = 60 / bpm / 4;
  const notes = lead.filter(entry => bars.includes(entry.at)).flatMap(entry => entry.score.notes.map(note => {
    let pitch = Math.round(note.midi);
    while (pitch < 48) pitch += 12;
    while (pitch > 83) pitch -= 12;
    const start = Math.max(0, Math.round((entry.at - origin + note.start) / step));
    return { pitch, quantizedStartStep: start,
      quantizedEndStep: Math.min(steps, Math.max(start + 1, Math.round((entry.at - origin + note.start + note.duration) / step))) };
  })).filter(note => note.quantizedStartStep < steps).sort((a, b) => a.quantizedStartStep - b.quantizedStartStep);
  const unique = notes.filter((note, i) => !i || note.quantizedStartStep !== notes[i - 1]!.quantizedStartStep);
  unique.forEach((note, i) => { note.quantizedEndStep = Math.min(note.quantizedEndStep, unique[i + 1]?.quantizedStartStep ?? steps); });
  return { notes: unique, steps, bars };
}
