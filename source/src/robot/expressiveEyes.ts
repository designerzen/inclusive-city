import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';

const segments = 24;

/** A rounded lens whose upper lid can droop and lower lid can rise into a smile. */
export function eyeContour(lid: number, curve: number, slant: number): number[] {
  const positions = [0, (-lid * .09 + curve * .21) / 2, 0];
  for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const x = Math.cos(angle), arc = Math.sin(angle);
    const y = arc >= 0
      ? arc * (.16 - lid * .09)
      : arc * .16 + -arc * curve * .21;
    positions.push(x * .185, y + slant * x * .075, 0);
  }
  return positions;
}

export function createEyeLens(name: string, scene: Scene) {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = eyeContour(0, 0, 0);
  data.indices = [];
  data.normals = [];
  for (let i = 0; i <= segments; i++) data.normals.push(0, 0, -1);
  for (let i = 0; i < segments; i++) data.indices.push(0, i + 1, (i + 1) % segments + 1);
  data.applyToMesh(mesh, true);
  mesh.isPickable = false;
  let previous = '';
  return {
    mesh,
    reshape(lid: number, curve: number, slant: number) {
      const key = `${lid},${curve},${slant}`;
      if (previous === key) return;
      previous = key;
      mesh.updateVerticesData(VertexBuffer.PositionKind, eyeContour(lid, curve, slant), true);
    },
  };
}
