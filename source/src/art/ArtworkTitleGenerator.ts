import { paintRandom } from './ProceduralPainting';
import type { PaintStroke } from './ProceduralPainting';

export interface ArtworkTitle {
  version: 1;
  text: string;
  inspirations: [string, string];
}
export interface TitleJourney {
  steps: number; discoveries: number; improvements: number;
  marks: readonly PaintStroke[];
}

// Pair grammatically compatible fragments from two different works.
const works = [
  { name: 'The Starry Night', opening: 'A Starry Night of', image: 'Wandering Stars' },
  { name: 'Water Lilies', opening: 'Water Lilies and', image: 'Water Lilies' },
  { name: 'The Great Wave off Kanagawa', opening: 'The Great Wave of', image: 'a Great Wave' },
  { name: 'The Persistence of Memory', opening: 'The Persistence of', image: 'Small Memories' },
  { name: 'The Birth of Venus', opening: 'The Birth of', image: 'a New Venus' },
  { name: 'Girl with a Pearl Earring', opening: 'A Pearl Earring for', image: 'Pearl Light' },
  { name: 'Sunflowers', opening: 'Sunflowers and', image: 'Sunflowers' },
  { name: 'Impression, Sunrise', opening: 'An Impression of', image: 'a New Sunrise' },
  { name: 'The Scream', opening: 'A Quiet Scream of', image: 'a Quiet Scream' },
  { name: 'The Sleeping Gypsy', opening: 'The Sleeping Gypsy dreams of', image: 'Sleeping Wanderers' },
  { name: 'The Garden of Earthly Delights', opening: 'The Garden of', image: 'Small Delights' },
  { name: 'Broadway Boogie Woogie', opening: 'A City Boogie of', image: 'Broadway Rhythms' },
  { name: 'The Kiss', opening: 'A Kiss of', image: 'Golden Kisses' },
  { name: 'The Swing', opening: 'The Swing of', image: 'a Swing in the Garden' },
  { name: 'The Son of Man', opening: 'The Son of Man finds', image: 'a Hidden Face' },
  { name: 'A Sunday Afternoon on the Island of La Grande Jatte', opening: 'A Sunday Afternoon of', image: 'Sunday Light' },
] as const;

/** Replayable title score: familiar paintings meet this robot's particular journey. */
export class ArtworkTitleGenerator {
  constructor(private readonly seed: number) {}

  generate(journey: TitleJourney): ArtworkTitle {
    let hash = this.seed >>> 0;
    const mix = (value: number) => { hash = Math.imul(hash ^ value, 16777619) >>> 0; };
    mix(journey.steps); mix(journey.discoveries); mix(journey.improvements);
    for (const mark of journey.marks) { mix(mark.sequence); mix(mark.seed); }
    const random = paintRandom(hash);
    const first = Math.floor(random() * works.length);
    const second = (first + 1 + Math.floor(random() * (works.length - 1))) % works.length;
    const opening = works[first]!, image = works[second]!;
    return { version: 1, text: `${opening.opening} ${image.image}`, inspirations: [opening.name, image.name] };
  }
}
