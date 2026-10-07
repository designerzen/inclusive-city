import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { RoutePoint } from './cityLayout';
import { bridgeHeight, type BridgeAccess } from './humpbackBridge';

/** A raised crossing with permanent steps and a separate accessible route. */
export function createHumpbackBridge(scene: Scene, id: string, a: RoutePoint, b: RoutePoint, deckMaterial: StandardMaterial, accessMaterial: StandardMaterial) {
  const root = new TransformNode(`humpback-${id}`, scene);
  root.position.set(a.x, 0, a.z); root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  const length = Math.hypot(b.x - a.x, b.z - a.z), run = length * .4;
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, material = deckMaterial) {
    const m = MeshBuilder.CreateBox(`${name}-${id}`, { width: w, height: h, depth: d }, scene);
    m.parent = root; m.position.set(x, y, z); m.material = material;
    m.metadata = { street: id }; m.isPickable = true; return m;
  }
  const crest = box('humpback-deck', 0, .075 + bridgeHeight - .07, length / 2, 2.6, .14, length * .2);
  const steps = [0, 1].flatMap(side => Array.from({ length: 4 }, (_, i) => {
    const height = bridgeHeight * (i + 1) / 4;
    return box(`humpback-step-${side}-${i}`, 0, .075 + height / 2,
      side ? length - (i + .5) * run / 4 : (i + .5) * run / 4, 2.6, height, run / 4);
  }));
  const slopeLength = Math.hypot(run, bridgeHeight);
  const ramps = [0, 1].map(side => {
    const m = box(`humpback-ramp-${side}`, 0, .075 + bridgeHeight / 2 - .07, side ? length - run / 2 : run / 2, 2.6, .14, slopeLength, accessMaterial);
    m.rotation.x = (side ? 1 : -1) * Math.atan2(bridgeHeight, run); return m;
  });
  const rails = [-1, 1].flatMap(side => [0, 1, 2].map(section => {
    const m = box(`humpback-handrail-${side}-${section}`, side * 1.3, section === 1 ? 1.7 : 1.25,
      section === 0 ? run / 2 : section === 1 ? length / 2 : length - run / 2, .07, .07, section === 1 ? length * .2 : slopeLength);
    m.rotation.x = section === 0 ? -Math.atan2(bridgeHeight, run) : section === 2 ? Math.atan2(bridgeHeight, run) : 0;
    return m;
  }));
  const lifts = [0, 1].map(side => {
    const z = side * length;
    const platform = box(`humpback-elevator-platform-${side}`, 0, .1, z, 2.6, .15, 1.4, accessMaterial);
    const towers = [-1, 1].map(x => box(`humpback-elevator-post-${side}-${x}`, x * 1.55, .9, z, .15, 1.8, 1.4));
    const roof = box(`humpback-elevator-roof-${side}`, 0, 1.9, z, 3.3, .12, 1.6, accessMaterial);
    return { platform, towers: [...towers, roof] };
  });
  // Step/ramp colliders are selected with the access mode; elevators move the rider explicitly.
  const solids = [crest, ...steps, ...ramps];
  function sync(access: BridgeAccess, width: number) {
    crest.scaling.x = width / 2.6;
    crest.scaling.z = access === 'elevator' ? 5 : 1;
    for (const m of steps) {
      m.position.x = access === 'ramp' ? -(width / 2 + .7) : 0;
      m.scaling.x = access === 'ramp' ? 1.2 / 2.6 : width / 2.6;
      m.metadata.decorative = access !== 'steps';
    }
    for (const m of ramps) { m.setEnabled(access === 'ramp'); m.scaling.x = width / 2.6; }
    rails.forEach((m, i) => { m.position.x = (i < 3 ? -1 : 1) * (width / 2 + .08); m.setEnabled(access !== 'elevator'); });
    lifts.forEach(({ platform, towers }) => {
      platform.setEnabled(access === 'elevator'); platform.scaling.x = width / 2.6;
      towers.forEach(m => m.setEnabled(access === 'elevator'));
    });
  }
  function animateLifts(position?: RoutePoint) {
    for (const [i, { platform }] of lifts.entries()) {
      const node = i ? b : a;
      platform.position.y = position && Math.hypot(position.x - node.x, position.z - node.z) < .01 ? position.y - .06 : .1;
    }
  }
  sync('steps', 2.6);
  return { root, solids, sync, animateLifts };
}
