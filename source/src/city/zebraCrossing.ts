import type { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ProceduralCity } from './proceduralCity';
import type { cityRoadNetwork } from './cityRoadNetwork';

/** Ordinary straight road sections only: never overlay a signalised crossing. */
export function zebraRoadSites(world: ProceduralCity, network: ReturnType<typeof cityRoadNetwork>) {
  return world.streets.flatMap(street => {
    if (street.id === world.steamTrain?.street || (street.kind !== 'clear' && street.kind !== 'width')) return [];
    const span = network.spans.get(street.id);
    if (!span || Math.hypot(span.b.x - span.a.x, span.b.z - span.a.z) < 4) return [];
    const a = world.nodes.find(node => node.id === street.a)!, b = world.nodes.find(node => node.id === street.b)!;
    if ((span.b.x - span.a.x) * (b.x - a.x) + (span.b.z - span.a.z) * (b.z - a.z) <= 0) return [];
    return [{ street, x: (span.a.x + span.b.x) / 2, z: (span.a.z + span.b.z) / 2,
      horizontal: Math.abs(span.b.x - span.a.x) > Math.abs(span.b.z - span.a.z) }];
  });
}

/** The angled city camera looks from negative Z. Keep this clear of buildings. */
export function foregroundCrossingPosition(world: ProceduralCity) {
  return { x: Math.min(...world.nodes.map(n => n.x)) + 5,
    z: Math.min(...world.nodes.map(n => n.z)) - 3 };
}

/** One amber flash per quarter-note beat, using the song's clock rather than frames. */
export function zebraBeaconOn(seconds: number, bpm: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(bpm) || bpm <= 0) return false;
  const beat = seconds * bpm / 60;
  return beat - Math.floor(beat + 1e-8) < .35;
}

export function createZebraCrossing(scene: Scene, id: string, white: StandardMaterial, black: StandardMaterial) {
  const root = new TransformNode(`zebra-${id}`, scene);
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(`${name}-${id}`, { width: w, height: h, depth: d }, scene);
    mesh.parent = root; mesh.position.set(x, y, z); mesh.material = material; mesh.isPickable = false;
    return mesh;
  };
  // Dark backing preserves the zebra pattern on pale or repaired roads too.
  const asphalt = box('zebra-asphalt', 0, .09, 0, 3.2, .012, 1, black);
  const stripes: ReturnType<typeof box>[] = [];
  const amber = new StandardMaterial(`belisha-amber-${id}`, scene);
  amber.disableLighting = true; amber.specularColor = Color3.Black();
  const lit = Color3.FromHexString('#ffac18'), dim = Color3.FromHexString('#75400c');
  const poles = [-1, 1].map(side => {
    const pole = new TransformNode(`belisha-pole-${id}-${side}`, scene); pole.parent = root;
    const base = box(`belisha-base-${side}`, 0, .12, 0, .38, .24, .38, black); base.parent = pole;
    for (let i = 0; i < 8; i++) {
      const band = MeshBuilder.CreateCylinder(`belisha-band-${id}-${side}-${i}`, { height: .3, diameter: .16, tessellation: 12 }, scene);
      band.parent = pole; band.position.y = .3 + i * .3; band.material = i % 2 ? white : black; band.isPickable = false;
    }
    const globe = MeshBuilder.CreateSphere(`belisha-globe-${id}-${side}`, { diameter: .62, segments: 16 }, scene);
    globe.parent = pole; globe.position.y = 2.75; globe.material = amber; globe.isPickable = false;
    const cap = box(`belisha-cap-${side}`, 0, 3.04, 0, .32, .06, .32, black); cap.parent = pole;
    return { pole, side };
  });
  return {
    root,
    place(x: number, z: number, width: number, horizontal = true) {
      root.position.set(x, 0, z); root.rotation.y = horizontal ? 0 : Math.PI / 2;
      asphalt.scaling.z = width;
      // The pedestrian travels across the road (local Z). Each white stripe
      // runs along traffic (local X), with alternating gaps across the width.
      const count = Math.max(2, Math.ceil(width / .6));
      while (stripes.length > count) stripes.pop()!.dispose();
      while (stripes.length < count) stripes.push(box(`zebra-stripe-${stripes.length}`, 0, .105, 0, 3.2, .018, 1, white));
      stripes.forEach((stripe, i) => {
        stripe.position.z = -width / 2 + (i + .5) * width / count;
        stripe.scaling.z = width / count * .5;
      });
      poles.forEach(({ pole, side }) => { pole.position.z = side * (width / 2 + .45); });
    },
    update(seconds: number, bpm: number) {
      const on = zebraBeaconOn(seconds, bpm);
      amber.diffuseColor.copyFrom(on ? lit : dim);
      amber.emissiveColor.copyFrom(amber.diffuseColor);
    },
  };
}
