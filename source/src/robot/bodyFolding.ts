import type { BaseBodyModel, Point, Point3 } from './bodyNet';

const sub = (a: Point3, b: Point3): Point3 => a.map((v, i) => v - b[i]) as Point3;
const dot = (a: Point3, b: Point3) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Point3): Point3 => a.map(v => v / Math.hypot(...a)) as Point3;
function rotate(point: Point3, origin: Point3, axis: Point3, angle: number): Point3 {
  const v = sub(point, origin), c = Math.cos(angle), s = Math.sin(angle), perpendicular = cross(axis, v), parallel = dot(axis, v) * (1 - c);
  return origin.map((o, i) => o + v[i] * c + perpendicular[i] * s + axis[i] * parallel) as Point3;
}

/** Rigid hinges: 0 = the exported net, 1 = the closed body. Face 1 stays fixed.
 * Index n represents the seam tabs attached to the final panel. This illustrates
 * their closing crease, not the physical act of threading them through slots. */
export function bodyFoldingPose(model: BaseBodyModel, fraction: number) {
  const amount = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 1;
  const first = model.faces[0].solid, base = first[0];
  const along = unit(sub(first[3], base)), edge = sub(first[1], base);
  const across = unit(edge.map((v, i) => v - dot(edge, along) * along[i]) as Point3);
  const embed = ([x, y]: Point): Point3 => base.map((v, i) => v + across[i] * x + along[i] * y) as Point3;
  const normal = (face: Point3[]) => unit(cross(sub(face[1], face[0]), sub(face[3], face[0])));
  const hinges = model.faces.map((face, i) => {
    const next = model.faces[(i + 1) % model.p.sides];
    const axis = unit(sub(face.solid[2], face.solid[1]));
    const a = normal(face.solid), b = normal(next.solid);
    const angle = Math.atan2(dot(axis, cross(a, b)), dot(a, b)) * amount;
    const origin = embed(face.flat[1]), flatAxis = unit(sub(embed(face.flat[2]), origin));
    return { origin, axis: flatAxis, angle };
  });
  const point = (face: number, flat: Point): Point3 => {
    let result = embed(flat);
    // Compose in reverse so a parent hinge carries all downstream hinges with it.
    for (let i = Math.min(face, hinges.length) - 1; i >= 0; i--) {
      const hinge = hinges[i]; result = rotate(result, hinge.origin, hinge.axis, hinge.angle);
    }
    return result;
  };
  return { point, faces: model.faces.map((face, i) => face.flat.map(p => point(i, p))) };
}
