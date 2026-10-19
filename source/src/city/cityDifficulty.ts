import type { ArtBot } from '../robot/botHistory';
import { generateCity, robotFootprint } from './proceduralCity';

export const barrierAmounts = ['all', '0', '3', '6', '12'] as const;
export type BarrierAmount = typeof barrierAmounts[number];
export function isBarrierAmount(value: string | null): value is BarrierAmount {
  return barrierAmounts.includes(value as BarrierAmount);
}

/** A barrier is one place to change, even if it needs several changes. */
export function generateCityWithBarriers(seed: number, robots: readonly ArtBot[], amount: BarrierAmount) {
  const world = generateCity(seed, robots);
  if (amount === 'all') return world;
  const candidates = [
    ...world.streets.filter(street => street.kind !== 'clear').map(street => street.id),
    ...(world.bicycles ?? []).map(bike => bike.id),
    'studio-entrance',
    ...(robots.some(bot => !bot.profile.enabledFunctions.includes('communication')) ? ['communication'] : []),
  ];
  // Use an independent seeded shuffle so difficulty never changes the layout.
  let state = seed >>> 0;
  for (let i = candidates.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  const kept = new Set(candidates.slice(0, Number(amount)));
  world.initialImprovements = [];
  for (const street of world.streets) {
    if (kept.has(street.id) || street.kind === 'clear') continue;
    if (street.id === world.steamTrain?.street || street.kind === 'bridge' || street.kind === 'stairs') {
      world.initialImprovements.push(street.id);
      street.bridgeAccess = 'ramp';
    } else street.kind = 'clear';
  }
  world.bicycles = world.bicycles?.filter(bike => kept.has(bike.id));
  if (!kept.has('studio-entrance')) world.studioEntrance = {
    width: Math.max(...robots.map(robotFootprint)) + .2, doorType: 'automatic',
  };
  if (!kept.has('communication')) world.initialImprovements.push('communication');
  return world;
}
