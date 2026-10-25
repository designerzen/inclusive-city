import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon } from 'polygon-clipping';
import { bodyFoldingPose } from './bodyFolding';
import type { BaseBodyModel, Point, Point3 } from './bodyNet';

export const exposureLabels = {
  matrix: 'micro:bit LED matrix / light sensing', laser: 'Matrix laser ranging',
  lightLeft: 'Left light sensor', lightRight: 'Right light sensor', infrared: 'Infrared receiver',
  lineOuterLeft: 'Line sensor · outer left', lineInnerLeft: 'Line sensor · inner left',
  lineCentre: 'Line sensor · centre', lineInnerRight: 'Line sensor · inner right', lineOuterRight: 'Line sensor · outer right',
  microphone: 'micro:bit V2 microphone',
};
export type ExposureKey = keyof typeof exposureLabels;
export interface ExposureSettings {
  enabled: Record<ExposureKey, boolean>;
  margin: number; frontOffset: number; matrixHeight: number; laserHeight: number; laserTilt: number;
}
export const exposureRanges = { margin: [2, 10, 1], frontOffset: [20, 70, 1], matrixHeight: [35, 100, 1], laserHeight: [100, 230, 1], laserTilt: [-30, 30, 1] } as const;
export const defaultExposure: ExposureSettings = {
  enabled: Object.fromEntries(Object.keys(exposureLabels).map(key => [key, !['lightLeft', 'lightRight', 'infrared'].includes(key)])) as Record<ExposureKey, boolean>,
  margin: 5, frontOffset: 45, matrixHeight: 60, laserHeight: 175, laserTilt: 0,
};
export function normaliseExposure(input: unknown): ExposureSettings {
  const data = input && typeof input === 'object' ? input as Partial<ExposureSettings> : {};
  const result: ExposureSettings = { ...defaultExposure, enabled: { ...defaultExposure.enabled } };
  for (const key of Object.keys(exposureLabels) as ExposureKey[]) if (typeof data.enabled?.[key] === 'boolean') result.enabled[key] = data.enabled[key];
  for (const key of Object.keys(exposureRanges) as (keyof typeof exposureRanges)[]) {
    const value = data[key], [min, max, step] = exposureRanges[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = min + Math.round((Math.max(min, Math.min(max, value)) - min) / step) * step;
  }
  return result;
}
export interface ExposureZone { key: ExposureKey; origin: Point3; forward: Point3; right: Point3; up: Point3; halfWidth: number; halfHeight: number; spread: number }
export function exposureZones(settings: ExposureSettings): ExposureZone[] {
  const zone = (key: ExposureKey, origin: Point3, halfWidth: number, halfHeight: number, angle = 0, tilt = 0): ExposureZone => {
    const a = tilt * Math.PI / 180;
    return { key, origin, forward: [0, Math.sin(a), Math.cos(a)], right: [1, 0, 0], up: [0, Math.cos(a), -Math.sin(a)], halfWidth, halfHeight, spread: Math.tan(angle * Math.PI / 180) };
  };
  const z = settings.frontOffset;
  return [
    zone('matrix', [0, settings.matrixHeight, z], 15, 15),
    zone('laser', [0, settings.laserHeight, 0], 8, 8, 30, settings.laserTilt),
    zone('lightLeft', [-35, 25, z], 6, 6, 30, 30), zone('lightRight', [35, 25, z], 6, 6, 30, 30),
    zone('infrared', [0, 30, z + 5], 6, 6, 40),
    ...(['lineOuterLeft', 'lineInnerLeft', 'lineCentre', 'lineInnerRight', 'lineOuterRight'] as ExposureKey[]).map((key, i) => ({
      key, origin: [(i - 2) * 18, 8, z] as Point3, forward: [0, -1, 0] as Point3, right: [1, 0, 0] as Point3, up: [0, 0, 1] as Point3, halfWidth: 4, halfHeight: 4, spread: Math.tan(25 * Math.PI / 180),
    })),
    zone('microphone', [17, settings.matrixHeight + 18, z], 6, 6),
  ].filter(zone => settings.enabled[zone.key]);
}
const dot = (a: Point3, b: Point3) => a.reduce((sum, v, i) => sum + v * b[i], 0);
/** All half-spaces are linear, so their intersection with each rigid face is exact. */
export function zonePlanes(zone: ExposureZone, margin: number): ((point: Point3) => number)[] {
  const local = (p: Point3) => { const v = p.map((x, i) => x - zone.origin[i]) as Point3; return [dot(v, zone.forward), dot(v, zone.right), dot(v, zone.up)]; };
  return [p => local(p)[0], ...[-1, 1].flatMap(sign => [
    (p: Point3) => { const [f, r] = local(p); return zone.halfWidth + margin + f * zone.spread + sign * r; },
    (p: Point3) => { const [f, , u] = local(p); return zone.halfHeight + margin + f * zone.spread + sign * u; },
  ])];
}
export const ringArea = (ring: Point[]) => Math.abs(ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
export const materialArea = (polygons: MultiPolygon) => polygons.reduce((sum, polygon) => sum + ringArea(polygon[0]) - polygon.slice(1).reduce((s, ring) => s + ringArea(ring), 0), 0);
function clipPlane(polygon: Point[], plane: (point: Point) => number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = plane(a), db = plane(b);
    if (da >= -1e-9) result.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return result;
}
const snap = (p: Point[]): Point[] => p.map(v => v.map(n => Math.round(n * 1e7) / 1e7) as Point);
const geometry = (ring: Point[]): Polygon => [ring];
/** Boolean intersections can leave coincident points along shared creases.
 * Remove sub-micron slivers before triangulation or rounding an SVG contour. */
function clean(polygons: MultiPolygon): MultiPolygon {
  const ring = (input: Point[]) => {
    const points: Point[] = [];
    for (const p of snap(input)) if (!points.length || Math.hypot(p[0] - points.at(-1)![0], p[1] - points.at(-1)![1]) > 1e-5) points.push(p);
    if (points.length > 1 && Math.hypot(points[0][0] - points.at(-1)![0], points[0][1] - points.at(-1)![1]) < 1e-5) points.pop();
    let changed = true;
    while (changed && points.length > 3) {
      changed = false;
      for (let i = 0; i < points.length; i++) {
        const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
        if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-7 * (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]))) { points.splice(i, 1); changed = true; break; }
      }
    }
    return points;
  };
  return polygons.flatMap(polygon => {
    const rings = polygon.map(ring);
    if (rings[0].length < 3 || ringArea(rings[0]) < 1e-5) return [];
    return [[rings[0], ...rings.slice(1).filter(p => p.length >= 3 && ringArea(p) > 1e-5)]];
  });
}
function inside(p: Point, ring: Point[]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) : 0;
    if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) < 1e-5) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
/** Split score lines at every cut; never score across an aperture. */
export function trimFold(segment: Point[], cuts: Point[][]): Point[][] {
  const [a, b] = segment, dx = b[0] - a[0], dy = b[1] - a[1], ts = [0, 1];
  for (const cut of cuts) for (let i = 0; i < cut.length; i++) {
    const c = cut[i], d = cut[(i + 1) % cut.length], ex = d[0] - c[0], ey = d[1] - c[1], det = dx * ey - dy * ex;
    if (Math.abs(det) < 1e-10) continue;
    const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / det;
    const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / det;
    if (t > 0 && t < 1 && u >= -1e-8 && u <= 1 + 1e-8) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const result: Point[][] = [];
  for (let i = 1; i < ts.length; i++) {
    const low = ts[i - 1], high = ts[i]; if (high - low < 1e-8) continue;
    const mid: Point = [a[0] + dx * (low + high) / 2, a[1] + dy * (low + high) / 2];
    if (!cuts.some(cut => inside(mid, cut))) result.push([[a[0] + dx * low, a[1] + dy * low], [a[0] + dx * high, a[1] + dy * high]]);
  }
  return result;
}
export function buildBodyExposure(model: BaseBodyModel, input?: ExposureSettings) {
  // Generic geometry remains available to callers that have no hardware profile.
  const settings = input ? normaliseExposure(input) : { ...defaultExposure, enabled: Object.fromEntries(Object.keys(exposureLabels).map(k => [k, false])) as ExposureSettings['enabled'] };
  const zones = exposureZones(settings), pose = bodyFoldingPose(model, 1);
  const cuts: Point[][] = [], zoneCuts = zones.map(zone => ({ key: zone.key, area: 0 }));
  const surfaces = [...model.faces.map((face, i) => ({ face: i, flat: face.flat })), ...model.tabPolygons.map(flat => ({ face: model.p.sides, flat }))];
  const windows = surfaces.map(surface => zones.flatMap((zone, j) => {
    let cut = surface.flat;
    for (const plane of zonePlanes(zone, settings.margin)) cut = clipPlane(cut, p => plane(pose.point(surface.face, p)));
    cut = snap(cut);
    if (cut.length < 3 || ringArea(cut) < 1e-6) return [];
    zoneCuts[j].area += ringArea(cut); cuts.push(cut); return [cut];
  }));
  const subtract = (ring: Point[], holes: Point[][]): MultiPolygon => clean(holes.length ? polygonClipping.difference(geometry(snap(ring)), ...holes.map(geometry)) : [[snap(ring)]]);
  const panelPolygons = model.faces.map((face, i) => subtract(face.flat, [...windows[i], ...(i === 0 ? model.slots : [])]));
  const tabs = model.tabPolygons.map((tab, i) => subtract(tab, windows[model.p.sides + i]));
  const net = subtract(model.boundary, [...model.slots, ...cuts]);
  const foldGroups = model.folds.map(fold => trimFold(fold, cuts));
  const weakHinge = foldGroups.some((pieces, i) => pieces.reduce((sum, line) => sum + Math.hypot(line[1][0] - line[0][0], line[1][1] - line[0][1]), 0) < (i < model.p.sides - 1 ? 6 : 8));
  const seamConflict = cuts.some(cut => model.slots.some(slot => materialArea(polygonClipping.intersection(geometry(cut), geometry(slot))) > 1e-6)) || windows.slice(model.p.sides).some(list => list.length > 0);
  const valid = net.length === 1 && panelPolygons.every(polygons => materialArea(polygons) > 1) && !weakHinge && !seamConflict;
  return { settings, zones, cuts, zoneCuts, panelPolygons, tabs, net, folds: foldGroups.flat(), valid, active: zones.length > 0,
    reason: net.length !== 1 ? 'Exposure openings would split the card into separate pieces.' : weakHinge ? 'Exposure openings leave too little card at a fold.' : seamConflict ? 'Exposure openings intersect the closing tabs or slots.' : !valid ? 'Exposure openings remove an entire panel.' : '' };
}
