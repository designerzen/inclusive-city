import type { RoutePoint } from './cityLayout';
import type { CityBuilding } from './proceduralCity';

/** Swept capsule clearance in the map plane, including contact tolerance. */
export function buildingRouteClearance(buildings: readonly CityBuilding[], radius: number) {
  const bounds = buildings.map(b => ({
    minX: b.x - b.w / 2 - radius, maxX: b.x + b.w / 2 + radius,
    minZ: b.z - b.d / 2 - radius, maxZ: b.z + b.d / 2 + radius,
  }));
  return (a: RoutePoint, b: RoutePoint) => bounds.every(box => {
    let enter = 0, leave = 1;
    for (const [start, delta, min, max] of [
      [a.x, b.x - a.x, box.minX, box.maxX],
      [a.z, b.z - a.z, box.minZ, box.maxZ],
    ]) {
      if (Math.abs(delta!) < 1e-12) {
        if (start! < min! || start! > max!) return true;
      } else {
        const t1 = (min! - start!) / delta!, t2 = (max! - start!) / delta!;
        enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
        if (enter > leave) return true;
      }
    }
    return false;
  });
}
