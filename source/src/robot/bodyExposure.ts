import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon } from 'polygon-clipping';
import { bodyFoldingPose } from './bodyFolding';
import type { BaseBodyModel, Point, Point3 } from './bodyNet';
import { ornamentPoint } from './bodyDecoration';
import { bendStrips, makeBend, move } from './cardMaterial';

export const exposureLabels = {
  matrix: 'micro:bit LED matrix / light sensing', laser: 'Matrix laser ranging',
  lightLeft: 'Left light sensor', lightRight: 'Right light sensor', infrared: 'Infrared receiver',
  lineOuterLeft: 'Line sensor · outer left', lineInnerLeft: 'Line sensor · inner left',
  lineCentre: 'Line sensor · centre', lineInnerRight: 'Line sensor · inner right', lineOuterRight: 'Line sensor · outer right',
  microphone: 'micro:bit V2 microphone', qrReader: 'Forward-facing QR code reader',
};
export type ExposureKey = keyof typeof exposureLabels;
export interface ExposureSettings {
  enabled: Record<ExposureKey, boolean>;
  qrReaderHeight?: number;
  margin: number; frontOffset: number; matrixHeight: number; laserHeight: number; laserTilt: number;
}
export const exposureRanges = { qrReaderHeight: [40, 220, 1], margin: [2, 10, 1], frontOffset: [20, 70, 1], matrixHeight: [35, 100, 1], laserHeight: [100, 230, 1], laserTilt: [-30, 30, 1] } as const;
export const defaultExposure: ExposureSettings = {
  enabled: Object.fromEntries(Object.keys(exposureLabels).map(key => [key, !['lightLeft', 'lightRight', 'infrared'].includes(key)])) as Record<ExposureKey, boolean>,
  qrReaderHeight: 110, margin: 5, frontOffset: 45, matrixHeight: 60, laserHeight: 175, laserTilt: 0,
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
    // Provisional reader aperture / 40-degree full view. Measure the fitted module.
    zone('qrReader', [0, settings.qrReaderHeight ?? 110, z], 10, 10, 20),
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
const geometry = (ring: Point[]): Polygon => [snap(ring)];
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
function resolveBodyExposure(model: BaseBodyModel, input?: ExposureSettings) {
  // Generic geometry remains available to callers that have no hardware profile.
  const settings = input ? normaliseExposure(input) : { ...defaultExposure, enabled: Object.fromEntries(Object.keys(exposureLabels).map(k => [k, false])) as ExposureSettings['enabled'] };
  const zones = exposureZones(settings), pose = bodyFoldingPose(model, 1);
  const cuts: Point[][] = model.decoration.windows.map(window => window.flat), zoneCuts = zones.map(zone => ({ key: zone.key, area: 0 }));
  const surfaces = [
    ...model.faces.map((face, i) => ({ flat: face.flat, point: (flat: Point) => pose.point(i, flat) })),
    ...model.tabPolygons.map(flat => ({ flat, point: (p: Point) => pose.point(model.p.sides, p) })),
    ...model.decoration.ornaments.map(facet => ({ flat: facet.flat, point: (p: Point) => ornamentPoint(model, facet, p, 1, pose) })),
  ];
  const bandSurfaces = [
    ...model.material.bends.filter(bend=>bend.width>1e-7).map(bend=>({flat:bend.flat,bend,body:model.material.bends.indexOf(bend),ornament:undefined as number|undefined,point:(p:Point)=>pose.bendPoint(model.material.bends.indexOf(bend),p)})),
    ...model.decoration.ornaments.map((facet,ornament)=>({flat:facet.hinges.at(-1)!.flat,bend:facet.hinges.at(-1)!,body:undefined as number|undefined,ornament,point:(p:Point)=>ornamentPoint(model,facet,p,1,pose,true)})),
  ];
  surfaces.push(...bandSurfaces);
  const windows = surfaces.map(surface => zones.flatMap((zone, j) => {
    let cut = surface.flat;
    // Pad the chord approximation of a bend by more than its maximum radial
    // deviation, and include the complete material thickness in every opening.
    for (const plane of zonePlanes(zone, settings.margin+model.p.thickness+2*(model.p.bendRadius+model.p.thickness))) cut = clipPlane(cut, p => plane(surface.point(p)));
    cut = snap(cut);
    if (cut.length < 3 || ringArea(cut) < 1e-6) return [];
    zoneCuts[j].area += ringArea(cut); cuts.push(cut); return [cut];
  }));
  const boxes=new WeakMap<Point[],number[]>();
  const bounds=(ring:Point[])=>{let box=boxes.get(ring);if(!box){box=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];boxes.set(ring,box);}return box;};
  const overlaps=(a:Point[],b:Point[])=>{const x=bounds(a),y=bounds(b);return x[0]<=y[2] && x[2]>=y[0] && x[1]<=y[3] && x[3]>=y[1];};
  const subtract = (ring: Point[], holes: Point[][]): MultiPolygon => {const local=holes.filter(h=>overlaps(ring,h));return clean(local.length ? polygonClipping.difference(geometry(snap(ring)), ...local.map(geometry)) : [[snap(ring)]]);};
  const panelPolygons = model.faces.map((face, i) => subtract(face.flat, [...windows[i], ...model.decoration.windows.filter(w => w.face === i).map(w => w.flat), ...(i === 0 ? model.slots : [])]));
  const root=model.tabBends[0], positions=new Set<number>([0,model.tabDimensions.reach]);
  for(const bend of model.tabBends){const start=(bend.edge[0][0]-root.edge[0][0])*root.across[0]+(bend.edge[0][1]-root.edge[0][1])*root.across[1];for(let i=0;i<=8;i++)positions.add(start+bend.width*i/8);}
  const intervals=[...positions].sort((a,b)=>a-b), slabs=intervals.slice(1).flatMap((end,i)=>end-intervals[i]>1e-7?[makeBend(root.edge.map(p=>move(p,root.across,intervals[i])),end-intervals[i],0,model.p.sides-1).flat]:[]);
  const tabs = model.tabPolygons.map((tab, i) => {const polygons=subtract(tab,windows[model.p.sides+i]);return slabs.filter(slab=>overlaps(tab,slab)).flatMap(slab=>clean(polygonClipping.intersection(polygons,geometry(slab))));});
  const ornamentStart = model.p.sides + model.tabPolygons.length;
  const bandStart=ornamentStart+model.decoration.ornaments.length;
  const originalOrnaments = model.decoration.ornaments.map((facet, i) => subtract(facet.flat, windows[ornamentStart + i]));
  const omittedGroups = new Set<number>();
  model.decoration.ornaments.forEach((facet, i) => {
    const bend=facet.hinges.at(-1)!;
    const retainedRoot = Math.min(...[bend.edge,bend.edge.map(p=>move(p,bend.across,bend.width))].map(edge=>trimFold(edge,cuts).reduce((sum,line)=>sum+Math.hypot(line[1][0]-line[0][0],line[1][1]-line[0][1]),0)));
    if (retainedRoot < model.material.minWeb || materialArea(originalOrnaments[i]) < 1) omittedGroups.add(facet.group);
  });
  const retained = model.decoration.ornaments.filter(f => !omittedGroups.has(f.group));
  const ornaments = originalOrnaments.map((polygons, i) => omittedGroups.has(model.decoration.ornaments[i].group) ? [] : polygons);
  // Functional openings take priority: omit a whole rim motif if its hinge would
  // be severed, instead of leaving a detached flap or disabling the sensor.
  const keptSurface=(i:number)=>i<ornamentStart || (i<bandStart ? !omittedGroups.has(model.decoration.ornaments[i-ornamentStart].group) : bandSurfaces[i-bandStart].ornament===undefined || !omittedGroups.has(model.decoration.ornaments[bandSurfaces[i-bandStart].ornament!].group));
  cuts.length = 0; cuts.push(...model.decoration.windows.map(w => w.flat), ...windows.flatMap((list,i)=>keptSurface(i)?list:[]));
  const bands=bandSurfaces.filter((_,i)=>keptSurface(i+bandStart)).flatMap(surface=>bendStrips(surface.bend).map(flat=>({...surface,flat,polygons:subtract(flat,cuts)})));
  const ornamentBands=retained.map(f=>f.hinges.at(-1)!.flat);
  // Weld coincident hinge edges for the boolean operation. These 0.0002 mm
  // strips lie inside the neighbouring faces, not across a physical opening.
  const welds = retained.flatMap(facet => {
    const bend=facet.hinges.at(-1)!;return [bend.edge,bend.edge.map(p=>move(p,bend.across,bend.width))];
  }).map(edge => {
    const [a,b]=edge, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length, dy = (b[1] - a[1]) / length;
    return [[a[0] + dx * .01 - dy * .0001, a[1] + dy * .01 + dx * .0001], [b[0] - dx * .01 - dy * .0001, b[1] - dy * .01 + dx * .0001], [b[0] - dx * .01 + dy * .0001, b[1] - dy * .01 - dx * .0001], [a[0] + dx * .01 + dy * .0001, a[1] + dy * .01 - dx * .0001]] as Point[];
  });
  const uncut = retained.length ? polygonClipping.union(geometry(model.boundary), ...retained.map(f => geometry(f.flat)), ...ornamentBands.map(geometry), ...welds.map(geometry)) : [geometry(model.boundary)];
  const net = clean(polygonClipping.difference(uncut, ...[...model.slots, ...cuts].map(geometry)));
  const flatOverlap = materialArea(uncut) < ringArea(model.boundary) + retained.reduce((s, f) => s + ringArea(f.flat), 0) + ornamentBands.reduce((s,f)=>s+ringArea(f),0) - .01;
  const extraFolds = retained.map(facet => facet.hinges.at(-1)!.score);
  const foldGroups = [...model.folds, ...extraFolds].map(fold => trimFold(fold, cuts));
  const weakHinge = foldGroups.some(pieces => pieces.reduce((sum,line)=>sum+Math.hypot(line[1][0]-line[0][0],line[1][1]-line[0][1]),0)<model.material.minWeb);
  const seamConflict = cuts.some(cut => model.slots.some(slot => overlaps(cut,slot) && materialArea(polygonClipping.intersection(geometry(cut), geometry(slot))) > 1e-6)) || windows.slice(model.p.sides, model.p.sides + model.tabPolygons.length).some(list => list.length > 0);
  const valid = net.length === 1 && panelPolygons.every(polygons => materialArea(polygons) > 1) && !weakHinge && !seamConflict && !flatOverlap;
  return { settings, zones, cuts, zoneCuts, panelPolygons, tabs, ornaments, bands, omittedOrnaments: omittedGroups.size, net, folds: foldGroups.flat(), valid, active: true,
    reason: flatOverlap ? 'The flat ornaments overlap. Reduce their height or increase the top size.' : net.length !== 1 ? 'Openings or ornaments would split the card into separate pieces.' : weakHinge ? 'Openings leave too little card at a fold.' : seamConflict ? 'Openings intersect the closing tabs or slots.' : !valid ? 'Openings remove an entire panel or ornament.' : '' };
}
/** Numerical boolean failures must block fabrication instead of breaking controls.
 * Random searches can then discard the candidate and continue. */
export function buildBodyExposure(model: BaseBodyModel, input?: ExposureSettings): ReturnType<typeof resolveBodyExposure> {
  try { return resolveBodyExposure(model, input); }
  catch (error) {
    if (!(error instanceof Error) || !error.stack?.includes('polygon-clipping')) throw error;
    const settings = input ? normaliseExposure(input) : { ...defaultExposure, enabled: Object.fromEntries(Object.keys(exposureLabels).map(k => [k, false])) as ExposureSettings['enabled'] };
    const zones = exposureZones(settings);
    return { settings, zones, cuts: [], zoneCuts: zones.map(zone => ({ key: zone.key, area: 0 })), panelPolygons: model.faces.map(() => []), tabs: model.tabPolygons.map(() => []), ornaments: model.decoration.ornaments.map(() => []), bands:[], omittedOrnaments: 0, net: [], folds: [], valid: false, active: true, reason: 'This cut pattern could not be resolved safely. Change the angles or details.' };
  }
}
