import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ProceduralCity, CityStreet } from './proceduralCity';
import { RouteTrajectory } from './routeTrajectory';
import { routeRoadPolygons } from './routeRoad';
import type { RoadPolygon } from './roadPolygonUnion';

/** Straight street spans joined by circular bends, including both kerb edges. */
export function cityRoadNetwork(world: ProceduralCity, radius: number, width = (s: CityStreet) => s.width) {
  const polygons: RoadPolygon[] = [];
  const ends = new Map<string, Vector3>();
  const spans = new Map<string, { a: Vector3; b: Vector3 }>();
  const turns: { path: RouteTrajectory; streets: CityStreet[] }[] = [];
  const node = (id: string) => world.nodes.find(n => n.id === id)!;
  for (const junction of world.nodes) {
    const incident = world.streets.filter(s => s.a === junction.id || s.b === junction.id);
    const ground = incident.filter(s => s.id !== world.steamTrain?.street);
    for (let a = 0; a < ground.length; a++) for (let b = a + 1; b < ground.length; b++) {
      const first = ground[a]!, second = ground[b]!;
      const before = node(first.a === junction.id ? first.b : first.a), after = node(second.a === junction.id ? second.b : second.a);
      const incoming = new Vector3(junction.x - before.x, 0, junction.z - before.z).normalize();
      const outgoing = new Vector3(after.x - junction.x, 0, after.z - junction.z).normalize();
      if (Math.abs(Vector3.Dot(incoming, outgoing)) > .99999) continue;
      const path = new RouteTrajectory([before, junction, after], new Map(), radius);
      // Only the bend belongs to this junction. Straight spans are emitted once.
      if (path.points.length < 4) continue;
      const bend = new RouteTrajectory([], new Map(), radius);
      bend.points.push(...path.points.slice(1, -1));
      for (let i = 1; i < bend.points.length; i++) bend.distances.push(bend.distances[i - 1]! + Vector3.Distance(bend.points[i - 1]!, bend.points[i]!));
      bend.milestones.push(0, bend.length / 2, bend.length);
      const streets = [first, second]; turns.push({ path: bend, streets });
      polygons.push(...routeRoadPolygons(bend, streets.map(s => ({ id: s.id, width: width(s) }))));
      for (const [street, end] of [[first, bend.points[0]!], [second, bend.points.at(-1)!]] as const) {
        const neighbour = node(street.a === junction.id ? street.b : street.a);
        const direction = new Vector3(neighbour.x - junction.x, 0, neighbour.z - junction.z).normalize();
        const straightThrough = ground.some(other => {
          if (other === street) return false;
          const n = node(other.a === junction.id ? other.b : other.a);
          return Vector3.Dot(direction, new Vector3(n.x - junction.x, 0, n.z - junction.z).normalize()) < -.99999;
        });
        if (!straightThrough) ends.set(`${street.id}:${junction.id}`, end);
      }
    }
  }
  for (const street of world.streets) {
    const a = ends.get(`${street.id}:${street.a}`) ?? node(street.a), b = ends.get(`${street.id}:${street.b}`) ?? node(street.b);
    spans.set(street.id, { a: new Vector3(a.x, a.y, a.z), b: new Vector3(b.x, b.y, b.z) });
    if (street.id === world.steamTrain?.street) continue;
    const originalA = node(street.a), originalB = node(street.b);
    // Adjacent bends may meet without leaving a straight section between them.
    if ((b.x - a.x) * (originalB.x - originalA.x) + (b.z - a.z) * (originalB.z - originalA.z) <= 1e-8) continue;
    const straight = new RouteTrajectory([a, b]);
    polygons.push(...routeRoadPolygons(straight, [{ id: street.id, width: width(street) }]));
  }
  // Preserve a mesh entry for a street that consists entirely of bends.
  return { polygons, turns, spans };
}
