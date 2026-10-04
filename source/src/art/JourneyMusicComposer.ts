import { SoundEffect } from '../audio/SoundEffect';
import type { SoundScore, SoundSequenceEntry } from '../audio/SoundEffect';
import type { MusicianStyle } from './artistStyles';
import { magentaAccompaniment } from '../audio/MagentaAccompaniment';
import type { AccompanimentProvider } from '../audio/magentaProtocol';
import { magentaBackingNotes } from '../audio/magentaScore';

export interface JourneyExpression { moving: boolean; turning: number; slope: number; paused: boolean; speed: number }
interface Phrase { at: number; phrase: number; steps: number; edge: number; blocked: boolean; harmony: boolean; expression?: JourneyExpression }
type Voice = Partial<SoundScore['voice']>;
/** Scale degree, beat position, beat length. Original motifs, never song quotations. */
type Figure = readonly (readonly [number, number, number])[];
const recipes: Record<MusicianStyle, { bpm: number; voice: Voice }> = {
  melodic: { bpm: 100, voice: { waveform: 'triangle', release: .2 } },
  ambient: { bpm: 64, voice: { waveform: 'sine', attack: .3, release: 1.8, cutoff: 1400 } },
  classical: { bpm: 102, voice: { waveform: 'triangle', attack: .004, decay: .12, sustain: .12, release: .3, cutoff: 3200 } },
  minimalist: { bpm: 112, voice: { waveform: 'sine', attack: .008, release: .13 } },
  jazz: { bpm: 116, voice: { waveform: 'triangle', release: .25, cutoff: 2100 } },
  blues: { bpm: 94, voice: { waveform: 'triangle', pitchBend: .12, release: .2, cutoff: 2400 } },
  electronic: { bpm: 124, voice: { waveform: 'sawtooth', attack: .004, release: .07, cutoff: 1800, resonance: 2 } },
  techno: { bpm: 140, voice: { waveform: 'square', attack: .002, release: .06, cutoff: 1200 } },
  chimes: { bpm: 88, voice: { waveform: 'sine', decay: .15, sustain: .12, release: .8 } },
  chiptune: { bpm: 136, voice: { waveform: 'square', attack: .001, release: .025, echoGain: 0, cutoff: 7500 } },
  folk: { bpm: 90, voice: { waveform: 'triangle', decay: .1, sustain: .18, release: .35 } },
  waltz: { bpm: 96, voice: { waveform: 'triangle', release: .25, cutoff: 2800 } },
  latin: { bpm: 118, voice: { waveform: 'triangle', decay: .08, sustain: .15, release: .12 } },
  cinematic: { bpm: 76, voice: { waveform: 'sine', layers: 2, spread: 9, attack: .2, release: 1.2 } },
  lofi: { bpm: 78, voice: { waveform: 'triangle', cutoff: 950, attack: .02, release: .45, echoGain: .1 } },
  baroque: { bpm: 108, voice: { waveform: 'triangle', attack: .002, decay: .06, sustain: .15, release: .08, echoGain: .03 } },
  romantic: { bpm: 74, voice: { waveform: 'triangle', attack: .006, decay: .2, sustain: .15, release: .65 } },
  ragtime: { bpm: 108, voice: { waveform: 'triangle', attack: .002, decay: .09, sustain: .08, release: .09, echoGain: .02 } },
  funk: { bpm: 106, voice: { waveform: 'square', attack: .002, decay: .06, sustain: .1, release: .04, cutoff: 1700, resonance: 3, echoGain: .02 } },
  reggae: { bpm: 82, voice: { waveform: 'triangle', release: .12, echoTime: .36, echoGain: .22 } },
  disco: { bpm: 120, voice: { waveform: 'sawtooth', layers: 2, spread: 7, attack: .008, release: .09, cutoff: 2300 } },
  synthwave: { bpm: 98, voice: { waveform: 'sawtooth', layers: 2, spread: 12, attack: .01, release: .22, cutoff: 1700, echoGain: .18 } },
  dnb: { bpm: 168, voice: { waveform: 'sine', attack: .015, release: .5, echoGain: .2 } },
};
const regular = (degrees: readonly number[], beats = 4, length = .32): Figure => degrees.map((degree, i) => [degree, i * beats / degrees.length, length]);
const hooks: Partial<Record<MusicianStyle, Figure>> = {
  melodic: [[0, 0, .6], [2, .75, .3], [4, 1, .7], [3, 2, .45], [2, 2.75, .3], [0, 3, .7]],
  ambient: [[0, 0, 2], [4, 1.5, 1.8], [6, 3, 1.5]],
  classical: [[4, 0, .4], [3, .5, .4], [2, 1, .4], [1, 1.5, .4], [0, 2, .7], [1, 3, .35], [2, 3.5, .35]],
  jazz: [[2, 0, .4], [4, 2 / 3, .24], [5, 1, .4], [4, 1 + 2 / 3, .24], [3, 2, .4], [1, 2 + 2 / 3, .24], [0, 3, .65]],
  blues: [[0, 0, .4], [1, 2 / 3, .24], [2, 1, .4], [3, 1 + 2 / 3, .24], [4, 2, .4], [2, 2 + 2 / 3, .24], [1, 3, .4], [0, 3 + 2 / 3, .24]],
  electronic: [[0, 0, .2], [0, .75, .2], [4, 1.5, .3], [2, 2, .2], [2, 2.75, .2], [4, 3.5, .3]],
  folk: [[0, 0, .8], [1, 1, .4], [2, 1.5, .4], [4, 2, .7], [2, 3, .4], [1, 3.5, .4]],
  latin: [[2, 0, .5], [4, .75, .5], [5, 1.5, .4], [4, 2.25, .5], [1, 3, .65]],
  cinematic: [[0, 0, 1.4], [2, 1, 1.4], [4, 2, 1.4], [6, 3, 1.4]],
  lofi: [[2, 0, .7], [4, 1 + 2 / 3, .25], [3, 2, .7], [1, 3 + 2 / 3, .25]],
  romantic: [[4, 0, 1.2], [5, 1.5, .35], [4, 2, .45], [2, 2.75, .35], [1, 3.25, .6]],
  ragtime: [[2, 0, .2], [4, .75, .2], [2, 1.25, .2], [1, 1.75, .2], [0, 2.5, .2], [2, 3.25, .2], [4, 3.75, .2]],
  funk: [[0, 0, .12], [0, .75, .12], [3, 1.25, .12], [4, 1.75, .12], [0, 2.5, .12], [6, 2.75, .12], [4, 3.5, .12]],
  reggae: [[0, 0, .6], [2, 1.5, .3], [4, 2.75, .4], [2, 3.5, .3]],
  disco: [[4, 0, .3], [4, .75, .2], [2, 1.5, .3], [3, 2, .3], [4, 2.75, .2], [6, 3.5, .3]],
  dnb: [[0, 0, 1.25], [4, 1.75, .6], [2, 3, .65]],
};

/** Genre grammar + a recurring robot motif. Resolved notes and voices remain JSON-replayable. */
export class JourneyMusicComposer {
  readonly bpm: number;
  readonly beats: number;
  constructor(readonly style: MusicianStyle, private readonly seed: number, speed = 50,
    private readonly accompaniment: AccompanimentProvider = magentaAccompaniment) {
    this.bpm = style === 'melodic' ? 92 + Math.round(speed * .2) + (seed >>> 0) % 9 : recipes[style].bpm;
    this.beats = style === 'waltz' ? 3 : 4;
  }

  /** Warm four chord responses without changing any recorded or audible notes. */
  prepareAccompaniment() { this.preview(); }

  async enhancedPreview(): Promise<SoundSequenceEntry[]> {
    this.prepareAccompaniment();
    await this.accompaniment.whenIdle?.();
    return this.preview();
  }

  /** Four bars expose a groove and its chord changes. */
  preview(bars = 4): SoundSequenceEntry[] {
    const count = Math.max(1, Math.min(12, Math.floor(bars) || 4));
    const measure = this.beats * 60 / this.bpm;
    return Array.from({ length: count }, (_, phrase) => this.compose({
      at: phrase * measure, phrase, steps: phrase * 4, edge: 0, blocked: false, harmony: true,
    })).flat();
  }

  async studioVerses(at: number, phrase: number, steps: number, edge: number): Promise<SoundSequenceEntry[]> {
    const measure = this.beats * 60 / this.bpm;
    const compose = () => Array.from({ length: 8 }, (_, i) => this.compose({
      at: at + i * measure, phrase: phrase + i, steps, edge, blocked: false, harmony: true,
    }, true)).flat();
    compose(); // Queue model responses before freezing the studio arrangement.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([this.accompaniment.whenIdle?.() ?? Promise.resolve(),
        new Promise<void>(resolve => { timer = setTimeout(resolve, 8000); })]);
    } catch { /* A playable harmonic arrangement survives unavailable inference. */ }
    finally { clearTimeout(timer); }
    return compose();
  }

  compose(data: Phrase, studio = false): SoundSequenceEntry[] {
    const style = this.style, beat = 60 / this.bpm, slot = data.phrase % 4;
    // Functional progressions survive changing steps; incidents change their emotional mode.
    let root = [60, 67, 57, 65][slot]!, minor = slot === 2, seventh = 10;
    if (['classical', 'baroque', 'romantic', 'ragtime', 'folk', 'waltz'].includes(style)) {
      root = [60, 65, 67, 60][slot]!; minor = false;
    }
    if (['ambient', 'minimalist', 'chimes', 'cinematic', 'synthwave', 'dnb'].includes(style)) {
      root = [57, 65, 60, 67][slot]!; minor = slot === 0;
    }
    if (['jazz', 'latin', 'lofi'].includes(style)) {
      root = [62, 67, 60, 60][slot]!; minor = slot === 0; seventh = slot < 2 ? 10 : 11;
    }
    if (style === 'blues') { root = [60, 60, 60, 60, 65, 65, 60, 60, 67, 65, 60, 67][data.phrase % 12]!; minor = false; }
    if (style === 'funk') { root = slot < 3 ? 60 : 65; minor = false; }
    // Different robots choose different keys while retaining each genre's harmonic grammar.
    const transpose = ((this.seed >>> 5) % 12) - 5;
    const tonicRoot = root;
    root += transpose;
    if (data.blocked) { root = 57 + transpose; minor = true; }
    const third = minor ? 3 : 4;
    const scale = style === 'blues' ? [0, 3, 5, 6, 7, 10, 12]
      : style === 'folk' ? [0, minor ? 3 : 2, minor ? 5 : 4, 7, minor ? 10 : 9, 12, 14]
      : [0, 2, third, tonicRoot === 65 && !data.blocked ? 6 : 5, 7,
        minor && (data.blocked || tonicRoot !== 62) ? 8 : 9,
        ['jazz', 'latin', 'lofi', 'funk'].includes(style) ? seventh : minor || tonicRoot === 67 ? 10 : 11];
    const pitch = (degree: number) => scale[degree % scale.length]! + Math.floor(degree / scale.length) * 12;
    const figure = hooks[style] ?? (style === 'minimalist' ? regular([0, 4, 2, 4, 0, 4, 2, 4])
      : style === 'baroque' ? regular([0, 1, 2, 4, 3, 2, 1, 0])
      : style === 'waltz' ? regular([4, 2, 1, 0, 1, 2], 3)
      : style === 'chimes' ? regular([0, 4, 2, 6, 4, 2], 4, .75)
      : style === 'chiptune' ? regular([0, 2, 4, 7, 4, 2, 0, 4, 2, 4, 7, 9, 7, 4, 2, 0], 4, .12)
      : style === 'synthwave' ? regular([0, 4, 7, 4, 0, 4, 7, 6]) : regular([0, 0, 4, 0, 2, 0, 4, 2]));
    const motif = (this.seed >>> 0) % 3;
    const melody = new SoundEffect({ gain: style === 'chiptune' ? .09 : .18, echoTime: beat / 2, echoGain: .1, ...recipes[style].voice }).toScore();
    melody.notes = figure.map(([degree, start, duration], i) => {
      let resolved = degree + motif + (i % 2 ? (this.seed >>> ((i % 8) * 3)) & 1 : 0);
      // An occasional phrase-ending ornament reflects the travelled route.
      if (slot === 3 && i === figure.length - 1) resolved = data.harmony ? (data.steps + data.edge) % 3 : 0;
      if (style === 'minimalist') resolved += Math.floor(data.phrase / 4) % 3;
      if (studio) resolved += Math.floor(data.phrase / 4) % 2 ? (i % 2 ? 2 : 0) : 0;
      return { midi: root + (style === 'ambient' ? 0 : style === 'chimes' ? 24 : 12) + pitch(resolved), start: start * beat, duration: duration * beat * (data.blocked ? 1.25 : 1) };
    });
    const result: SoundSequenceEntry[] = [{ at: data.at, score: melody, label: `journey:melody:${data.phrase}` }];
    const add = (part: string, voice: Voice, notes: SoundScore['notes']) => {
      const score = new SoundEffect(voice).toScore(); score.notes = notes;
      result.push({ at: data.at, score, label: `journey:${part}:${data.phrase}` });
    };
    const notes = (figure: Figure, base: number) => figure.map(([interval, start, duration]) => ({ midi: base + interval, start: start * beat, duration: duration * beat }));
    if (['techno', 'electronic', 'lofi', 'funk', 'reggae', 'disco', 'synthwave', 'dnb'].includes(style)) {
      const kick = style === 'lofi' ? [0, 2.5] : style === 'funk' ? [0, 1.75, 2.5] : style === 'reggae' ? [2]
        : style === 'dnb' ? [0, 1.5, 2.75] : style === 'synthwave' ? [0, 2] : [0, 1, 2, 3];
      add(style === 'techno' ? 'techno-kick' : 'pulse', { waveform: 'sine', gain: .24, pitchBend: -24, attack: .001, decay: .06, sustain: 0, release: .06, echoGain: 0 }, notes(kick.map(at => [0, at, .18]), 36));
      // Preserve the Donk preset's three-part voice; other grooves have a backbeat and metallic ticks.
      if (style !== 'techno') {
        const snare = style === 'reggae' ? [2] : style === 'dnb' ? [1, 3, 3.75] : [1, 3];
        add('backbeat', { waveform: 'triangle', gain: .17, pitchBend: -12, attack: .001, decay: .025, sustain: 0, release: .025, cutoff: 5000, echoGain: 0 },
          snare.flatMap(at => [62, 68, 75].map(midi => ({ midi, start: at * beat, duration: .08 * beat }))));
        const hats = ['disco', 'reggae'].includes(style) ? [.5, 1.5, 2.5, 3.5]
          : Array.from({ length: style === 'funk' || style === 'dnb' ? 16 : 8 }, (_, i) => i / (style === 'funk' || style === 'dnb' ? 4 : 2));
        add('hi-hat', { waveform: 'square', gain: .12, attack: .001, decay: .01, sustain: 0, release: .008, cutoff: 10000, echoGain: 0 }, notes(hats.map(at => [0, at, .025]), 106));
      }
    }
    let bass: Figure = regular([0, 7, 0, 7], 4, .55);
    if (style === 'jazz') bass = regular([0, third, 7, slot === 3 ? 11 : 10], 4, .8);
    if (style === 'blues') bass = regular([0, 7, 9, 10], 4, .65);
    if (style === 'techno') bass = [[0, .5, .35], [7, 1.5, .35], [0, 2.5, .35], [7, 3.5, .35]];
    if (style === 'waltz') bass = [[0, 0, .65]];
    if (style === 'latin') bass = [[0, 0, .7], [7, 1.5, .4], [0, 2, .7], [7, 3.5, .4]];
    if (style === 'classical') bass = regular([0, 7, third, 7, 0, 7, third, 7], 4, .4);
    if (style === 'baroque') bass = regular([0, -1, -3, -5], 4, .8);
    if (style === 'romantic') bass = regular([0, 7, 12 + third, 19, 12, 7, 12 + third, 19], 4, .6);
    if (style === 'ragtime') bass = [[0, 0, .3], [7, 1, .3], [0, 2, .3], [7, 3, .3]];
    if (style === 'funk') bass = [[0, 0, .2], [12, .75, .12], [0, 1.5, .2], [7, 1.75, .12], [0, 2.5, .2], [10, 3.25, .12], [12, 3.75, .12]];
    if (style === 'reggae') bass = [[0, 0, .9], [7, 1.75, .35], [12, 2.5, .6], [7, 3.5, .3]];
    if (style === 'disco') bass = regular([0, 12, 0, 7, 0, 12, 10, 12], 4, .3);
    if (style === 'synthwave') bass = regular([0, 0, 0, 12, 0, 0, 7, 0], 4, .35);
    if (style === 'dnb') bass = [[0, 0, 1.2], [0, 1.5, .5], [7, 2.75, .7]];
    if (!['ambient', 'chimes', 'cinematic', 'melodic', 'minimalist'].includes(style)) {
      add(style === 'techno' ? 'donk-bass' : 'bass', { waveform: ['techno', 'chiptune', 'funk', 'synthwave'].includes(style) ? 'square' : 'triangle', gain: .16, cutoff: 650, attack: .006, release: .1, echoGain: 0 }, notes(bass, root - 24));
    }
    if (style === 'baroque') {
      add('counterpoint', { waveform: 'triangle', gain: .11, attack: .002, release: .08, pan: -.25, echoGain: .02 },
        regular([4, 3, 2, 1, 0, 1, 2, 4]).map(([degree, start, duration]) => ({ midi: root + pitch(degree), start: start * beat, duration: duration * beat })));
    }
    if (data.harmony || !['melodic', 'classical', 'baroque', 'blues', 'techno', 'chiptune', 'folk'].includes(style)) {
      const extended = ['jazz', 'lofi', 'latin', 'funk', 'disco', 'ragtime'].includes(style);
      const intervals = [0, third, 7, ...(extended ? [seventh] : data.harmony ? [12] : []), ...(extended && data.harmony ? [14] : [])];
      let offsets = [0], length = 2;
      if (style === 'waltz') { offsets = [1, 2]; length = .4; }
      if (style === 'latin') { offsets = [0, .75, 1.5, 2.5, 3.25]; length = .25; }
      if (style === 'ragtime') { offsets = [.5, 1.5, 2.5, 3.5]; length = .2; }
      if (style === 'reggae') { offsets = [.5, 1.5, 2.5, 3.5]; length = .15; }
      if (style === 'funk') { offsets = [.75, 1.75, 2.5, 3.75]; length = .12; }
      if (style === 'disco' || style === 'electronic') { offsets = [.5, 1.5, 2.5, 3.5]; length = .3; }
      if (['ambient', 'cinematic', 'synthwave'].includes(style)) length = 3.5;
      add('harmony', { waveform: style === 'synthwave' ? 'sawtooth' : 'sine', layers: style === 'synthwave' ? 2 : 1, spread: 10, gain: .12, attack: length > 2 ? .2 : .004, decay: .08, sustain: length > 2 ? .45 : .15, release: length > 2 ? .8 : .16, cutoff: 1300, echoTime: style === 'reggae' ? beat * .75 : beat / 2, echoGain: style === 'reggae' ? .25 : .08 },
        offsets.flatMap(at => notes(intervals.map(interval => [interval, at, length]), root - 12)));
    }
    if (data.harmony && (studio || ['melodic', 'ambient', 'jazz', 'lofi', 'cinematic'].includes(style))) {
      const chordName = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][((root % 12) + 12) % 12]!;
      const extended = style === 'jazz' || style === 'lofi';
      const response = this.accompaniment.get({
        chord: chordName + (minor ? extended ? 'm7' : 'm' : extended ? seventh === 11 ? 'maj7' : '7' : ''),
        notes: melody.notes.map(note => {
          const start = Math.min(15, Math.round(note.start / beat * 4));
          return { pitch: Math.max(48, Math.min(83, note.midi)), quantizedStartStep: start,
            quantizedEndStep: Math.min(16, Math.max(start + 1, Math.round((note.start + note.duration) / beat * 4))) };
        }),
      });
      if (response) {
        const backing = magentaBackingNotes(response, root, [0, third, 7, ...(extended ? [seventh] : [])], this.bpm);
        if (backing.length) add('magenta-countermelody', { waveform: 'triangle', gain: .09, pan: -.3, cutoff: 1500, attack: .025, release: .2 }, backing);
      }
    }
    if (data.expression) {
      const expression = data.expression;
      const energy = expression.moving ? .9 + Math.min(1, expression.speed / 3) * .2 : data.blocked ? .55 : .45;
      for (const entry of result) {
        entry.score.voice.gain *= energy;
        entry.score.voice.cutoff *= expression.moving ? 1 + Math.abs(expression.slope) * .5 : .7;
        entry.score.voice.pan = Math.max(-.4, Math.min(.4, expression.turning * .3));
      }
      // A full-measure chord bridges sparse genre motifs, including when waiting or stuck.
      add('city-bed', { waveform: 'sine', gain: .09, attack: .18, sustain: .6, release: .5,
        cutoff: data.blocked ? 750 : 1200, echoGain: .12, echoTime: beat / 2 },
      notes([0, third, 7, data.harmony ? 14 : 12].map(interval => [interval, 0, this.beats]), root - 12));
      if (expression.moving) add('travel-pulse', { waveform: 'triangle', gain: .08, attack: .003,
        decay: .04, sustain: .1, release: .08, cutoff: 1100, echoGain: .04 },
      notes(regular([0, 7, third, 7], this.beats, .16), root));
    }
    return result;
  }

  /** Short chord-tone answers on the same beat grid as the ongoing arrangement. */
  react(kind: string, data: Phrase, direction = 0): SoundSequenceEntry {
    const arrangement = this.compose({ ...data, expression: undefined, harmony: true });
    const chord = arrangement.find(entry => entry.label?.includes(':harmony:'))!.score.notes;
    const pitches = [...new Set(chord.map(note => note.midi))].slice(0, 3).map(midi => midi + 12);
    const figures: Record<string, number[]> = {
      step: [0, 2], turn: direction < 0 ? [2, 1, 0] : [0, 1, 2],
      climb: [0, 1, 2, 3], descend: [3, 2, 1, 0], blocked: [2, 1, 1], collision: [2, 0, 1, 0],
      intervention: [0, 2, 3, 4], pickup: [0, 1, 2, 4], achievement: [0, 2, 4, 5],
      arrived: [0, 1, 2, 3, 4, 5], segment: [2, 0], exploration: [0, 2, 1],
      city_edit: [1, 2], journey_started: [0, 1, 2], journey_ended: [2, 1, 0],
      state_changed: data.expression?.paused ? [2, 1, 0] : [0, 2, 3],
    };
    const beat = 60 / this.bpm;
    const score = new SoundEffect({ ...recipes[this.style].voice, gain: kind === 'step' ? .055 : .12,
      attack: .008, release: kind === 'blocked' ? .4 : .2, pan: Math.max(-.6, Math.min(.6, direction * .6)),
      echoTime: beat / 2, echoGain: .16, vibratoDepth: kind === 'blocked' ? 9 : 2 }).toScore();
    score.notes = (figures[kind] ?? [0, 2]).map((degree, i) => ({
      midi: pitches[degree % pitches.length]! + Math.floor(degree / pitches.length) * 12,
      start: i * beat / 4, duration: beat * (kind === 'step' ? .16 : .35),
    }));
    return { at: data.at, score, label: `journey:action:${kind}` };
  }
}
