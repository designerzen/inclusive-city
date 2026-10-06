import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';

export interface RoadRectangle { id: string; minX: number; maxX: number; minZ: number; maxZ: number }
export type RoadClearance = Omit<RoadRectangle, 'id'>;
export interface RoadSurfaceData { positions: number[]; indices: number[]; normals: number[] }

/** Partition the union before triangulating: no two streets draw the same face. */
export function roadSurfaceData(rectangles: readonly RoadRectangle[], radius = .65, occupied: readonly RoadClearance[] = []) {
  const result = new Map<string, RoadSurfaceData>(rectangles.map(r => [r.id, { positions: [], indices: [], normals: [] }]));
  const xs = [...new Set(rectangles.flatMap(r => [r.minX, r.maxX]))].sort((a, b) => a - b);
  const zs = [...new Set(rectangles.flatMap(r => [r.minZ, r.maxZ]))].sort((a, b) => a - b);
  const cells: (RoadRectangle | undefined)[][] = [];
  const polygon = (road: RoadRectangle, points: number[][]) => {
    const data = result.get(road.id)!, base = data.positions.length / 3;
    for (const [x, z] of points) { data.positions.push(x!, .075, z!); data.normals.push(0, 1, 0); }
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[0]!, b = points[i]!, c = points[i + 1]!;
      const cross = (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
      // Babylon's default scene uses left-handed face winding.
      data.indices.push(base, base + (cross > 0 ? i : i + 1), base + (cross > 0 ? i + 1 : i));
    }
  };
  for (let i = 0; i < xs.length - 1; i++) {
    cells[i] = [];
    for (let j = 0; j < zs.length - 1; j++) {
      const x = (xs[i]! + xs[i + 1]!) / 2, z = (zs[j]! + zs[j + 1]!) / 2;
      const road = rectangles.find(r => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
      cells[i]![j] = road;
      if (road) polygon(road, [[xs[i]!, zs[j]!], [xs[i + 1]!, zs[j]!], [xs[i + 1]!, zs[j + 1]!], [xs[i]!, zs[j + 1]!]]);
    }
  }
  const corners: { x: number; z: number; sx: number; sz: number; road: RoadRectangle }[] = [];
  for (let i = 1; i < xs.length - 1; i++) for (let j = 1; j < zs.length - 1; j++) {
    const quadrants = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
    const owners = quadrants.map(([sx, sz]) => cells[i + (sx < 0 ? -1 : 0)]?.[j + (sz < 0 ? -1 : 0)]);
    if (owners.filter(Boolean).length !== 3) continue;
    const [sx, sz] = quadrants[owners.findIndex(r => !r)]!;
    corners.push({ x: xs[i]!, z: zs[j]!, sx, sz, road: owners.find(r => r)! });
  }
  const bounds = (corner: typeof corners[number], r: number) => ({
    minX: Math.min(corner.x, corner.x + corner.sx * r), maxX: Math.max(corner.x, corner.x + corner.sx * r),
    minZ: Math.min(corner.z, corner.z + corner.sz * r), maxZ: Math.max(corner.z, corner.z + corner.sz * r),
  });
  const overlaps = (a: RoadClearance, b: RoadClearance) =>
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 1e-8 &&
    Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 1e-8;
  // Bound each tangent by the continuous straight kerb beside it.
  const tangentLength = (x: number, z: number, direction: number, axis: 'x' | 'z') => {
    const intervals = rectangles.filter(r => axis === 'x' ? z > r.minZ && z < r.maxZ : x > r.minX && x < r.maxX)
      .map(r => axis === 'x' ? [r.minX, r.maxX] : [r.minZ, r.maxZ]);
    let end = axis === 'x' ? x : z;
    for (let pass = 0; pass < intervals.length; pass++) for (const [lo, hi] of intervals) {
      if (lo! <= end + 1e-8 && hi! >= end - 1e-8) end = direction > 0 ? Math.max(end, hi!) : Math.min(end, lo!);
    }
    return Math.abs(end - (axis === 'x' ? x : z));
  };
  for (const corner of corners) {
    const { x, z, sx, sz, road } = corner;
    let r = Math.min(radius, tangentLength(x, z - sz * 1e-6, sx, 'x'), tangentLength(x - sx * 1e-6, z, sz, 'z'));
    // Stay inside the empty quadrant, including when a nearby street is widened.
    for (const rectangle of [...rectangles, ...occupied]) {
      const nearX = sx > 0 ? rectangle.minX - x : x - rectangle.maxX;
      const farX = sx > 0 ? rectangle.maxX - x : x - rectangle.minX;
      const nearZ = sz > 0 ? rectangle.minZ - z : z - rectangle.maxZ;
      const farZ = sz > 0 ? rectangle.maxZ - z : z - rectangle.minZ;
      if (farX > 1e-8 && farZ > 1e-8) r = Math.min(r, Math.max(0, nearX, nearZ));
    }
    for (const other of corners) if (other !== corner && overlaps(bounds(corner, radius), bounds(other, radius))) {
      r = Math.min(r, Math.max(Math.abs(other.x - x), Math.abs(other.z - z)) / 2);
    }
    if (r < 1e-8) continue;
    const points = [[x, z]];
    // A circular kerb return tangent to both straight road edges.
    const segments = Math.max(24, Math.ceil(r * 8));
    for (let step = 0; step <= segments; step++) {
      const angle = -Math.PI / 2 - step * Math.PI / (2 * segments);
      points.push([x + sx * r * (1 + Math.cos(angle)), z + sz * r * (1 + Math.sin(angle))]);
    }
    polygon(road, points);
  }
  return result;
}

export function updateRoadSurface(mesh: Mesh, data: RoadSurfaceData) {
  mesh.setEnabled(data.indices.length > 0);
  if (!data.indices.length) return;
  const vertices = new VertexData();
  // Keep mesh origin at the street centre for the dimension drag controls.
  vertices.positions = data.positions.map((v, i) => v - (i % 3 === 0 ? mesh.position.x : i % 3 === 2 ? mesh.position.z : 0));
  vertices.indices = data.indices; vertices.normals = data.normals;
  vertices.applyToMesh(mesh);
}

export function createRoadSurface(name: string, scene: Scene) { return new Mesh(name, scene); }
