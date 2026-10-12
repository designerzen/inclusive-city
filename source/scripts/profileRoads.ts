import { performance } from 'node:perf_hooks';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity, routeToGoal } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { cityRoadNetwork } from '../src/city/cityRoadNetwork';
import { roadPolygonUnion } from '../src/city/roadPolygonUnion';
import { routeRoadPolygons } from '../src/city/routeRoad';
const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current;
for (const seed of [42, 123, 567]) {
 const world = generateCity(seed, [bot]), journey = new PlannedJourney(bot, world); journey.enableLineFollowing();
 journey.setRoute(routeToGoal(world, world.start)!);
 const start = performance.now(), network = cityRoadNetwork(world, journey.minimumTurnRadius), networkEnd = performance.now();
 const streets = journey.route.slice(1).map((id,i) => world.streets.find(s => s.a===id && s.b===journey.route[i] || s.b===id && s.a===journey.route[i])!);
 const corridors = routeRoadPolygons(journey.trajectory, streets);
 const unionStart = performance.now();
 const roads = roadPolygonUnion([...network.polygons, ...corridors]);
 console.log(JSON.stringify({seed, networkMs:networkEnd-start, unionMs:performance.now()-unionStart, polygons:network.polygons.length+corridors.length, vertices:[...roads.values()].reduce((n,s)=>n+s.positions.length/3,0)}));
}

