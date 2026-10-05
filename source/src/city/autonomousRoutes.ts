import { routeToGoal, type ProceduralCity } from './proceduralCity';

/** Keep ambient traffic on loops, away from the studio and the default journey. */
export function autonomousRoutes(world: ProceduralCity) {
  const goal = world.nodes.find(n => n.id === world.destination)!;
  const nodes = new Map(world.nodes.map(n => [n.id, n]));
  const reserved = new Set(routeToGoal(world) ?? [world.start, world.destination]);
  const streets = world.streets.filter(street => {
    const a = nodes.get(street.a)!, b = nodes.get(street.b)!;
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((goal.x - a.x) * dx + (goal.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    return !reserved.has(a.id) && !reserved.has(b.id) && Math.hypot(a.x + t * dx - goal.x, a.z + t * dz - goal.z) >= 10;
  });
  const allowed = new Set(world.nodes.map(n => n.id));
  // Repeat pruning: removing a leaf can expose an entire dead-end branch.
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of allowed) {
      const degree = streets.filter(s => (s.a === id && allowed.has(s.b)) || (s.b === id && allowed.has(s.a))).length;
      if (degree < 2) { allowed.delete(id); changed = true; }
    }
  }
  return new Map(world.nodes.filter(n => allowed.has(n.id)).map(n => [n.id, streets
    .filter(s => s.a === n.id && allowed.has(s.b) || s.b === n.id && allowed.has(s.a))
    .map(s => nodes.get(s.a === n.id ? s.b : s.a)!)]));
}
