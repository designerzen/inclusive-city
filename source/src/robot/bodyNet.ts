import { buildBodyExposure } from './bodyExposure';
import type { ExposureSettings } from './bodyExposure';
/** Millimetres throughout. A ring of rigid trapezoids, cut at one generator. */
export interface BodyParameters {
  sides: number; diameter: number; height: number; taper: number; tabs: number;
  thickness: number; clearance: number; skeletonWidth: number; skeletonDepth: number; skeletonHeight: number;
}
export type Point = [number, number];
export type Point3 = [number, number, number];
export const defaultBody: BodyParameters = { sides: 8, diameter: 180, height: 180, taper: 80, tabs: 3, thickness: .5, clearance: 5, skeletonWidth: 100, skeletonDepth: 80, skeletonHeight: 150 };
export const bodyRanges: Record<keyof BodyParameters, [number, number, number]> = {
  sides: [4, 12, 1], diameter: [100, 260, 1], height: [90, 300, 1], taper: [55, 100, 1], tabs: [2, 5, 1],
  thickness: [.2, 1, .1], clearance: [2, 15, 1], skeletonWidth: [30, 200, 1], skeletonDepth: [30, 200, 1], skeletonHeight: [40, 280, 1],
};
export function normaliseBody(input: Partial<BodyParameters>): BodyParameters {
  const result = { ...defaultBody };
  for (const key of Object.keys(bodyRanges) as (keyof BodyParameters)[]) {
    const [min, max, step] = bodyRanges[key], value = input[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Number((min + Math.round((Math.max(min, Math.min(max, value)) - min) / step) * step).toFixed(3));
  }
  return result;
}
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
function makeBodyBase(input: BodyParameters) {
  const p = normaliseBody(input), n = p.sides, ratio = p.taper / 100;
  const apothem = p.diameter / 2, radius = apothem / Math.cos(Math.PI / n);
  const bottom = 2 * radius * Math.sin(Math.PI / n), top = bottom * ratio;
  const edge = Math.hypot(p.height, radius * (1 - ratio));
  const slant = Math.hypot(p.height, apothem * (1 - ratio));
  const angle = ratio === 1 ? 0 : 2 * Math.asin(bottom * (1 - ratio) / (2 * edge));
  const outer = ratio === 1 ? 0 : edge / (1 - ratio);
  const flat = (i: number, t: number): Point => ratio === 1
    ? [i * bottom, p.height * t]
    : [(outer - t * edge) * Math.sin(i * angle), outer - (outer - t * edge) * Math.cos(i * angle)];
  const solid = (i: number, t: number): Point3 => {
    // Put the closing seam behind the hardware; +Z is the front of the robot.
    const r = radius * (1 - t * (1 - ratio)), a = 2 * Math.PI * i / n + Math.PI;
    return [r * Math.sin(a), p.height * t, r * Math.cos(a)];
  };
  const faces = Array.from({ length: n }, (_, i) => ({ flat: [flat(i, 0), flat(i + 1, 0), flat(i + 1, 1), flat(i, 1)], solid: [solid(i, 0), solid(i + 1, 0), solid(i + 1, 1), solid(i, 1)] }));
  const end = flat(n, 0), finish = flat(n, 1);
  const direction: Point = [(finish[0] - end[0]) / edge, (finish[1] - end[1]) / edge];
  const outward: Point = [direction[1], -direction[0]];
  const folds: Point[][] = Array.from({ length: n - 1 }, (_, i) => [flat(i + 1, 0), flat(i + 1, 1)]);
  const tabWidth = 18, tabReach = 16, slotInset = 8;
  const tabPolygons: Point[][] = [], slots: Point[][] = [];
  const boundary: Point[] = [flat(0, 0), ...Array.from({ length: n }, (_, i) => flat(i + 1, 0))];
  for (let j = 1; j <= p.tabs; j++) {
    const distance = edge * j / (p.tabs + 1);
    const rootA = add(end, mul(direction, distance - tabWidth / 2));
    const rootB = add(end, mul(direction, distance + tabWidth / 2));
    const tipA = add(add(rootA, mul(outward, tabReach)), mul(direction, 2));
    const tipB = add(add(rootB, mul(outward, tabReach)), mul(direction, -2));
    tabPolygons.push([rootA, tipA, tipB, rootB]); boundary.push(rootA, tipA, tipB, rootB);
    folds.push([rootA, rootB], [add(rootA, mul(outward, slotInset)), add(rootB, mul(outward, slotInset))]);
    // First seam is vertical in the development; interior of face 1 is +x.
    const width = p.thickness + .3, length = tabWidth + .6;
    slots.push([[slotInset - width / 2, distance - length / 2], [slotInset + width / 2, distance - length / 2], [slotInset + width / 2, distance + length / 2], [slotInset - width / 2, distance + length / 2]]);
  }
  boundary.push(flat(n, 1), ...Array.from({ length: n }, (_, i) => flat(n - i - 1, 1)));
  const xs = boundary.map(v => v[0]), ys = boundary.map(v => v[1]);
  const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  // A conservative circle around the rectangular envelope fits inside every facet.
  const requiredDiameter = Math.hypot(p.skeletonWidth + 2 * p.clearance, p.skeletonDepth + 2 * p.clearance);
  const innerDiameter = p.diameter * ratio - 2 * p.thickness;
  const fits = innerDiameter >= requiredDiameter && p.height >= p.skeletonHeight + p.clearance;
  // Sector must not wrap into itself; tab projections also need a separated seam.
  const valid = n * angle < Math.PI * 1.9 && top > tabReach + 6 && edge / (p.tabs + 1) > tabWidth + 6;
  return { p, faces, boundary, folds, slots, tabPolygons, bounds, edge, slant, bottom, top, angle, innerDiameter, requiredDiameter, fits, valid };
}
export type BaseBodyModel = ReturnType<typeof makeBodyBase>;
export function makeBody(input: BodyParameters, settings?: ExposureSettings) {
  const base = makeBodyBase(input), exposure = buildBodyExposure(base, settings);
  return { ...base, valid: base.valid && exposure.valid, exposure };
}
export type BodyModel = ReturnType<typeof makeBody>;
/** Convex half-plane clipping lets the preview cut the very same slot apertures. */
function clip(polygon: Point[], axis: 0 | 1, value: number, keepGreater: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const insideA = keepGreater ? a[axis] >= value : a[axis] <= value;
    const insideB = keepGreater ? b[axis] >= value : b[axis] <= value;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (value - a[axis]) / (b[axis] - a[axis]); result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}
export function slottedFacePieces(model: BodyModel): Point[][] {
  const polygon = model.faces[0].flat, pieces: Point[][] = [];
  let start = Math.min(...polygon.map(p => p[1]));
  for (const slot of model.slots) {
    const low = slot[0][1], high = slot[2][1];
    pieces.push(clip(clip(polygon, 1, start, true), 1, low, false));
    const band = clip(clip(polygon, 1, low, true), 1, high, false);
    pieces.push(clip(band, 0, slot[0][0], false), clip(band, 0, slot[1][0], true));
    start = high;
  }
  pieces.push(clip(polygon, 1, start, true));
  return pieces.filter(p => p.length >= 3);
}
const number = (n: number) => n.toFixed(4);
const points = (list: Point[]) => list.map(p => p.map(number).join(',')).join(' ');
export function bodySvg(model: BodyModel, annotated = false): string {
  const { bounds: b, p } = model, margin = annotated ? 20 : 5;
  const exposure = model.exposure;
  const cutPaths = exposure.active ? exposure.net.flatMap(polygon => polygon.map(ring => `<polygon points="${points(ring)}"/>`)).join('') : `<polygon points="${points(model.boundary)}"/>${model.slots.map(s => `<polygon points="${points(s)}"/>`).join('')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(b.width + margin * 2)}mm" height="${number(b.height + margin * 2)}mm" viewBox="${number(b.x - margin)} ${number(b.y - margin)} ${number(b.width + margin * 2)} ${number(b.height + margin * 2)}">
  <title>Robot body: ${p.sides} panels, ${p.diameter} mm base across flats, ${p.height} mm high, ${p.taper}% top</title>
  <desc>One connected sheet. Red CUT: outline, slots and enforced exposure openings. Blue SCORE: light crease only, never through-cut. Units mm; 1:1 scale. Open top and bottom. Zero-thickness developed surface. Exposure profile is photo-estimated; verify alignment on hardware. Protected: ${exposure.zones.map(z => z.key).join(', ') || 'none'}. Test card and slot fit before fabrication.</desc>
  <g id="CUT" fill="none" stroke="#d12626" stroke-width="0.1">${cutPaths}</g>
  <g id="SCORE" fill="none" stroke="#245bd6" stroke-width="0.1"${annotated ? ' stroke-dasharray="2 1"' : ''}>${exposure.folds.map(f => `<polyline points="${points(f)}"/>`).join('')}</g>
  ${annotated ? `<g fill="#354252" font-family="sans-serif" font-size="5">${model.faces.map((f, i) => `<text x="${number(f.flat.reduce((s, p) => s + p[0], 0) / 4)}" y="${number(f.flat.reduce((s, p) => s + p[1], 0) / 4)}" text-anchor="middle">${i + 1}</text>`).join('')}<text x="${b.x}" y="${b.y - 8}">CUT red · SCORE blue · mm · print 100%</text></g>` : ''}</svg>`;
}
