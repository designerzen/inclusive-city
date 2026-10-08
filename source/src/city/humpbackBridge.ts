import type { CityStreet, ProceduralCity } from './proceduralCity';
import type { RoutePoint } from './cityLayout';

export type BridgeAccess = 'steps' | 'ramp' | 'elevator';
export const bridgeHeight = .9;
// Junction bends can leave a very short straight span. Keep its ramp below
// the controller's slope limit instead of squeezing a full-height hump into it.
export function bridgeRampRise(length: number) { return Math.min(bridgeHeight, length * .4 * .45); }
export function isHumpbackBridge(street: CityStreet, world: ProceduralCity) {
  return street.id !== world.steamTrain?.street && (street.kind === 'stairs' || street.kind === 'bridge');
}
export function rampHeight(t: number) { return bridgeHeight * Math.max(0, Math.min(1, t / .4, (1 - t) / .4)); }
export function elevatorPose(a: RoutePoint, b: RoutePoint, seconds: number, speed: number) {
  const length = Math.hypot(b.x - a.x, b.z - a.z), walkSeconds = length / speed;
  const duration = walkSeconds + 4, t = Math.max(0, Math.min(seconds, duration));
  const progress = Math.max(0, Math.min(1, (t - 2) / walkSeconds));
  const lift = Math.min(1, t / 2, (duration - t) / 2);
  return { duration, progress, lifting: t < 2 || t >= duration - 2,
    position: { x: a.x + (b.x - a.x) * progress, y: a.y + bridgeHeight * lift, z: a.z + (b.z - a.z) * progress } };
}
