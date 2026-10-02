import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';

/** A closed gabled roof, with a ridge and two sloping faces. */
export function createBuildingRoof(name: string, width: number, depth: number, rise: number, scene: Scene) {
  const x = width / 2, z = depth / 2;
  const positions = [-x, 0, -z, x, 0, -z, 0, rise, -z, -x, 0, z, x, 0, z, 0, rise, z];
  const indices = [0, 1, 2, 3, 5, 4, 0, 5, 3, 0, 2, 5, 1, 5, 2, 1, 4, 5, 0, 4, 1, 0, 3, 4];
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions; data.indices = indices; data.normals = normals;
  const roof = new Mesh(name, scene);
  data.applyToMesh(roof);
  roof.convertToFlatShadedMesh();
  return roof;
}
