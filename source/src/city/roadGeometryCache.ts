import type { ProceduralCity } from './proceduralCity';
import type { RouteTrajectory } from './routeTrajectory';
import { cityRoadNetwork } from './cityRoadNetwork';
import { routeRoadPolygons } from './routeRoad';
import { roadPolygonUnion } from './roadPolygonUnion';

/** Scene-local cache. Doors, signals, repairs and bikes do not change asphalt. */
export function createRoadGeometryCache() {
  let networkKey = '', surfaceKey = '';
  let network: ReturnType<typeof cityRoadNetwork> | undefined;
  let surfaces: ReturnType<typeof roadPolygonUnion> | undefined;
  return (world: ProceduralCity, trajectory: RouteTrajectory, route: readonly string[], radius: number,
    width: (street: ProceduralCity['streets'][number]) => number) => {
    const nextNetwork = JSON.stringify([radius, world.steamTrain?.street,
      world.nodes.map(n => [n.id, n.x, n.y, n.z]),
      world.streets.map(s => [s.id, s.a, s.b, s.kind, width(s)])]);
    if (nextNetwork !== networkKey) {
      network = cityRoadNetwork(world, radius, width);
      networkKey = nextNetwork;
    }
    // Compare actual geometry rather than dimensionRevision: a doorway edit can
    // invalidate the trajectory object while leaving its road footprint intact.
    const nextSurface = JSON.stringify([networkKey, route, trajectory.minimumRadius,
      trajectory.points.map(p => [p.x, p.z]), trajectory.distances, trajectory.milestones]);
    if (!surfaces || nextSurface !== surfaceKey) {
      const streets = route.slice(1).map((id, i) => world.streets.find(s =>
        s.a === id && s.b === route[i] || s.b === id && s.a === route[i])!);
      const corridors = routeRoadPolygons(trajectory, streets.map(s => ({ id: s.id, width: width(s), transport: false })));
      surfaces = roadPolygonUnion([...network!.polygons, ...corridors]);
      surfaceKey = nextSurface;
    }
    return surfaces;
  };
}
