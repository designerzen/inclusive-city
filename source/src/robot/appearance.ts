export const bodyShapes = ['box', 'rounded', 'cylinder', 'hexagon', 'diamond', 'cone'] as const;
export type RobotShape = typeof bodyShapes[number];
export type RobotShapePart = 'head' | 'body';
export const robotAccessories = [
  { id: 'moustache', label: 'Moustache', description: 'A splendid curly moustache.' },
  { id: 'wings', label: 'Wings', description: 'A pair of feathery wings.' },
  { id: 'monocle', label: 'Monocle', description: 'A golden eyepiece and chain.' },
  { id: 'topHat', label: 'Top hat', description: 'A tall hat with a colourful band.' },
  { id: 'bowTie', label: 'Bow tie', description: 'A bright little finishing touch.' },
] as const;
export type RobotAccessory = typeof robotAccessories[number]['id'];
export const bodyColours = [
  { name: 'Mint', hex: '#6ed5bc' },
  { name: 'Coral', hex: '#f59482' },
  { name: 'Lavender', hex: '#b6a1ec' },
  { name: 'Honey', hex: '#f3c76b' },
  { name: 'Sky blue', hex: '#81c5ee' },
  { name: 'Rose', hex: '#e99fc7' },
] as const;

export interface RobotAppearance {
  shape: typeof bodyShapes[number];
  headShape?: RobotShape;
  colour: typeof bodyColours[number];
  width: number;
  height: number;
  depth: number;
  accessories?: RobotAccessory[];
}

export function defaultAppearance(): RobotAppearance {
  return { shape: 'box', colour: bodyColours[0], width: 1, height: 1, depth: 1 };
}

export function randomiseAppearance(previous: RobotAppearance, random = Math.random): RobotAppearance {
  function choose<T>(options: readonly T[]): T {
    return options[Math.min(options.length - 1, Math.floor(random() * options.length))]!;
  }
  function dimension(previousValue: number, options: number[]) {
    return choose(options.filter(value => value !== previousValue));
  }
  // Every press changes all three design properties, even when the RNG repeats.
  return {
    accessories: [...(previous.accessories ?? [])],
    shape: choose(bodyShapes.filter(shape => shape !== previous.shape)),
    headShape: choose(bodyShapes.filter(shape => shape !== (previous.headShape ?? previous.shape))),
    colour: choose(bodyColours.filter(colour => colour.hex !== previous.colour.hex)),
    width: dimension(previous.width, [0.75, 0.9, 1.05, 1.2, 1.3]),
    height: dimension(previous.height, [0.8, 0.95, 1.1, 1.25]),
    depth: dimension(previous.depth, [0.8, 0.95, 1.1, 1.25]),
  };
}

export function describeAppearance(appearance: RobotAppearance) {
  const accessories = robotAccessories.filter(item => appearance.accessories?.includes(item.id)).map(item => item.label);
  return `${appearance.colour.name} ${appearance.shape} body · ${appearance.headShape ?? appearance.shape} head · width ${Math.round(appearance.width * 100)}% · height ${Math.round(appearance.height * 100)}% · depth ${Math.round(appearance.depth * 100)}%${accessories.length ? ` · accessories: ${accessories.join(', ')}` : ''}`;
}

export function cycleShape(appearance: RobotAppearance, part: RobotShapePart): RobotAppearance {
  const current = part === 'head' ? appearance.headShape ?? appearance.shape : appearance.shape;
  const next = bodyShapes[(bodyShapes.indexOf(current) + 1) % bodyShapes.length]!;
  return part === 'head' ? { ...appearance, headShape: next }
    : { ...appearance, headShape: appearance.headShape ?? appearance.shape, shape: next };
}
