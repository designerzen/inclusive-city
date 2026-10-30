import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { shellQr, shellPayload, qrReaderSpecification } from './shellIdentity';

/** Geometry works in NullEngine too; no canvas texture or cosmetic fake code. */
export function createShellHardware(scene: Scene, parent: TransformNode, id: string) {
  const white = new StandardMaterial('shell-qr-white', scene); white.diffuseColor = Color3.White(); white.emissiveColor = Color3.White(); white.disableLighting = true;
  const black = new StandardMaterial('shell-qr-black', scene); black.diffuseColor = Color3.Black(); black.disableLighting = true;
  const lens = new StandardMaterial('qr-reader-lens', scene); lens.diffuseColor = Color3.FromHexString('#173c48');
  const reader = MeshBuilder.CreateBox('shell-qr-reader', { width: .3, height: .25, depth: .1 }, scene);
  reader.parent = parent; reader.position.set(-.52, 1.22, -.56); reader.material = black;
  reader.metadata = { ...qrReaderSpecification, feature: 'qr-reader' };
  const glass = MeshBuilder.CreateSphere('shell-qr-reader-lens', { diameter: .16, segments: 12 }, scene);
  glass.parent = reader; glass.position.z = -.06; glass.scaling.z = .22; glass.material = lens;
  const plate = MeshBuilder.CreatePlane('shell-qr-label', { size: .68, sideOrientation: Mesh.DOUBLESIDE }, scene);
  plate.parent = parent; plate.position.set(.79, .85, 0); plate.rotation.y = -Math.PI / 2; plate.material = white;
  const modules = new Mesh('shell-qr-modules', scene); modules.parent = plate; modules.material = black; modules.isPickable = false;
  function setIdentity(shellId: string) {
    if (plate.metadata?.shellId === shellId) return;
    const qr = shellQr(shellId), step = .68 / (qr.count + 8);
    const positions: number[] = [], indices: number[] = [];
    qr.cells.forEach((row, y) => row.forEach((dark, x) => {
      if (!dark) return;
      const left = -.34 + (x + 4) * step, top = .34 - (y + 4) * step, i = positions.length / 3;
      positions.push(left, top, -.002, left + step, top, -.002, left + step, top - step, -.002, left, top - step, -.002);
      indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }));
    const data = new VertexData(); data.positions = positions; data.indices = indices;
    const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals); data.normals = normals; data.applyToMesh(modules);
    plate.metadata = { feature: 'shell-identity', shellId, qrPayload: shellPayload(shellId) };
  }
  setIdentity(id);
  return { reader, plate, setIdentity };
}
