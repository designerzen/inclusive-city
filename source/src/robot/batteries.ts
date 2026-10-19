import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { RobotProfile } from './functions';

/** Upright AA cells on the back, following the body's proportions and animation. */
export function createBatteries(scene: Scene, body: TransformNode) {
  const material = (name: string, hex: string) => {
    const surface = new StandardMaterial(`battery-${name}`, scene);
    surface.diffuseColor = Color3.FromHexString(hex);
    return surface;
  };
  const casing = material('casing', '#26333d');
  const copper = material('copper', '#d99557');
  const metal = material('terminal', '#dce4e7');
  metal.specularColor = new Color3(.8, .8, .8);
  let labelMaterial: StandardMaterial | undefined;
  if (scene.getEngine().getRenderingCanvas()) {
    const texture = new DynamicTexture('battery-AA-label', { width: 128, height: 256 }, scene, false);
    texture.drawText('AA', null, 174, 'bold 68px sans-serif', '#ffffff', '#26333d', true);
    labelMaterial = material('label', '#ffffff');
    labelMaterial.diffuseTexture = texture;
  }
  const cells = [0, 1].map(index => {
    // The bottom pivot keeps shrinking cells seated on their mounting rail.
    const root = new TransformNode(`battery-${index}`, scene);
    root.parent = body;
    root.position.set(index ? .23 : -.23, .23, .66);
    root.scaling.setAll(.825);
    const cylinder = (name: string, diameter: number, height: number, y: number, surface: StandardMaterial) => {
      const mesh = MeshBuilder.CreateCylinder(`battery-${index}-${name}`, { diameter, height, tessellation: 24 }, scene);
      mesh.parent = root; mesh.position.y = y; mesh.material = surface; mesh.isPickable = false;
    };
    cylinder('case', .34, .85, .455, casing);
    cylinder('copper-cap', .34, .22, .99, copper);
    cylinder('negative-terminal', .34, .06, .03, metal);
    cylinder('positive-terminal', .14, .06, 1.13, metal);
    for (const [name, width, height] of [['plus-horizontal', .13, .025], ['plus-vertical', .025, .13]] as const) {
      const mark = MeshBuilder.CreateBox(`battery-${index}-${name}`, { width, height, depth: .012 }, scene);
      mark.parent = root; mark.position.set(0, .99, .169); mark.material = casing; mark.isPickable = false;
    }
    if (labelMaterial) {
      const label = MeshBuilder.CreatePlane(`battery-${index}-label`, { width: .22, height: .44 }, scene);
      label.parent = root; label.position.set(0, .49, .173); label.rotation.y = Math.PI;
      label.material = labelMaterial; label.isPickable = false;
    }
    const rail = MeshBuilder.CreateBox(`battery-${index}-mount`, { width: .39, height: .07, depth: .43 }, scene);
    rail.parent = root; rail.position.set(0, -.035, -.025); rail.material = casing; rail.isPickable = false;
    return root;
  });
  return (profile: RobotProfile) => {
    const longLife = profile.abilities.endurance >= 50;
    const scale = .65 + profile.abilities.burstPower * .0035;
    cells.forEach((cell, index) => {
      cell.setEnabled(index === 0 || longLife);
      cell.position.x = longLife ? (index ? .23 : -.23) : 0;
      cell.scaling.setAll(scale);
    });
  };
}
