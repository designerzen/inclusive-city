import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import type { CreativeBuilding } from './proceduralCity';

/** Word-free landmarks, visible on the roof and street frontage. */
export function creativeBuildingModel(role: CreativeBuilding, scene: Scene, light: Material, dark: Material) {
  const root = new TransformNode(`landmark-${role}`, scene);
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat = light) => {
    const mesh = MeshBuilder.CreateBox(`${role}-${name}`, { width: w, height: h, depth: d }, scene);
    mesh.parent = root; mesh.position.set(x, y, z); mesh.material = mat; mesh.isPickable = false; return mesh;
  };
  if (role === 'gallery') {
    box('frame', 0, .8, 0, 1.6, 1.3, .14);
    box('canvas', 0, .8, -.09, 1.3, 1, .06, dark);
    box('art-block', -.3, .7, -.14, .35, .6, .05);
    const circle = MeshBuilder.CreateSphere('gallery-art-disc', { diameter: .45, segments: 12 }, scene);
    circle.parent = root; circle.position.set(.3, .95, -.15); circle.scaling.z = .15; circle.material = light; circle.isPickable = false;
  } else if (role === 'record-store') {
    for (const [diameter, z, mat] of [[1.5, 0, light], [1.25, -.06, dark], [.9, -.1, light], [.7, -.14, dark], [.28, -.18, light]] as const) {
      const disc = MeshBuilder.CreateCylinder('vinyl-groove', { diameter, height: .05, tessellation: 40 }, scene);
      disc.parent = root; disc.rotation.x = Math.PI / 2; disc.position.set(0, .85, z); disc.material = mat; disc.isPickable = false;
    }
    for (let i = 0; i < 4; i++) box(`record-rack-${i}`, -.55 + i * .35, -.25, 0, .22, .45, .12);
  } else {
    for (const x of [-.65, 0, .65]) box('column', x, .6, 0, .18, 1.1, .25);
    box('base', 0, 0, 0, 1.7, .16, .4);
    box('lintel', 0, 1.2, 0, 1.7, .16, .4);
    const pediment = MeshBuilder.CreateCylinder('museum-pediment', { diameter: 1.9, height: .25, tessellation: 3 }, scene);
    pediment.parent = root; pediment.rotation.x = Math.PI / 2; pediment.rotation.y = Math.PI; pediment.position.y = 1.45; pediment.material = light; pediment.isPickable = false;
  }
  return root;
}
