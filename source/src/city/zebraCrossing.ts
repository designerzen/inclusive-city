import type { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ProceduralCity, CityStreet } from './proceduralCity';
import type { cityRoadNetwork } from './cityRoadNetwork';
import type { RouteTrajectory } from './routeTrajectory';
import { normalizeZebraPairs } from '../app/zebraPreferences';
import { objectSeed } from '../audio/cityInstruments';

/** A short signalised crossing at the mouth of a connected junction. */
export function signalCrossingSite(world: ProceduralCity, street: CityStreet, radius: number, route: readonly string[]) {
  const a = world.nodes.find(n => n.id === street.a)!, b = world.nodes.find(n => n.id === street.b)!;
  const length = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / length, uz = (b.z - a.z) / length;
  for (const node of [a, b]) {
    const sides = world.streets.filter(s => s !== street && s.id !== world.steamTrain?.street && (s.a === node.id || s.b === node.id)).filter(s => {
      const other = world.nodes.find(n => n.id === (s.a === node.id ? s.b : s.a))!;
      return Math.abs((other.x - node.x) * ux + (other.z - node.z) * uz) < 1e-6;
    });
    if (!sides.length) continue;
    const crossingLength = Math.min(Math.max(...sides.map(s => s.width)), Math.max(.3, length - 2 * radius));
    const index = route.indexOf(node.id);
    const prev = world.nodes.find(n => n.id === route[index - 1]), next = world.nodes.find(n => n.id === route[index + 1]);
    const straight = prev && next && Math.abs((prev.x - node.x) * uz - (prev.z - node.z) * ux) < 1e-6
      && Math.abs((next.x - node.x) * uz - (next.z - node.z) * ux) < 1e-6;
    const offset = straight ? 0 : Math.min(length / 2, radius + crossingLength / 2);
    const sign = node === a ? 1 : -1;
    return { x: node.x + ux * offset * sign, z: node.z + uz * offset * sign, length: crossingLength, ux, uz };
  }
  return null;
}

/** Join opposite approaches across an actual side road, prioritising the robot's route. */
export function zebraRoadSites(world: ProceduralCity, network: ReturnType<typeof cityRoadNetwork>, pairs = 4, trajectory?: RouteTrajectory) {
  const sites = world.nodes.flatMap(node => {
    const incident = world.streets.filter(s => s.a === node.id || s.b === node.id);
    // Raised decks, railway tracks and signalised crossings need their own markings.
    if (incident.length < 3 || incident.some(s => s.id === world.steamTrain?.street || s.kind === 'crossing' || s.kind === 'bridge' || s.kind === 'stairs')) return [];
    const arms = incident.map(street => {
      const other = world.nodes.find(n => n.id === (street.a === node.id ? street.b : street.a))!;
      return { street, dx: other.x - node.x, dz: other.z - node.z };
    });
    return [true, false].flatMap(alongX => {
      const approaches = arms.filter(a => alongX ? Math.abs(a.dz) < 1e-6 : Math.abs(a.dx) < 1e-6);
      const sideRoads = arms.filter(a => alongX ? Math.abs(a.dx) < 1e-6 : Math.abs(a.dz) < 1e-6);
      if (approaches.length !== 2 || !sideRoads.length) return [];
      if ((alongX ? approaches[0]!.dx * approaches[1]!.dx : approaches[0]!.dz * approaches[1]!.dz) >= 0) return [];
      const width = Math.max(...sideRoads.map(a => a.street.width));
      const bandWidth = Math.min(3.2, ...approaches.map(a => a.street.width));
      // The full painted rectangle must fit on the straight approaches, not a bend.
      if (approaches.some(a => {
        const span = network.spans.get(a.street.id);
        if (!span) return true;
        const near = a.street.a === node.id ? span.a : span.b;
        return Math.hypot(near.x - node.x, near.z - node.z) > 1e-6 || Math.hypot(a.dx, a.dz) < width / 2 + .5;
      })) return [];
      const onRoute = trajectory?.points.some((a, i, points) => {
        const b = points[i + 1];
        if (!b) return false;
        return alongX
          ? Math.abs(a.z - node.z) < 1e-6 && Math.abs(b.z - node.z) < 1e-6 && Math.min(a.x, b.x) <= node.x - width / 2 && Math.max(a.x, b.x) >= node.x + width / 2
          : Math.abs(a.x - node.x) < 1e-6 && Math.abs(b.x - node.x) < 1e-6 && Math.min(a.z, b.z) <= node.z - width / 2 && Math.max(a.z, b.z) >= node.z + width / 2;
      }) ?? false;
      return [{ id: `${node.id}-${alongX ? 'x' : 'z'}`, node: node.id, street: sideRoads[0]!.street,
        x: node.x, z: node.z, horizontal: !alongX, width, bandWidth, onRoute }];
    });
  });
  // One crossing per junction; perpendicular sets of paint would overlap.
  const used = new Set<string>();
  return sites.sort((a, b) => Number(b.onRoute) - Number(a.onRoute)).filter(site => {
    if (used.has(site.node)) return false;
    used.add(site.node); return true;
  }).slice(0, normalizeZebraPairs(pairs));
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
    return { pole, side };
  });
  return {
    root,
    place(x: number, z: number, width: number, horizontal = true, bandWidth = 3.2) {
      root.position.set(x, 0, z); root.rotation.y = horizontal ? 0 : Math.PI / 2;
      asphalt.scaling.z = width;
      asphalt.scaling.x = bandWidth / 3.2;
      // Stripes run across traffic (local Z), along the pedestrian's path.
      const count = Math.max(2, Math.ceil(bandWidth / .6));
      while (stripes.length > count) stripes.pop()!.dispose();
      while (stripes.length < count) stripes.push(box(`zebra-stripe-${stripes.length}`, 0, .105, 0, 3.2, .018, 1, white));
      stripes.forEach((stripe, i) => {
        stripe.position.x = -bandWidth / 2 + (i + .5) * bandWidth / count;
        stripe.scaling.x = bandWidth / count * .5 / 3.2;
        stripe.scaling.z = width;
      });
      poles.forEach(({ pole, side }) => {
        pole.position.x = bandWidth / 2 + .35;
        pole.position.z = side * (width / 2 + .45);
      });
    },
    update(seconds: number, bpm: number, stagger = false, reducedMotion = false) {
      // Each pair stays together; neighbouring crossings answer on different eighth notes.
      const phase = stagger ? (objectSeed(id) % 8) / 2 : 0;
      const on = !reducedMotion && zebraBeaconOn(seconds < 0 ? seconds : seconds + phase * 60 / bpm, bpm);
      amber.diffuseColor.copyFrom(on ? lit : dim);
      amber.emissiveColor.copyFrom(amber.diffuseColor);
    },
  };
}
