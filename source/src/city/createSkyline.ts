import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Theme } from '../app/theme';

/** A quiet, non-interactive city beyond the streets, with an open river corridor. */
export function createSkyline(scene: Scene) {
  const materials = [0, 1].map(layer => {
    const material = new StandardMaterial(`skyline-${layer}`, scene);
    material.disableLighting = true;
    material.specularColor = Color3.Black();
    return material;
  });
  let meshes: Mesh[] = [];
  let previous = '';

  function resize(extentX: number, extentZ: number, riverX: number) {
    const key = `${extentX}:${extentZ}:${riverX}`;
    if (key === previous) return;
    previous = key;
    meshes.forEach(mesh => mesh.dispose());
    meshes = [];
    for (let layer = 0; layer < 2; layer++) {
      const pieces: Mesh[] = [];
      const xEdge = extentX + 18 + layer * 17;
      const zEdge = extentZ + 18 + layer * 17;
      for (let side = 0; side < 4; side++) {
        const horizontal = side < 2;
        const span = horizontal ? xEdge : zEdge;
        const count = Math.ceil(span * 2 / 7);
        for (let index = 0; index < count; index++) {
          const along = -span + (index + .5) * (span * 2 / count);
          const width = 4 + ((index * 7 + side * 3 + layer) % 5) * .55;
          // Leave both ends of the water visible between the distant districts.
          if (horizontal && Math.abs(along - riverX) < width / 2 + 6) continue;
          const height = 7 + ((index * 13 + side * 7 + layer * 11) % 17);
          const x = horizontal ? along : (side === 2 ? -xEdge : xEdge);
          const z = horizontal ? (side === 0 ? -zEdge : zEdge) : along;
          const tower = MeshBuilder.CreateBox('skyline-piece', {
            width: horizontal ? width : 5, height, depth: horizontal ? 5 : width,
          }, scene);
          tower.position.set(x, height / 2 - .05, z);
          pieces.push(tower);
          if (index % 3 === 0) {
            const crown = MeshBuilder.CreateBox('skyline-crown', { width: 2.5, height: 2.5, depth: 2.5 }, scene);
            crown.position.set(x, height + 1.2, z);
            pieces.push(crown);
          }
        }
      }
      const merged = Mesh.MergeMeshes(pieces, true, true);
      if (merged) {
        merged.name = `skyline-layer-${layer}`;
        merged.material = materials[layer]!;
        merged.isPickable = false;
        meshes.push(merged);
      }
    }
  }

  function setTheme(theme: Theme) {
    const colours = theme === 'dark' ? ['#303a40', '#232b31'] : ['#b6c2c7', '#cbd3d6'];
    materials.forEach((material, index) => {
      material.diffuseColor = material.emissiveColor = Color3.FromHexString(colours[index]!);
    });
  }
  setTheme('dark');
  return { resize, setTheme };
}
