import type { CityBuilding, ProceduralCity } from './proceduralCity';
import type { RoutePoint } from './cityLayout';

export const buildingSymbols = { gallery: '▣', 'record-store': '◎', museum: '🏛' } as const;
export const buildingDescriptions = {
  gallery: 'Gallery: introduces geometric brushwork and bell-like musical colour.',
  'record-store': 'Record store: adds another musical part.',
  museum: 'Museum: brings back the original brush style and adds an echo of the melody.',
};

/** Encounter the nearest adjoining street, including on sides without a doorway. */
export function buildingFrontage(building: CityBuilding, world: ProceduralCity) {
  let closest = { x: building.x, y: 0, z: building.z, distance: Infinity, street: '' };
  for (const street of world.streets) {
    if (street.kind === 'bridge' || street.id === world.steamTrain?.street) continue;
    const a = world.nodes.find(n => n.id === street.a)!, b = world.nodes.find(n => n.id === street.b)!;
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(.15, Math.min(.85, ((building.x - a.x) * dx + (building.z - a.z) * dz) / (dx * dx + dz * dz)));
    const x = a.x + t * dx, z = a.z + t * dz, distance = Math.hypot(x - building.x, z - building.z);
    if (distance < closest.distance) closest = { x, y: a.y + t * (b.y - a.y), z, distance, street: street.id };
  }
  return closest;
}

export function passedFrontage(from: RoutePoint, to: RoutePoint, frontage: RoutePoint, radius = 2.5) {
  const dx = to.x - from.x, dz = to.z - from.z, length = dx * dx + dz * dz;
  if (length < 1e-8) return false;
  const t = Math.max(0, Math.min(1, ((frontage.x - from.x) * dx + (frontage.z - from.z) * dz) / length));
  return Math.abs(from.y + t * (to.y - from.y) - frontage.y) < .6
    && Math.hypot(from.x + t * dx - frontage.x, from.z + t * dz - frontage.z) <= radius;
}
