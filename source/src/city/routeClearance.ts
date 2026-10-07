import type { RoutePoint } from './cityLayout';
import type { CityBuilding, ProceduralCity } from './proceduralCity';
import { isHumpbackBridge } from './humpbackBridge';

export function cityRouteClearance(world: ProceduralCity, radius: number) {
  // Raised features on other streets also obstruct a corner-cutting bend.
  const raised = world.streets.filter(street => isHumpbackBridge(street, world)).map(street => {
    const a = world.nodes.find(node => node.id === street.a)!, b = world.nodes.find(node => node.id === street.b)!;
    return { name: street.id, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
      w: Math.abs(a.x - b.x) || street.width, d: Math.abs(a.z - b.z) || street.width, h: 1 };
  });
  return buildingRouteClearance([...world.buildings, ...raised], radius);
}

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
