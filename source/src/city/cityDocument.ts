import type { BarrierId } from './cityLayout';
import { buildingProperty, initialBuildingWalls, initialDoors, initialPavements, pavementEdge, wallLimits, doorBuilding } from './buildingDimensions';
import type { BuildingKey, DoorKey, PavementKey } from './buildingDimensions';
export type CityEditId = BarrierId | BuildingKey | DoorKey | PavementKey;
export function cityEditName(id: CityEditId) {
  const property = buildingProperty(id);
  if (pavementEdge(id) !== null) return `Route pavement ${pavementEdge(id)! + 1}`;
  return property ? `${property.building.name} ${property.wall} wall` : doorBuilding(id) ? `${doorBuilding(id)!.name} doorway` : featureNames[id as BarrierId];
}

export const featureNames: Record<BarrierId, string> = {
  communication: 'Communication board', curb: 'Curb', crossing: 'Crossing', guidance: 'Route cues',
  sidewalk: 'Pavement', bridge: 'Bridge', stairs: 'Stairs', elevator: 'Elevator',
};
export type CityValue = boolean | number;
export const initialCity = {
  communication: false, curb: false, crossing: 1.5, guidance: false,
  sidewalk: 1.2, bridge: false, stairs: false, elevator: false,
};
export type CityProperties = typeof initialCity & Record<BuildingKey | DoorKey | PavementKey, number>;
export interface CityEdit { id: CityEditId; before: CityValue; after: CityValue }

// One document drives both geometry and access checks. History belongs to the city,
// so restarting a robot does not reset edits or erase undo.
export class CityDocument {
  private values: CityProperties = { ...initialCity, ...initialBuildingWalls, ...initialDoors, ...initialPavements };
  private past: CityEdit[] = [];
  private future: CityEdit[] = [];
  revision = 0;
  get(id: CityEditId): CityValue { return this.values[id]; }
  snapshot(): CityProperties { return { ...this.values }; }
  get undoEdit() { return this.past.at(-1); }
  get redoEdit() { return this.future.at(-1); }
  get changedFeatures(): BarrierId[] {
    return (Object.keys(initialCity) as BarrierId[]).filter(id => this.values[id] !== initialCity[id]);
  }
  set(id: CityEditId, value: CityValue): CityEdit | null {
    const property = buildingProperty(id);
    if (pavementEdge(id) !== null) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 2.5 || value > 6) throw new Error('Invalid pavement width');
      value = Math.round(value * 10) / 10;
    } else if (doorBuilding(id)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.65 || value > 2) throw new Error('Invalid doorway width');
      value = Math.round(value * 100) / 100;
    } else if (property) {
      const limits = wallLimits(property.building.name, property.wall, key => Number(this.get(key)));
      if (typeof value !== 'number' || !Number.isFinite(value) || value < limits.min || value > limits.max) throw new Error('Invalid building dimension');
      value = Math.round(value * 10) / 10;
    } else if (id === 'sidewalk' || id === 'crossing') {
      const [min, max] = id === 'sidewalk' ? [0.8, 6] : [1.5, 20];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('Invalid city dimension');
      value = Math.round(value * 10) / 10;
    } else if (typeof value !== 'boolean') throw new Error('Invalid city feature state');
    if (this.get(id) === value) return null;
    const edit = { id, before: this.get(id), after: value };
    this.apply(edit, value); this.past.push(edit); this.future = [];
    return edit;
  }
  private apply(edit: CityEdit, value: CityValue) {
    // Each command has already been validated against its feature's property type.
    Object.assign(this.values, { [edit.id]: value }); this.revision++;
  }
  undo(): CityEdit | null {
    const edit = this.past.pop(); if (!edit) return null;
    this.apply(edit, edit.before); this.future.push(edit); return edit;
  }
  redo(): CityEdit | null {
    const edit = this.future.pop(); if (!edit) return null;
    this.apply(edit, edit.after); this.past.push(edit); return edit;
  }
}

export function describeFeature(city: CityDocument, id: BarrierId): string {
  const value = city.get(id);
  switch (id) {
    case 'sidewalk': return `Clear width: ${Number(value).toFixed(1)} m`;
    case 'crossing': return `Crossing time: ${Number(value).toFixed(1)} seconds`;
    case 'curb': return value ? 'Curb lowered' : 'Curb raised';
    case 'bridge': return value ? 'Bridge lowered' : 'Bridge raised';
    case 'stairs': return value ? 'Ramp added' : 'Steps only';
    case 'guidance': return value ? 'Route cues added' : 'No route cues';
    case 'elevator': return value ? 'Elevator enabled' : 'Elevator off';
    case 'communication': return value ? 'Communication board available' : 'No communication board';
  }
}
