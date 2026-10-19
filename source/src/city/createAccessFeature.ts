import type { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AccessibilityBarrierKind } from './accessibilityBarriers';

/** Visual indicators only: capability checks decide access, not solid colliders. */
export function createAccessFeature(scene: Scene, id: string, kind: AccessibilityBarrierKind,
  x: number, z: number, angle: number, before: StandardMaterial, after: StandardMaterial) {
  const root = new TransformNode(`access-${id}`, scene);
  root.position.set(x, 0, z); root.rotation.y = angle;
  root.metadata = { street: id };
  const original: ReturnType<typeof MeshBuilder.CreateBox>[] = [];
  const improved: ReturnType<typeof MeshBuilder.CreateBox>[] = [];
  const box = (enabled: boolean, name: string, px: number, py: number, pz: number, w: number, h: number, d: number) => {
    const mesh = MeshBuilder.CreateBox(`access-${id}-${name}-${enabled}`, { width: w, height: h, depth: d }, scene);
    mesh.parent = root; mesh.position.set(px, py, pz); mesh.material = enabled ? after : before;
    mesh.metadata = { street: id }; mesh.isPickable = true;
    (enabled ? improved : original).push(mesh);
    return mesh;
  };
  for (const enabled of [false, true]) {
    if (kind === 'uneven') {
      for (let i = 0; i < 5; i++) box(enabled, `paver-${i}`, (i - 2) * .45, .11 + (enabled ? 0 : i % 2 * .05), 0, .4, .035, 1.7);
    } else if (kind === 'rest') {
      if (enabled) {
        box(true, 'seat', 0, .5, 2, 1.8, .15, .55);
        box(true, 'back', 0, .9, 2.2, 1.8, .65, .12);
        box(true, 'charger', 1.2, .55, 2, .3, 1, .3);
      } else {
        // A continuous row of distance marks shows the uninterrupted stretch.
        for (let i = 0; i < 6; i++) box(false, `distance-${i}`, (i - 2.5) * .5, .12, 1, .15, .025, .35);
      }
    } else {
      box(enabled, 'post', 0, .9, 2, .12, 1.8, .12);
      box(enabled, 'panel', 0, 1.7, 2, 1.4, .8, .12);
      if (kind === 'slope') {
        const ramp = box(enabled, 'gradient', 0, .14, 0, 2.5, .05, 1.5);
        ramp.rotation.z = enabled ? .04 : .16;
        if (enabled) for (let i = 0; i < 3; i++) {
          const stripe = box(true, `switchback-${i}`, (i - 1) * .7, .24, 0, .07, .025, 1.4);
          stripe.rotation.y = i % 2 ? -.4 : .4;
        }
      } else if (kind === 'signage') {
        // Large contrasting strokes replace tiny text lines.
        for (let i = 0; i < 3; i++) {
          const line = box(enabled, `text-${i}`, 0, 1.9 - i * .18, 1.92, enabled ? 1 : .4, enabled ? .07 : .025, .03);
          line.material = enabled ? before : after;
        }
      } else {
        box(enabled, 'speaker', 0, 1.7, 1.86, .35, .4, .15);
        if (enabled) {
          box(true, 'direction', 0, .12, 0, 1.6, .025, .12);
          for (const direction of [-1, 1]) box(true, `arrow-${direction}`, .6, .12, direction * .18, .12, .025, .45).rotation.y = direction * .7;
        }
      }
      if (enabled && (kind === 'signage' || kind === 'announcement')) {
        for (let i = 0; i < 4; i++) box(true, `tactile-${i}`, (i - 1.5) * .35, .12, .65, .12, .025, .35);
      }
    }
  }
  return {
    root,
    sync(enabled: boolean) {
      original.forEach(mesh => mesh.setEnabled(!enabled));
      improved.forEach(mesh => mesh.setEnabled(enabled));
    },
  };
}
