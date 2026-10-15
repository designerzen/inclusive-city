import type { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { robotAccessories } from './appearance';
import type { RobotAccessory } from './appearance';

/** Attach to the animated rigs so decorations follow every pose and proportion. */
export function createAccessories(scene: Scene, head: TransformNode, body: TransformNode) {
  const material = (name: string, hex: string) => {
    const mat = new StandardMaterial(`accessory-${name}`, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    return mat;
  };
  const ink = material('ink', '#302842'), gold = material('gold', '#efbd54');
  const feather = material('feather', '#fff0d4'), ribbon = material('ribbon', '#ee718e');
  const roots = Object.fromEntries(robotAccessories.map(({ id }) => {
    const root = new TransformNode(`accessory-${id}`, scene);
    root.parent = ['moustache', 'monocle', 'topHat'].includes(id) ? head : body;
    root.setEnabled(false);
    return [id, root];
  })) as Record<RobotAccessory, TransformNode>;
  function ellipsoid(id: RobotAccessory, name: string, position: number[], scale: number[], mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateSphere(`accessory-${name}`, { diameter: 2, segments: 16 }, scene);
    mesh.parent = roots[id]; mesh.position.set(position[0]!, position[1]!, position[2]!);
    mesh.scaling.set(scale[0]!, scale[1]!, scale[2]!); mesh.material = mat; mesh.isPickable = false;
    return mesh;
  }
  function tube(id: RobotAccessory, name: string, points: number[][], radius: number, mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateTube(`accessory-${name}`, { path: points.map(p => new Vector3(p[0]!, p[1]!, p[2]!)), radius, tessellation: 10 }, scene);
    mesh.parent = roots[id]; mesh.material = mat; mesh.isPickable = false;
    return mesh;
  }
  for (const side of [-1, 1]) {
    const curl = [[0, -.09, -.68], [side * .12, -.07, -.7], [side * .25, -.15, -.7], [side * .39, -.12, -.68], [side * .43, -.02, -.66]];
    tube('moustache', `moustache-${side}`, curl, .055, ink);
    for (let i = 0; i < 4; i++) {
      const plume = ellipsoid('wings', `wing-${side}-${i}`, [side * (1.02 + i * .18), 1.05 + i * .16, .38], [.22, .65 - i * .07, .1], feather);
      plume.rotation.z = -side * (.35 + i * .16);
    }
    const bow = MeshBuilder.CreateCylinder(`accessory-bow-${side}`, { diameterTop: .38, diameterBottom: .08, height: .32, tessellation: 3 }, scene);
    bow.parent = roots.bowTie; bow.position.set(side * .19, 1.57, -.58); bow.rotation.z = -side * Math.PI / 2;
    bow.material = ribbon; bow.isPickable = false;
  }
  ellipsoid('bowTie', 'bow-knot', [0, 1.57, -.6], [.1, .1, .09], gold);
  const rim = MeshBuilder.CreateTorus('accessory-monocle-rim', { diameter: .48, thickness: .045, tessellation: 40 }, scene);
  rim.parent = roots.monocle; rim.position.set(-.3, .06, -.71); rim.rotation.x = Math.PI / 2; rim.material = gold; rim.isPickable = false;
  tube('monocle', 'monocle-chain', [[-.53, -.02, -.68], [-.64, -.27, -.64], [-.65, -.48, -.55], [-.79, -.5, -.3], [-.85, -.25, 0]], .016, gold);
  for (const [name, diameter, height, y, mat] of [
    ['brim', 1.65, .08, .56, ink], ['crown', 1.05, .65, .91, ink], ['band', 1.07, .13, .67, ribbon],
  ] as const) {
    const mesh = MeshBuilder.CreateCylinder(`accessory-hat-${name}`, { diameter, height, tessellation: 32 }, scene);
    mesh.parent = roots.topHat; mesh.position.y = y; mesh.material = mat; mesh.isPickable = false;
  }
  return (selected: readonly RobotAccessory[] = []) => {
    for (const { id } of robotAccessories) roots[id].setEnabled(selected.includes(id));
  };
}
