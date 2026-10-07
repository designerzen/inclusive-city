import type { RoadClearance, RoadSurfaceData } from './roadSurface';

export interface RoadPolygon { id: string; points: readonly (readonly number[])[]; needsClearance?: boolean }

/** Sweep the polygon union into disjoint trapezoids, including curved road ribbons.
 * Edge intersections split the sweep so overlapping streets never share a face.
 */
export function roadPolygonUnion(polygons: readonly RoadPolygon[], occupied: readonly RoadClearance[] = []) {
  const result = new Map<string, RoadSurfaceData>();
  type Edge = { lo: number; hi: number; z: (x: number) => number; polygon: number };
  const edges: Edge[] = [], cuts = new Set<number>();
  polygons.forEach((p, polygon) => {
    if (!result.has(p.id)) result.set(p.id, { positions: [], normals: [], indices: [] });
    p.points.forEach((a, i) => {
      const b = p.points[(i + 1) % p.points.length]!;
      cuts.add(a[0]!);
      if (Math.abs(a[0]! - b[0]!) < 1e-10) return;
      const slope = (b[1]! - a[1]!) / (b[0]! - a[0]!);
      edges.push({ lo: Math.min(a[0]!, b[0]!), hi: Math.max(a[0]!, b[0]!),
        z: x => a[1]! + slope * (x - a[0]!), polygon });
    });
  });
  // Clearance boundaries also split the sweep and its vertical bands.
  const masks = occupied.flatMap(r => {
    cuts.add(r.minX); cuts.add(r.maxX);
    return [r.minZ, r.maxZ].map(z => ({ lo: r.minX, hi: r.maxX, z: () => z, polygon: -1 }));
  });
  const allEdges = [...edges, ...masks];
  for (let i = 0; i < allEdges.length; i++) for (let j = i + 1; j < allEdges.length; j++) {
    const a = allEdges[i]!, b = allEdges[j]!, lo = Math.max(a.lo, b.lo), hi = Math.min(a.hi, b.hi);
    if (hi - lo < 1e-9) continue;
    const d0 = a.z(lo) - b.z(lo), d1 = a.z(hi) - b.z(hi);
    if (d0 * d1 < -1e-12) cuts.add(lo + (hi - lo) * d0 / (d0 - d1));
  }
  const xs = [...cuts].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const left = xs[i - 1]!, right = xs[i]!, x = (left + right) / 2;
    if (right - left < 1e-9) continue;
    const active = allEdges.filter(e => e.lo < x && e.hi > x).sort((a, b) => a.z(x) - b.z(x));
    const interiors = new Map<number, [number, number][]>();
    for (let p = 0; p < polygons.length; p++) {
      const crossings = active.filter(e => e.polygon === p);
      interiors.set(p, crossings.filter((_, n) => n % 2 === 0).map((e, n) => [e.z(x), crossings[n * 2 + 1]!.z(x)]));
    }
    for (let n = 1; n < active.length; n++) {
      const low = active[n - 1]!, high = active[n]!, z = (low.z(x) + high.z(x)) / 2;
      if (high.z(x) - low.z(x) < 1e-9) continue;
      const blocked = occupied.some(r => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
      const owner = polygons.findIndex((p, k) => (!blocked || !p.needsClearance) && interiors.get(k)!.some(([lo, hi]) => z > lo && z < hi));
      if (owner < 0) continue;
      const data = result.get(polygons[owner]!.id)!, base = data.positions.length / 3;
      const points = [[left, low.z(left)], [right, low.z(right)], [right, high.z(right)], [left, high.z(left)]];
      for (const [px, pz] of points) { data.positions.push(px!, .075, pz!); data.normals.push(0, 1, 0); }
      for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
        const pa = points[a!]!, pb = points[b!]!, pc = points[c!]!;
        if (Math.abs((pb[0]! - pa[0]!) * (pc[1]! - pa[1]!) - (pb[1]! - pa[1]!) * (pc[0]! - pa[0]!)) > 1e-12)
          data.indices.push(base + a!, base + b!, base + c!);
      }
    }
  }
  return result;
}
