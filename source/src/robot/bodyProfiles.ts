import type { BodyParameters, Point, Point3 } from './bodyNet';

export const bodySections = ['Faceted round', 'Box shoulders', 'Diamond wedge', 'Shield'];
export const bodyRims = ['Level', 'Sloping visor', 'Twin peaks', 'Sawtooth'];
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

/** Homothetic sections keep every wall planar, even with a leaning axis and
 * uneven rim. Unfold each wall by trilateration around its shared generator. */
export function profiledFaces(p: BodyParameters) {
  const n = p.sides, ratio = p.taper / 100;
  let ring = Array.from({ length: n }, (_, i): Point => {
    const a = Math.PI + i * Math.PI * 2 / n, x = Math.sin(a), z = Math.cos(a);
    const scale = p.section === 1 ? 1 / Math.max(Math.abs(x), Math.abs(z)) : p.section === 2 ? 1 / (Math.abs(x) + Math.abs(z)) : 1;
    return [x * scale * p.aspect / 100, z * scale * (p.section === 3 ? (z > 0 ? 1.6 : .75) : 1)];
  });
  const apothem = Math.min(...ring.map((a, i) => {
    const b = ring[(i + 1) % n];
    return Math.abs(a[0] * b[1] - b[0] * a[1]) / distance(a, b);
  }));
  ring = ring.map(([x, z]) => [x * p.diameter / (2 * apothem), z * p.diameter / (2 * apothem)]);
  const level = (i: number) => {
    const a = (i % n) * Math.PI * 2 / n;
    const cut = p.rim === 1 ? (1 + Math.cos(a)) / 2 : p.rim === 2 ? Math.abs(Math.sin(a)) : p.rim === 3 ? (i % n) % 2 : 0;
    return 1 - p.ridge / 100 * cut;
  };
  const point = (i: number, top: boolean): Point3 => {
    const [x, z] = ring[i % n], t = top ? level(i) : 0, scale = 1 + (ratio - 1) * t;
    return [x * scale + p.lean * t, p.height * t, z * scale];
  };
  const faces: { flat: Point[]; solid: Point3[] }[] = [];
  for (let i = 0; i < n; i++) {
    const solid = [point(i, false), point(i + 1, false), point(i + 1, true), point(i, true)];
    const e = distance(solid[0], solid[3]);
    const a: Point = i ? faces[i - 1].flat[1] : [0, 0], d: Point = i ? faces[i - 1].flat[2] : [0, e];
    const along: Point = [(d[0] - a[0]) / e, (d[1] - a[1]) / e], right: Point = [along[1], -along[0]];
    const locate = (v: Point3): Point => {
      const av = distance(solid[0], v), dv = distance(solid[3], v), y = (av * av + e * e - dv * dv) / (2 * e), x = Math.sqrt(Math.max(0, av * av - y * y));
      return [a[0] + along[0] * y + right[0] * x, a[1] + along[1] * y + right[1] * x];
    };
    faces.push({ solid, flat: [a, locate(solid[1]), locate(solid[2]), d] });
  }
  return faces;
}
