import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createBuildingRoof } from './buildingRoof';

/** The destination sits two metres inside the front entrance. */
export function createStudioBuilding(scene: Scene, entrance: TransformNode, walls: StandardMaterial, roofs: StandardMaterial, floorMaterial: StandardMaterial) {
  const parts = ['left', 'right', 'back', 'front-left', 'front-right', 'floor'].map(side => {
    const mesh = MeshBuilder.CreateBox(`studio-${side}`, { size: 1 }, scene);
    mesh.parent = entrance; mesh.material = side === 'floor' ? floorMaterial : walls;
    mesh.isPickable = false;
    return mesh;
  });
  const roof = createBuildingRoof('studio-roof', 8.4, 6.4, 1.2, scene);
  roof.parent = entrance; roof.position.set(0, 4, 3); roof.material = roofs; roof.isPickable = false;
  function sync(doorWidth: number, complete: boolean) {
    const width = Math.max(8, doorWidth + 2), wing = (width - doorWidth - 1) / 2;
    const layouts = [
      [-width / 2, 2, 3, .2, 4, 6], [width / 2, 2, 3, .2, 4, 6],
      [0, 2, 6, width, 4, .2],
      [-(doorWidth + 1 + wing) / 2, 2, 0, wing, 4, .2],
      [(doorWidth + 1 + wing) / 2, 2, 0, wing, 4, .2],
      [0, -.1, 3, width, .1, 6],
    ];
    parts.forEach((mesh, i) => { const [x, y, z, w, h, d] = layouts[i]!; mesh.position.set(x!, y!, z!); mesh.scaling.set(w!, h!, d!); });
    roof.scaling.x = (width + .4) / 8.4;
    // Cut away the roof for the arrival camera and duet inside the room.
    roof.setEnabled(!complete);
    parts.slice(0, 5).forEach(mesh => { mesh.visibility = complete ? .25 : 1; });
  }
  return { parts, roof, sync };
}
