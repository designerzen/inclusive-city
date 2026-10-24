import type { SoundSequenceEntry } from '../audio/SoundEffect';
import { JourneyDance } from './journeyDance';
import type { DancePose } from './journeyDance';

export type DuetPhase = 'stopped' | 'song' | 'listening' | 'thinking' | 'queued' | 'answer';
interface Note { midi: number; start: number; end: number }
const notesFrom = (score: readonly SoundSequenceEntry[], origin: number): Note[] => score
  .filter(entry => !/(?:^|:)(?:drums?|percussion|pulse|techno-kick|backbeat|hi-hat)(?=:|$)/.test(entry.label ?? ''))
  .flatMap(entry => entry.score.notes.map(note => ({ midi: note.midi,
    start: entry.at - origin + note.start, end: entry.at - origin + note.start + note.duration })));

/** Shared story and choreography, sampled on the audible song clock, including live replies. */
export class ExhibitionDuet {
  private song: Note[] = [];
  private dance: JourneyDance;
  private users: Note[] = [];
  private heardUntil = -Infinity;
  private preparing = false;
  private reply: { notes: Note[]; dance: JourneyDance; start: number; end: number } | null = null;

  constructor(private readonly bpm: number, private readonly beats: number, score: readonly SoundSequenceEntry[]) {
    this.dance = new JourneyDance(score, bpm, beats);
    this.setSong(score);
  }

  setSong(score: readonly SoundSequenceEntry[]) {
    this.song = notesFrom(score, score[0]?.at ?? 0);
    this.dance = new JourneyDance(score, this.bpm, this.beats);
  }

  hear(entry: SoundSequenceEntry, percussion = false) {
    this.heardUntil = entry.at + 120 / this.bpm;
    if (!percussion) this.users = [...this.users.filter(note => note.end > entry.at - 1), ...notesFrom([entry], 0)].slice(-128);
  }

  think(value: boolean) { this.preparing = value; }
  answer(score: readonly SoundSequenceEntry[], start: number, end: number) {
    this.preparing = false;
    this.reply = { notes: notesFrom(score, 0), dance: new JourneyDance(score, this.bpm, this.beats, 0), start, end };
  }
  reset() { this.users = []; this.heardUntil = -Infinity; this.preparing = false; this.reply = null; }

  frame(time: number, playing: boolean, reducedMotion = false) {
    const reply = this.reply;
    const phase: DuetPhase = !playing ? 'stopped'
      : reply && time >= reply.start && time < reply.end ? 'answer'
      : this.preparing ? 'thinking'
      : reply && time < reply.start ? 'queued'
      : time < this.heardUntil ? 'listening' : 'song';
    const activeNotes = (notes: Note[]) => playing ? notes.filter(note => note.start <= time && note.end > time) : [];
    const robot = activeNotes(phase === 'answer' ? reply!.notes : this.song);
    const user = activeNotes(this.users);
    const pose: DancePose = (phase === 'answer' ? reply!.dance : this.dance).pianoPose(time, playing, reducedMotion);
    // Each hand follows its own note register and onset, rather than a generic beat wave.
    const hands = (left: boolean) => {
      const notes = robot.filter(note => (note.midi < 66) === left);
      const pitch = notes.length ? notes.reduce((sum, note) => sum + note.midi, 0) / notes.length : left ? 55 : 74;
      const strike = notes.reduce((value, note) => Math.max(value, Math.exp(-(time - note.start) * 18)), 0);
      return { swing: !playing ? .35 : 1.17 + (notes.length ? .08 : 0) + strike * .12,
        reach: Math.max(-.35, Math.min(.35, (pitch - (left ? 55 : 74)) * .018)) };
    };
    const left = hands(true), right = hands(false);
    if (!reducedMotion && playing) {
      if (phase === 'listening') { pose.headYaw = -.2; pose.headTilt = .12; pose.headNod = .1; right.swing = .8; pose.rightArm = .4; }
      if (phase === 'thinking') { pose.headNod = -.12; pose.headTilt = -.1; pose.antenna = .25; right.swing = .85; }
      if (phase === 'queued') { pose.headNod = .08; right.swing = 1.05; }
      if (phase === 'answer') { pose.headNod += .08; }
      pose.leftArm += left.reach; pose.rightArm += right.reach;
    }
    return { phase, pose,
      leftSwing: reducedMotion ? 1.2 : left.swing, rightSwing: reducedMotion ? 1.2 : right.swing,
      robotKeys: reducedMotion ? [] : robot.map(note => note.midi),
      userKeys: reducedMotion ? [] : user.map(note => note.midi) };
  }
}

export const duetStory: Record<DuetPhase, { title: string; detail: string }> = {
  stopped: { title: 'Ready for our duet?', detail: 'Start the song or play a note to join me.' },
  song: { title: 'I’m playing. Join me!', detail: 'Add a beat or a melody. My keys glow green; your notes glow blue.' },
  listening: { title: 'I hear you!', detail: 'Keep playing. When you’re ready, ask me to answer your melody.' },
  thinking: { title: 'Let me answer that…', detail: 'I’m making a melody from yours. Keep the beat with me.' },
  queued: { title: 'My turn on the next bar!', detail: 'Watch my hands and the green keys. You can keep playing too.' },
  answer: { title: 'Here’s my answer to you!', detail: 'This melody grew from your notes. Let’s play it together.' },
};
