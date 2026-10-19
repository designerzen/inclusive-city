import { buildingDescriptions, buildingSymbols } from './creativeBuildings';
import type { CreativeBuilding } from './proceduralCity';
import type { RobotEvent } from '../robot/robotState';

export interface JourneyInspiration { id: string; name: string; symbol: string; description: string }
const discoveries = {
  art: ['◇', 'Drawing inspiration', 'My next brushstrokes will be broader and richer.'],
  colour: ['◈', 'Colour inspiration', 'My painting now uses a wider palette and extra circular marks.'],
  music: ['♫', 'Music inspiration', 'This discovery adds a musical response to my journey song.'],
  harmony: ['♬', 'Harmony inspiration', 'My song now uses richer chord voices.'],
} as const;

export function journeyInspiration(event: RobotEvent, place?: string): JourneyInspiration | null {
  if (event.type === 'building_encounter') {
    const role = event.data.kind as CreativeBuilding;
    if (!Object.hasOwn(buildingDescriptions, role)) return null;
    const effect = buildingDescriptions[role].replace(/^[^:]+:\s*/, '');
    return { id: `building:${event.data.id}`, name: String(event.data.id), symbol: buildingSymbols[role], description: effect[0]!.toUpperCase() + effect.slice(1) };
  }
  if (event.type !== 'pickup' || !Object.hasOwn(discoveries, String(event.data.kind))) return null;
  const [symbol, name, description] = discoveries[event.data.kind as keyof typeof discoveries];
  return { id: `pickup:${event.data.id}`, name: place ? `${place} · ${name}` : name, symbol, description };
}

