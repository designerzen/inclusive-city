import type { ProceduralCity } from './proceduralCity';

/** Wider minimum radii need longer straight spans between neighbouring bends. */
export function fitCurveLayout(world: ProceduralCity, radius: number, moveBuilding: (name: string, x: number, z: number) => void) {
  if (!world.curvedRoadLayout) return;
  const oldScale = world.curvedRoadScale ?? 1;
  const spans = world.streets.filter(s => s.id !== world.steamTrain?.street && !s.id.startsWith('train-')).map(s => {
    const a = world.nodes.find(n => n.id === s.a)!, b = world.nodes.find(n => n.id === s.b)!;
    return Math.hypot(b.x - a.x, b.z - a.z) / oldScale;
  });
  // Leave a usable straight bridge deck between its curved approaches.
  const scale = Math.max(1, (radius * 2 + 6) / Math.min(...spans)), factor = scale / oldScale;
  if (Math.abs(factor - 1) > 1e-8) {
    for (const n of world.nodes) { n.x *= factor; n.z *= factor; }
    for (const b of world.buildings) moveBuilding(b.name, b.x * factor, b.z * factor);
    if (world.bicycleGarage) { world.bicycleGarage.x *= factor; world.bicycleGarage.z *= factor; }
    for (const p of [world.steamTrain?.trackStart, world.steamTrain?.trackEnd]) if (p) { p.x *= factor; p.z *= factor; }
    world.riverX *= factor;
  }
  world.curvedRoadScale = scale;
  for (const [id, track, sign] of [['train-west', world.steamTrain?.trackStart, 1], ['train-east', world.steamTrain?.trackEnd, -1]] as const) {
    const station = world.nodes.find(n => n.id === id);
    if (station && track) { station.x = track.x; station.z = track.z + sign * Math.max(2.6 * scale, radius + .5); }
    const approach = world.streets.find(s => s.id === `${id}-approach`);
    if (station && approach) {
      // Arrive from beyond the platform and continue toward the track. Connecting
      // to the track's own grid dot forced a reversal at the boarding station.
      const outside = world.nodes.filter(n => !n.id.startsWith('train-') && Math.abs(n.x - station.x) < 1e-6 && (n.z - station.z) * sign > .1)
        .sort((a, b) => Math.abs(a.z - station.z) - Math.abs(b.z - station.z))[0];
      if (outside) { if (approach.a === station.id) approach.b = outside.id; else approach.a = outside.id; }
    }
  }
}
