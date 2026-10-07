import type { RouteTrajectory } from './routeTrajectory';
import type { RoadPolygon } from './roadPolygonUnion';

/** The asphalt corridor is offset from the exact line followed by the robot. */
export function routeRoadPolygons(trajectory: RouteTrajectory, streets: readonly { id: string; width: number; transport?: boolean }[]) {
  const { points, distances, milestones } = trajectory;
  const edgeAt = (distance: number) => {
    let edge = 0;
    while (edge < streets.length - 1 && milestones[edge + 1]! <= distance + 1e-9) edge++;
    return edge;
  };
  const sides = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)]!, b = points[Math.min(points.length - 1, i + 1)]!;
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
    const half = Math.max(.3, (streets[edgeAt(distances[i]!)]?.width ?? 1) / 2);
    return [[p.x - dz / length * half, p.z + dx / length * half], [p.x + dz / length * half, p.z - dx / length * half]];
  });
  const polygons: RoadPolygon[] = [];
  for (let i = 1; i < points.length; i++) {
    const street = streets[edgeAt((distances[i - 1]! + distances[i]!) / 2)];
    if (!street || street.transport) continue;
    polygons.push({ id: street.id, needsClearance: true, points: [sides[i - 1]![0]!, sides[i]![0]!, sides[i]![1]!, sides[i - 1]![1]!] });
  }
  return polygons;
}
