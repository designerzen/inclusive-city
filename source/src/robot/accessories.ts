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
  const blue = material('blue', '#70c8ef'), purple = material('purple', '#ab85ee');
  const lens = material('sunglass-lens', '#111f38');
  lens.specularColor = new Color3(.65, .75, .9);
  const roots = Object.fromEntries(robotAccessories.map(({ id }) => {
    const root = new TransformNode(`accessory-${id}`, scene);
    root.parent = ['wings', 'bowTie', 'starTattoo', 'lightningTattoo', 'scarf', 'goldChain'].includes(id) ? body : head;
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
  function box(id: RobotAccessory, name: string, size: number[], position: number[], mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(`accessory-${name}`, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.parent = roots[id]; mesh.position.set(position[0]!, position[1]!, position[2]!);
    mesh.material = mat; mesh.isPickable = false;
    return mesh;
  }
  function hoop(id: RobotAccessory, name: string, diameter: number, thickness: number, position: number[], mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateTorus(`accessory-${name}`, { diameter, thickness, tessellation: 32 }, scene);
    mesh.parent = roots[id]; mesh.position.set(position[0]!, position[1]!, position[2]!);
    mesh.rotation.x = Math.PI / 2; mesh.material = mat; mesh.isPickable = false;
    return mesh;
  }
  // Thin, filled graphics sit just in front of the shell, like ink rather than badges.
  function tattoo(id: 'starTattoo' | 'lightningTattoo', points: number[][], x: number, mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateRibbon(`accessory-${id}-ink`, {
      pathArray: [points.map(p => new Vector3(p[0]! + x, p[1]! + .67, -.525)),
        points.map(() => new Vector3(x, .67, -.525))],
      closePath: true, sideOrientation: 2,
    }, scene);
    mesh.parent = roots[id]; mesh.material = mat; mesh.isPickable = false;
  }
  tattoo('starTattoo', Array.from({ length: 10 }, (_, i) => {
    const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .075 : .17;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }), -.44, ribbon);
  tattoo('lightningTattoo', [[.02, .22], [-.13, -.02], [-.01, -.02], [-.05, -.22], [.13, .05], [.02, .05]], .44, gold);
  for (const side of [-1, 1]) {
    ellipsoid('sunglasses', `sunglasses-frame-${side}`, [side * .3, .06, -.74], [.29, .21, .055], gold);
    ellipsoid('sunglasses', `sunglasses-lens-${side}`, [side * .3, .06, -.79], [.25, .17, .025], lens);
    tube('sunglasses', `sunglasses-arm-${side}`, [[side * .54, .09, -.72], [side * .85, .09, -.45], [side * .85, .05, .1]], .028, gold);
    ellipsoid('headphones', `headphone-pad-${side}`, [side * .88, .02, 0], [.15, .3, .32], ink);
    ellipsoid('headphones', `headphone-cup-${side}`, [side * 1.01, .02, 0], [.09, .25, .27], purple);
  }
  for (let i = 0; i <= 24; i++) {
    const angle = i * Math.PI / 24;
    const link = hoop('goldChain', `chain-link-${i}`, .085, .022,
      [Math.cos(angle) * .55, 1.65 - Math.sin(angle) * .7, -.61 - Math.sin(angle) * .06], gold);
    link.rotation.y = i % 2 ? Math.PI / 3 : 0;
  }
  hoop('goldChain', 'pendant-bail', .08, .022, [0, .88, -.68], gold);
  ellipsoid('goldChain', 'pendant-backing', [0, .65, -.67], [.205, .205, .025], ink);
  hoop('goldChain', 'cnd-ring', .38, .035, [0, .65, -.71], gold);
  tube('goldChain', 'cnd-centre', [[0, .84, -.72], [0, .46, -.72]], .018, gold);
  for (const side of [-1, 1]) tube('goldChain', `cnd-branch-${side}`,
    [[0, .65, -.72], [side * .134, .516, -.72]], .018, gold);
  box('sunglasses', 'sunglasses-bridge', [.17, .04, .045], [0, .1, -.77], gold);
  tube('headphones', 'headphone-band', Array.from({ length: 25 }, (_, i) => {
    const angle = i * Math.PI / 24;
    return [Math.cos(angle) * .94, .08 + Math.sin(angle) * .61, .1];
  }), .065, purple);
  for (let i = 0; i < 5; i++) {
    const spike = MeshBuilder.CreateCylinder(`accessory-mohawk-spike-${i}`, { diameterTop: 0, diameterBottom: .22, height: .38 + .2 * Math.sin(i * Math.PI / 4), tessellation: 5 }, scene);
    spike.parent = roots.mohawk; spike.position.set(0, .72 + .1 * Math.sin(i * Math.PI / 4), -.4 + i * .2);
    spike.material = ribbon; spike.isPickable = false;
  }
  const crownBand = MeshBuilder.CreateCylinder('accessory-crown-band', { diameter: 1.28, height: .2, tessellation: 32 }, scene);
  crownBand.parent = roots.crown; crownBand.position.y = .58; crownBand.material = gold; crownBand.isPickable = false;
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    const point = MeshBuilder.CreateCylinder(`accessory-crown-point-${i}`, { diameterTop: 0, diameterBottom: .25, height: .34, tessellation: 4 }, scene);
    point.parent = roots.crown; point.position.set(Math.sin(angle) * .51, .82, Math.cos(angle) * .51);
    point.material = gold; point.isPickable = false;
    ellipsoid('crown', `crown-jewel-${i}`, [Math.sin(angle) * .64, .59, Math.cos(angle) * .64], [.06, .065, .06], i % 2 ? purple : ribbon);
  }
  ellipsoid('cap', 'cap-dome', [0, .5, 0], [.77, .33, .56], blue);
  ellipsoid('cap', 'cap-peak', [0, .47, -.61], [.72, .045, .46], blue);
  ellipsoid('cap', 'cap-button', [0, .84, 0], [.065, .045, .065], ink);
  box('scarf', 'scarf-wrap', [1.02, .19, 1.06], [0, 1.68, 0], ribbon);
  for (const [i, x] of [-.29, -.04].entries()) {
    box('scarf', `scarf-tail-${i}`, [.18, .65 - i * .12, .05], [x, 1.31 + i * .06, -.59], ribbon);
    for (let stripe = 0; stripe < 3; stripe++) box('scarf', `scarf-stripe-${i}-${stripe}`, [.185, .045, .012], [x, 1.08 + stripe * .15 + i * .12, -.623], feather);
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
