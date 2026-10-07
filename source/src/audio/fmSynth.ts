/** JSON-safe two-operator FM patch. Index is deviation / modulator frequency. */
export interface FmPatch {
  ratio: number;
  index: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export const fmPatches = {
  warm: { ratio: 1, index: .65, attack: .02, decay: .35, sustain: .3, release: .2 },
  electricPiano: { ratio: 1, index: 2.5, attack: .002, decay: .28, sustain: .08, release: .18 },
  bell: { ratio: 2.76, index: 1.8, attack: .001, decay: .5, sustain: .02, release: .5 },
  bright: { ratio: 2, index: 1.4, attack: .004, decay: .15, sustain: .35, release: .15 },
} satisfies Record<string, FmPatch>;

/** Modulator feeds carrier frequency, never the audible output. Works offline too. */
export function scheduleFm(context: BaseAudioContext, carrier: OscillatorNode, patch: FmPatch,
  hz: number, start: number, end: number, release: number, pitchBend: number) {
  const modulator = context.createOscillator();
  const depth = context.createGain();
  const frequency = Math.min(hz * patch.ratio, context.sampleRate * .45);
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(frequency, start);
  modulator.frequency.exponentialRampToValueAtTime(Math.min(frequency * 2 ** (pitchBend / 12), context.sampleRate * .45), end);
  modulator.detune.value = carrier.detune.value;
  const peak = frequency * patch.index;
  const attack = Math.min(patch.attack, (end - start) * .4);
  const decay = Math.min(patch.decay, (end - start) * .4);
  depth.gain.setValueAtTime(0, start);
  depth.gain.linearRampToValueAtTime(peak, start + attack);
  depth.gain.linearRampToValueAtTime(peak * patch.sustain, start + attack + decay);
  depth.gain.setValueAtTime(peak * patch.sustain, end);
  depth.gain.linearRampToValueAtTime(0, end + Math.min(patch.release, release));
  modulator.connect(depth); depth.connect(carrier.frequency);
  modulator.start(start); modulator.stop(end + release);
  return { modulator, depth };
}
