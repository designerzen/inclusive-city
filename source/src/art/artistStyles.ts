import { worldMusicStyles } from './worldMusicStyles';

export const painterStyles = [
  { id: 'impressionist', label: 'Impressionist', description: 'Soft, broken colour and expressive pigment washes.', colours: ['#245b80', '#d17a51', '#d8ad60', '#668f85'] },
  { id: 'watercolour', label: 'Watercolourist', description: 'Transparent washes, watery blooms and delicate pools of colour.', colours: ['#678b9c', '#c8969d', '#c9af75', '#8ba99b'] },
  { id: 'expressionist', label: 'Expressionist', description: 'Bold, restless brushwork and intense emotional colour.', colours: ['#212f63', '#db4c40', '#efbd38', '#486744'] },
  { id: 'cubist', label: 'Cubist', description: 'Angular planes, fragmented shapes and overlapping perspectives.', colours: ['#665442', '#aa7f54', '#c5b58b', '#456f76'] },
  { id: 'geometric', label: 'Geometric abstract artist', description: 'Balanced blocks, grids, circles and clean primary colours.', colours: ['#1955a5', '#d53f38', '#ecc64b', '#202a30'] },
  { id: 'pointillist', label: 'Pointillist', description: 'Thousands of small colour dots build shimmering forms.', colours: ['#326b91', '#df835e', '#dcc869', '#74a287'] },
  { id: 'ink', label: 'Ink painter', description: 'Calligraphic black strokes, dry ink and quiet negative space.', colours: ['#222a2d', '#575b59', '#a44439', '#9c9c8f'] },
  { id: 'surrealist', label: 'Surrealist', description: 'Floating moons, dreamlike eyes and unexpected constellations.', colours: ['#484274', '#ac6d86', '#d8b974', '#468e91'] },
  { id: 'pop', label: 'Pop artist', description: 'Bright graphic shapes, comic outlines and halftone dots.', colours: ['#198bcb', '#f0447e', '#f1c933', '#4d3a99'] },
  { id: 'minimalist', label: 'Minimalist', description: 'Restrained marks, spare lines and space to breathe.', colours: ['#344b56', '#ad7968', '#b7a481', '#738c7a'] },
  { id: 'collage', label: 'Collage artist', description: 'Layered paper-like fragments, torn edges and printed textures.', colours: ['#456776', '#bb775f', '#c6b487', '#8e947c'] },
] as const;

export const musicianStyles = [
  { id: 'melodic', label: 'Melodic explorer', description: 'Bright, lyrical arpeggios that follow the journey.' },
  { id: 'ambient', label: 'Ambient musician', description: 'Slow, spacious notes and gently sustained chord clouds.' },
  { id: 'classical', label: 'Classical piano', description: 'Balanced question-and-answer melodies over a rolling Alberti bass.' },
  { id: 'minimalist', label: 'Minimalist composer', description: 'Repeating patterns that shift gradually with each discovery.' },
  { id: 'jazz', label: 'Jazz improviser', description: 'Swung rhythms, seventh and ninth colours, and a moving bass.' },
  { id: 'blues', label: 'Blues musician', description: 'A twelve-bar shape, blues-scale melody and shuffled pulse.' },
  { id: 'electronic', label: 'Synth-pop', description: 'A repeating synth hook, pop chord changes and a crisp electronic backbeat.' },
  { id: 'techno', label: 'Techno producer', description: 'A driving four-beat kick and offbeat synth bass.' },
  { id: 'chimes', label: 'Bell & chime composer', description: 'Clear, ringing arpeggios with long shimmering tails.' },
  { id: 'chiptune', label: 'Chiptune artist', description: 'Playful square-wave melodies and quick arcade arpeggios.' },
  { id: 'folk', label: 'Folk musician', description: 'Warm pentatonic melodies and simple, spacious accompaniment.' },
  { id: 'waltz', label: 'Waltz composer', description: 'A lilting three-beat phrase with bass and chord responses.' },
  { id: 'latin', label: 'Bossa nova', description: 'Soft syncopated seventh chords, an alternating bass and a relaxed Latin groove.' },
  { id: 'cinematic', label: 'Cinematic composer', description: 'Broad chord swells and rising, dramatic melodic gestures.' },
  { id: 'lofi', label: 'Lo-fi beatmaker', description: 'Soft, filtered keys, relaxed swing and gentle percussion.' },
  { id: 'baroque', label: 'Baroque counterpoint', description: 'Interweaving melodic voices, sequences and a measured continuo bass.' },
  { id: 'romantic', label: 'Romantic piano', description: 'A singing melody above rippling broken chords, with warm expressive cadences.' },
  { id: 'ragtime', label: 'Ragtime', description: 'Jaunty syncopated keys over a bouncing bass-and-chord accompaniment.' },
  { id: 'funk', label: 'Funk', description: 'Short sixteenth-note hooks, syncopated octave bass and clipped chord stabs.' },
  { id: 'reggae', label: 'Reggae / dub', description: 'Offbeat chord skanks, a deep bass line, a third-beat drum accent and dub echoes.' },
  { id: 'disco', label: 'Disco / house', description: 'Four-on-the-floor drums, offbeat hi-hats and an octave-jumping dance bass.' },
  { id: 'synthwave', label: 'Synthwave', description: 'Wide nostalgic synth chords, a pulsing minor-key arpeggio and an eighties backbeat.' },
  { id: 'dnb', label: 'Drum & bass', description: 'Fast broken beats, a deep bass pulse and spacious melodic answers.' },
  ...worldMusicStyles,
] as const;

export type PainterStyle = typeof painterStyles[number]['id'];
export type MusicianStyle = typeof musicianStyles[number]['id'];
export interface ArtistPreferences { painter: PainterStyle; musician: MusicianStyle }
export const defaultArtist = (): ArtistPreferences => ({ painter: 'impressionist', musician: 'melodic' });
export function normaliseArtist(value?: Partial<ArtistPreferences>): ArtistPreferences {
  return {
    painter: painterStyles.some(style => style.id === value?.painter) ? value!.painter! : 'impressionist',
    musician: musicianStyles.some(style => style.id === value?.musician) ? value!.musician! : 'melodic',
  };
}
