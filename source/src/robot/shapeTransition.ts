import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { RobotShape } from './appearance';

export function shapePositions(unit: readonly number[], shape: RobotShape, size: readonly number[]) {
  const result = [...unit];
  for (let i = 0; i < result.length; i += 3) {
    const x = unit[i]!, y = unit[i + 1]!, z = unit[i + 2]!;
    const radial = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const hexRadius = Math.cos(Math.PI / 6) / Math.cos(((angle % (Math.PI / 3) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6);
    const divisor = shape === 'box' ? Math.max(Math.abs(x), Math.abs(y), Math.abs(z))
      : shape === 'diamond' ? Math.abs(x) + Math.abs(y) + Math.abs(z)
      : shape === 'hexagon' ? Math.max(radial / hexRadius, Math.abs(y))
      : shape === 'cylinder' || shape === 'cone' ? Math.max(radial, Math.abs(y)) : 1;
    const safe = Math.max(.0001, divisor);
    const taper = shape === 'cone' ? .8 - .2 * y / safe : 1;
    result[i] = x / safe * size[0]! / 2 * taper;
    result[i + 1] = y / safe * size[1]! / 2;
    result[i + 2] = z / safe * size[2]! / 2 * taper;
  }
  return result;
}

export function easeOutBack(t: number) {
  const x = Math.max(0, Math.min(1, t)) - 1;
  return 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2;
}

export function createShapeTransition(mesh: Mesh, unit: readonly number[], size: readonly number[]) {
  let from: number[] = [], target: number[] = [], elapsed = .48;
  function render(positions: number[]) {
    mesh.updateVerticesData(VertexBuffer.PositionKind, positions, true);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, mesh.getIndices()!, normals);
    mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();
  }
  return {
    set(shape: RobotShape, animate: boolean) {
      const next = shapePositions(unit, shape, size);
      if (target.length && next.every((value, i) => value === target[i])) return;
      from = [...mesh.getVerticesData(VertexBuffer.PositionKind)!];
      target = next; elapsed = animate ? 0 : .48;
      if (!animate) render(target);
    },
    update(seconds: number, reducedMotion = false) {
      if (elapsed >= .48) return;
      elapsed = reducedMotion ? .48 : Math.min(.48, elapsed + seconds);
      const amount = easeOutBack(elapsed / .48);
      render(target.map((value, i) => from[i]! + (value - from[i]!) * amount));
    },
  };
}
