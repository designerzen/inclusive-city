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
  const widthAt = (distance: number) => {
    for (let edge = 1; edge < streets.length; edge++) {
      const centre = milestones[edge]!;
      const span = Math.min(trajectory.minimumRadius * Math.PI / 4, centre - milestones[edge - 1]!, milestones[edge + 1]! - centre);
      if (span <= 1e-9 || distance < centre - span || distance > centre + span) continue;
      const t = (distance - centre + span) / (span * 2), blend = t * t * (3 - 2 * t);
      return streets[edge - 1]!.width + (streets[edge]!.width - streets[edge - 1]!.width) * blend;
    }
    return streets[edgeAt(distance)]?.width ?? 1;
  };
  const sides = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)]!, b = points[Math.min(points.length - 1, i + 1)]!;
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
    // Unequal street widths must blend through the bend; changing width at one
    // sample creates a sharp kerb even when the centre line is already smooth.
    const half = Math.max(.3, widthAt(distances[i]!) / 2);
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
