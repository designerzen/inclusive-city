import type { CityBuilding, ProceduralCity } from './proceduralCity';
import { cityRoadNetwork } from './cityRoadNetwork';
import { buildingRouteClearance } from './routeClearance';

/** Reserve complete road bends instead of forcing the follower to turn sharply. */
export function reserveRoadSpace(world: ProceduralCity, radius: number, relocate: (name: string, x: number, z: number) => void) {
  const { turns } = cityRoadNetwork(world, radius);
  const clear = (lot: CityBuilding) => {
    for (const { path, streets } of turns) {
      const allowed = buildingRouteClearance([lot], Math.max(...streets.map(s => s.width)) / 2 + .3);
      if (path.points.some((p, i) => i > 0 && !allowed(path.points[i - 1]!, p))) return false;
    }
    for (const s of world.streets) {
      const a = world.nodes.find(n => n.id === s.a)!, b = world.nodes.find(n => n.id === s.b)!;
      if (!buildingRouteClearance([lot], s.width / 2 + .3)(a, b)) return false;
    }
    const goal = world.nodes.find(n => n.id === world.destination)!;
    return Math.abs(lot.x - goal.x) > 10 + lot.w / 2 || Math.abs(lot.z - goal.z) > 10 + lot.d / 2;
  };
  const garage = world.bicycleGarage;
  const lots = [...world.buildings, ...(garage ? [{ name: '__garage', ...garage, w: 5.5, d: 4.5, h: 2 }] : [])];
  const xs = [...new Set(world.nodes.map(n => n.x))].sort((a, b) => a - b), zs = [...new Set(world.nodes.map(n => n.z))].sort((a, b) => a - b);
  const candidates = xs.slice(1).flatMap((x, i) => zs.slice(1).map((z, j) => ({ x: (x + xs[i]!) / 2, z: (z + zs[j]!) / 2 })));
  for (let row = 0; row < lots.length + 1; row++) {
    const z = zs[0]! + row * 6;
    candidates.push({ x: xs[0]! - 7, z }, { x: xs.at(-1)! + 7, z });
  }
  let changed = false;
  for (const lot of lots) {
    if (clear(lot)) continue;
    const destination = [...candidates].sort((a, b) => Math.hypot(a.x - lot.x, a.z - lot.z) - Math.hypot(b.x - lot.x, b.z - lot.z))
      .find(p => clear({ ...lot, ...p }) && lots.every(other => other === lot || Math.abs(other.x - p.x) >= (other.w + lot.w) / 2 + .5 || Math.abs(other.z - p.z) >= (other.d + lot.d) / 2 + .5));
    if (!destination) continue;
    if (lot.name === '__garage') { Object.assign(garage!, destination); Object.assign(lot, destination); }
    else relocate(lot.name, destination.x, destination.z);
    changed = true;
  }
  return changed;
}
