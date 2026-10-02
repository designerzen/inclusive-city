import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';

export interface PointerAttention { x: number; y: number; amount: number }
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function proximityAttention(pointer: { x: number; y: number }, head: { x: number; y: number }, feet: { x: number; y: number }): PointerAttention {
  const dx = feet.x - head.x, dy = feet.y - head.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((pointer.x - head.x) * dx + (pointer.y - head.y) * dy) / lengthSquared)) : 0;
  const distance = Math.hypot(pointer.x - head.x - dx * t, pointer.y - head.y - dy * t);
  const radius = Math.max(60, Math.min(180, Math.sqrt(lengthSquared) * .45));
  const near = Math.max(0, 1 - distance / radius);
  return { x: clamp((pointer.x - head.x) / radius), y: clamp((pointer.y - head.y) / radius), amount: near * near * (3 - 2 * near) };
}

// Project the actual robot into CSS pixels, so hover works at every zoom and viewport size.
export function createPointerAttention(scene: Scene, engine: Engine, robot: TransformNode) {
  const canvas = engine.getRenderingCanvas();
  let pointer: { x: number; y: number } | null = null;
  const attention: PointerAttention = { x: 0, y: 0, amount: 0 };
  const clear = () => { pointer = null; };
  const move = (event: PointerEvent) => {
    if ((event.pointerType === 'mouse' || event.pointerType === 'pen') && event.buttons === 0) pointer = { x: event.clientX, y: event.clientY };
    else clear();
  };
  canvas?.addEventListener('pointermove', move);
  canvas?.addEventListener('pointerleave', clear);
  canvas?.addEventListener('pointerdown', clear);
  window.addEventListener('blur', clear);
  scene.onDisposeObservable.add(() => {
    canvas?.removeEventListener('pointermove', move);
    canvas?.removeEventListener('pointerleave', clear);
    canvas?.removeEventListener('pointerdown', clear);
    window.removeEventListener('blur', clear);
  });
  return {
    update(seconds: number): PointerAttention {
      let target: PointerAttention = { x: 0, y: 0, amount: 0 };
      if (pointer && canvas && scene.activeCamera && scene.getMeshByName('head')?.isVisible) {
        const bounds = canvas.getBoundingClientRect();
        const width = engine.getRenderWidth(), height = engine.getRenderHeight();
        const viewport = scene.activeCamera.viewport.toGlobal(width, height);
        const head = scene.getTransformNodeByName('head-rig')!;
        head.computeWorldMatrix(true); robot.computeWorldMatrix(true);
        const project = (point: Vector3) => {
          const p = Vector3.Project(point, Matrix.Identity(), scene.getTransformMatrix(), viewport);
          return { x: p.x * bounds.width / width, y: p.y * bounds.height / height, z: p.z };
        };
        const h = project(head.getAbsolutePosition()), f = project(robot.getAbsolutePosition());
        if (h.z >= 0 && h.z <= 1) target = proximityAttention({ x: pointer.x - bounds.left, y: pointer.y - bounds.top }, h, f);
      }
      const blend = 1 - Math.exp(-Math.max(0, seconds) * 10);
      attention.x += (target.x - attention.x) * blend;
      attention.y += (target.y - attention.y) * blend;
      attention.amount += (target.amount - attention.amount) * blend;
      return { ...attention };
    },
  };
}
