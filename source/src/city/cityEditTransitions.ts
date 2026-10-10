import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

export const cityEditDuration = .55;
export function easeOutBack(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const remaining = t - 1;
  return 1 + 2.70158 * remaining * remaining * remaining + 1.70158 * remaining * remaining;
}

/** Render-only transforms: restore the committed geometry before simulation. */
export function createCityEditTransitions(nodes: readonly TransformNode[]) {
  const applied = new Set<TransformNode>();
  const states = new Map(nodes.map(node => [node, {
    position: node.position.clone(), scaling: node.scaling.clone(),
    fromPosition: node.position.clone(), fromScaling: node.scaling.clone(), elapsed: cityEditDuration, fresh: false,
  }]));
  function rendered(node: TransformNode) {
    const state = states.get(node)!;
    const amount = easeOutBack(Math.min(1, state.elapsed / cityEditDuration));
    return {
      position: Vector3.Lerp(state.fromPosition, state.position, amount),
      scaling: Vector3.Lerp(state.fromScaling, state.scaling, amount),
    };
  }
  return {
    // Road widths rebuild vertex geometry. Compensate its new width at the start
    // of the transition so it can pluck into place like the box-based objects.
    roadWidth(node: TransformNode, axis: 'x' | 'z', ratio: number) {
      const state = states.get(node);
      if (!state || ratio === 1) return;
      const current = rendered(node);
      state.fromPosition.copyFrom(current.position);
      state.fromScaling.copyFrom(current.scaling);
      state.fromScaling[axis] *= ratio;
      state.position.copyFrom(node.position); state.scaling.copyFrom(node.scaling);
      state.elapsed = 0;
      state.fresh = true;
    },
    apply(seconds: number, reducedMotion: boolean) {
      for (const [node, state] of states) {
        if (node.isDisposed()) { states.delete(node); continue; }
        if (!node.position.equalsWithEpsilon(state.position, 1e-6) || !node.scaling.equalsWithEpsilon(state.scaling, 1e-6)) {
          const current = rendered(node);
          state.fromPosition.copyFrom(current.position); state.fromScaling.copyFrom(current.scaling);
          state.position.copyFrom(node.position); state.scaling.copyFrom(node.scaling);
          state.elapsed = 0;
          state.fresh = true;
        }
        // The edit can rebuild geometry and physics for longer than the tween.
        // Its work happened before this first visible frame, not during it.
        state.elapsed = reducedMotion ? cityEditDuration : Math.min(cityEditDuration, state.elapsed + (state.fresh ? 0 : Math.max(0, seconds)));
        state.fresh = false;
        if (state.elapsed === cityEditDuration) continue;
        const current = rendered(node);
        node.position.copyFrom(current.position);
        // Back easing can overshoot a large shrink below zero. Keep all scales
        // positive so the pluck never inverts a mesh or collapses its matrix.
        node.scaling.set(Math.max(.001, current.scaling.x), Math.max(.001, current.scaling.y), Math.max(.001, current.scaling.z));
        node.computeWorldMatrix(true);
        applied.add(node);
      }
    },
    restore() {
      for (const node of applied) {
        if (node.isDisposed()) continue;
        const state = states.get(node)!;
        node.position.copyFrom(state.position); node.scaling.copyFrom(state.scaling);
        node.computeWorldMatrix(true);
      }
      applied.clear();
    },
  };
}
