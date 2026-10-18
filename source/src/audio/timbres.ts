import type { SoundScore } from './SoundEffect';
import { fmPatches } from './fmSynth';

type Voice = Partial<SoundScore['voice']>;

/** Original synthesized colours, not sampled acoustic instrument emulations.
 * Resolved spectra and envelopes are stored in each score for replay and export.
 */
export const timbres = {
  piano: { waveform: 'triangle', partials: [1, .45, .23, .12, .08, .04], attack: .003, decay: .22, sustain: .1, release: .35, cutoff: 5200, filterEnvelope: { octaves: 1.2, decay: .18 }, layers: 1, vibratoDepth: 0 },
  nylon: { waveform: 'triangle', partials: [1, .5, .16, .25, .07, .1], attack: .003, decay: .14, sustain: .06, release: .22, cutoff: 2800, filterEnvelope: { octaves: 1.8, decay: .12 }, layers: 1, vibratoDepth: 0 },
  wire: { waveform: 'triangle', partials: [1, .25, .55, .13, .32, .08, .2, .08], attack: .001, decay: .1, sustain: .035, release: .35, cutoff: 6500, filterEnvelope: { octaves: 1, decay: .08 }, layers: 1, vibratoDepth: 0 },
  reed: { waveform: 'square', partials: [1, .12, .65, .08, .32, .05, .15], attack: .025, decay: .12, sustain: .65, release: .18, cutoff: 3800, layers: 1, vibratoDepth: 5 },
  brass: { waveform: 'sawtooth', partials: [.7, 1, .8, .55, .35, .18], attack: .045, decay: .16, sustain: .55, release: .16, cutoff: 2400, filterEnvelope: { octaves: -1.8, decay: .1 }, layers: 2, spread: 5, vibratoDepth: 3 },
  flute: { waveform: 'sine', partials: [1, .18, .07, .025], attack: .055, decay: .12, sustain: .7, release: .24, cutoff: 4800, layers: 1, vibratoDepth: 9, vibratoRate: 4.6 },
  organ: { waveform: 'sine', partials: [1, .7, .45, .6, .08, .2, .03, .15], attack: .006, decay: .04, sustain: .85, release: .065, cutoff: 4500, layers: 1, vibratoDepth: 0 },
  strings: { waveform: 'sawtooth', partials: [1, .65, .45, .3, .2, .14, .1, .07], attack: .18, decay: .25, sustain: .7, release: .85, cutoff: 3800, filterEnvelope: { octaves: -1.5, decay: .35 }, layers: 3, spread: 11, vibratoDepth: 5 },
  glass: { waveform: 'sine', fm: fmPatches.bell, attack: .002, decay: .28, sustain: .025, release: 1.1, cutoff: 9500, layers: 1, vibratoDepth: 0 },
  mallet: { waveform: 'sine', fm: { ratio: 3, index: 1.25, attack: .001, decay: .09, sustain: .015, release: .12 }, attack: .002, decay: .13, sustain: .04, release: .2, cutoff: 4600, layers: 1, vibratoDepth: 0 },
  steel: { waveform: 'sine', fm: { ratio: 2.01, index: 2.8, attack: .001, decay: .24, sustain: .025, release: .3 }, attack: .001, decay: .18, sustain: .07, release: .5, cutoff: 7200, layers: 1, vibratoDepth: 0 },
  electric: { waveform: 'sine', fm: fmPatches.electricPiano, attack: .003, decay: .2, sustain: .18, release: .3, cutoff: 3600, layers: 1, vibratoDepth: 0 },
  clav: { waveform: 'square', partials: [1, .8, .2, .45, .1, .25], attack: .001, decay: .045, sustain: .03, release: .045, cutoff: 1800, filterEnvelope: { octaves: 2.5, decay: .07 }, resonance: 2, layers: 1, vibratoDepth: 0 },
  air: { waveform: 'sine', partials: [1, .08, .22, .04, .1, .025, .04], attack: .4, decay: .5, sustain: .65, release: 1.8, cutoff: 3200, filterEnvelope: { octaves: -2, decay: .8 }, layers: 3, spread: 18, vibratoDepth: 3 },
  acid: { waveform: 'sawtooth', attack: .002, decay: .09, sustain: .16, release: .09, cutoff: 900, filterEnvelope: { octaves: 3, decay: .18 }, resonance: 3, layers: 1, vibratoDepth: 0 },
  roundBass: { waveform: 'sine', partials: [1, .3, .12, .04], attack: .006, decay: .16, sustain: .5, release: .12, cutoff: 850, layers: 1, vibratoDepth: 0 },
  pickedBass: { waveform: 'triangle', partials: [1, .55, .3, .12, .06], attack: .002, decay: .12, sustain: .18, release: .09, cutoff: 900, filterEnvelope: { octaves: 2, decay: .1 }, layers: 1, vibratoDepth: 0 },
} satisfies Record<string, Voice>;
