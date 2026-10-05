import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { PlannedJourney } from '../simulation/plannedJourney';
import { trainRidePose } from './steamTrainRide';

export function createSteamTrain(scene: Scene, journey: PlannedJourney, metal: StandardMaterial, dark: StandardMaterial, accent: StandardMaterial, steam: StandardMaterial) {
  const street = journey.world.streets.find(s => s.id === journey.world.steamTrain?.street);
  if (!street) return () => {};
  const a = journey.world.nodes.find(n => n.id === street.a)!, b = journey.world.nodes.find(n => n.id === street.b)!;
  const site = new TransformNode('steam-railway', scene);
  site.position.set(a.x, 0, a.z); site.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  function box(name: string, parent: TransformNode, x: number, y: number, z: number, w: number, h: number, d: number, mat = metal) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.parent = parent; mesh.position.set(x, y, z); mesh.material = mat; mesh.isPickable = false; return mesh;
  }
  for (const side of [-1, 1]) box(`train-rail-${side}`, site, 2.6 + side * .65, .14, length / 2, .09, .12, length + 9, dark);
  for (let z = -4; z < length + 5; z += .55) box(`train-sleeper-${z}`, site, 2.6, .08, z, 1.9, .1, .2, metal);
  const train = new TransformNode('steam-train', scene);
  box('train-carriage-floor', train, 0, .65, 0, 2.2, .22, 2.8, accent);
  box('train-carriage-roof', train, 0, 2.8, 0, 2.5, .22, 3.1, dark);
  for (const z of [-1.3, 1.3]) {
    box(`train-carriage-end-${z}`, train, 0, 1.7, z, 2.2, 2, .12);
    for (const x of [-1, 1]) box(`train-door-post-${x}-${z}`, train, x, 1.7, z * .55, .12, 2, .12, accent);
  }
  // Both side doorways remain clear so riders can roll straight through.
  box('train-engine-chassis', train, 0, .6, 2.7, 1.8, .25, 2.4, dark);
  const boiler = MeshBuilder.CreateCylinder('steam-boiler', { diameter: 1.25, height: 2, tessellation: 20 }, scene);
  boiler.parent = train; boiler.position.set(0, 1.3, 2.8); boiler.rotation.x = Math.PI / 2; boiler.material = dark;
  box('steam-engine-cab', train, 0, 1.65, 1.6, 1.8, 1.8, .8, accent);
  box('steam-engine-cab-roof', train, 0, 2.65, 1.6, 2.1, .15, 1.2, dark);
  const chimney = MeshBuilder.CreateCylinder('steam-chimney', { diameterTop: .55, diameterBottom: .3, height: 1, tessellation: 16 }, scene);
  chimney.parent = train; chimney.position.set(0, 2.2, 3.3); chimney.material = dark;
  const wheels: ReturnType<typeof MeshBuilder.CreateCylinder>[] = [];
  for (const x of [-1, 1]) for (const z of [-.9, .9, 2, 3.3]) {
    const wheel = MeshBuilder.CreateCylinder(`train-wheel-${x}-${z}`, { diameter: .7, height: .15, tessellation: 16 }, scene);
    wheel.parent = train; wheel.position.set(x, .4, z); wheel.rotation.z = Math.PI / 2; wheel.material = dark; wheels.push(wheel);
    box(`train-wheel-hub-${x}-${z}`, train, x * 1.09, .4, z, .06, .16, .16, accent);
  }
  for (const x of [-1.13, 1.13]) box(`steam-connecting-rod-${x}`, train, x, .4, 2.65, .08, .09, 1.45, accent);
  const puffs = Array.from({ length: 4 }, (_, i) => {
    const mesh = MeshBuilder.CreateSphere(`steam-puff-${i}`, { diameter: .55, segments: 8 }, scene);
    mesh.parent = train; mesh.material = steam; mesh.isPickable = false; return mesh;
  });
  const ramps = [0, 1].map((station) => {
    const side = station === 0 ? 1.3 : 3.9, z = station * length;
    box(`station-platform-${station}`, site, station === 0 ? -.65 : 5.85, .1, z, 1.8, .15, 3.2);
    for (const x of [-.55, .55]) box(`robot-ramp-rail-${station}-${x}`, site, side + x, .12, z - 2, .06, .1, 4.5, dark);
    box(`ramp-shed-back-${station}`, site, side, .9, z - 5, 2.5, 1.8, .12);
    for (const x of [-1.2, 1.2]) box(`ramp-shed-wall-${station}-${x}`, site, side + x, .9, z - 4.1, .12, 1.8, 1.8);
    box(`ramp-shed-roof-${station}`, site, side, 1.85, z - 4.1, 2.7, .16, 2.1, dark);
    const ramp = new TransformNode(`robotic-ramp-${station}`, scene); ramp.parent = site;
    const deck = box(`robotic-ramp-deck-${station}`, ramp, 0, .4, 0, 2.8, .12, 1.8, accent);
    deck.rotation.z = station === 0 ? .22 : -.22;
    for (const railZ of [-.85, .85]) {
      const rail = box(`ramp-handrail-${station}-${railZ}`, ramp, 0, .85, railZ, 2.8, .07, .07, metal); rail.rotation.z = deck.rotation.z;
      for (const x of [-1.2, 1.2]) box(`ramp-post-${station}-${railZ}-${x}`, ramp, x, .6 + x * (station === 0 ? .22 : -.22), railZ, .06, .5, .06);
    }
    box(`ramp-robot-drive-${station}`, ramp, 0, .17, 0, .8, .25, 1.4, dark);
    for (const x of [-.5, .5]) for (const rz of [-.6, .6]) {
      const wheel = MeshBuilder.CreateSphere(`ramp-drive-wheel-${station}-${x}-${rz}`, { diameter: .25, segments: 8 }, scene);
      wheel.parent = ramp; wheel.position.set(x, .17, rz); wheel.material = dark;
    }
    box(`ramp-robot-sensor-${station}`, ramp, 0, .7, -.95, .45, .2, .18, accent);
    return { ramp, side, z };
  });
  site.getChildMeshes().forEach(m => { m.isPickable = false; }); train.getChildMeshes().forEach(m => { m.isPickable = false; });
  let last = trainRidePose(a, b, 0);
  return (reducedMotion: boolean) => {
    if (journey.ready) last = trainRidePose(a, b, 0);
    else if (journey.lastTrainPose) last = journey.lastTrainPose;
    const reverse = journey.trainFrom === street.b;
    train.position.set(last.train.x, 0, last.train.z);
    train.rotation.y = last.heading + Math.PI;
    for (const [i, { ramp, side, z }] of ramps.entries()) {
      const progress = i === (reverse ? 1 : 0) ? last.boardingRamp : last.exitRamp;
      ramp.position.set(side, 0, z - 4 * (1 - progress));
    }
    const moving = journey.onTrainLink && last.phase === 'travelling' && !journey.paused;
    wheels.forEach(wheel => { wheel.rotation.x = reducedMotion ? 0 : journey.trainSeconds * (moving ? 3 : 0); });
    puffs.forEach((puff, i) => {
      puff.setEnabled(!reducedMotion && moving);
      const t = (journey.trainSeconds * .7 + i / 4) % 1;
      puff.position.set(0, 2.9 + t * 2, 3.3 - t); puff.scaling.setAll(.6 + t); puff.visibility = 1 - t;
    });
  };
}
