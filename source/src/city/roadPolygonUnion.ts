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
  const masks = occupied.flatMap((r, index) => {
    cuts.add(r.minX); cuts.add(r.maxX);
    return [r.minZ, r.maxZ].map(z => ({ lo: r.minX, hi: r.maxX, z: () => z, polygon: -index - 1 }));
  });
  const allEdges = [...edges, ...masks].sort((a, b) => a.lo - b.lo);
  // Compare only edges whose x ranges overlap, rather than every city edge.
  for (let i = 0; i < allEdges.length; i++) for (let j = i + 1; j < allEdges.length && allEdges[j]!.lo < allEdges[i]!.hi; j++) {
    const a = allEdges[i]!, b = allEdges[j]!, lo = Math.max(a.lo, b.lo), hi = Math.min(a.hi, b.hi);
    if (hi - lo < 1e-9) continue;
    const d0 = a.z(lo) - b.z(lo), d1 = a.z(hi) - b.z(hi);
    if (d0 * d1 < -1e-12) cuts.add(lo + (hi - lo) * d0 / (d0 - d1));
  }
  const xs = [...cuts].sort((a, b) => a - b);
  const live = new Set<Edge>();
  type Band = { id: string; low: Edge; high: Edge; left: number; right: number };
  let pending: Band[] = [];
  const emit = ({ id, low, high, left, right }: Band) => {
    const data = result.get(id)!, base = data.positions.length / 3;
    const points = [[left, low.z(left)], [right, low.z(right)], [right, high.z(right)], [left, high.z(left)]];
    for (const [px, pz] of points) { data.positions.push(px!, .075, pz!); data.normals.push(0, 1, 0); }
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const pa = points[a!]!, pb = points[b!]!, pc = points[c!]!;
      if (Math.abs((pb[0]! - pa[0]!) * (pc[1]! - pa[1]!) - (pb[1]! - pa[1]!) * (pc[0]! - pa[0]!)) > 1e-12)
        data.indices.push(base + a!, base + b!, base + c!);
    }
  };
  let next = 0;
  for (let i = 1; i < xs.length; i++) {
    const left = xs[i - 1]!, right = xs[i]!, x = (left + right) / 2;
    if (right - left < 1e-9) continue;
    while (next < allEdges.length && allEdges[next]!.lo < x) live.add(allEdges[next++]!);
    for (const e of live) if (e.hi <= x) live.delete(e);
    const active = [...live].sort((a, b) => a.z(x) - b.z(x));
    const inside = new Set<number>(), blocked = new Set<number>();
    const bands: { id: string; low: Edge; high: Edge }[] = [];
    for (let n = 1; n < active.length; n++) {
      const low = active[n - 1]!, high = active[n]!;
      const membership = low.polygon < 0 ? blocked : inside;
      if (membership.has(low.polygon)) membership.delete(low.polygon); else membership.add(low.polygon);
      if (high.z(x) - low.z(x) < 1e-9) continue;
      let owner = Infinity;
      for (const p of inside) if (p < owner && (!blocked.size || !polygons[p]!.needsClearance)) owner = p;
      if (!Number.isFinite(owner)) continue;
      const id = polygons[owner]!.id, previous = bands.at(-1);
      // Interior strip edges do not need triangles: keep only owner boundaries.
      if (previous?.id === id && Math.abs(previous.high.z(x) - low.z(x)) < 1e-9) previous.high = high;
      else bands.push({ id, low, high });
    }
    const continued: Band[] = [];
    for (const band of bands) {
      // A distant curve's x cuts must not subdivide every straight road in town.
      const previous = pending.findIndex(p => p.id === band.id && Math.abs(p.right - left) < 1e-9 &&
        [p.low, p.high].every((edge, n) => {
          const other = n === 0 ? band.low : band.high;
          return Math.abs(edge.z(left) - other.z(left)) < 1e-9 && Math.abs(edge.z(right) - other.z(right)) < 1e-9;
        }));
      if (previous < 0) continued.push({ ...band, left, right });
      else { const p = pending.splice(previous, 1)[0]!; p.right = right; continued.push(p); }
    }
    pending.forEach(emit);
    pending = continued;
  }
  pending.forEach(emit);
  return result;
}
