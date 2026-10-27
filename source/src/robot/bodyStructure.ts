import type { MultiPolygon } from 'polygon-clipping';
import type { BaseBodyModel, Point } from './bodyNet';
import { materialArea, trimFold } from './bodyExposure';
import { ornamentPoint } from './bodyDecoration';
import { bodyFoldingPose } from './bodyFolding';
import { move } from './cardMaterial';

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
function insideRing(p: Point, ring: Point[]) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function projection(p: Point, a: Point, b: Point): Point {
  const d = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), d) / (dot(d, d) || 1)));
  return [a[0] + t * d[0], a[1] + t * d[1]];
}

/** Find short material bridges between actual cut contours. The midpoint must
 * be card, not the waste inside a slot. Perimeter separation ignores ordinary
 * corners and tiny tapered tips, but catches long thin prongs and necks. */
export function narrowMaterial(polygons: MultiPolygon, minimum: number): number | undefined {
  for (const polygon of polygons) {
    const rings = polygon.map(ring => distance(ring[0], ring.at(-1)!) < 1e-6 ? ring.slice(0, -1) : ring);
    const edges = rings.flatMap((ring, r) => {
      let position = 0;
      return ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length], start = position; position += distance(a, b);
        return { a, b, r, i, start, end: position };
      });
    });
    const perimeters = rings.map(ring => ring.reduce((s, a, i) => s + distance(a, ring[(i + 1) % ring.length]), 0));
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i], b = edges[j];
      if (a.r === b.r && (Math.abs(a.i - b.i) <= 1 || Math.abs(a.i - b.i) === rings[a.r].length - 1)) continue;
      const pairs: [Point, Point][] = [[a.a, projection(a.a, b.a, b.b)], [a.b, projection(a.b, b.a, b.b)], [projection(b.a, a.a, a.b), b.a], [projection(b.b, a.a, a.b), b.b]];
      // Parallel long edges need interior samples: their endpoints may lie at
      // harmless corners even when the entire section between them is narrow.
      const am: Point = [(a.a[0] + a.b[0]) / 2, (a.a[1] + a.b[1]) / 2];
      const bm: Point = [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2];
      pairs.push([am, projection(am, b.a, b.b)], [projection(bm, a.a, a.b), bm]);
      for (const [p, q] of pairs) {
        const width = distance(p, q);
        if (width < 1e-5 || width >= minimum - 1e-5) continue;
        if (a.r === b.r) {
          const s = a.start + distance(a.a, p), t = b.start + distance(b.a, q);
          if (Math.min(Math.abs(s - t), perimeters[a.r] - Math.abs(s - t)) < minimum * 2) continue;
        }
        // Check more than the midpoint: a candidate across an opening or concave
        // waste must not masquerade as a bridge in the remaining card.
        if ([.2, .5, .8].every(t => {
          const v: Point = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
          return insideRing(v, rings[0]) && !rings.slice(1).some(ring => insideRing(v, ring));
        })) return width;
      }
    }
  }
  return undefined;
}

const longest = (pieces: Point[][]) => Math.max(0, ...pieces.map(line => distance(line[0], line[1])));
const ringArea = (ring: Point[]) => Math.abs(ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;

/** Conservative fabrication rules, not a material-strength or gravity solver.
 * Use actual retained surfaces after every window and sensor cut. */
export function checkBodyStructure(model: BaseBodyModel, exposure: {
  panelPolygons: MultiPolygon[]; ornaments: MultiPolygon[]; cuts: Point[][];
  omittedOrnaments: number; valid: boolean;
}) {
  const minimumWeb = Math.max(8, 4 * model.p.thickness);
  const maximumFreeSpan = 120 * model.p.thickness;
  const issues: string[] = [];
  const issue = (text: string) => { if (issues.length < 6 && !issues.includes(text)) issues.push(text); };
  if (!model.valid || !exposure.valid) return { rules: 'conservative-card-v1', valid: false, checked: false, minimumWeb, maximumFreeSpan, issues, reason: '' };
  if (model.p.height > 700 * model.p.thickness) issue(`The walls are too tall for ${model.p.thickness} mm card. Lower the body or use thicker card.`);
  exposure.panelPolygons.forEach((polygons, i) => {
    if (polygons.length !== 1) issue(`Panel ${i + 1} is split into separate structural sections.`);
    if (materialArea(polygons) < ringArea(model.faces[i].flat) * .35) issue(`Panel ${i + 1} has too little card left to support the body. Reduce its openings.`);
    const narrow = narrowMaterial(polygons, minimumWeb);
    if (narrow !== undefined) issue(`Panel ${i + 1} has a ${narrow.toFixed(1)} mm bridge; keep at least ${minimumWeb.toFixed(1)} mm between cuts and edges.`);
  });
  // Small isolated remnants must not be summed into a deceptively strong hinge.
  for (const bend of model.material.bends) {
    const width = Math.min(...[bend.edge, bend.edge.map(p => move(p, bend.across, bend.width))].map(edge => longest(trimFold(edge, exposure.cuts))));
    if (width < minimumWeb) issue(`A body fold needs one continuous ${minimumWeb.toFixed(1)} mm strip of card. Move or reduce the openings.`);
  }
  const pose = bodyFoldingPose(model, 1);
  const roof = model.decoration.settings.roof;
  if (roof !== 'open' && exposure.omittedOrnaments) issue('The roof has lost a supporting section to an opening. Raise the body or adjust the roof and sensor positions.');
  const facets = model.decoration.ornaments;
  facets.forEach((facet, i) => {
    const polygons = exposure.ornaments[i];
    if (!polygons.length) return;
    const hinge = facet.hinges.at(-1)!;
    const rootWidth = Math.min(...[hinge.edge, hinge.edge.map(p => move(p, hinge.across, hinge.width))].map(edge => longest(trimFold(edge, exposure.cuts))));
    const name = roof === 'open' ? `Appendage ${facet.group + 1}` : 'Roof section';
    if (rootWidth < minimumWeb) issue(`${name} needs a continuous ${minimumWeb.toFixed(1)} mm hinge. Widen it or reduce the openings.`);
    if (polygons.length !== 1 || narrowMaterial(polygons, minimumWeb) !== undefined) issue(`${name} contains a thin neck or split section. Widen or shorten it.`);
    // Every crease carries all downstream facets, not just the nearest segment.
    const downstream = facets.flatMap((f, j) => f.group === facet.group && f.hinges.includes(hinge) ? [{ f, polygons: exposure.ornaments[j] }] : []);
    const a = ornamentPoint(model, facet, hinge.edge[0], 1, pose, true), b = ornamentPoint(model, facet, hinge.edge[1], 1, pose, true);
    const axis = b.map((v, k) => v - a[k]), axisLength = Math.hypot(...axis);
    let reach = 0, area = 0;
    for (const part of downstream) {
      area += materialArea(part.polygons);
      for (const p of part.polygons.flat(2)) {
        const point = ornamentPoint(model, part.f, p, 1, pose);
        const v = point.map((value, k) => value - a[k]);
        const along = v.reduce((s, value, k) => s + value * axis[k], 0) / (axisLength * axisLength);
        reach = Math.max(reach, Math.hypot(...v.map((value, k) => value - along * axis[k])));
      }
    }
    const supportedRoof = roof === 'pyramid' || roof === 'lid';
    if (supportedRoof && materialArea(polygons) < ringArea(facet.flat) * .85) issue('A roof opening removes too much supporting card. Raise the body or reduce the roof opening.');
    if (!supportedRoof && (reach > maximumFreeSpan || reach > rootWidth * 4 || area > rootWidth * maximumFreeSpan)) {
      issue(`${name} is too long or heavy for its hinge and ${model.p.thickness} mm card. Shorten it, widen its root, or use thicker card (free span limit ${maximumFreeSpan.toFixed(0)} mm).`);
    }
    if (supportedRoof && (reach > maximumFreeSpan * 2 || reach > rootWidth * 4)) issue(`${name} spans too far between supports. Reduce the roof size or use thicker card.`);
    // Supported caps still need enough stiffness between opposite walls. Taped
    // pyramid seams supply side support; a wide flat lid spans half its diameter.
    if (roof === 'lid' && i === 0 && model.p.diameter * model.p.taper / 200 > maximumFreeSpan) issue(`The lid span is too wide for ${model.p.thickness} mm card. Reduce the top size or use thicker card.`);
  });
  return { rules: 'conservative-card-v1', valid: issues.length === 0, checked: true, minimumWeb, maximumFreeSpan, issues, reason: issues[0] || '' };
}
