import { buildings, cityRoute } from './cityLayout';
export const pavementEdges = cityRoute.slice(0, -1).map((_, edge) => edge).filter(edge => ![2, 4, 6, 8, 10].includes(edge));
export type PavementKey = `pavement:${number}`;
export function pavementEdge(id: string) { const edge = Number(id.slice(9)); return id.startsWith('pavement:') && pavementEdges.includes(edge) ? edge : null; }
export const initialPavements = Object.fromEntries(pavementEdges.map(edge => [`pavement:${edge}`, 3.2])) as Record<PavementKey, number>;
export const wallSides = ['front', 'back', 'left', 'right'] as const;
export type WallSide = typeof wallSides[number];
export type BuildingName = typeof buildings[number]['name'];
export type BuildingKey = `building:${BuildingName}:${WallSide}`;
export type DoorKey = `door:${BuildingName}`;
export function doorBuilding(id: string) { return id.startsWith('door:') ? buildings.find(b => b.name === id.slice(5)) : undefined; }
export const buildingKey = (name: BuildingName, wall: WallSide): BuildingKey => `building:${name}:${wall}`;
export function buildingProperty(id: string) {
  const [, name, wall] = id.split(':');
  const building = buildings.find(item => item.name === name);
  if (!id.startsWith('building:') || !building || !wallSides.includes(wall as WallSide)) return null;
  return { building, wall: wall as WallSide };
}
export function originalWall(name: BuildingName, wall: WallSide) {
  const b = buildings.find(item => item.name === name)!;
  return wall === 'front' ? b.z - b.d / 2 : wall === 'back' ? b.z + b.d / 2 : wall === 'left' ? b.x - b.w / 2 : b.x + b.w / 2;
}
export const initialBuildingWalls = Object.fromEntries(buildings.flatMap(b => wallSides.map(wall => [buildingKey(b.name, wall), originalWall(b.name, wall)]))) as Record<BuildingKey, number>;
export const initialDoors = Object.fromEntries(buildings.map(b => [`door:${b.name}`, 0.65])) as Record<DoorKey, number>;
export function wallLimits(name: BuildingName, wall: WallSide, get: (key: BuildingKey) => number) {
  const original = originalWall(name, wall);
  const low = wall === 'front' || wall === 'left';
  const opposite: WallSide = wall === 'front' ? 'back' : wall === 'back' ? 'front' : wall === 'left' ? 'right' : 'left';
  return { min: low ? original - 1.5 : Math.max(original - 1.5, get(buildingKey(name, opposite)) + 2),
    max: low ? Math.min(original + 1.5, get(buildingKey(name, opposite)) - 2) : original + 1.5 };
}
