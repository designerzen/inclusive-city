import type { SoundSequenceEntry } from '../audio/SoundEffect';

export interface DancePose {
  x: number; yaw: number; lift: number; sway: number; stretch: number;
  headTilt: number; headYaw: number; headNod: number;
  leftArm: number; rightArm: number; armSwing: number; antenna: number; energy: number;
}

/** Choreography is a function of the saved score and audible time, never accumulated frames. */
export class JourneyDance {
  private readonly notes: { start: number; end: number; pitch: number; gain: number }[];
  private readonly tail: number;
  constructor(score: readonly SoundSequenceEntry[], private readonly bpm: number, private readonly beatsPerBar = 4) {
    const origin = score[0]?.at ?? 0;
    this.notes = score.flatMap(entry => entry.score.notes.map(note => ({
      start: entry.at - origin + note.start,
      end: entry.at - origin + note.start + note.duration + entry.score.voice.release,
      pitch: note.midi, gain: entry.score.voice.gain,
    }))).sort((a, b) => a.start - b.start);
    this.tail = Math.max(0, ...this.notes.map(note => note.end - note.start));
  }

  pose(seconds: number, playing = true, reducedMotion = false): DancePose {
    const rest: DancePose = { x: 0, yaw: -.16, lift: 0, sway: 0, stretch: 1, headTilt: -.04, headYaw: 0, headNod: 0,
      leftArm: -.15, rightArm: .15, armSwing: 0, antenna: 0, energy: 0 };
    if (!playing || reducedMotion || !Number.isFinite(seconds) || seconds < 0 || !this.notes.length) return rest;
    let lo = 0, hi = this.notes.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (this.notes[mid]!.start <= seconds) lo = mid + 1; else hi = mid; }
    let level = 0, pitch = 0, accent = 0;
    for (let i = lo - 1; i >= 0 && this.notes[i]!.start >= seconds - this.tail; i--) {
      const note = this.notes[i]!;
      if (seconds >= note.end) continue;
      const envelope = Math.min(1, (note.end - seconds) / .18);
      level += note.gain * envelope; pitch += note.pitch * note.gain * envelope;
      accent += Math.exp(-(seconds - note.start) * 12) * note.gain;
    }
    if (level <= .0001) return rest; // Silent gaps are rests in the choreography too.
    const energy = Math.min(1, level * 3), high = Math.max(0, Math.min(1, (pitch / level - 45) / 40));
    const beat = seconds * this.bpm / 60 * Math.PI * 2, bar = beat / this.beatsPerBar;
    const pulse = (1 - Math.cos(beat)) / 2;
    return { x: Math.sin(bar) * .2 * energy, yaw: rest.yaw + Math.sin(bar / 2) * .22 * energy,
      lift: pulse * .13 * energy, sway: Math.sin(beat / 2) * .12 * energy, stretch: 1 - Math.cos(beat) * .035 * energy,
      headTilt: rest.headTilt + Math.sin(beat / 2 + .4) * .16 * energy, headYaw: Math.sin(bar) * .2 * energy,
      headNod: pulse * .14 * energy,
      leftArm: -.15 - (.45 + Math.sin(bar + .6) * .35 + high * .3) * energy,
      rightArm: .15 + (.45 + Math.cos(bar + .6) * .35 + high * .3) * energy,
      armSwing: Math.sin(beat / 2) * .3 * energy,
      antenna: Math.sin(beat + .5) * .12 * energy + Math.min(.12, accent), energy };
  }

  studioPose(seconds: number, playing = true, reducedMotion = false): DancePose {
    const pose = this.pose(seconds, playing, reducedMotion);
    if (!pose.energy) return pose;
    const bars = seconds * this.bpm / 60 / this.beatsPerBar;
    const cycle = bars % 8;
    const turn = Math.max(0, Math.min(1, (cycle - 6) / 2));
    pose.yaw += Math.PI * 2 * turn * turn * (3 - 2 * turn);
    return pose;
  }
}
