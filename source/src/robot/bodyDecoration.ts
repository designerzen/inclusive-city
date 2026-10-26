import type { BaseBodyModel, BodyParameters, Point, Point3 } from './bodyNet';
import { bodyFoldingPose } from './bodyFolding';
import { bendAllowance, cardBendInPlane, makeBend, move } from './cardMaterial';
import type { CardBend } from './cardMaterial';

export const ornamentStyles = { plain: 'No appendages', crown: 'Folded crown', petals: 'Petal collar', accordion: 'Accordion ruffle', ears: 'Robot ears', fins: 'Swept fins', antenna: 'Antenna paddles', fork: 'Forked feelers', pennant: 'Pennant flags', wing: 'Jointed wings', horn: 'Articulated horns', bolt: 'Lightning blades', mixed: 'Mixed appendages' };
export const appendageLayouts = { all: 'Every panel', alternate: 'Alternating panels', pair: 'Opposite pair', scattered: 'Scattered' };
export const windowStyles = { none: 'No ornamental windows', diamond: 'Diamonds', hexagon: 'Honeycomb hexagons', star: 'Stars', porthole: 'Octagonal portholes', slash: 'Angled slashes', chevron: 'Chevron vents', visor: 'Visor windows' };
export interface DecorationSettings {
  ornament: keyof typeof ornamentStyles; height: number; angle: number;
  windows: keyof typeof windowStyles; windowSize: number; rows: number; windowAngle: number;
  layout: keyof typeof appendageLayouts; variation: number; offset: number; span: number;
}
export const defaultDecoration: DecorationSettings = { ornament: 'plain', height: 30, angle: 45, windows: 'none', windowSize: 16, rows: 2, windowAngle: 0, layout: 'all', variation: 0, offset: 0, span: 58 };
export const decorationRanges = { height: [12, 120, 1], angle: [15, 85, 1], windowSize: [6, 70, 1], rows: [1, 4, 1], windowAngle: [-75, 75, 1], variation: [0, 100, 1], offset: [0, 11, 1], span: [25, 90, 1] } as const;
export function normaliseDecoration(input: unknown): DecorationSettings {
  const data = input && typeof input === 'object' ? input as Partial<DecorationSettings> : {};
  const result = { ...defaultDecoration };
  if (data.ornament && Object.hasOwn(ornamentStyles, data.ornament)) result.ornament = data.ornament;
  if (data.windows && Object.hasOwn(windowStyles, data.windows)) result.windows = data.windows;
  if (data.layout && Object.hasOwn(appendageLayouts, data.layout)) result.layout = data.layout;
  for (const key of Object.keys(decorationRanges) as (keyof typeof decorationRanges)[]) {
    const [min, max, step] = decorationRanges[key], value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = min + Math.round((Math.max(min, Math.min(max, value)) - min) / step) * step;
  }
  return result;
}
/** Avoid repeating the last silhouette while retaining explicit surprise exclusions. */
export function surpriseDecoration(previous: DecorationSettings, appendages = true, windows = true, random = Math.random): DecorationSettings {
  const pick = <T>(values: T[]) => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  return normaliseDecoration({
    ornament: appendages ? pick((Object.keys(ornamentStyles) as DecorationSettings['ornament'][]).filter(s => s !== 'plain' && s !== previous.ornament)) : 'plain',
    windows: windows ? pick((Object.keys(windowStyles) as DecorationSettings['windows'][]).filter(s => s !== 'none' && s !== previous.windows)) : 'none',
    layout: pick(Object.keys(appendageLayouts)), height: integer(40, 110), angle: integer(25, 85), span: integer(40, 85),
    windowSize: integer(20, 65), rows: integer(1, 4), windowAngle: integer(-65, 65), variation: integer(15, 100), offset: integer(0, 11),
  });
}
export interface OrnamentFacet { face: number; flat: Point[]; hinges: CardBend[]; group: number }
const mix = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distanceToEdge = (p: Point, a: Point, b: Point) => Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
export function buildDecorationGeometry(faces: { flat: Point[] }[], slots: Point[][], input?: DecorationSettings, material?: BodyParameters) {
  const settings = normaliseDecoration(input), ornaments: OrnamentFacet[] = [], windows: { face: number; flat: Point[] }[] = [];
  let omittedWindows = 0, materialValid=true;
  faces.forEach(({ flat }, face) => {
    const left = flat[3], right = flat[2], w = Math.hypot(right[0] - left[0], right[1] - left[1]);
    const across: Point = [(right[0] - left[0]) / w, (right[1] - left[1]) / w], up: Point = [-across[1], across[0]];
    const topMiddle = mix(left, right, .5), rootWidth = Math.min(w * settings.span / 100, 90);
    const at = (x: number, y: number): Point => [topMiddle[0] + across[0] * x + up[0] * y, topMiddle[1] + across[1] * x + up[1] * y];
    const position = (face + settings.offset) % faces.length;
    const selected = settings.layout === 'all' || (settings.layout === 'alternate' && position % 2 === 0) || (settings.layout === 'pair' && (position === 0 || position === Math.floor(faces.length / 2))) || (settings.layout === 'scattered' && (position * 7 + 3) % 11 < 6);
    if (settings.ornament !== 'plain' && selected) {
      const styles = ['wing', 'crown', 'horn', 'petals', 'bolt', 'accordion', 'ears', 'fins', 'antenna', 'fork', 'pennant'];
      const style = settings.ornament === 'mixed' ? styles[(face * 3 + settings.offset) % styles.length] : settings.ornament;
      const variety = settings.variation / 100, noise = ((face * 7 + settings.offset * 3) % 13) / 12;
      const height = settings.height * (1 - variety * .45 * noise), half = rootWidth / 2 * (1 - variety * .3 * (1 - noise));
      const count = style === 'accordion' || style === 'horn' ? 3 : style === 'wing' ? 2 : 1, hinges: OrnamentFacet['hinges'] = [];
      if(material && (height/count<Math.max(2*material.thickness,2*material.bendRadius+material.slotClearance) || rootWidth<Math.max(6,3*material.thickness)))materialValid=false;
      let accumulatedAllowance=0;
      for (let segment = 0; segment < count; segment++) {
        const y0 = height * segment / count+accumulatedAllowance;
        const rootHalf = half * (style === 'horn' ? 1 - segment * .28 : 1), tipHalf = half * (1 - (segment + 1) * .28);
        const angle = settings.angle * Math.PI / 180 * (segment === 0 ? 1 : style === 'horn' ? .4 : style === 'wing' ? -.65 : segment % 2 ? -2 : 2);
        const width=material?bendAllowance(material,angle,-1):0;
        const bend=makeBend([at(-rootHalf,y0),at(rootHalf,y0)],width,angle,face,-1);
        hinges.push(bend); accumulatedAllowance+=width;
        const edge=bend.edge.map(p=>move(p,bend.across,width)), y1=height*(segment+1)/count+accumulatedAllowance;
        const outline = style === 'crown'
          ? [edge[0], edge[1], at(0, y1)]
          : style === 'petals'
            ? [edge[0], edge[1], at(half, y1 * .65), at(half * .45, y1), at(-half * .45, y1), at(-half, y1 * .65)]
            : style === 'horn' ? [edge[0], edge[1], at(tipHalf, y1), at(-tipHalf, y1)]
            : style === 'wing' && segment === 1 ? [edge[0], edge[1], at(half, y1), at(half * .3, y1 * .8), at(-half * .2, y1 * .95), at(-half * .35, y1 * .7), at(-half, y1 * .8)]
            : style === 'bolt' ? [edge[0], edge[1], at(half * .15, y1 * .4), at(half * .85, y1 * .4), at(-half * .55, y1), at(-half * .15, y1 * .55), at(-half * .9, y1 * .55)]
            : style === 'ears' ? [edge[0], edge[1], at(half * .7, y1), at(-half * .7, y1)]
            : style === 'fins' ? [edge[0], edge[1], at(half, y1), at(-half * .5, y1 * .55)]
            : style === 'antenna' ? [edge[0], edge[1], at(half * .35, y1 * .6), at(half * .8, y1 * .7), at(half * .8, y1), at(-half * .8, y1), at(-half * .8, y1 * .7), at(-half * .35, y1 * .6)]
            : style === 'fork' ? [edge[0], edge[1], at(half, y1), at(half * .4, y1), at(0, y1 * .5), at(-half * .4, y1), at(-half, y1)]
            : style === 'pennant' ? [edge[0], edge[1], at(half, y1 * .8), at(-half * .6, y1), at(-half * .25, y1 * .5)]
            : [edge[0], edge[1], at(half, y1), at(-half, y1)];
        ornaments.push({ face, flat: outline, hinges: [...hinges], group: face });
      }
    }
    if (settings.windows === 'none') return;
    for (let row = 0; row < settings.rows; row++) {
      const t = (row + 1) / (settings.rows + 1), centre = mix(mix(flat[0], flat[1], .5), topMiddle, t);
      const edgeMargin=material?Math.max(10,3*material.thickness+material.bendRadius):10;
      let radius = Math.min(settings.windowSize / 2, ...flat.map((a, i) => distanceToEdge(centre, a, flat[(i + 1) % flat.length]) - edgeMargin));
      // Keep generous bridges between rows and around the seam closure slots.
      radius = Math.min(radius, Math.hypot(topMiddle[0] - (flat[0][0] + flat[1][0]) / 2, topMiddle[1] - (flat[0][1] + flat[1][1]) / 2) / (settings.rows + 1) / 2 - 4);
      if (face === 0) for (const slot of slots) radius = Math.min(radius, ...slot.map(p => Math.hypot(p[0] - centre[0], p[1] - centre[1]) - 8));
      if (radius < 3) { omittedWindows++; continue; }
      const n = settings.windows === 'diamond' ? 4 : settings.windows === 'hexagon' ? 6 : settings.windows === 'star' ? 10 : 8;
      const outline: Point[] = settings.windows === 'slash' ? [[-.8,-.5],[-.5,-.8],[.8,.5],[.5,.8]] : settings.windows === 'chevron' ? [[-.9,-.35],[0,.25],[.9,-.35],[.9,.15],[0,.75],[-.9,.15]] : settings.windows === 'visor' ? [[-1,0],[-.7,-.4],[.7,-.4],[1,0],[.7,.4],[-.7,.4]] : Array.from({ length: n }, (_, i): Point => {
        const angle = Math.PI / 2 + i * 2 * Math.PI / n, r = radius * (settings.windows === 'star' && i % 2 ? .55 : 1);
        return [Math.cos(angle) * r / radius, Math.sin(angle) * r / radius];
      });
      const rotation = settings.windowAngle * Math.PI / 180, c = Math.cos(rotation), s = Math.sin(rotation);
      const points = outline.map(([x,y]): Point => {
        const u = radius * (x * c - y * s), v = radius * (x * s + y * c);
        return [centre[0] + across[0] * u + up[0] * v, centre[1] + across[1] * u + up[1] * v];
      });
      windows.push({ face, flat: points });
    }
  });
  return { settings, ornaments, windows, omittedWindows, materialValid };
}
/** Fold the free rim strip around its own creases, then carry it with its body face. */
export function ornamentPoint(model: BaseBodyModel, facet: OrnamentFacet, flat: Point, fraction: number, pose = bodyFoldingPose(model, fraction), band = false): Point3 {
  let point = pose.point(facet.face, flat);
  for (let i = facet.hinges.length - 1; i >= 0; i--) {
    const hinge = facet.hinges[i], origin = pose.point(facet.face, hinge.edge[0]), end = pose.point(facet.face, hinge.edge[1]);
    const u=band && i===facet.hinges.length-1 ? Math.max(0,Math.min(hinge.width,(flat[0]-hinge.edge[0][0])*hinge.across[0]+(flat[1]-hinge.edge[0][1])*hinge.across[1])) : undefined;
    point=cardBendInPlane(point,origin,end,pose.point(facet.face,move(hinge.edge[0],hinge.across,1)),hinge.width,hinge.angle,Math.max(0,Math.min(1,fraction)),u);
  }
  return point;
}
