import { SoundEffect } from './SoundEffect';
import type { SoundEffectConfig } from './SoundEffect';
import { robotHarmonies } from './robotHarmony';
import type { RobotMood } from './robotHarmony';
export type { RobotMood } from './robotHarmony';

// All voices share C as their tonal centre so interaction cues and robot phrases fit together.
const moods: Record<RobotMood, SoundEffectConfig> = {
  curious: { root: 60, intervals: [0, 7, 14], pattern: 'up-down', durationBeats: 0.35, gain: 0.16 },
  sad: { root: 48, intervals: [0, 3, 7], pattern: 'chord', waveform: 'sine', durationBeats: 1.4, attack: 0.07, release: 0.6, cutoff: 1600, layers: 2, vibratoDepth: 4 },
  happy: { root: 60, intervals: [0, 4, 7, 12], pattern: 'up', stepBeats: 0.25, durationBeats: 0.45, echoGain: 0.2 },
  celebrating: { root: 60, intervals: [0, 4, 7, 11, 12], pattern: 'up', stepBeats: 0.3, durationBeats: 1.1, release: 0.5, layers: 2, gain: 0.24 },
  calm: { root: 60, intervals: robotHarmonies.calm.intervals, attack: .12, release: .7, waveform: 'sine' },
  determined: { root: 55, intervals: robotHarmonies.determined.intervals, durationBeats: .6, attack: .008 },
  uncertain: { root: 60, intervals: robotHarmonies.uncertain.intervals, durationBeats: .8, vibratoDepth: 5 },
  frustrated: { root: 48, intervals: robotHarmonies.frustrated.intervals, waveform: 'triangle', cutoff: 1000, release: .4 },
  relieved: { root: 60, intervals: robotHarmonies.relieved.intervals, attack: .08, release: .65 },
  wonder: { root: 60, intervals: robotHarmonies.wonder.intervals, waveform: 'sine', attack: .15, release: 1 },
};

export function robotMoodSound(mood: RobotMood, overrides: SoundEffectConfig = {}) {
  return new SoundEffect({ ...moods[mood], ...overrides });
}

export type InteractionSound = 'tap' | 'next' | 'previous' | 'enabled' | 'disabled' | 'save' | 'reset' | 'tune';
const interactions: Record<InteractionSound, SoundEffectConfig> = {
  tap: { root: 72, intervals: [0, 7], pattern: 'up', stepBeats: 0.1, durationBeats: 0.12, gain: 0.1, release: 0.07, echoGain: 0 },
  next: { root: 60, intervals: [0, 4, 7], pattern: 'up', durationBeats: 0.3 },
  previous: { root: 60, intervals: [0, 4, 7], pattern: 'down', durationBeats: 0.3 },
  enabled: { root: 67, intervals: [0, 5], pattern: 'up', stepBeats: 0.15, durationBeats: 0.2 },
  disabled: { root: 60, intervals: [0, 7], pattern: 'down', stepBeats: 0.15, durationBeats: 0.2 },
  save: { root: 72, intervals: [0, 4, 7], durationBeats: 0.4, waveform: 'sine' },
  reset: { root: 60, intervals: [0, 7, 12], pattern: 'down', durationBeats: 0.3 },
  tune: { root: 60, intervals: [0], durationBeats: 0.12, gain: 0.08, release: 0.06, echoGain: 0 },
};
export function interactionSound(name: InteractionSound, overrides: SoundEffectConfig = {}) {
  return new SoundEffect({ ...interactions[name], ...overrides });
}

/** Each control has its own motif, rather than sharing the generic tap cue. */
const buttonSignatures = {
  'exhibition-rewind': { root: 57, intervals: [0, 5, 9, 16], pattern: 'down', stepBeats: .07 },
  'studio-track-play': { root: 65, intervals: [0, 4, 9, 19], pattern: 'up', stepBeats: .1, waveform: 'sine' },
  'studio-track-stop': { root: 53, intervals: [0, 5, 12], pattern: 'down', stepBeats: .08, waveform: 'sine' },
  'city-tool-route': { root: 63, intervals: [0, 2, 9, 17], pattern: 'up', stepBeats: .09 },
  'city-tool-edit': { root: 61, intervals: [0, 5, 11, 18], pattern: 'up', stepBeats: .09 },
  'city-route-undo': { root: 64, intervals: [0, 2, 9, 17], pattern: 'down', stepBeats: .09 },
  'city-route-clear': { root: 62, intervals: [0, 5, 11, 18], pattern: 'down', stepBeats: .09 },
  'city-repair': { root: 59, intervals: [0, 4, 10, 17], pattern: 'up', stepBeats: .11 },
  'city-issue-action': { root: 60, intervals: [0, 5, 9, 14], pattern: 'up', stepBeats: .11 },
  'city-crossing-cues': { root: 84, intervals: [0, 7], pattern: 'up', stepBeats: .12, waveform: 'sine' },
  'city-bridge-elevator': { root: 65, intervals: [0, 5, 7, 12], pattern: 'up', stepBeats: .12, waveform: 'triangle' },
  'city-roboramp': { root: 68, intervals: [0, 4, 7, 12], pattern: 'up', stepBeats: .1, waveform: 'triangle' },
  'city-ask-robot': { root: 76, intervals: [0, 4, 9], pattern: 'up', stepBeats: .12, waveform: 'sine' },
  'city-undo': { root: 58, intervals: [0, 4, 10, 17], pattern: 'down', stepBeats: .11 },
  'city-new': { root: 70, intervals: [0, 5, 10, 17], pattern: 'up-down', stepBeats: .1 },
  'city-view-toggle': { root: 73, intervals: [0, 5, 10, 17], pattern: 'up', stepBeats: .1 },
  'city-map-fit': { root: 71, intervals: [0, 5, 10, 17], pattern: 'chord', stepBeats: .1 },
  'choose-existing': { root: 63, intervals: [0, 7, 12, 17], pattern: 'up', stepBeats: .12 },
  'edit-robot': { root: 66, intervals: [0, 4, 9, 16], pattern: 'up', stepBeats: .14 },
  'preset-previous': { root: 69, intervals: [0, 5, 12], pattern: 'down', stepBeats: .1 },
  'preset-next': { root: 69, intervals: [0, 5, 12], pattern: 'up', stepBeats: .1 },
  'city-exhibition': { root: 62, intervals: [0, 5, 9, 16], pattern: 'up', stepBeats: .16, waveform: 'sine' },
  'exhibition-play': { root: 64, intervals: [0, 7, 11, 19], pattern: 'up', stepBeats: .11, waveform: 'sine' },
  'exhibition-stop': { root: 59, intervals: [0, 5, 12], pattern: 'down', stepBeats: .07, waveform: 'sine' },
  'exhibition-download': { root: 74, intervals: [0, 3, 7, 14], pattern: 'down', stepBeats: .09, waveform: 'sine' },
  'exhibition-download-mp3': { root: 75, intervals: [0, 4, 9, 16], pattern: 'up', stepBeats: .1, waveform: 'triangle' },
  'exhibition-attract': { root: 57, intervals: [0, 7, 12, 15], pattern: 'down', stepBeats: .12 },
  'exhibition-designer': { root: 65, intervals: [0, 4, 12, 19], pattern: 'up', stepBeats: .13 },
  'city-instructions-close': { root: 60, intervals: [0, 4, 7, 14], pattern: 'up', stepBeats: .11, waveform: 'sine' },
  'attract-enter': { root: 60, intervals: [0, 7, 12, 19], pattern: 'up', stepBeats: .14, layers: 2 },
  'attract-music': { root: 72, intervals: [0, 4, 9, 12], pattern: 'up', stepBeats: .09 },
  'attract-motion': { root: 67, intervals: [0, 5], pattern: 'up-down', stepBeats: .08, waveform: 'sine' },
  'city-waiting': { root: 65, intervals: [0, 4, 7], pattern: 'up', stepBeats: 0.13 },
  'randomise-design': { root: 60, intervals: [0, 4, 7], pattern: 'up' },
  'previous-bot': { root: 60, intervals: [0, 4, 7], pattern: 'down' },
  'save-name': { root: 72, intervals: [0, 4, 7], pattern: 'chord', waveform: 'sine', durationBeats: 0.4 },
  'random-name': { root: 74, intervals: [0, 3, 7], pattern: 'up', waveform: 'sine', durationBeats: 0.4 },
  'reset-abilities': { root: 60, intervals: [0, 7, 12], pattern: 'down' },
  'designer-capabilities': { root: 62, intervals: [0, 4, 9], pattern: 'up' },
  'designer-tuning': { root: 65, intervals: [0, 5, 10], pattern: 'down' },
  'designer-creativity': { root: 69, intervals: [0, 3, 8], pattern: 'up' },
  'rotation-toggle': { root: 67, intervals: [0, 5, 12], pattern: 'up-down', waveform: 'sine', stepBeats: 0.12 },
  'enter-city': { root: 48, intervals: [0, 7, 12, 16], pattern: 'up', stepBeats: 0.18, layers: 2 },
  'back-to-designer': { root: 60, intervals: [0, 4, 12], pattern: 'down', waveform: 'sine' },
  'city-tool-shape': { root: 68, intervals: [0, 5, 14], pattern: 'up', stepBeats: .08 },
  'city-tool-pan': { root: 58, intervals: [0, 5, 14], pattern: 'down', stepBeats: .08 },
  'city-pause': { root: 64, intervals: [0, 3], pattern: 'up', durationBeats: 0.18, release: 0.06 },
  'city-restart': { root: 55, intervals: [0, 5, 9, 17], pattern: 'up', stepBeats: 0.1 },
  'fix-barrier': { root: 60, intervals: [0, 7, 14], pattern: 'up', waveform: 'sine', stepBeats: 0.08, pitchBend: 0.1 },
  'sound-mute': { root: 72, intervals: [0, 12], pattern: 'down', waveform: 'sine', stepBeats: 0.1, echoGain: 0 },
  'midi-connect': { root: 60, intervals: [0, 7, 16], pattern: 'up', stepBeats: .12, waveform: 'sine' },
  'midi-disconnect': { root: 55, intervals: [0, 5, 12], pattern: 'down', stepBeats: .09, waveform: 'sine' },
  'app-options': { root: 64, intervals: [0, 5, 12], pattern: 'up', stepBeats: .08, gain: .1 },
  'options-close': { root: 62, intervals: [0, 7, 12], pattern: 'down', stepBeats: .08, gain: .1 },
  'function-communication': { root: 48, intervals: [0, 7, 12], pattern: 'up', waveform: 'triangle', stepBeats: 0.1 },
  'function-vision': { root: 76, intervals: [0, 3, 8], pattern: 'up', waveform: 'sine', stepBeats: 0.14 },
  'function-hearing': { root: 67, intervals: [0, 5, 9], pattern: 'up-down', waveform: 'sine', stepBeats: 0.1 },
  'function-memory': { root: 60, intervals: [0, 4], pattern: 'up', repeats: 2, stepBeats: 0.12 },
  'function-balance': { root: 55, intervals: [0, 5, 9], pattern: 'chord', waveform: 'sine', attack: 0.03 },
  'map-zoom-in': { root: 72, intervals: [0, 4, 12], pattern: 'up', stepBeats: 0.08 },
  'map-zoom-out': { root: 60, intervals: [0, 4, 12], pattern: 'down', stepBeats: 0.08 },
  'map-fit': { root: 60, intervals: [0, 4, 7, 12], pattern: 'chord', waveform: 'sine' },
  'map-left': { root: 60, intervals: [0, 7], pattern: 'down', pan: -0.6 },
  'map-right': { root: 60, intervals: [0, 7], pattern: 'up', pan: 0.6 },
  'map-up': { root: 67, intervals: [0, 5, 9], pattern: 'up', stepBeats: 0.08 },
  'map-down': { root: 55, intervals: [0, 5, 9], pattern: 'down', stepBeats: 0.08 },
  'explore-music-seed': { root: 72, intervals: [0, 4, 9], pattern: 'up-down', stepBeats: 0.1 },
  'explore-art-seed': { root: 65, intervals: [0, 7, 14], pattern: 'up-down', waveform: 'sine' },
  'explore-harmony-seed': { root: 48, intervals: [0, 4, 7, 11], pattern: 'chord' },
  'explore-colour-seed': { root: 69, intervals: [0, 3, 10], pattern: 'up', waveform: 'sine' },
  'explore-library-story': { root: 67, intervals: [0, 7, 14], pattern: 'up-down', waveform: 'sine' },
  'explore-cafe-rhythm': { root: 74, intervals: [0, 4, 9], pattern: 'up-down', stepBeats: 0.1 },
  'explore-cinema-colour': { root: 71, intervals: [0, 3, 10], pattern: 'up', waveform: 'sine' },
  'explore-museum-harmony': { root: 50, intervals: [0, 4, 7, 11], pattern: 'chord' },
  'catwalk-replay': { root: 60, intervals: [0, 4, 7, 19], pattern: 'up', stepBeats: 0.12 },
  'download-live-painting': { root: 69, intervals: [0, 3, 7, 10], pattern: 'down', waveform: 'sine', stepBeats: 0.09 },
  'download-final-painting': { root: 72, intervals: [0, 7, 12, 16], pattern: 'down', waveform: 'sine', stepBeats: 0.1 },
  'view-overhead': { root: 72, intervals: [0, 7, 12], pattern: 'chord', waveform: 'sine' },
  'view-angled': { root: 64, intervals: [0, 3, 8], pattern: 'up', stepBeats: 0.09 },
  'view-follow': { root: 55, intervals: [0, 7, 14], pattern: 'up-down', stepBeats: 0.09 },
  'view-robot-eye': { root: 60, intervals: [0, 2, 7], pattern: 'up', waveform: 'sine', stepBeats: 0.11 },
  'city-view-overhead': { root: 72, intervals: [0, 7, 12], pattern: 'down', waveform: 'sine' },
  'city-view-angled': { root: 64, intervals: [0, 4, 9], pattern: 'up', waveform: 'sine' },
  'city-view-follow': { root: 60, intervals: [0, 7, 16], pattern: 'up', stepBeats: 0.09 },
  'city-view-robot-eye': { root: 76, intervals: [0, 5, 12], pattern: 'up-down', waveform: 'sine' },
} satisfies Record<string, SoundEffectConfig>;

export type ButtonSound = keyof typeof buttonSignatures;
export const buttonSoundNames = Object.keys(buttonSignatures) as ButtonSound[];
export function isButtonSound(name: string): name is ButtonSound {
  return Object.hasOwn(buttonSignatures, name);
}
export function buttonSound(name: ButtonSound, active = true) {
  const config: SoundEffectConfig = {
    gain: 0.12, durationBeats: 0.22, release: 0.1, echoGain: 0.05,
    ...buttonSignatures[name],
  };
  // Switches retain their identity when disabled, with a softer descending answer.
  if (!active) { config.pattern = 'down'; config.gain = 0.09; config.cutoff = 2200; }
  return new SoundEffect(config);
}
