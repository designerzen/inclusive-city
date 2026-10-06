import type { SoundScore } from '../audio/SoundEffect';

type Figure = readonly (readonly [number, number, number])[];
interface WorldArrangement {
  bpm: number;
  beats?: number;
  voice: Partial<SoundScore['voice']>;
  scale: readonly number[];
  roots: readonly [number, number, number, number];
  minor?: boolean;
  hook: Figure;
  bass: Figure;
  chords: readonly number[];
  chordLength: number;
  drums: readonly number[];
  ticks: readonly number[];
}
const pluck = { waveform: 'triangle', attack: .002, decay: .09, sustain: .08, release: .16 } as const;
const reed = { waveform: 'square', attack: .025, cutoff: 1800, release: .2 } as const;
const bell = { waveform: 'sine', attack: .002, decay: .16, sustain: .08, release: .7 } as const;
const synth = { waveform: 'sawtooth', attack: .005, cutoff: 1600, release: .12 } as const;
const major = [0, 2, 4, 5, 7, 9, 11];
const minor = [0, 2, 3, 5, 7, 8, 10];
const pentatonic = [0, 2, 4, 7, 9];
const harmonicMinor = [0, 2, 3, 5, 7, 8, 11];
const hijaz = [0, 1, 4, 5, 7, 8, 10];
const dorian = [0, 2, 3, 5, 7, 9, 10];
const line = (degrees: readonly number[], onsets: readonly number[], length = .22): Figure =>
  degrees.map((degree, i) => [degree, onsets[i]!, length]);
const bass = (onsets: readonly number[], intervals: readonly number[] = [0, 7], length = .35): Figure =>
  onsets.map((at, i) => [intervals[i % intervals.length]!, at, length]);

/** Original oscillator sketches, inspired by traditions rather than recordings or instrument emulations.
 * Equal-tempered scales approximate modal colours; they do not reproduce microtonal tuning or complete ragas.
 */
export const worldMusicStyles = [
  { id: 'afrobeat', label: 'Afrobeat', description: 'West African-inspired interlocking riffs, syncopated bass and layered pulses.' },
  { id: 'highlife', label: 'Highlife', description: 'Ghanaian-inspired bright plucked phrases and buoyant offbeat chords.' },
  { id: 'soukous', label: 'Soukous', description: 'Congolese-inspired cascading plucked melodies and dancing bass.' },
  { id: 'mbalax', label: 'Mbalax', description: 'Senegalese-inspired quick melodic answers and shifting percussion accents.' },
  { id: 'ethiojazz', label: 'Ethio-jazz', description: 'Ethiopian jazz-inspired modal melodies, spacious keys and a relaxed pulse.' },
  { id: 'amapiano', label: 'Amapiano', description: 'South African-inspired soft keys, deep syncopated bass and airy ticks.' },
  { id: 'gnawa', label: 'Gnawa-inspired', description: 'Moroccan-inspired repeating low riffs, pentatonic answers and metallic pulses.' },
  { id: 'rai', label: 'Raï-inspired', description: 'Algerian-inspired ornamented synth phrases and a bouncing dance rhythm.' },
  { id: 'maqam', label: 'Arabic maqam-inspired', description: 'An equal-tempered modal sketch with winding phrases and sparse plucked accompaniment.' },
  { id: 'turkish', label: 'Turkish folk-inspired', description: 'Bright plucked runs over an uneven seven-beat dance pattern.' },
  { id: 'persian', label: 'Persian classical-inspired', description: 'Delicate ringing ornaments and spacious modal phrases in an equal-tempered sketch.' },
  { id: 'raga', label: 'Indian raga-inspired', description: 'A pentatonic melodic exploration over a sustained drone; an original tonal sketch.' },
  { id: 'qawwali', label: 'Qawwali-inspired', description: 'South Asian-inspired rising call-and-answer phrases, sustained reed colours and handclap-like accents.' },
  { id: 'gamelan', label: 'Gamelan-inspired', description: 'Indonesian-inspired interlocking bell patterns over a low ringing cycle.' },
  { id: 'koto', label: 'Japanese koto-inspired', description: 'Sparse plucked phrases and open space, using an equal-tempered five-note palette.' },
  { id: 'guzheng', label: 'Chinese guzheng-inspired', description: 'Flowing pentatonic plucked runs and rippling accompaniment.' },
  { id: 'korean', label: 'Korean folk-inspired', description: 'Lilting pentatonic phrases and a gentle three-beat accompaniment.' },
  { id: 'irish', label: 'Irish jig-inspired', description: 'Quick six-part melodic figures with a lilting compound pulse.' },
  { id: 'flamenco', label: 'Flamenco-inspired', description: 'Spanish-inspired Phrygian phrases, clipped plucked chords and sharp rhythmic accents.' },
  { id: 'klezmer', label: 'Klezmer-inspired', description: 'Jewish folk-inspired reed-like turns, modal colour and a bouncing bass.' },
  { id: 'balkan', label: 'Balkan dance-inspired', description: 'An uneven seven-beat dance with bright reed phrases and accents grouped two, two, three.' },
  { id: 'tango', label: 'Tango · rhythmic sketch', description: 'A compact Argentine-inspired sketch: clipped reed phrases, syncopated bass and a synthesized pulse.' },
  { id: 'argentineTango', label: 'Argentine tango', description: 'Orchestral tango-inspired: bandoneón-like reeds, lyrical bowed-synth answers, piano accents and marked bass steps. No drum-machine beat.' },
  { id: 'samba', label: 'Samba', description: 'Brazilian-inspired bright syncopated melody and a bustling layered pulse.' },
  { id: 'salsa', label: 'Salsa', description: 'Afro-Cuban-inspired repeating keyboard figures, anticipated bass and clave-like accents.' },
  { id: 'cumbia', label: 'Cumbia', description: 'Colombian-inspired lilting melody, alternating bass and a steady dancing pulse.' },
  { id: 'merengue', label: 'Merengue', description: 'Dominican-inspired brisk reed phrases, alternating bass and busy ticks.' },
  { id: 'calypso', label: 'Calypso', description: 'Trinidadian-inspired playful bell-like phrases and buoyant syncopation.' },
  { id: 'soca', label: 'Soca', description: 'Trinidadian-inspired fast dance pulses and bright, punchy melodic hooks.' },
  { id: 'bluegrass', label: 'Bluegrass', description: 'American-inspired fast plucked runs and a bouncing bass-and-chord pulse.' },
  { id: 'rock', label: 'Rock', description: 'Crunchy synth riffs, driving bass and a firm backbeat.' },
  { id: 'hiphop', label: 'Hip-hop', description: 'A laid-back beat, short sampled-key-like phrases and deep bass answers.' },
  { id: 'trap', label: 'Trap', description: 'Half-time accents, deep sustained bass and rapid hi-hat-like ticks.' },
] as const;
export type WorldMusicStyle = typeof worldMusicStyles[number]['id'];

export const worldArrangements: Record<WorldMusicStyle, WorldArrangement> = {
  afrobeat: { bpm: 112, voice: reed, scale: dorian, minor: true, roots: [60,60,65,60], hook: line([0,2,4,2,0,4,3], [0,.75,1.25,1.75,2.5,3,3.75]), bass: bass([0,.75,1.5,2.5,3.25],[0,12,7]), chords: [.5,1.75,2.75,3.5], chordLength: .14, drums: [0,1.5,2.75], ticks: [.5,1,1.75,2.5,3,3.75] },
  highlife: { bpm: 116, voice: pluck, scale: major, roots: [60,65,67,60], hook: line([0,2,4,5,4,2,1,2],[0,.5,1,1.5,2,2.5,3.25,3.75]), bass: bass([0,1.5,2,3.5]), chords: [.5,1.5,2.5,3.5], chordLength: .2, drums: [0,2], ticks: [.75,1.5,2.75,3.5] },
  soukous: { bpm: 128, voice: { ...pluck, cutoff: 3800 }, scale: major, roots: [60,67,65,67], hook: line([0,2,4,2,5,4,2,1,2,4,5,4],[0,.25,.5,1,1.25,1.5,2,2.25,2.5,3,3.25,3.5],.15), bass: bass([0,.75,1.5,2.25,3,3.5],[0,7,12]), chords: [.75,1.75,2.75,3.75], chordLength: .18, drums: [0,1,2,3], ticks: [.5,1.25,2.5,3.25] },
  mbalax: { bpm: 134, voice: pluck, scale: pentatonic, roots: [60,65,60,67], hook: line([0,1,3,4,3,1,2],[0,.5,1.25,1.75,2.5,3.25,3.75],.16), bass: bass([0,1.25,2.5,3.5],[0,7,12]), chords: [.5,2,3.25], chordLength: .18, drums: [0,.75,2,2.75], ticks: [.25,1,1.5,2.25,3,3.5,3.75] },
  ethiojazz: { bpm: 92, voice: { ...bell, cutoff: 1900 }, scale: [0,2,3,7,8], minor: true, roots: [60,60,65,67], hook: line([0,1,2,4,3,2],[0,2/3,1.5,2,2+2/3,3.5],.45), bass: bass([0,1,2,3],[0,3,7,10],.7), chords: [0,2.5], chordLength: 1, drums: [0,2.5], ticks: [2/3,1+2/3,2+2/3,3+2/3] },
  amapiano: { bpm: 112, voice: { ...bell, cutoff: 1500, release: .4 }, scale: minor, minor: true, roots: [60,65,63,67], hook: line([2,4,3,1],[0,1.5,2.75,3.5],.5), bass: bass([0,.75,1.75,2.5,3.75],[0,-12,7,12],.24), chords: [0,2.5], chordLength: 1.2, drums: [0,1,2,3], ticks: [.5,1.5,2.25,2.5,3.5] },
  gnawa: { bpm: 100, voice: { ...pluck, cutoff: 1200 }, scale: [0,3,5,7,10], minor: true, roots: [60,60,60,60], hook: line([0,2,3,2,1,0],[0,.75,1.5,2,2.75,3.5],.3), bass: bass([0,.75,2,2.75],[0,7,0,12],.4), chords: [0], chordLength: 4, drums: [0,2], ticks: [0,.75,1.5,2,2.75,3.5] },
  rai: { bpm: 120, voice: synth, scale: hijaz, roots: [60,61,60,67], hook: line([0,1,2,1,3,4,2,1],[0,.25,.75,1.25,2,2.5,3,3.75]), bass: bass([0,1.5,2,3.5]), chords: [.5,1.5,2.5,3.5], chordLength: .2, drums: [0,2,2.75], ticks: [.5,1,1.5,2.5,3,3.5] },
  maqam: { bpm: 82, voice: pluck, scale: hijaz, roots: [60,60,65,60], hook: line([0,1,2,4,3,2,1],[0,.5,.75,1.5,2.25,2.75,3.5],.35), bass: bass([0,2.5],[0,7],1), chords: [0], chordLength: 3.5, drums: [0,1.5,3], ticks: [1,2,3.5] },
  turkish: { bpm: 154, beats: 7, voice: pluck, scale: hijaz, roots: [60,60,65,60], hook: line([0,1,2,4,3,2,1,0,2],[0,.5,1,2,2.5,3,4,5,6],.3), bass: bass([0,2,4],[0,7,0],.65), chords: [1,3,5,6], chordLength: .3, drums: [0,2,4], ticks: [1,3,5,6] },
  persian: { bpm: 78, voice: bell, scale: harmonicMinor, minor: true, roots: [60,60,65,60], hook: line([0,1,2,1,4,3,2],[0,.5,.75,1,2,2.5,3.25],.4), bass: bass([0,2],[0,7],1.4), chords: [0], chordLength: 3, drums: [], ticks: [] },
  raga: { bpm: 80, voice: { ...pluck, release: .5, echoGain: .16 }, scale: pentatonic, roots: [60,60,60,60], hook: line([0,1,2,3,4,3,1],[0,.75,1.25,1.5,2,2.75,3.5],.5), bass: bass([0],[0],4), chords: [0], chordLength: 4, drums: [0,1.5,2.5], ticks: [1,2,3,3.5] },
  qawwali: { bpm: 104, voice: reed, scale: harmonicMinor, minor: true, roots: [60,60,65,60], hook: line([0,2,3,4,5,4,2,0],[0,.5,1,1.5,2,2.5,3,3.5],.4), bass: bass([0,2],[0,7],.8), chords: [0,1,2,3], chordLength: .65, drums: [0,2], ticks: [1,3] },
  gamelan: { bpm: 96, voice: { ...bell, release: 1 }, scale: [0,2,5,7,9], roots: [60,60,60,60], hook: line([0,2,1,3,2,4,3,1],[0,.5,1,1.5,2,2.5,3,3.5],.45), bass: bass([0],[0],3.5), chords: [0,2], chordLength: 1.5, drums: [], ticks: [.25,.75,1.25,1.75,2.25,2.75,3.25,3.75] },
  koto: { bpm: 72, voice: { ...pluck, release: .65 }, scale: [0,1,5,7,8], roots: [60,60,65,60], hook: line([0,1,3,4,2],[0,.75,1.5,2.75,3.5],.5), bass: bass([0,2],[0,7],1.2), chords: [0], chordLength: 3, drums: [], ticks: [] },
  guzheng: { bpm: 94, voice: { ...pluck, echoGain: .16 }, scale: pentatonic, roots: [60,65,67,60], hook: line([0,1,2,3,4,3,2,1,3,2],[0,.25,.5,.75,1.5,2,2.5,3,3.25,3.5],.3), bass: bass([0,1,2,3],[0,7,12,7],.6), chords: [0,2], chordLength: 1, drums: [], ticks: [] },
  korean: { bpm: 88, beats: 3, voice: pluck, scale: pentatonic, roots: [60,65,60,67], hook: line([0,2,3,2,1,0],[0,.5,1,1.5,2,2.5],.4), bass: bass([0,1.5],[0,7],.6), chords: [1,2], chordLength: .35, drums: [0,2], ticks: [.5,1.5,2.5] },
  irish: { bpm: 116, beats: 3, voice: reed, scale: dorian, minor: true, roots: [60,67,65,60], hook: line([0,2,4,3,2,1],[0,.5,1,1.5,2,2.5],.25), bass: bass([0,1.5],[0,7],.5), chords: [.5,2], chordLength: .25, drums: [0,1.5], ticks: [.5,1,2,2.5] },
  flamenco: { bpm: 118, voice: pluck, scale: [0,1,3,5,7,8,10], minor: true, roots: [60,58,56,55], hook: line([4,3,2,1,0,1,0],[0,.5,1,1.5,2.25,3,3.5],.18), bass: bass([0,1.5,3],[0,7,12],.3), chords: [0,.75,1.5,2.5,3.5], chordLength: .12, drums: [0,1.5,3], ticks: [.5,1,2,2.75,3.5] },
  klezmer: { bpm: 122, voice: { ...reed, vibratoDepth: 4 }, scale: hijaz, roots: [60,65,67,60], hook: line([0,1,2,4,3,2,1,2,0],[0,.25,.5,1,1.5,2,2.5,2.75,3.5],.2), bass: bass([0,1,2,3]), chords: [.5,1.5,2.5,3.5], chordLength: .25, drums: [0,2], ticks: [1,3] },
  balkan: { bpm: 168, beats: 7, voice: reed, scale: harmonicMinor, minor: true, roots: [60,65,67,60], hook: line([0,2,4,5,4,3,2,1,0],[0,.5,1,2,2.5,3,4,5,6],.24), bass: bass([0,2,4],[0,7,12],.6), chords: [1,3,5,6], chordLength: .22, drums: [0,2,4], ticks: [.5,1.5,2.5,3.5,4.5,5,6] },
  tango: { bpm: 108, voice: { ...reed, release: .1 }, scale: harmonicMinor, minor: true, roots: [60,65,67,60], hook: line([0,4,3,2,1,0],[0,.75,1.5,2,2.5,3.5],.3), bass: bass([0,.75,1.5,2,3],[0,7,12,7,0],.25), chords: [0,1.5,2,3], chordLength: .18, drums: [0,2], ticks: [] },
  argentineTango: { bpm: 116, voice: { ...reed, attack: .018, sustain: .38, release: .22, cutoff: 2400, vibratoDepth: 3 }, scale: harmonicMinor, minor: true, roots: [60,65,67,60], hook: [[0,0,.65],[2,.75,.18],[3,1,.65],[4,1.75,.18],[3,2,.7],[1,3,.35],[0,3.5,.4]], bass: bass([0,1,2,3],[0,7,0,7],.22), chords: [0,1,2,3], chordLength: .2, drums: [], ticks: [] },
  samba: { bpm: 132, voice: pluck, scale: major, roots: [60,65,62,67], hook: line([2,4,5,4,2,1,0],[0,.75,1.25,1.75,2.5,3,3.75]), bass: bass([0,1.75,2,3.75]), chords: [.5,1.25,2.5,3.25], chordLength: .18, drums: [0,1.75,2,3.75], ticks: [.25,.75,1.25,1.5,2.25,2.75,3.25,3.5] },
  salsa: { bpm: 174, voice: pluck, scale: major, roots: [60,65,67,60], hook: line([0,2,4,2,4,5,4,2],[0,.5,1.5,2,2.5,3,3.5,3.75],.18), bass: bass([0,1.5,2.75],[0,7,12],.5), chords: [0,.75,1.5,2.5,3], chordLength: .18, drums: [0,2.5], ticks: [0,.75,1.5,2.5,3] },
  cumbia: { bpm: 100, voice: reed, scale: minor, minor: true, roots: [60,67,65,67], hook: line([0,2,4,3,2,1,0],[0,.5,1.5,2,2.5,3,3.5],.3), bass: bass([0,1,2,3],[0,7,12,7],.5), chords: [.5,1.5,2.5,3.5], chordLength: .22, drums: [0,2], ticks: [.5,1,1.5,2.5,3,3.5] },
  merengue: { bpm: 152, voice: reed, scale: major, roots: [60,67,65,67], hook: line([0,2,4,5,4,2,1,0],[0,.5,1,1.5,2,2.5,3,3.5],.15), bass: bass([0,.5,1,1.5,2,2.5,3,3.5],[0,7],.22), chords: [.5,1.5,2.5,3.5], chordLength: .18, drums: [0,1,2,3], ticks: [0,.25,.5,.75,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75] },
  calypso: { bpm: 108, voice: bell, scale: major, roots: [60,65,67,60], hook: line([0,2,4,5,4,2,3],[0,.75,1.5,2,2.75,3.25,3.75],.3), bass: bass([0,1.5,2.5,3.5],[0,7,12,7]), chords: [.75,1.75,2.5,3.5], chordLength: .22, drums: [0,2], ticks: [.5,1.5,2.5,3.5] },
  soca: { bpm: 144, voice: synth, scale: major, roots: [60,67,65,67], hook: line([4,4,2,3,4,5,4],[0,.5,1.25,1.75,2.5,3,3.5],.2), bass: bass([0,.75,1.5,2,2.75,3.5],[0,12,7],.2), chords: [.5,1.5,2.5,3.5], chordLength: .15, drums: [0,1,2,3], ticks: [.5,1.5,2.25,2.5,3.5,3.75] },
  bluegrass: { bpm: 138, voice: { ...pluck, release: .07 }, scale: major, roots: [60,65,67,60], hook: line([0,2,4,2,5,4,2,1,0,2,4,5,4,2,1,0],[0,.25,.5,.75,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75],.12), bass: bass([0,1,2,3],[0,7],.4), chords: [.5,1.5,2.5,3.5], chordLength: .15, drums: [], ticks: [] },
  rock: { bpm: 126, voice: { ...synth, layers: 2, spread: 5 }, scale: [0,3,5,7,10], minor: true, roots: [60,58,65,60], hook: line([0,0,2,3,2,0],[0,.5,1.5,2,2.75,3.5],.3), bass: bass([0,.5,1,1.5,2,2.5,3,3.5],[0,0,7,0],.25), chords: [0,1.5,2.5], chordLength: .4, drums: [0,2,2.5], ticks: [1,3] },
  hiphop: { bpm: 86, voice: { ...pluck, cutoff: 1100, release: .35 }, scale: minor, minor: true, roots: [60,56,65,67], hook: line([2,4,3,0],[0,1+2/3,2.5,3+2/3],.5), bass: bass([0,1.75,2.5],[0,-12,7],.7), chords: [0,2.5], chordLength: 1, drums: [0,1.75,2.5], ticks: [1,3] },
  trap: { bpm: 140, voice: { ...bell, cutoff: 2200 }, scale: minor, minor: true, roots: [60,56,58,60], hook: line([4,2,0,1,2],[0,1,2.5,3.25,3.5],.4), bass: bass([0,1.75,3.25],[0,-12,7],1.1), chords: [0], chordLength: 3.5, drums: [0,1.75,3.5], ticks: [0,.5,1,1.5,1.75,1.875,2,2.5,3,3.25,3.5,3.625,3.75,3.875] },
};
