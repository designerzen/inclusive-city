import { buildBodyExposure } from './bodyExposure';
import type { ExposureSettings } from './bodyExposure';
import { buildDecorationGeometry } from './bodyDecoration';
import type { DecorationSettings } from './bodyDecoration';
import { profiledFaces } from './bodyProfiles';
import { bendAllowance, developCardWalls, embedCard, makeBend, move, neutralRadius } from './cardMaterial';
import { bodyFoldingPose } from './bodyFolding';
import { roofInstructions } from './bodyRoof';
import { checkBodyStructure } from './bodyStructure';
/** Millimetres throughout. Rigid planar walls, cut at one closing generator. */
export interface BodyParameters {
  sides: number; diameter: number; height: number; taper: number; tabs: number;
  thickness: number; clearance: number; skeletonWidth: number; skeletonDepth: number; skeletonHeight: number;
  section: number; aspect: number; lean: number; rim: number; ridge: number;
  bendRadius: number; neutralAxis: number; slotClearance: number;
}
export type Point = [number, number];
export type Point3 = [number, number, number];
export const defaultBody: BodyParameters = { sides: 8, diameter: 180, height: 180, taper: 80, tabs: 3, thickness: .5, clearance: 5, skeletonWidth: 100, skeletonDepth: 80, skeletonHeight: 150, section: 0, aspect: 100, lean: 0, rim: 0, ridge: 0, bendRadius: .3, neutralAxis: 50, slotClearance: .3 };
export const bodyRanges: Record<keyof BodyParameters, [number, number, number]> = {
  sides: [4, 12, 1], diameter: [100, 260, 1], height: [90, 300, 1], taper: [55, 140, 1], tabs: [2, 5, 1],
  thickness: [.2, 3, .1], clearance: [2, 15, 1], skeletonWidth: [30, 200, 1], skeletonDepth: [30, 200, 1], skeletonHeight: [40, 280, 1],
  bendRadius: [.1, 3, .1], neutralAxis: [30, 70, 1], slotClearance: [.1, 1, .05],
  section: [0, 3, 1], aspect: [60, 180, 1], lean: [-45, 45, 1], rim: [0, 3, 1], ridge: [0, 45, 1],
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
const cross2 = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const simpleOutline = (points: Point[]) => !points.some((a, i) => points.some((c, j) => {
  if (j <= i + 1 || (i === 0 && j === points.length - 1)) return false;
  const b = points[(i + 1) % points.length], d = points[(j + 1) % points.length];
  return cross2(a, b, c) * cross2(a, b, d) < -1e-7 && cross2(c, d, a) * cross2(c, d, b) < -1e-7;
}));
const insideFace = (p: Point, face: Point[]) => {
  const signs = face.map((a, i) => cross2(a, face[(i + 1) % face.length], p));
  return signs.every(v => v >= -1e-7) || signs.every(v => v <= 1e-7);
};
function makeBodyBase(input: BodyParameters, details?: DecorationSettings) {
  const p = normaliseBody(input), n = p.sides, ratio = p.taper / 100;
  const apothem = p.diameter / 2, radius = apothem / Math.cos(Math.PI / n);
  const bottom = 2 * radius * Math.sin(Math.PI / n), top = bottom * ratio;
  let edge = Math.hypot(p.height, radius * (1 - ratio));
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
  const advanced = ratio > 1 || p.section !== 0 || p.aspect !== 100 || p.lean !== 0 || (p.rim !== 0 && p.ridge !== 0);
  const referenceFaces = advanced ? profiledFaces(p) : Array.from({ length: n }, (_, i) => ({ flat: [flat(i, 0), flat(i + 1, 0), flat(i + 1, 1), flat(i, 1)], solid: [solid(i, 0), solid(i + 1, 0), solid(i + 1, 1), solid(i, 1)] }));
  const material = developCardWalls(referenceFaces,p), faces=material.faces;
  const vertex = (i: number, top: boolean): Point => i === n ? faces[n - 1].flat[top ? 2 : 1] : faces[i].flat[top ? 3 : 0];
  const end = vertex(n, false), finish = vertex(n, true);
  edge = Math.hypot(finish[0] - end[0], finish[1] - end[1]);
  const direction: Point = [(finish[0] - end[0]) / edge, (finish[1] - end[1]) / edge];
  const outward: Point = [direction[1], -direction[0]];
  const folds: Point[][] = material.bends.filter(b=>b.width>1e-7).map(b=>b.score);
  const tabWidth = 18 + 2 * p.thickness, slotInset = 8 + 2 * p.thickness + p.slotClearance;
  const rootAllowance=bendAllowance(p,material.angles[n-1]), joggleIn=bendAllowance(p,Math.PI/2), joggleOut=bendAllowance(p,-Math.PI/2);
  const returnStart=rootAllowance+joggleIn+p.slotClearance+joggleOut+slotInset;
  const stackDepth=neutralRadius(p,Math.PI/2)+neutralRadius(p,-Math.PI/2)+p.slotClearance;
  const returnAllowance=Math.PI*(stackDepth+p.thickness+p.slotClearance)/2;
  const tabReach = returnStart + returnAllowance + 8 + 2*p.thickness;
  const tabBends = [[0,rootAllowance,material.angles[n-1]],[rootAllowance,joggleIn,Math.PI/2],[rootAllowance+joggleIn+p.slotClearance,joggleOut,-Math.PI/2],[returnStart,returnAllowance,-Math.PI]].map(([start,width,theta])=>makeBend([move(end,outward,start),move(finish,outward,start)],width,theta,n-1));
  const tabPolygons: Point[][] = [], slots: Point[][] = [];
  const boundary: Point[] = faces.flatMap(f=>[f.flat[0],f.flat[1]]);
  for (let j = 1; j <= p.tabs; j++) {
    const distance = edge * j / (p.tabs + 1);
    const rootA = add(end, mul(direction, distance - tabWidth / 2));
    const rootB = add(end, mul(direction, distance + tabWidth / 2));
    const tipA = add(add(rootA, mul(outward, tabReach)), mul(direction, 2+p.thickness));
    const tipB = add(add(rootB, mul(outward, tabReach)), mul(direction, -2-p.thickness));
    tabPolygons.push([rootA, tipA, tipB, rootB]); boundary.push(rootA, tipA, tipB, rootB);
    for(const bend of tabBends)if(bend.width>1e-7){const offset=(bend.edge[0][0]-end[0])*outward[0]+(bend.edge[0][1]-end[1])*outward[1];folds.push([move(rootA,outward,offset+bend.width/2),move(rootB,outward,offset+bend.width/2)]);}
    // First seam is vertical in the development; interior of face 1 is +x.
    const width = p.thickness + p.slotClearance, length = tabWidth + 2*p.slotClearance, seamStart=faces[0].flat[0][0];
    slots.push([[seamStart+slotInset-width/2,distance-length/2],[seamStart+slotInset+width/2,distance-length/2],[seamStart+slotInset+width/2,distance+length/2],[seamStart+slotInset-width/2,distance+length/2]]);
  }
  // Intersect the thick locking turn with the thick first wall, instead of
  // assuming a thickness-wide slot at a sharp 90-degree crossing.
  const pose=bodyFoldingPose({p,faces,referenceFaces,material,tabBends},1), embed=embedCard(referenceFaces), origin=embed([0,0]);
  const unit3=(v:number[])=>{const l=Math.hypot(...v);return v.map(x=>x/l);}, cross3=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const xAxis=unit3(embed([1,0]).map((v,k)=>v-origin[k])), yAxis=unit3(embed([0,1]).map((v,k)=>v-origin[k])), normal=cross3(xAxis,yAxis);
  const project=(point:Point3)=>[xAxis,yAxis,normal].map(axis=>point.reduce((s,v,k)=>s+(v-origin[k])*axis[k],0));
  let locksValid=true;
  for(let j=1;j<=1;j++) {
    const centre=move(end,direction,edge*j/(p.tabs+1));
    const samples=Array.from({length:129},(_,i)=>{
      const u=returnStart+returnAllowance*i/128, flat=move(centre,outward,u), point=pose.point(n,flat), step=.0001;
      const before=pose.point(n,move(centre,outward,u-step)),after=pose.point(n,move(centre,outward,u+step)), along=pose.point(n,move(flat,direction,1));
      const tangent=unit3(after.map((v,k)=>v-before[k])), axis=unit3(along.map((v,k)=>v-point[k])), surfaceNormal=unit3(cross3(tangent,axis));
      return [1-p.neutralAxis/100,-p.neutralAxis/100].map(offset=>project(point.map((v,k)=>v+surfaceNormal[k]*p.thickness*offset) as Point3));
    });
    let section=samples.map(s=>s[0]).concat(samples.slice().reverse().map(s=>s[1]));
    for(const [level,sign] of [[-p.neutralAxis/100*p.thickness,1],[(1-p.neutralAxis/100)*p.thickness,-1]]) {
      const clipped:number[][]=[];
      section.forEach((a,i)=>{const b=section[(i+1)%section.length],da=(a[2]-level)*sign,db=(b[2]-level)*sign;if(da>=0)clipped.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);clipped.push(a.map((v,k)=>v+(b[k]-v)*t));}});section=clipped;
    }
    if(!section.length){locksValid=false;continue;}
    const low=Math.min(...section.map(v=>v[0]))-p.slotClearance/2,high=Math.max(...section.map(v=>v[0]))+p.slotClearance/2;
    const cy=project(pose.point(n,move(centre,outward,returnStart)))[1], length=tabWidth+2*p.slotClearance;
    slots[j-1]=[[low,cy-length/2],[high,cy-length/2],[high,cy+length/2],[low,cy+length/2]];
  }
  // The parallel tab paths differ only by translation along the seam axis.
  for(let j=1;j<p.tabs;j++)slots[j]=slots[0].map(([x,y])=>[x,y+j*edge/(p.tabs+1)]);
  boundary.push(...faces.slice().reverse().flatMap(f=>[f.flat[2],f.flat[3]]));
  const decoration = buildDecorationGeometry(faces, slots, details, p);
  const allPoints = [...boundary, ...decoration.ornaments.flatMap(facet => [...facet.flat, ...facet.hinges.at(-1)!.flat])];
  const xs = allPoints.map(v => v[0]), ys = allPoints.map(v => v[1]);
  const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  // A conservative circle around the rectangular envelope fits inside every facet.
  const requiredDiameter = Math.hypot(p.skeletonWidth + 2 * p.clearance, p.skeletonDepth + 2 * p.clearance);
  const innerDiameter = p.diameter * Math.min(1, ratio) - 2 * (p.thickness + p.bendRadius) - 2 * Math.abs(p.lean);
  const minimumHeight = Math.min(...faces.flatMap(f => f.solid.slice(2).map(v => v[1])));
  const fits = innerDiameter >= requiredDiameter && minimumHeight >= p.skeletonHeight + p.clearance;
  // Sector must not wrap into itself; tab projections also need a separated seam.
  const valid = locksValid && material.valid && decoration.materialValid && n * angle < Math.PI * 1.9 && faces.every(f => Math.hypot(f.flat[2][0] - f.flat[3][0], f.flat[2][1] - f.flat[3][1]) > slotInset + p.thickness + material.minWeb) && edge / (p.tabs + 1) > tabWidth + material.minWeb && simpleOutline(boundary) && slots.flat().every(v => insideFace(v, faces[0].flat));
  return { p, faces, referenceFaces, material, tabBends, tabDimensions:{width:tabWidth,reach:tabReach,slotInset,rootAllowance,returnAllowance,returnStart,stackDepth}, boundary, folds, slots, tabPolygons, bounds, edge, slant, bottom, top, angle, innerDiameter, requiredDiameter, minimumHeight, fits, valid, decoration };
}
export type BaseBodyModel = ReturnType<typeof makeBodyBase>;
export function makeBody(input: BodyParameters, settings?: ExposureSettings, details?: DecorationSettings) {
  const base = makeBodyBase(input, details), exposure = buildBodyExposure(base, settings);
  const structure = checkBodyStructure(base, exposure);
  return { ...base, geometryValid: base.valid && exposure.valid, valid: base.valid && exposure.valid && structure.valid, exposure, structure };
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
  const bendPolygons=[...exposure.bands.flatMap(b=>b.polygons),...exposure.tabs.flatMap(polygons=>polygons.filter(polygon=>model.tabBends.some(bend=>{const ring=polygon[0],mid=ring.reduce((s,p)=>s+(p[0]-bend.edge[0][0])*bend.across[0]+(p[1]-bend.edge[0][1])*bend.across[1],0)/ring.length;return mid>0 && mid<bend.width;})))];
  const bendGuide=annotated?`<g id="BEND_GUIDE" fill="#e5be66" fill-opacity="0.45" stroke="none" fill-rule="evenodd">${bendPolygons.map(polygon=>`<path d="${polygon.map(ring=>`M ${ring.map(p=>p.map(number).join(' ')).join(' L ')} Z`).join(' ')}"/>`).join('')}</g>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(b.width + margin * 2)}mm" height="${number(b.height + margin * 2)}mm" viewBox="${number(b.x - margin)} ${number(b.y - margin)} ${number(b.width + margin * 2)} ${number(b.height + margin * 2)}">
  <title>Robot body: ${p.sides} panels, ${p.diameter} mm base across flats, ${p.height} mm high, ${p.taper}% top</title>
  <desc>One connected sheet. Red CUT: outline, slots and windows. Blue SCORE: light crease only, never through-cut. Units mm; 1:1 scale. Open bottom. Roof: ${model.decoration.settings.roof}. ${roofInstructions[model.decoration.settings.roof]} Calibrated finite-bend model. Card thickness ${p.thickness} mm; inside bend radius ${p.bendRadius} mm; neutral axis ${p.neutralAxis}%; slot clearance ${p.slotClearance} mm; seam relief ${model.material.seamGap.toFixed(3)} mm. Bend allowance = absolute angle in radians times neutral radius; reverse folds use the opposite sheet side. Calibrate on a crease and slot coupon before cutting the full net. Section ${p.section}; width/depth ${p.aspect}%; lean ${p.lean} mm; roofline ${p.rim}, depth ${p.ridge}%. Ornament: ${model.decoration.settings.ornament}; ornamental windows: ${model.decoration.settings.windows}; ornament fold ${model.decoration.settings.angle} degrees outward, alternate reverse folds for accordion. Exposure profile is photo-estimated; verify alignment on hardware. Protected: ${exposure.zones.map(z => z.key).join(', ') || 'none'}. Test card and slot fit before fabrication.</desc>
  ${bendGuide}
  <g id="CUT" fill="none" stroke="#d12626" stroke-width="0.1">${cutPaths}</g>
  <g id="SCORE" fill="none" stroke="#245bd6" stroke-width="0.1"${annotated ? ' stroke-dasharray="2 1"' : ''}>${exposure.folds.map(f => `<polyline points="${points(f)}"/>`).join('')}</g>
  ${annotated ? `<g fill="#354252" font-family="sans-serif" font-size="5">${model.faces.map((f, i) => `<text x="${number(f.flat.reduce((s, p) => s + p[0], 0) / 4)}" y="${number(f.flat.reduce((s, p) => s + p[1], 0) / 4)}" text-anchor="middle">${i + 1}</text>`).join('')}${model.decoration.ornaments.map((facet, i) => {
    if (!exposure.ornaments[i].length) return '';
    const hinge = facet.hinges.at(-1)!, a = hinge.edge[0], c = hinge.edge[1];
    return `<text font-size="3" x="${number((a[0] + c[0]) / 2)}" y="${number((a[1] + c[1]) / 2 + 3)}" text-anchor="middle">${hinge.angle < 0 ? 'REV' : 'OUT'} ${Math.round(Math.abs(hinge.angle) * 180 / Math.PI)}°</text>`;
  }).join('')}<text x="${b.x}" y="${b.y - 12}">${p.thickness} mm card · inside R ${p.bendRadius} mm · K ${(p.neutralAxis/100).toFixed(2)} · fit clearance ${p.slotClearance} mm</text><text x="${b.x}" y="${b.y - 6}">CUT red · SCORE blue · BEND amber · OUT outward / REV reverse · mm · print 100%</text></g>` : ''}</svg>`;
}
