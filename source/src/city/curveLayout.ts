import type { ProceduralCity } from './proceduralCity';

/** Wider minimum radii need longer straight spans between neighbouring bends. */
export function fitCurveLayout(world: ProceduralCity, radius: number, moveBuilding: (name: string, x: number, z: number) => void) {
  if (!world.curvedRoadLayout) return;
  const oldScale = world.curvedRoadScale ?? 1;
  const spans = world.streets.filter(s => s.kind !== 'bridge' && !s.id.startsWith('train-')).map(s => {
    const a = world.nodes.find(n => n.id === s.a)!, b = world.nodes.find(n => n.id === s.b)!;
    return Math.hypot(b.x - a.x, b.z - a.z) / oldScale;
  });
  const scale = Math.max(1, (radius * 2 + .5) / Math.min(...spans)), factor = scale / oldScale;
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
  }
}
