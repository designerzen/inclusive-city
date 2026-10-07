import type { BridgeAccess } from './humpbackBridge';
import type { ArtBot } from '../robot/botHistory';
import type { RoutePoint } from './cityLayout';

export type StreetKind = 'clear' | 'bridge' | 'curb' | 'stairs' | 'width' | 'crossing' | 'guidance';
export interface CityNode extends RoutePoint { id: string; label: string; discovery?: 'music' | 'art' | 'harmony' | 'colour' }
export interface CityStreet { id: string; a: string; b: string; kind: StreetKind; width: number; crossingSeconds: number; buttonHeight?: number; bridgeAccess?: BridgeAccess }
export interface CityBuilding { name: string; x: number; z: number; w: number; d: number; h: number }
export const studioDoorTypes = ['revolving', 'automatic', 'push'] as const;
export type StudioDoorType = typeof studioDoorTypes[number];
export interface StudioEntrance { width: number; doorType: StudioDoorType }
export interface CityBicycle { id: string; street: string; location: 'pavement' | 'road'; pushDistance?: number }
export interface ProceduralCity {
  minimumTurnRadius?: number;
  seed: number; nodes: CityNode[]; streets: CityStreet[]; buildings: CityBuilding[];
  studioEntrance?: StudioEntrance;
  bicycleGarage?: { x: number; z: number };
  bicycles?: CityBicycle[];
  steamTrain?: { street: string; trackStart?: RoutePoint; trackEnd?: RoutePoint };
  start: string; destination: string; riverX: number; rememberedRobots: number;
}

export function robotFootprint(bot: ArtBot) { return (2 * (.95 + bot.profile.abilities.reach * .004) + .35) * bot.appearance.width * .55; }
export function robotSpeed(bot: ArtBot) { return .8 + bot.profile.effectiveAbilities.speed * .025; }
/** Reach tuning determines the highest crossing button the arm can operate. */
export function robotButtonReach(bot: ArtBot) { return .9 + bot.profile.effectiveAbilities.reach * .012; }
export function crossingButtonHeight(street: CityStreet) { return street.buttonHeight ?? 1.5; }
export function crossingReachProblem(street: CityStreet, bot: ArtBot) {
  return street.kind === 'crossing' && crossingButtonHeight(street) > robotButtonReach(bot) + 1e-8
    ? `The crossing button is ${crossingButtonHeight(street).toFixed(2)} m high. ${bot.name} can reach ${robotButtonReach(bot).toFixed(2)} m. Lower the button panel so the robot can request a green light.` : null;
}
export function studioEntranceProblem(entrance: StudioEntrance | undefined, bot: ArtBot): string | null {
  if (!entrance) return null;
  const needed = robotFootprint(bot) + .15;
  if (entrance.width + 1e-8 < needed) return `The studio doorway is ${entrance.width.toFixed(2)} m wide. ${bot.name} needs ${needed.toFixed(2)} m. Widen the doorway so the robot can fit.`;
  if (entrance.doorType === 'revolving' && bot.profile.effectiveAbilities.agility < 60) return `${bot.name} cannot turn quickly enough inside the revolving door. Choose an automatic door or a push door the robot can operate.`;
  if (entrance.doorType === 'push' && (robotButtonReach(bot) < 1.2 || bot.profile.effectiveAbilities.burstPower < 40)) return `${bot.name} cannot operate the push door: its push bar is 1.20 m high and needs 40 burst power. Choose an automatic door.`;
  return null;
}
export function streetBetween(city: ProceduralCity, a: string, b: string) { return city.streets.find(s => s.a === a && s.b === b || s.a === b && s.b === a); }
export function neighbours(city: ProceduralCity, id: string) {
  return city.streets.filter(s => s.a === id || s.b === id).map(s => city.nodes.find(n => n.id === (s.a === id ? s.b : s.a))!);
}

/** Follow streets to the goal without requiring the player to draw a whole route. */
export function routeToGoal(city: ProceduralCity, from = city.start) {
  const queue = [{ route: [from], cost: 0 }], visited = new Set<string>();
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { route, cost } = queue.shift()!;
    if (visited.has(route.at(-1)!)) continue;
    visited.add(route.at(-1)!);
    if (route.at(-1) === city.destination) return route;
    for (const node of neighbours(city, route.at(-1)!)) {
      if (visited.has(node.id)) continue;
      const street = streetBetween(city, route.at(-1)!, node.id)!;
      const penalty = city.steamTrain && street.kind === 'bridge' && street.id !== city.steamTrain.street ? 100 : 0;
      queue.push({ route: [...route, node.id], cost: cost + 1 + penalty });
    }
  }
  return null;
}

export const streetNames: Record<StreetKind, string> = { clear: 'Open street', bridge: 'Humpback bridge with steps', curb: 'Raised curb', stairs: 'Humpback bridge with steps', width: 'Narrow passage', crossing: 'Pelican crossing', guidance: 'Missing route cues' };
export const streetActions: Record<StreetKind, string> = { clear: 'Street already open', bridge: 'Add ramp', curb: 'Lower curb', stairs: 'Add ramp', width: 'Widen passage', crossing: 'Give more crossing time', guidance: 'Add route cues' };

/** Both banks are connected; every route between them crosses an initially raised bridge. */
export function generateCity(seed: number, robots: readonly ArtBot[]): ProceduralCity {
  if (!Number.isFinite(seed) || !robots.length) throw new Error('A city needs a seed and at least one robot.');
  let state = seed >>> 0;
  const random = () => { state += 0x6d2b79f5; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const shuffle = <T>(values: T[]) => { for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j]!, values[i]!]; } return values; };
  const xs = [-22, -14, -6, 6, 14, 22].map(x => x + (random() - .5) * 1.8);
  const zs = [-16, -8, 0, 8, 16].map(z => z + (random() - .5) * 1.8);
  const nodes: CityNode[] = zs.flatMap((z, row) => xs.map((x, col) => ({ id: `${col}-${row}`, x, y: .16, z, label: `${String.fromCharCode(65 + col)}${row + 1}` })));
  const start = `0-${Math.floor(random() * 5)}`, destination = `5-${Math.floor(random() * 5)}`;
  const candidates: { a: string; b: string }[] = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
    if (col < 5 && col !== 2) candidates.push({ a: `${col}-${row}`, b: `${col + 1}-${row}` });
    if (row < 4) candidates.push({ a: `${col}-${row}`, b: `${col}-${row + 1}` });
  }
  const parent = new Map(nodes.map(n => [n.id, n.id]));
  const root = (id: string): string => { const p = parent.get(id)!; if (p === id) return id; const r = root(p); parent.set(id, r); return r; };
  const chosen = shuffle(candidates).filter(edge => { const a = root(edge.a), b = root(edge.b); if (a !== b) { parent.set(a, b); return true; } return random() < .55; });
  const bridgeRows = shuffle([0, 1, 2, 3, 4]).slice(0, 2 + Math.floor(random() * 2));
  if (!bridgeRows.includes(2)) bridgeRows[0] = 2;
  const minWidth = Math.min(...robots.map(robotFootprint));
  const fastest = Math.max(...robots.map(robotSpeed));
  const kinds: StreetKind[] = ['clear', 'clear', 'curb', 'stairs', 'width', 'crossing', 'guidance'];
  const streets: CityStreet[] = chosen.map((edge, i) => ({ ...edge, id: `street-${i}`, kind: kinds[Math.floor(random() * kinds.length)]!, width: Math.max(.3, minWidth - .2), crossingSeconds: Math.max(.1, 4 / fastest - .2) }));
  bridgeRows.forEach(row => streets.push({ id: `bridge-${row}`, a: `2-${row}`, b: `3-${row}`, kind: 'bridge', width: 3.5, crossingSeconds: 20 }));
  // The studio forecourt is clear; its doorway is the final obstacle after the road.
  streets.filter(s => s.a === destination || s.b === destination).forEach(s => { if (s.kind === 'crossing') s.kind = 'clear'; });
  const places = shuffle(nodes.filter(n => n.id !== start && n.id !== destination));
  ['Library', 'Café', 'Market', 'Cinema', 'Museum', 'Studios'].forEach((name, i) => { places[i]!.label = name; places[i]!.discovery = (['art', 'music', 'colour', 'colour', 'harmony', 'art'] as const)[i]; });
  nodes.find(n => n.id === start)!.label = 'Workshop'; nodes.find(n => n.id === destination)!.label = 'Duet studio';
  const names = shuffle(['Library', 'Café', 'Studios', 'Market', 'Offices', 'Flats', 'Cinema', 'School', 'Museum', 'Hall', 'Tower', 'Workshop', 'Gallery']);
  const lots = shuffle(zs.slice(0, -1).flatMap((z, row) => xs.slice(0, -1).flatMap((x, col) => col === 2 ? [] : [{ x: (x + xs[col + 1]!) / 2, z: (z + zs[row + 1]!) / 2 }])));
  const buildings = names.map((name, i) => ({ name, ...lots[i]!, w: 3 + random(), d: 3 + random(), h: 1.8 + random() * 3 }));
  const bicycleStreets = [...new Set([
    ...streets.filter(s => s.a === start || s.b === start),
    ...streets.filter(s => s.kind !== 'bridge').slice(0, 3),
  ])].filter(street => street.kind !== 'crossing');
  const bicycles: CityBicycle[] = bicycleStreets.map((street, i) => ({ id: `bicycle-${i + 1}`, street: street.id, location: i % 2 === 1 ? 'road' : 'pavement' }));
  // The railway crosses the central river corridor. Its station junctions sit
  // on opposite sides of the rails, so riders continue directly off the train.
  const west = nodes.find(n => n.id === '2-2')!, east = nodes.find(n => n.id === '3-2')!;
  const centreZ = (west.z + east.z) / 2;
  const trackStart = { x: west.x, y: .16, z: centreZ };
  const trackEnd = { x: east.x, y: .16, z: centreZ };
  const entry: CityNode = { id: 'train-west', label: 'Central station - board', x: west.x, y: .16, z: centreZ + 2.6 };
  const exit: CityNode = { id: 'train-east', label: 'Central station - exit', x: east.x, y: .16, z: centreZ - 2.6 };
  nodes.push(entry, exit);
  const trainStreet = streets.find(s => s.id === 'bridge-2')!;
  trainStreet.a = entry.id; trainStreet.b = exit.id; trainStreet.width = Math.max(8, ...robots.map(robotFootprint));
  streets.push(
    { id: 'train-west-approach', a: west.id, b: entry.id, kind: 'clear', width: 6, crossingSeconds: 20 },
    { id: 'train-east-approach', a: exit.id, b: east.id, kind: 'clear', width: 6, crossingSeconds: 20 },
  );
  // Reserve generous forecourts for turning, queuing and ramp deployment.
  // Check whole footprints, including room for the building editor's 1.5 m expansion.
  const outsideStations = (lot: { x: number; z: number; w: number; d: number }) => [entry, exit].every(stop =>
    Math.abs(lot.x - stop.x) >= 6 + lot.w / 2 || Math.abs(lot.z - stop.z) >= 6 + lot.d / 2);
  const stationBuildings = buildings.filter(building => outsideStations({ ...building, w: building.w + 3, d: building.d + 3 }));
  const garageLots = lots.filter(lot => outsideStations({ ...lot, w: 5.5, d: 4.5 }));
  const bicycleGarage = garageLots.find(lot => !stationBuildings.some(building => building.x === lot.x && building.z === lot.z)) ?? garageLots[0]!;
  const openBuildings = stationBuildings.filter(building => building.x !== bicycleGarage.x || building.z !== bicycleGarage.z);
  return { steamTrain: { street: trainStreet.id, trackStart, trackEnd }, bicycleGarage, bicycles, studioEntrance: { width: Math.max(.5, minWidth - .2), doorType: 'revolving' }, seed: seed >>> 0, nodes, streets, buildings: openBuildings, start, destination, riverX: (xs[2]! + xs[3]!) / 2, rememberedRobots: robots.length };
}

export function streetProblem(street: CityStreet, bot: ArtBot, repaired = false, crossingLength = 4): string | null {
  if (repaired || street.kind === 'clear') return null;
  const reachProblem = crossingReachProblem(street, bot);
  if (reachProblem) return reachProblem;
  if (street.kind === 'width') return street.width < robotFootprint(bot) + .15 ? `This passage is ${street.width.toFixed(1)} m wide. ${bot.name} needs ${(robotFootprint(bot) + .15).toFixed(1)} m.` : null;
  if (street.kind === 'crossing') return street.crossingSeconds + 1e-8 < crossingLength / robotSpeed(bot) ? `The green light gives ${street.crossingSeconds.toFixed(1)} seconds. ${bot.name} needs ${(crossingLength / robotSpeed(bot)).toFixed(1)} seconds to cross. Extend the green phase for slower robots.` : null;
  if (street.kind === 'guidance') return !bot.profile.enabledFunctions.includes('vision') || bot.profile.effectiveAbilities.routeMemory < 40 ? `${bot.name} needs repeated route cues at this junction.` : null;
  return street.kind === 'bridge' || street.kind === 'stairs' ? 'Steps lead up and down this humpback bridge. The robot needs a ramp or elevators at both ends.' : 'The raised curb blocks the robot’s wheels.';
}
