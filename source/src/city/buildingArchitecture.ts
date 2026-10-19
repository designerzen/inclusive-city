import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import type { CityBuilding } from './proceduralCity';

export type BuildingArchitecture = 'skyscraper' | 'apartments' | 'shop' | 'civic' | 'house';

export function buildingArchitecture(building: CityBuilding): BuildingArchitecture {
  return building.architecture ?? (building.h >= 9 ? 'skyscraper' : building.name === 'Flats' ? 'apartments'
    : ['Café', 'Market', 'Record store', 'Cinema'].includes(building.name) ? 'shop'
    : ['Museum', 'Library', 'Hall', 'Gallery'].includes(building.name) ? 'civic' : 'house');
}

/** Local-space details follow the editable walls; merged by material to keep draw calls bounded. */
export function createBuildingArchitecture(building: CityBuilding, scene: Scene, glass: Material, trim: Material, roofMaterial: Material) {
  const root = new TransformNode(`architecture-${building.name}`, scene);
  const batches = new Map<Material, Mesh[]>();
  const { w, d, h } = building;
  const style = buildingArchitecture(building);
  const box = (name: string, x: number, y: number, z: number, width: number, height: number, depth: number, material = trim) => {
    const mesh = MeshBuilder.CreateBox(`${building.name}-${name}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    const batch = batches.get(material) ?? []; batch.push(mesh); batches.set(material, batch);
  };
  // Repeated windows on all four elevations make buildings readable from every camera angle.
  const spacing = style === 'skyscraper' ? .95 : 1.05;
  for (let y = 2.15; y < h - .35; y += spacing) {
    for (const side of [-1, 1]) {
      for (let col = 0; col < 3; col++) {
        const x = (col - 1) * w * .28, z = (col - 1) * d * .28;
        box('window', x, y, side * (d / 2 + .095), w * .19, .54, .035, glass);
        box('side-window', side * (w / 2 + .095), y, z, .035, .54, d * .19, glass);
      }
    }
    if (style === 'skyscraper') {
      box('floor-front', 0, y - .38, -d / 2 - .09, w, .065, .07);
      box('floor-back', 0, y - .38, d / 2 + .09, w, .065, .07);
      box('floor-left', -w / 2 - .09, y - .38, 0, .07, .065, d);
      box('floor-right', w / 2 + .09, y - .38, 0, .07, .065, d);
    }
    if (style === 'apartments') {
      for (const side of [-1, 1]) {
        box('balcony-slab', side * w * .28, y - .33, -d / 2 - .22, w * .24, .09, .38);
        box('balcony-rail', side * w * .28, y - .06, -d / 2 - .38, w * .24, .08, .05);
      }
    }
  }
  if (style === 'skyscraper') {
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2])
      box('corner-mullion', x, h / 2, z, .13, h, .13);
    box('setback-crown', 0, h + .65, 0, w * .74, 1.2, d * .74, glass);
    box('crown-cap', 0, h + 1.28, 0, w * .8, .12, d * .8);
    box('rooftop-plant', w * .15, h + 1.65, 0, w * .3, .65, d * .35, roofMaterial);
    if (building.name === 'Tower' || h >= 13) box('spire', 0, h + 2.65, 0, .09, 2.7, .09);
  } else if (style === 'house') {
    box('chimney', w * .25, h + .8, d * .2, .4, 1.3, .45, roofMaterial);
  } else {
    box('parapet-front', 0, h + .25, -d / 2, w + .2, .3, .14);
    box('parapet-back', 0, h + .25, d / 2, w + .2, .3, .14);
    box('parapet-left', -w / 2, h + .25, 0, .14, .3, d);
    box('parapet-right', w / 2, h + .25, 0, .14, .3, d);
    box('roof-plant', w * .2, h + .35, d * .18, w * .28, .45, d * .25, roofMaterial);
  }
  // Leave the central editable doorway clear.
  for (const side of [-1, 1]) box('display-window', side * w * .32, .95, -d / 2 - .095, w * .22, 1.05, .04, glass);
  if (style === 'shop') {
    box('shop-awning', 0, 1.8, -d / 2 - .22, w * .94, .14, .45, roofMaterial);
    for (let i = 0; i < 7; i++) box('awning-stripe', (i - 3) * w * .125, 1.88, -d / 2 - .22, w * .055, .025, .45);
  }
  if (style === 'civic') {
    for (const side of [-1, 1]) {
      box('entrance-column', side * w * .43, 1, -d / 2 - .18, .18, 2, .22);
      box('column-base', side * w * .43, .12, -d / 2 - .18, .3, .18, .32);
    }
    box('entrance-lintel', 0, 2.05, -d / 2 - .18, w * .96, .2, .35);
  }
  for (const [material, meshes] of batches) {
    const merged = Mesh.MergeMeshes(meshes, true, true)!;
    merged.name = `facade-${building.name}-${material.name}`;
    merged.material = material; merged.parent = root; merged.isPickable = false;
  }
  return root;
}
