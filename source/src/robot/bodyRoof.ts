import type { BodyParameters, Point } from './bodyNet';
import type { OrnamentFacet } from './bodyDecoration';
import { bendAllowance, makeBend, move } from './cardMaterial';

export const roofStyles = { open: 'Open top', flaps: 'Inward closing flaps', lid: 'Hinged tuck lid', pyramid: 'Pointed panel roof' };
export type RoofStyle = keyof typeof roofStyles;
export const roofInstructions: Record<RoofStyle, string> = {
  open: 'Leave the top open. Rim appendages fold outward as shown.',
  flaps: 'Fold the triangular flaps inward in order. The tips meet near the centre; use a small piece of removable tape if you want to hold them shut.',
  lid: 'Close the short support flaps first, then fold the large lid over them. Fold its end tongue down and tuck it inside the opposite wall. Lift the tongue to reopen.',
  pyramid: 'Raise the triangular roof panels until their tips meet. Join adjacent edges with removable tape underneath. The pointed roof is not a self-locking closure.',
};

/** Rim facets use the same bend, exposure and unfolding pipeline as appendages.
 * Regular level sleeves only: profiled rims need individually developed roofs. */
export function buildRoof(faces: { flat: Point[] }[], p: BodyParameters, style: RoofStyle, rise: number) {
  const facets: OrnamentFacet[] = [];
  if (style === 'open') return { facets, valid: true, reason: '' };
  const supported = p.section === 0 && p.aspect === 100 && p.lean === 0 && (p.rim === 0 || p.ridge === 0) && (style !== 'lid' || p.sides % 2 === 0);
  if (!supported) return { facets, valid: false, reason: 'Roofs need a regular cross-section, 100% width / depth, no lean and a level rim. Tuck lids also need an even panel count.' };
  const apothem = p.diameter * p.taper / 200;
  const slope = Math.atan2(p.diameter / 2 - apothem, p.height);
  const roofSlope = style === 'pyramid' ? Math.atan2(rise, apothem) : 0;
  const angle = -(Math.PI / 2 - slope - roofSlope);
  const gap = Math.max(p.thickness + p.slotClearance, .8);
  faces.forEach(({ flat }, face) => {
    // The large lid fans sideways in the development. Keep the neighbouring
    // rim edges clear so supporting flaps cannot overlap it on the stock.
    if (style === 'lid' && (face === 1 || face === faces.length - 1)) return;
    const a = flat[3], b = flat[2], width = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const across: Point = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
    const up: Point = [-across[1], across[0]];
    const at = (x: number, y: number): Point => [a[0] + across[0] * (width / 2 + x) + up[0] * y, a[1] + across[1] * (width / 2 + x) + up[1] * y];
    const half = width / 2 - gap;
    const bend = makeBend([at(-half, 0), at(half, 0)], bendAllowance(p, angle, -1), angle, face, -1);
    const root = bend.edge.map(v => move(v, bend.across, bend.width));
    const group = faces.length + face;
    if (style === 'lid' && face === 0) {
      // A regular polygon, developed away from the rear hinge. Leave clearance
      // at its perimeter so it rests over the supporting flaps without binding.
      const radius = apothem / Math.cos(Math.PI / p.sides);
      const ring: Point[] = Array.from({ length: p.sides }, (_, i) => {
        const theta = -Math.PI / 2 - Math.PI / p.sides + 2 * Math.PI * i / p.sides;
        return at(Math.cos(theta) * (radius - gap), apothem + Math.sin(theta) * (radius - gap) + bend.width);
      });
      ring[0] = root[0]; ring[1] = root[1];
      facets.push({ face, flat: ring, hinges: [bend], group });
      const tongueWidth = Math.min(24, width / 3), tongueLength = Math.max(10, 4 * p.thickness);
      const y = apothem + Math.cos(Math.PI / p.sides) * (radius - gap) + bend.width;
      const tongueAngle = -(Math.PI / 2 + slope);
      const tongue = makeBend([at(-tongueWidth / 2, y), at(tongueWidth / 2, y)], bendAllowance(p, tongueAngle, -1), tongueAngle, face, -1);
      const edge = tongue.edge.map(v => move(v, tongue.across, tongue.width));
      facets.push({ face, flat: [edge[0], edge[1], at(tongueWidth / 2 - 2, y + tongue.width + tongueLength), at(-tongueWidth / 2 + 2, y + tongue.width + tongueLength)], hinges: [bend, tongue], group });
    } else {
      const length = style === 'lid' ? Math.min(18, apothem / 3) : Math.hypot(apothem, style === 'pyramid' ? rise : 0);
      const outline: Point[] = style === 'lid'
        ? [root[0], root[1], at(half - 3, bend.width + length), at(-half + 3, bend.width + length)]
        : [root[0], root[1], at(0, bend.width + length)];
      facets.push({ face, flat: outline, hinges: [bend], group });
    }
  });
  return { facets, valid: true, reason: '' };
}
