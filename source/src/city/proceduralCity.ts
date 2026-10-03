import type { ArtBot } from '../robot/botHistory';
import type { RoutePoint } from './cityLayout';

export type StreetKind = 'clear' | 'bridge' | 'curb' | 'stairs' | 'width' | 'crossing' | 'guidance';
export interface CityNode extends RoutePoint { id: string; label: string; discovery?: 'music' | 'art' | 'harmony' | 'colour' }
export interface CityStreet { id: string; a: string; b: string; kind: StreetKind; width: number; crossingSeconds: number }
export interface CityBuilding { name: string; x: number; z: number; w: number; d: number; h: number }
export interface ProceduralCity {
  seed: number; nodes: CityNode[]; streets: CityStreet[]; buildings: CityBuilding[];
  start: string; destination: string; riverX: number; rememberedRobots: number;
}

export function robotFootprint(bot: ArtBot) { return (2 * (.95 + bot.profile.abilities.reach * .004) + .35) * bot.appearance.width * .55; }
export function robotSpeed(bot: ArtBot) { return bot.profile.enabledFunctions.includes('movement') ? .8 + bot.profile.effectiveAbilities.speed * .025 : 1.4; }
export function streetBetween(city: ProceduralCity, a: string, b: string) { return city.streets.find(s => s.a === a && s.b === b || s.a === b && s.b === a); }
export function neighbours(city: ProceduralCity, id: string) {
  return city.streets.filter(s => s.a === id || s.b === id).map(s => city.nodes.find(n => n.id === (s.a === id ? s.b : s.a))!);
}

/** Follow streets to the goal without requiring the player to draw a whole route. */
export function routeToGoal(city: ProceduralCity, from = city.start) {
  const queue = [[from]], visited = new Set([from]);
  for (let i = 0; i < queue.length; i++) {
    const route = queue[i]!;
    if (route.at(-1) === city.destination) return route;
    for (const node of neighbours(city, route.at(-1)!)) {
      if (visited.has(node.id)) continue;
      visited.add(node.id); queue.push([...route, node.id]);
    }
  }
  return null;
}

export const streetNames: Record<StreetKind, string> = { clear: 'Open street', bridge: 'Raised bridge', curb: 'Raised curb', stairs: 'Steps', width: 'Narrow passage', crossing: 'Short crossing signal', guidance: 'Missing route cues' };
export const streetActions: Record<StreetKind, string> = { clear: 'Street already open', bridge: 'Lower bridge', curb: 'Lower curb', stairs: 'Add ramp', width: 'Widen passage', crossing: 'Give more crossing time', guidance: 'Add route cues' };

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
  const minWidth = Math.min(...robots.map(robotFootprint));
  const fastest = Math.max(...robots.map(robotSpeed));
  const kinds: StreetKind[] = ['clear', 'clear', 'curb', 'stairs', 'width', 'crossing', 'guidance'];
  const streets: CityStreet[] = chosen.map((edge, i) => ({ ...edge, id: `street-${i}`, kind: kinds[Math.floor(random() * kinds.length)]!, width: Math.max(.3, minWidth - .2), crossingSeconds: Math.max(.1, 4 / fastest - .2) }));
  bridgeRows.forEach(row => streets.push({ id: `bridge-${row}`, a: `2-${row}`, b: `3-${row}`, kind: 'bridge', width: 3.5, crossingSeconds: 20 }));
  const places = shuffle(nodes.filter(n => n.id !== start && n.id !== destination));
  ['Library', 'Café', 'Market', 'Cinema', 'Museum', 'Studios'].forEach((name, i) => { places[i]!.label = name; places[i]!.discovery = (['art', 'music', 'colour', 'colour', 'harmony', 'art'] as const)[i]; });
  nodes.find(n => n.id === start)!.label = 'Workshop'; nodes.find(n => n.id === destination)!.label = 'Duet studio';
  const names = shuffle(['Library', 'Café', 'Studios', 'Market', 'Offices', 'Flats', 'Cinema', 'School', 'Museum', 'Hall', 'Tower', 'Workshop', 'Gallery']);
  const lots = shuffle(zs.slice(0, -1).flatMap((z, row) => xs.slice(0, -1).flatMap((x, col) => col === 2 ? [] : [{ x: (x + xs[col + 1]!) / 2, z: (z + zs[row + 1]!) / 2 }])));
  const buildings = names.map((name, i) => ({ name, ...lots[i]!, w: 3 + random(), d: 3 + random(), h: 1.8 + random() * 3 }));
  return { seed: seed >>> 0, nodes, streets, buildings, start, destination, riverX: (xs[2]! + xs[3]!) / 2, rememberedRobots: robots.length };
}

export function streetProblem(street: CityStreet, bot: ArtBot, repaired = false): string | null {
  if (repaired || street.kind === 'clear') return null;
  if (street.kind === 'width') return street.width < robotFootprint(bot) + .15 ? `This passage is ${street.width.toFixed(1)} m wide. ${bot.name} needs ${(robotFootprint(bot) + .15).toFixed(1)} m.` : null;
  if (street.kind === 'crossing') return street.crossingSeconds < 4 / robotSpeed(bot) ? `The signal gives ${street.crossingSeconds.toFixed(1)} seconds. ${bot.name} needs ${(4 / robotSpeed(bot)).toFixed(1)} seconds to cross.` : null;
  if (street.kind === 'guidance') return !bot.profile.enabledFunctions.includes('vision') || bot.profile.effectiveAbilities.routeMemory < 40 ? `${bot.name} needs repeated route cues at this junction.` : null;
  return street.kind === 'bridge' ? 'The bridge is raised. The drawn line cannot carry the robot over the gap.' : street.kind === 'stairs' ? 'The robot’s wheels cannot climb these steps.' : 'The raised curb blocks the robot’s wheels.';
}
