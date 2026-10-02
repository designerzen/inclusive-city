import { SoundEffect } from '../audio/SoundEffect';
import type { SoundScore, SoundSequenceEntry } from '../audio/SoundEffect';
import type { MusicianStyle } from './artistStyles';

interface Phrase { at: number; phrase: number; steps: number; edge: number; blocked: boolean; harmony: boolean }
type Voice = Partial<SoundScore['voice']>;
const recipes: Record<MusicianStyle, { bpm: number; beats: number; notes: number; voice: Voice }> = {
  melodic: { bpm: 100, beats: 4, notes: 8, voice: { waveform: 'triangle', release: .2 } },
  ambient: { bpm: 64, beats: 4, notes: 3, voice: { waveform: 'sine', attack: .3, release: 1.8, cutoff: 1400 } },
  classical: { bpm: 102, beats: 4, notes: 12, voice: { waveform: 'triangle', attack: .01, release: .3, cutoff: 3200 } },
  minimalist: { bpm: 112, beats: 4, notes: 8, voice: { waveform: 'sine', attack: .008, release: .13 } },
  jazz: { bpm: 116, beats: 4, notes: 8, voice: { waveform: 'triangle', release: .25, cutoff: 2100 } },
  blues: { bpm: 94, beats: 4, notes: 8, voice: { waveform: 'triangle', pitchBend: .12, release: .2, cutoff: 2400 } },
  electronic: { bpm: 124, beats: 4, notes: 16, voice: { waveform: 'sawtooth', attack: .004, release: .07, cutoff: 1500, resonance: 2 } },
  techno: { bpm: 140, beats: 4, notes: 8, voice: { waveform: 'square', attack: .002, release: .06, cutoff: 1200 } },
  chimes: { bpm: 88, beats: 4, notes: 6, voice: { waveform: 'sine', decay: .15, sustain: .12, release: .8 } },
  chiptune: { bpm: 136, beats: 4, notes: 16, voice: { waveform: 'square', attack: .001, release: .025, echoGain: 0, cutoff: 7500 } },
  folk: { bpm: 90, beats: 4, notes: 6, voice: { waveform: 'triangle', decay: .1, sustain: .18, release: .35 } },
  waltz: { bpm: 96, beats: 3, notes: 6, voice: { waveform: 'triangle', release: .25, cutoff: 2800 } },
  latin: { bpm: 118, beats: 4, notes: 6, voice: { waveform: 'triangle', decay: .08, sustain: .15, release: .12 } },
  cinematic: { bpm: 76, beats: 4, notes: 4, voice: { waveform: 'sine', layers: 2, spread: 9, attack: .2, release: 1.2 } },
  lofi: { bpm: 78, beats: 4, notes: 8, voice: { waveform: 'triangle', cutoff: 950, attack: .02, release: .45, echoGain: .1 } },
};

/** Resolved MIDI notes, phrasing and oscillator voices are retained as ordinary replayable scores. */
export class JourneyMusicComposer {
  readonly bpm: number;
  readonly beats: number;
  constructor(readonly style: MusicianStyle, private readonly seed: number, speed = 50) {
    this.bpm = style === 'melodic' ? 92 + Math.round(speed * .2) + seed % 9 : recipes[style].bpm;
    this.beats = recipes[style].beats;
  }

  compose(data: Phrase): SoundSequenceEntry[] {
    const recipe = recipes[this.style], beat = 60 / this.bpm;
    let root = data.blocked ? 57 : [60, 57, 65, 67][(data.phrase + data.edge + this.seed % 4) % 4]!;
    let minor = root === 57, seventh = 10;
    if (this.style === 'jazz' && !data.blocked) {
      const slot = data.phrase % 4;
      root = [62, 67, 60, 60][slot]!; minor = slot === 0; seventh = slot < 2 ? 10 : 11;
    }
    if (this.style === 'blues' && !data.blocked) { root = [60, 60, 60, 60, 65, 65, 60, 60, 67, 65, 60, 67][data.phrase % 12]!; minor = false; }
    const third = minor || data.blocked ? 3 : 4;
    const chord = [0, third, 7, 12];
    const scale = this.style === 'blues' ? [0, 3, 5, 6, 7, 10, 12]
      : this.style === 'folk' ? [0, minor ? 3 : 2, minor ? 5 : 4, 7, minor ? 10 : 9, 12]
      : this.style === 'jazz' || this.style === 'lofi' ? [0, 2, third, 7, 9, seventh, 14] : chord;
    const melody = new SoundEffect({ gain: this.style === 'chiptune' ? .07 : .12, echoTime: beat / 2, echoGain: .13, ...recipe.voice }).toScore();
    const swing = ['jazz', 'blues', 'lofi'].includes(this.style);
    melody.notes = Array.from({ length: recipe.notes }, (_, i) => {
      const motif = this.style === 'minimalist' ? [0, 2, 3, 2][(i + Math.floor(data.phrase / 4)) % 4]!
        : this.style === 'classical' ? [0, 1, 2, 3, 2, 1][i % 6]!
        : this.style === 'cinematic' ? i
        : ((this.seed >>> ((i % 4) * 4)) + data.steps + data.phrase + i) % scale.length;
      const position = this.style === 'latin' ? [0, .75, 1.5, 2, 2.75, 3.5][i]!
        : this.style === 'folk' ? [0, .5, 1.5, 2, 2.5, 3.5][i]!
        : i * recipe.beats / recipe.notes + (swing && i % 2 ? 1 / 6 : 0);
      const duration = ['ambient', 'cinematic'].includes(this.style) ? 1.5 : this.style === 'classical' ? .3 : data.blocked ? .65 : .32;
      return { midi: root + (this.style === 'ambient' ? 0 : this.style === 'chimes' ? 24 : 12) + scale[motif % scale.length]!, start: position * beat, duration: duration * beat };
    });
    const result: SoundSequenceEntry[] = [{ at: data.at, score: melody, label: `journey:melody:${data.phrase}` }];
    const add = (score: SoundScore, part: string) => result.push({ at: data.at, score, label: `journey:${part}:${data.phrase}` });
    if (['techno', 'electronic', 'lofi'].includes(this.style)) {
      const kick = new SoundEffect({ waveform: 'sine', gain: this.style === 'lofi' ? .1 : .18, pitchBend: -24, attack: .001, decay: .08, sustain: 0, release: .08, echoGain: 0 }).toScore();
      kick.notes = Array.from({ length: this.style === 'lofi' ? 2 : 4 }, (_, i) => ({ midi: 36, start: i * beat * (this.style === 'lofi' ? 2 : 1), duration: beat * .2 }));
      add(kick, this.style === 'techno' ? 'techno-kick' : 'pulse');
    }
    if (['jazz', 'blues', 'electronic', 'techno', 'waltz', 'latin', 'folk', 'chiptune', 'lofi'].includes(this.style)) {
      const bass = new SoundEffect({ waveform: ['techno', 'chiptune'].includes(this.style) ? 'square' : 'triangle', gain: .085, cutoff: 650, attack: .006, release: .1, echoGain: 0 }).toScore();
      bass.notes = Array.from({ length: this.style === 'waltz' ? 1 : 4 }, (_, i) => ({ midi: root - 24 + (i % 2 ? 7 : 0),
        start: (i + (this.style === 'techno' ? .5 : this.style === 'latin' && i % 2 ? .25 : 0)) * beat, duration: beat * .55 }));
      add(bass, this.style === 'techno' ? 'donk-bass' : 'bass');
    }
    if (data.harmony || ['ambient', 'cinematic', 'waltz', 'jazz', 'lofi', 'latin'].includes(this.style)) {
      const intervals = ['jazz', 'lofi'].includes(this.style) ? [0, third, 7, seventh, ...(data.harmony ? [14] : [])] : chord.slice(0, data.harmony ? 4 : 3);
      const harmony = new SoundEffect({ root: root - 12, intervals, waveform: 'sine', gain: .06, bpm: this.bpm,
        durationBeats: ['ambient', 'cinematic'].includes(this.style) ? 3 : this.style === 'waltz' || this.style === 'latin' ? .45 : 2,
        attack: ['ambient', 'cinematic'].includes(this.style) ? .25 : .04, release: .4, cutoff: 1300 }).toScore();
      if (this.style === 'waltz' || this.style === 'latin') {
        const offsets = this.style === 'waltz' ? [1, 2] : [.5, 1.75, 3];
        harmony.notes = offsets.flatMap(offset => intervals.map(note => ({ midi: root - 12 + note, start: offset * beat, duration: beat * .4 })));
      }
      add(harmony, 'harmony');
    }
    return result;
  }
}
