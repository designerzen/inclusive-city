import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Culling/ray';
import type { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { PlannedJourney } from '../simulation/plannedJourney';
import { sides } from './cityDimensions';

export function createProceduralResizer(scene: Scene, engine: Engine, journey: PlannedJourney, sync: () => void, selected: (id: string) => void) {
  let drag: { id: string; x: number; y: number; dx: number; dy: number; before: number; multiplier: number } | null = null;
  let preview: { id: string; value: number } | null = null;
  function project(point: Vector3) {
    const canvas = engine.getRenderingCanvas()!;
    const p = Vector3.Project(point, Matrix.Identity(), scene.getTransformMatrix(), scene.activeCamera!.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    return { x: p.x * canvas.clientWidth / engine.getRenderWidth(), y: p.y * canvas.clientHeight / engine.getRenderHeight() };
  }
  return {
    get active() { return drag !== null; },
    value(id: string) { return preview?.id === id ? preview.value : journey.dimensions.get(id)!; },
    previewSize(id: string, value: number) {
      const limits = journey.dimensions.limits(id);
      if (!limits || !journey.canEdit(id) || !Number.isFinite(value)) return;
      preview = { id, value: Math.max(limits.min, Math.min(limits.max, value)) }; sync();
    },
    inspect(x: number, y: number) {
      // Respect occlusion: a doorway cannot be dragged through the roof above it.
      const pick = scene.pick(x, y);
      if (!pick?.pickedMesh || !pick.pickedPoint) return null;
      const meta = pick.pickedMesh.metadata;
      if (!meta?.building && !meta?.dimension) return null;
      let id: string = meta.dimension, axis = new Vector3(1, 0, 0), multiplier = 1;
      if (meta.building) {
        const name = meta.building;
        const side = meta.side ?? [...sides].sort((a, b) => {
          const distance = (side: string) => Math.abs((side === 'front' || side === 'back' ? pick.pickedPoint!.z : pick.pickedPoint!.x) - journey.dimensions.get(`wall:${name}:${side}`)!);
          return distance(a) - distance(b);
        })[0]!;
        id = `wall:${name}:${side}`;
        if (side === 'front' || side === 'back') axis = new Vector3(0, 0, 1);
      } else {
        if (meta.axis === 'z') axis = new Vector3(0, 0, 1);
        if (meta.axis === 'y') axis = new Vector3(0, 1, 0);
        const centre = pick.pickedMesh.getAbsolutePosition();
        multiplier = meta.axis === 'y' ? 1 : (axis.x ? pick.pickedPoint.x >= centre.x : pick.pickedPoint.z >= centre.z) ? 2 : -2;
      }
      const a = project(pick.pickedPoint), b = project(pick.pickedPoint.add(axis));
      const dx = b.x - a.x, dy = b.y - a.y;
      return { id, dx, dy, multiplier, available: journey.canEdit(id) && dx * dx + dy * dy >= 4 };
    },
    begin(x: number, y: number) {
      const target = this.inspect(x, y);
      if (!target?.available) return false;
      drag = { ...target, x, y, before: journey.dimensions.get(target.id)! };
      selected(target.id); return true;
    },
    move(x: number, y: number) {
      if (!drag) return;
      const { id, dx, dy, before, multiplier } = drag, limits = journey.dimensions.limits(id)!;
      const delta = ((x - drag.x) * dx + (y - drag.y) * dy) / (dx * dx + dy * dy) * multiplier;
      preview = { id, value: Math.max(limits.min, Math.min(limits.max, Math.round((before + delta) * 100) / 100)) };
      sync();
    },
    finish(commit = true) {
      const change = preview; preview = null; drag = null;
      if (commit && change) journey.editDimension(change.id, change.value);
      sync(); return commit ? change?.id : undefined;
    },
  };
}
