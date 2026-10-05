import type { RoutePoint } from './cityLayout';

export const trainRideDuration = 24;
export type TrainPhase = 'deploying' | 'boarding' | 'retracting' | 'travelling' | 'exit-ramp' | 'exiting' | 'stowing';
const mix = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
export function trainRidePose(a: RoutePoint, b: RoutePoint, seconds: number) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
  const point = (side: number, along: number, y = .16): RoutePoint => ({ x: a.x + dx * along + dz * side, y, z: a.z + dz * along - dx * side });
  const t = Math.max(0, Math.min(trainRideDuration, seconds));
  const phase: TrainPhase = t < 3 ? 'deploying' : t < 6 ? 'boarding' : t < 8 ? 'retracting' : t < 14 ? 'travelling' : t < 17 ? 'exit-ramp' : t < 22 ? 'exiting' : 'stowing';
  const along = mix(0, length, (t - 8) / 6);
  let position = point(0, 0);
  if (t >= 3 && t < 6) position = point(mix(0, 2.6, (t - 3) / 3), 0, mix(.16, .76, (t - 3) / 3));
  else if (t >= 6 && t < 17) position = point(2.6, along, .76);
  else if (t >= 17 && t < 19) position = point(mix(2.6, 5.2, (t - 17) / 2), length, mix(.76, .16, (t - 17) / 2));
  else if (t >= 19 && t < 20) position = point(5.2, mix(length, length - 3, t - 19));
  else if (t >= 20 && t < 21) position = point(mix(5.2, 0, t - 20), length - 3);
  else if (t >= 21) position = point(0, mix(length - 3, length, t - 21));
  return { phase, position, train: point(2.6, along, 0), heading: Math.atan2(-dx, -dz),
    boardingRamp: t < 6 ? mix(0, 1, t / 3) : mix(1, 0, (t - 6) / 2),
    exitRamp: t < 17 ? mix(0, 1, (t - 14) / 3) : t < 22 ? 1 : mix(1, 0, (t - 22) / 2), point, length };
}
export const trainPhaseText: Record<TrainPhase, string> = {
  deploying: 'The robotic ramp is rolling out of its shed on rails.',
  boarding: 'Boarding the steam train through the near-side doorway.',
  retracting: 'On board. The ramp is returning to its shed before departure.',
  travelling: 'Steam train: a short ride to the next stop.',
  'exit-ramp': 'At the next stop. The opposite-side ramp is moving into position.',
  exiting: 'Leaving through the opposite doorway onto the arrival platform.',
  stowing: 'Safely off the train. The robotic ramp is returning to its shed.',
};
