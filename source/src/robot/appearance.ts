export const bodyShapes = ['box', 'rounded', 'cylinder'] as const;
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
  colour: typeof bodyColours[number];
  width: number;
  height: number;
  depth: number;
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
    shape: choose(bodyShapes.filter(shape => shape !== previous.shape)),
    colour: choose(bodyColours.filter(colour => colour.hex !== previous.colour.hex)),
    width: dimension(previous.width, [0.75, 0.9, 1.05, 1.2, 1.3]),
    height: dimension(previous.height, [0.8, 0.95, 1.1, 1.25]),
    depth: dimension(previous.depth, [0.8, 0.95, 1.1, 1.25]),
  };
}

export function describeAppearance(appearance: RobotAppearance) {
  return `${appearance.colour.name} ${appearance.shape} body · width ${Math.round(appearance.width * 100)}% · height ${Math.round(appearance.height * 100)}% · depth ${Math.round(appearance.depth * 100)}%`;
}
