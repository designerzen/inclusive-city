import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { PlannedJourney } from '../simulation/plannedJourney';

export function createBicycleGarage(scene: Scene, journey: PlannedJourney, frame: StandardMaterial, tyres: StandardMaterial, walls: StandardMaterial) {
  const garage = journey.world.bicycleGarage;
  if (!garage) return () => {};
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(garage!.x + x, y, garage!.z + z); mesh.material = walls; mesh.isPickable = false;
  }
  box('bicycle-garage-floor', 0, .1, 0, 5.5, .15, 4.5);
  box('bicycle-garage-back', 0, 1, 2.2, 5.5, 1.8, .15);
  for (const side of [-1, 1]) box(`bicycle-garage-side-${side}`, side * 2.7, 1, 0, .15, 1.8, 4.5);
  const bikes = (journey.world.bicycles ?? []).map((bike, index) => {
    const root = new TransformNode(bike.id, scene);
    for (const x of [-.7, .7]) {
      const wheel = MeshBuilder.CreateTorus(`${bike.id}-wheel-${x}`, { diameter: .68, thickness: .075, tessellation: 20 }, scene);
      wheel.parent = root; wheel.position.set(x, .42, 0); wheel.rotation.x = Math.PI / 2; wheel.material = tyres;
    }
    const bars = [
      [[-.7, .42], [-.25, .9]], [[-.25, .9], [0, .42]], [[0, .42], [-.7, .42]],
      [[-.25, .9], [.45, 1]], [[.45, 1], [0, .42]], [[.45, 1], [.7, .42]],
      [[-.25, .9], [-.3, 1.12]], [[.45, 1], [.4, 1.3]],
    ];
    for (const [i, points] of bars.entries()) {
      const bar = MeshBuilder.CreateTube(`${bike.id}-frame-${i}`, { path: points.map(([x, y]) => new Vector3(x!, y!, 0)), radius: .045, tessellation: 6 }, scene);
      bar.parent = root; bar.material = frame;
    }
    const seat = MeshBuilder.CreateBox(`${bike.id}-seat`, { width: .4, height: .09, depth: .22 }, scene);
    seat.parent = root; seat.position.set(-.3, 1.12, 0); seat.material = tyres;
    const handle = MeshBuilder.CreateBox(`${bike.id}-handlebar`, { width: .12, height: .09, depth: .55 }, scene);
    handle.parent = root; handle.position.set(.4, 1.3, 0); handle.material = frame;
    root.getChildMeshes().forEach(mesh => { mesh.metadata = { street: bike.id }; mesh.isPickable = true; });
    const street = journey.world.streets.find(s => s.id === bike.street)!;
    const a = journey.world.nodes.find(n => n.id === street.a)!, b = journey.world.nodes.find(n => n.id === street.b)!;
    return { root, bike, index, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, rotation: Math.atan2(b.x - a.x, b.z - a.z) };
  });
  return () => {
    for (const { root, bike, index, x, z, rotation } of bikes) {
      const parked = journey.repaired.has(bike.id);
      const push = parked ? 0 : bike.pushDistance ?? 0;
      root.position.set(parked ? garage.x + (index % 2 ? 1.3 : -1.3) : x + Math.cos(rotation) * push, .12, parked ? garage.z - 1.5 + Math.floor(index / 2) * .85 : z - Math.sin(rotation) * push);
      root.rotation.x = push > 0 ? Math.PI / 2 : 0;
      root.rotation.y = parked ? 0 : rotation;
    }
  };
}
