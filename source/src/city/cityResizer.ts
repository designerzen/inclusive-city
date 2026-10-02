import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Culling/ray';
import type { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { CityJourney } from '../simulation/cityJourney';
import type { CityEditId } from './cityDocument';
import { buildingKey, buildingProperty, pavementEdge, wallLimits } from './buildingDimensions';
import type { DoorKey } from './buildingDimensions';
import { buildings } from './cityLayout';

export function resizeLimits(journey: CityJourney, id: CityEditId) {
  const property = buildingProperty(id);
  if (property) return wallLimits(property.building.name, property.wall, key => Number(journey.city.get(key)));
  return pavementEdge(id) !== null ? { min: 2.5, max: 6 } : id === 'sidewalk' ? { min: 0.8, max: 6 } : { min: 0.65, max: 2 };
}

/** Preview a drag without filling undo history with every pointer movement. */
export function createCityResizer(scene: Scene, engine: Engine, journey: CityJourney, sync: () => void, selected: (id: CityEditId) => void) {
  let drag: { id: CityEditId; x: number; y: number; dx: number; dy: number; before: number; multiplier: number } | null = null;
  let preview: { id: CityEditId; value: number } | null = null;
  function project(point: Vector3) {
    const canvas = engine.getRenderingCanvas()!;
    const p = Vector3.Project(point, Matrix.Identity(), scene.getTransformMatrix(), scene.activeCamera!.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    return { x: p.x * canvas.clientWidth / engine.getRenderWidth(), y: p.y * canvas.clientHeight / engine.getRenderHeight() };
  }
  return {
    get active() { return drag !== null; },
    get target() { return drag?.id ?? null; },
    value(id: CityEditId) { return preview?.id === id ? preview.value : Number(journey.city.get(id)); },
    inspect(x: number, y: number) {
      const pick = scene.pick(x, y, mesh => !!mesh.metadata?.building || !!mesh.metadata?.door || !!mesh.metadata?.pavement || mesh.metadata?.barrier === 'sidewalk');
      if (!pick?.pickedMesh || !pick.pickedPoint) return null;
      const metadata = pick.pickedMesh.metadata;
      let id: CityEditId, axis = new Vector3(0, 0, 1), multiplier = 1;
      if (metadata.pavement) {
        id = metadata.pavement;
        axis = metadata.resizeAxis === 'x' ? new Vector3(1, 0, 0) : axis;
        const centre = pick.pickedMesh.getAbsolutePosition();
        multiplier = (metadata.resizeAxis === 'x' ? pick.pickedPoint.x >= centre.x : pick.pickedPoint.z >= centre.z) ? 2 : -2;
      } else if (metadata.door) { id = `door:${metadata.door}` as DoorKey; axis = new Vector3(1, 0, 0); multiplier = pick.pickedPoint.x >= pick.pickedMesh.getAbsolutePosition().x ? 2 : -2; }
      else if (metadata.building) {
        const b = buildings.find(b => b.name === metadata.building)!;
        const normal = pick.getNormal(true)!;
        let wall: 'front' | 'back' | 'left' | 'right';
        if (Math.abs(normal.y) < 0.5) wall = Math.abs(normal.x) > Math.abs(normal.z) ? normal.x < 0 ? 'left' : 'right' : normal.z < 0 ? 'front' : 'back';
        else {
          const sides = (['front', 'back', 'left', 'right'] as const).map(wall => ({ wall, distance: Math.abs((wall === 'front' || wall === 'back' ? pick.pickedPoint!.z : pick.pickedPoint!.x) - Number(journey.city.get(buildingKey(b.name, wall)))) }));
          wall = sides.sort((a, b) => a.distance - b.distance)[0]!.wall;
        }
        id = buildingKey(b.name, wall);
        if (wall === 'left' || wall === 'right') axis = new Vector3(1, 0, 0);
      } else {
        id = 'sidewalk'; multiplier = pick.pickedPoint.z >= -4 ? 2 : -2;
      }
      const a = project(pick.pickedPoint), b = project(pick.pickedPoint.add(axis));
      const dx = b.x - a.x, dy = b.y - a.y;
      return { id, mesh: pick.pickedMesh, dx, dy, multiplier, available: journey.canEdit(id) && dx * dx + dy * dy >= 4 };
    },
    begin(x: number, y: number) {
      const target = this.inspect(x, y);
      if (!target?.available) return false;
      const { id, dx, dy, multiplier } = target;
      drag = { id, x, y, dx, dy, before: Number(journey.city.get(id)), multiplier };
      selected(id);
      return true;
    },
    move(x: number, y: number) {
      if (!drag) return;
      const { id, dx, dy, before, multiplier } = drag;
      const delta = ((x - drag.x) * dx + (y - drag.y) * dy) / (dx * dx + dy * dy) * multiplier;
      const { min, max } = resizeLimits(journey, id);
      preview = { id, value: Math.round(Math.max(min, Math.min(max, before + delta)) * 100) / 100 };
      sync();
    },
    finish(commit = true) {
      const change = preview;
      preview = null; drag = null;
      if (commit && change) journey.edit(change.id, change.value);
      sync();
      return commit ? change?.id : undefined;
    },
  };
}
