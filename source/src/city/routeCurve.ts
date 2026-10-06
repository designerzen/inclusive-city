import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/** Round the displayed route with tangent Bezier bends, without changing journey stops. */
export function routeCurve(stops: readonly Vector3[], cornerRadius = 6): Vector3[] {
  const points: Vector3[] = [];
  // A revisited dot otherwise draws overlapping tubes or a kinked reversal.
  for (const point of stops) {
    const revisit = points.findIndex(p => Vector3.DistanceSquared(p, point) < 1e-10);
    if (revisit >= 0) points.splice(revisit + 1);
    else points.push(point.clone());
  }
  // Intermediate dots on a straight street must not limit the sweep of a turn.
  for (let i = 1; i < points.length - 1;) {
    const incoming = points[i]!.subtract(points[i - 1]!).normalize();
    const outgoing = points[i + 1]!.subtract(points[i]!).normalize();
    if (Vector3.Dot(incoming, outgoing) > .999999) points.splice(i, 1);
    else i++;
  }
  // Short platform approaches otherwise force a tiny-radius zigzag. Blend those
  // display waypoints together so the bend spans the surrounding long streets.
  const minimumSpan = cornerRadius / 2;
  for (let i = 0; i < points.length - 1 && points.length > 2;) {
    if (Vector3.Distance(points[i]!, points[i + 1]!) >= minimumSpan) { i++; continue; }
    if (i === 0) points.splice(1, 1);
    else if (i === points.length - 2) points.splice(i, 1);
    else points.splice(i, 2, Vector3.Center(points[i]!, points[i + 1]!));
    i = Math.max(0, i - 1);
  }
  if (points.length < 3) return points;
  const path = [points[0]!.clone()];
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1]!, corner = points[i]!, after = points[i + 1]!;
    const incoming = corner.subtract(before), outgoing = after.subtract(corner);
    const inLength = incoming.length(), outLength = outgoing.length();
    incoming.normalize(); outgoing.normalize();
    const dot = Math.max(-1, Math.min(1, Vector3.Dot(incoming, outgoing)));
    if (dot > .999999 || cornerRadius <= 0) { path.push(corner.clone()); continue; }
    const angle = Math.acos(dot);
    const trim = Math.min(cornerRadius * Math.tan(angle / 2), inLength * .49, outLength * .49);
    const radius = trim / Math.tan(angle / 2);
    const handle = 4 / 3 * radius * Math.tan(angle / 4);
    const start = corner.subtract(incoming.scale(trim)), end = corner.add(outgoing.scale(trim));
    const c1 = start.add(incoming.scale(handle)), c2 = end.subtract(outgoing.scale(handle));
    path.push(start);
    const samples = Math.max(12, Math.ceil(angle / (Math.PI / 120)));
    for (let step = 1; step <= samples; step++) {
      const t = step / samples, u = 1 - t;
      path.push(start.scale(u ** 3).add(c1.scale(3 * u * u * t)).add(c2.scale(3 * u * t * t)).add(end.scale(t ** 3)));
    }
  }
  path.push(points.at(-1)!.clone());
  return path;
}
