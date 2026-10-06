import type { SoundSequenceEntry } from '../audio/SoundEffect';

const pitches = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const pitchName = (midi: number) => `${pitches[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
export const musicActionName = (cause: string) => ({
  journey_started: 'Journey started', blocked: 'Obstacle encountered', collision: 'Collision', intervention: 'Access improved',
  pickup: 'Discovery collected', exploration: 'New area explored', crossing_requested: 'Crossing requested',
  achievement: 'Achievement reached', arrived: 'Studio reached', journey_ended: 'Journey ended',
  paused: 'Robot paused', following: 'Robot resumed', step: 'Robot step', turn: 'Robot turned',
  climb: 'Robot climbed', descend: 'Robot descended', city_edit: 'City changed', segment: 'Route section reached',
  state_changed: 'Robot state changed',
} as Record<string, string>)[cause] ?? cause.replaceAll('_', ' ');

/** Cues use the scheduled score onsets; they are not a second music generator. */
export class CityMusicCues {
  private pending: { at: number; text: string; key: boolean }[] = [];
  add(score: readonly SoundSequenceEntry[]) {
    for (const entry of score) {
      const part = entry.label?.split(':')[1] ?? 'music';
      const action = part === 'action' ? musicActionName(entry.label!.split(':')[2]!) : part.replaceAll('-', ' ');
      for (const note of entry.score.notes) this.pending.push({ at: entry.at + note.start,
        text: `${action} · ${pitchName(note.midi)}`, key: false });
    }
    this.pending.sort((a, b) => a.at - b.at);
  }
  key(change: { at: number; tonic: number; mode: string; cause: string }) {
    this.pending.push({ at: change.at, text: `${musicActionName(change.cause)} → ${pitches[change.tonic]} · ${change.mode}`, key: true });
    this.pending.sort((a, b) => a.at - b.at);
  }
  advance(time: number) {
    const due = this.pending.filter(cue => cue.at <= time);
    this.pending = this.pending.filter(cue => cue.at > time);
    const groups = new Map<string, Set<string>>();
    for (const cue of due.filter(cue => !cue.key)) {
      const [part, pitch] = cue.text.split(' · ');
      const notes = groups.get(part!) ?? new Set<string>(); notes.add(pitch!); groups.set(part!, notes);
    }
    return { notes: [...groups].map(([part, notes]) => `${part}: ${[...notes].join(', ')}`).join(' · '),
      key: due.filter(cue => cue.key).at(-1)?.text };
  }
  clear() { this.pending = []; }
}
