import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { routeCurve } from './routeCurve';
import type { RoutePoint } from './cityLayout';

/** Arc-length coordinates shared by the painted line and its follower. */
export class RouteTrajectory {
  readonly points: Vector3[] = [];
  readonly distances: number[] = [];
  readonly milestones: number[] = [];
  constructor(stops: readonly RoutePoint[], transportEdges: ReadonlyMap<number, readonly RoutePoint[]> = new Map(), minimumRadius = 3,
    segmentIsClear?: (a: RoutePoint, b: RoutePoint) => boolean) {
    const streetCurve = (waypoints: readonly RoutePoint[]): Vector3[] => {
      const curve = routeCurve(waypoints.map(p => new Vector3(p.x, p.y, p.z)), minimumRadius, true, minimumRadius);
      // Obstacles must not change the line into a right angle. The city reserves
      // bend clearance; physical obstructions remain visible, repairable barriers.
      return curve;
    };
    // Transport changes timing and height, not continuity of the visible line.
    // Smooth the complete horizontal itinerary, including boarding and exit.
    const itinerary: RoutePoint[] = [];
    for (let edge = 0; edge < stops.length; edge++) {
      const stop = stops[edge]!;
      if (!itinerary.length || Math.hypot(stop.x - itinerary.at(-1)!.x, stop.z - itinerary.at(-1)!.z) > 1e-8) itinerary.push(stop);
      for (const p of transportEdges.get(edge)?.slice(1, -1) ?? [])
        if (Math.hypot(p.x - itinerary.at(-1)!.x, p.z - itinerary.at(-1)!.z) > 1e-8)
          itinerary.push({ ...p, y: stops[edge]!.y });
    }
    this.points.push(...streetCurve(itinerary));
    this.distances.push(0);
    for (let i = 1; i < this.points.length; i++) this.distances.push(this.distances[i - 1]! + Vector3.Distance(this.points[i - 1]!, this.points[i]!));
    let previous = 0;
    for (let stop = 0; stop < stops.length; stop++) {
      const p = stops[stop]!;
      let best = Infinity, milestone = previous;
      for (let i = 1; i < this.points.length; i++) {
        const a = this.points[i - 1]!, b = this.points[i]!, span = b.subtract(a);
        const low = Math.max(0, (previous - this.distances[i - 1]!) / span.length());
        if (low > 1) continue;
        const t = Math.max(low, Math.min(1, Vector3.Dot(new Vector3(p.x, p.y, p.z).subtract(a), span) / span.lengthSquared()));
        const distance = Vector3.DistanceSquared(a.add(span.scale(t)), new Vector3(p.x, p.y, p.z));
        if (distance < best) { best = distance; milestone = this.distances[i - 1]! + span.length() * t; }
      }
      if (stop === stops.length - 1) milestone = this.length;
      this.milestones.push(milestone); previous = milestone;
    }
  }
  get length() { return this.distances.at(-1) ?? 0; }
  edgeLength(edge: number) { return (this.milestones[edge + 1] ?? this.length) - (this.milestones[edge] ?? 0); }
  sample(distance: number) {
    const d = Math.max(0, Math.min(this.length, distance));
    let i = 1;
    while (i < this.distances.length - 1 && this.distances[i]! <= d + 1e-10) i++;
    const a = this.points[i - 1] ?? this.points[0] ?? Vector3.Zero(), b = this.points[i] ?? a;
    const length = this.distances[i]! - this.distances[i - 1]!;
    const t = length > 0 ? (d - this.distances[i - 1]!) / length : 0;
    return { position: Vector3.Lerp(a, b, t), heading: Math.atan2(a.x - b.x, a.z - b.z),
      remaining: Math.max(0, (this.distances[i] ?? d) - d) };
  }
  atEdge(edge: number, distance: number) { return this.sample((this.milestones[edge] ?? this.length) + distance); }
}
