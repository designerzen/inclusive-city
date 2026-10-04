import type { ProceduralCity } from './proceduralCity';
import { crossingButtonHeight, studioDoorTypes } from './proceduralCity';

export const sides = ['front', 'back', 'left', 'right'] as const;
export type BuildingSide = typeof sides[number];

/** Dimensions belong to the generated city, rather than the old fixed layout. */
export class CityDimensions {
  private values: Record<string, number> = {};
  private originals: Record<string, number> = {};
  constructor(readonly world: ProceduralCity) {
    for (const b of world.buildings) {
      Object.assign(this.values, {
        [`wall:${b.name}:front`]: b.z - b.d / 2, [`wall:${b.name}:back`]: b.z + b.d / 2,
        [`wall:${b.name}:left`]: b.x - b.w / 2, [`wall:${b.name}:right`]: b.x + b.w / 2,
        [`door:${b.name}`]: .65,
      });
    }
    for (const street of world.streets) {
      if (street.kind !== 'width') street.width = 2.6;
      this.values[`width:${street.id}`] = street.width;
      if (street.kind === 'crossing') {
        this.values[`crossing:${street.id}`] = street.crossingSeconds;
        this.values[`panel:${street.id}`] = crossingButtonHeight(street);
      }
    }
    if (world.studioEntrance) { this.values['studio:width'] = world.studioEntrance.width; this.values['studio:type'] = studioDoorTypes.indexOf(world.studioEntrance.doorType); }
    this.originals = { ...this.values };
  }
  get(id: string) { return this.values[id]; }
  snapshot() { return { ...this.values }; }
  name(id: string) {
    const [kind, name, side] = id.split(':');
    if (kind === 'studio') return name === 'width' ? 'Studio doorway width' : 'Studio door type';
    return kind === 'wall' ? `${name} ${side} wall` : kind === 'door' ? `${name} doorway` : kind === 'crossing' ? 'Crossing time' : kind === 'panel' ? 'Crossing button panel height' : 'Street width';
  }
  limits(id: string) {
    if (!(id in this.values)) return null;
    const [kind, name, side] = id.split(':');
    if (kind === 'studio') return name === 'width' ? { min: .5, max: 6, step: .05 } : { min: 0, max: 2, step: 1 };
    if (kind === 'door') return { min: .65, max: 2, step: .05 };
    if (kind === 'crossing') return { min: Math.min(.1, this.originals[id]!), max: 20, step: .1 };
    if (kind === 'panel') return { min: .5, max: 2.2, step: .05 };
    if (kind === 'width') return { min: Math.min(.3, this.originals[id]!), max: 6, step: .1 };
    const opposite = side === 'front' ? 'back' : side === 'back' ? 'front' : side === 'left' ? 'right' : 'left';
    const low = side === 'front' || side === 'left';
    const origin = this.originals[id]!, other = this.values[`wall:${name}:${opposite}`]!;
    return { min: low ? origin - 1.5 : other + 2.4, max: low ? other - 2.4 : origin + 1.5, step: .1 };
  }
  set(id: string, value: number) {
    const limits = this.limits(id);
    if (!limits || !Number.isFinite(value) || value < limits.min - 1e-8 || value > limits.max + 1e-8) return false;
    if (id === 'studio:type' && !Number.isInteger(value)) return false;
    if (this.values[id] === value) return false;
    this.values[id] = value;
    const [kind, name] = id.split(':');
    if (kind === 'studio' && this.world.studioEntrance) {
      if (name === 'width') this.world.studioEntrance.width = value;
      else this.world.studioEntrance.doorType = studioDoorTypes[value]!;
    } else if (kind === 'wall') {
      const b = this.world.buildings.find(b => b.name === name)!;
      const left = this.values[`wall:${name}:left`]!, right = this.values[`wall:${name}:right`]!;
      const front = this.values[`wall:${name}:front`]!, back = this.values[`wall:${name}:back`]!;
      b.x = (left + right) / 2; b.z = (front + back) / 2; b.w = right - left; b.d = back - front;
    } else if (kind === 'width' || kind === 'crossing' || kind === 'panel') {
      const street = this.world.streets.find(s => s.id === name)!;
      if (kind === 'width') street.width = value; else if (kind === 'panel') street.buttonHeight = value; else street.crossingSeconds = value;
    }
    return true;
  }
}
