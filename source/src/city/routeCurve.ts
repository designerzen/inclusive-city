import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/** Construct tangent Bezier bends for the shared line and follower trajectory. */
export function routeCurve(stops: readonly Vector3[], cornerRadius = 6, preserveVisits = false, minimumRadius = 0): Vector3[] {
  const points: Vector3[] = [];
  // A revisited dot otherwise draws overlapping tubes or a kinked reversal.
  for (const point of stops) {
    const revisit = points.findIndex(p => Vector3.DistanceSquared(p, point) < 1e-10);
    if (revisit >= 0 && !preserveVisits) points.splice(revisit + 1);
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
  const requiredTrim = (i: number) => {
    if (i === 0 || i === points.length - 1) return 0;
    const a = points[i]!.subtract(points[i - 1]!).normalize(), b = points[i + 1]!.subtract(points[i]!).normalize();
    const dot = Math.max(-1, Math.min(1, Vector3.Dot(a, b)));
    return minimumRadius * Math.tan(Math.acos(dot) / 2);
  };
  // Make room for the selected minimum instead of silently tightening a bend.
  if (minimumRadius > 0) for (let i = 0; i < points.length - 1 && points.length > 2;) {
    if (requiredTrim(i) + requiredTrim(i + 1) <= Vector3.Distance(points[i]!, points[i + 1]!) * .98) { i++; continue; }
    if (i === 0) points.splice(1, 1);
    else if (i === points.length - 2) points.splice(i, 1);
    else points.splice(i, 2, Vector3.Center(points[i]!, points[i + 1]!));
    i = 0;
  }
  if (points.length < 3) return points;
  const trims = points.map((_, i) => {
    if (i === 0 || i === points.length - 1) return 0;
    const a = points[i]!.subtract(points[i - 1]!).normalize(), b = points[i + 1]!.subtract(points[i]!).normalize();
    return Math.max(requiredTrim(i), Math.min(cornerRadius * Math.tan(Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(a, b)))) / 2),
      Vector3.Distance(points[i]!, points[i - 1]!) * .49, Vector3.Distance(points[i + 1]!, points[i]!) * .49));
  });
  for (let i = 0; i < points.length - 1; i++) {
    const room = Vector3.Distance(points[i]!, points[i + 1]!) * .98;
    if (trims[i]! + trims[i + 1]! <= room) continue;
    const baseA = requiredTrim(i), baseB = requiredTrim(i + 1), extraA = trims[i]! - baseA, extraB = trims[i + 1]! - baseB;
    const scale = Math.max(0, (room - baseA - baseB) / (extraA + extraB));
    trims[i] = baseA + extraA * scale; trims[i + 1] = baseB + extraB * scale;
  }
  const path = [points[0]!.clone()];
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1]!, corner = points[i]!, after = points[i + 1]!;
    const incoming = corner.subtract(before), outgoing = after.subtract(corner);
    const inLength = incoming.length(), outLength = outgoing.length();
    incoming.normalize(); outgoing.normalize();
    const dot = Math.max(-1, Math.min(1, Vector3.Dot(incoming, outgoing)));
    if (Math.abs(dot) > .999999 || cornerRadius <= 0) { path.push(corner.clone()); continue; }
    const angle = Math.acos(dot);
    const trim = trims[i]!;
    const radius = trim / Math.tan(angle / 2);
    const handle = 4 / 3 * radius * Math.tan(angle / 4);
    const start = corner.subtract(incoming.scale(trim)), end = corner.add(outgoing.scale(trim));
    const c1 = start.add(incoming.scale(handle)), c2 = end.subtract(outgoing.scale(handle));
    const normal = outgoing.subtract(incoming.scale(dot)).normalize();
    const centre = start.add(normal.scale(radius)), radial = start.subtract(centre);
    path.push(start);
    const samples = Math.max(12, Math.ceil(angle / (Math.PI / 120)));
    for (let step = 1; step <= samples; step++) {
      const t = step / samples, u = 1 - t;
      path.push(minimumRadius > 0
        ? centre.add(radial.scale(Math.cos(angle * t))).add(incoming.scale(radius * Math.sin(angle * t)))
        : start.scale(u ** 3).add(c1.scale(3 * u * u * t)).add(c2.scale(3 * u * t * t)).add(end.scale(t ** 3)));
    }
  }
  path.push(points.at(-1)!.clone());
  return path;
}
