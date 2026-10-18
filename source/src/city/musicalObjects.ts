import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Culling/ray';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Node } from '@babylonjs/core/node';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ProceduralCity } from './proceduralCity';
import { streetNames } from './proceduralCity';
import { objectRhythmSlot, type CityInstrument } from '../audio/cityInstruments';

export interface MusicalObject { id: string; name: string; kind: CityInstrument; meshes: AbstractMesh[] }

export function createMusicalObjects(scene: Scene, world: ProceduralCity) {
  const objects = new Map<string, MusicalObject>();
  const byMesh = new Map<AbstractMesh, MusicalObject>();
  const glow = new StandardMaterial('musical-response', scene);
  glow.disableLighting = true; glow.diffuseColor = glow.emissiveColor = Color3.FromHexString('#73cddc');
  const pulses: { ring: ReturnType<typeof MeshBuilder.CreateTorus>; object: MusicalObject; at: number }[] = [];
  let lastSlot = -1;
  function rebuild() {
    objects.clear(); byMesh.clear();
    for (const mesh of scene.meshes) {
      if (/^(musical-response|label-|drawn-route|resize-|dimension-)/.test(mesh.name)) continue;
      const ancestry: Node[] = [mesh];
      for (let parent = mesh.parent; parent; parent = parent.parent) ancestry.push(parent);
      const names = ancestry.map(n => n.name).join(' ');
      const building = world.buildings.find(b => ancestry.some(n => n.metadata?.building === b.name
        || b.creativeRole && n.name === `landmark-${b.creativeRole}`) || mesh.name.includes(b.name));
      const bot = ancestry.find(n => /^city-bot-\d+$/.test(n.name));
      const streetId = names.match(/\bstreet-\d+\b/)?.[0];
      const street = world.streets.find(s => s.id === streetId || ancestry.some(n => n.metadata?.street === s.id));
      const root = ancestry.at(-1)!;
      let id = root.name, name = mesh.name.replaceAll('-', ' '), kind: CityInstrument = 'pluck';
      if (building) { id = `building:${building.name}`; name = building.name; kind = 'bell'; }
      else if (bot) { id = bot.name; name = `City robot ${bot.name.split('-').at(-1)}`; kind = 'robot'; }
      else if (root.metadata?.hideNameTooltip) { id = 'your-robot'; name = 'Your robot'; kind = 'robot'; }
      else if (/train|steam|boiler/.test(names)) { id = 'steam-train'; name = 'Steam train'; kind = 'whistle'; }
      else if (/river/.test(names)) { id = 'river'; name = 'River'; kind = 'water'; }
      else if (/belisha|zebra/.test(names)) {
        id = root.name;
        const site = world.streets.find(s => `zebra-${s.id}` === root.name);
        name = site ? `Zebra crossing · ${world.nodes.find(n => n.id === site.a)?.label} to ${world.nodes.find(n => n.id === site.b)?.label}`
          : root.name === 'zebra-foreground' ? 'Zebra crossing near the workshop' : `Extra zebra crossing ${(Number(root.name.split('-').at(-1)) || 0) + 1}`;
        kind = 'bell';
      }
      else if (street) {
        id = `street:${street.id}`;
        const a = world.nodes.find(n => n.id === street.a), b = world.nodes.find(n => n.id === street.b);
        name = `${street.id === world.steamTrain?.street ? 'Railway bridge' : streetNames[street.kind]} · ${a?.label ?? street.a} to ${b?.label ?? street.b}`;
        kind = street.kind === 'crossing' ? 'bell' : 'drum';
      }
      else if (/bicycle-garage/.test(names)) { id = 'bicycle-garage'; name = 'Bicycle garage'; kind = 'pluck'; }
      else if (/bicycle|bike/.test(names)) { name = `Bicycle ${root.name.match(/\d+/)?.[0] ?? ''}`.trim(); kind = 'pluck'; }
      else if (/ground|road|crosswalk/.test(names)) { id = 'city-ground'; name = 'City ground'; kind = 'drum'; }
      else if (/^goal/.test(names)) { id = 'goal'; name = 'Goal flag'; kind = 'bell'; }
      else if (/^studio/.test(names)) { id = 'duet-studio'; name = 'Duet studio'; kind = 'bell'; }
      else if (mesh.metadata?.node) { name = `${world.nodes.find(n => n.id === mesh.metadata.node)?.label ?? 'Junction'} route marker`; }
      else if (/window|roof|wall|studio|goal/.test(names)) { kind = 'bell'; }
      const object: MusicalObject = objects.get(id) ?? { id, name, kind, meshes: [] };
      object.meshes.push(mesh); objects.set(id, object); byMesh.set(mesh, object);
    }
  }
  const visible = (mesh: AbstractMesh) => mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && mesh.getTotalVertices() > 0;
  function position(object: MusicalObject) {
    const mesh = (object.id === 'steam-train' ? object.meshes.find(m => m.name === 'steam-boiler' && visible(m)) : undefined)
      ?? object.meshes.find(visible);
    mesh?.computeWorldMatrix(true);
    return mesh?.getBoundingInfo().boundingBox.centerWorld.clone();
  }
  function at(x: number, y: number) {
    const hit = scene.pick(x, y, mesh => byMesh.has(mesh) && visible(mesh))?.pickedMesh;
    const exact = hit ? byMesh.get(hit) : undefined;
    // Small props keep a 44px square hit area. Larger foreground objects retain occlusion.
    if (exact && exact.kind !== 'drum' && exact.id !== 'river') return exact;
    const engine = scene.getEngine(), camera = scene.activeCamera!;
    let nearest: MusicalObject | undefined, distance = Infinity;
    for (const object of objects.values()) {
      if (object.kind === 'drum' || object.id === 'river') continue;
      const centre = position(object); if (!centre) continue;
      const p = Vector3.Project(centre, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
      const scale = engine.getHardwareScalingLevel(), dx = Math.abs(p.x * scale - x), dy = Math.abs(p.y * scale - y);
      if (p.z >= 0 && p.z <= 1 && dx <= 22 && dy <= 22 && dx + dy < distance) { nearest = object; distance = dx + dy; }
    }
    return nearest ?? exact;
  }
  function pointAt(x: number, y: number) {
    const point = scene.pick(x, y, mesh => byMesh.has(mesh) && visible(mesh))?.pickedPoint;
    return point ? { x: point.x, y: point.y, z: point.z } : undefined;
  }
  /** CSS-pixel bounds for an overlay that stays attached through camera moves and zoom. */
  function project(id: string, point?: { x: number; y?: number; z: number }) {
    const object = objects.get(id), camera = scene.activeCamera;
    if (!object || !camera) return null;
    scene.updateTransformMatrix();
    const engine = scene.getEngine(), scale = engine.getHardwareScalingLevel();
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    let meshes = object.meshes.filter(visible);
    if (id === 'steam-train') meshes = meshes.filter(m => /steam-boiler|steam-engine|train-carriage/.test(m.name));
    const anchor = point ? new Vector3(point.x, point.y ?? .25, point.z) : position(object);
    if (!anchor) return null;
    const centre = Vector3.Project(anchor, Matrix.Identity(), scene.getTransformMatrix(), viewport);
    if (centre.z < 0 || centre.z > 1) return null;
    const corners = point || id === 'river' || id === 'city-ground' ? [] : meshes.flatMap(mesh => {
      mesh.computeWorldMatrix(true);
      return mesh.getBoundingInfo().boundingBox.vectorsWorld.map(v => Vector3.Project(v, Matrix.Identity(), scene.getTransformMatrix(), viewport));
    }).filter(v => v.z >= 0 && v.z <= 1);
    const xs = corners.map(p => p.x * scale), ys = corners.map(p => p.y * scale);
    const x = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : centre.x * scale;
    const y = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : centre.y * scale;
    return { x, y, width: Math.max(48, xs.length ? Math.max(...xs) - Math.min(...xs) + 14 : 64),
      height: Math.max(48, ys.length ? Math.max(...ys) - Math.min(...ys) + 14 : 64) };
  }
  function pulse(object: MusicalObject, at: number, point?: { x: number; z: number }) {
    if (pulses.length >= 12) pulses.shift()!.ring.dispose();
    const ring = MeshBuilder.CreateTorus('musical-response', { diameter: 2.4, thickness: .12, tessellation: 24 }, scene);
    ring.material = glow; ring.isPickable = false; ring.setEnabled(false);
    ring.renderingGroupId = 3;
    if (point) ring.metadata = { anchor: { x: point.x, z: point.z } };
    pulses.push({ ring, object, at });
  }
  function update(time: number, reducedMotion: boolean) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i]!, age = time - p.at;
      if (age > .9) { p.ring.dispose(); pulses.splice(i, 1); continue; }
      const centre = position(p.object);
      p.ring.setEnabled(age >= 0 && !!centre);
      if (!centre) continue;
      p.ring.position.set(p.ring.metadata?.anchor?.x ?? centre.x, Math.max(.23, centre.y), p.ring.metadata?.anchor?.z ?? centre.z);
      p.ring.scaling.setAll(reducedMotion ? 1 : 1 + Math.max(0, age) * 1.8);
      p.ring.visibility = reducedMotion ? .65 : .8 * (1 - Math.max(0, age) / .9);
    }
  }
  function nearby(time: number, bpm: number, player: { x: number; y: number; z: number }) {
    const slot = Math.floor(time * bpm / 60 * 2);
    if (slot <= lastSlot) { if (slot < lastSlot) lastSlot = slot; return []; }
    lastSlot = slot;
    return [...objects.values()].filter(object => {
      if (!(object.id.startsWith('building:') || ['river', 'steam-train'].includes(object.id))) return false;
      const p = position(object);
      if (p && object.id === 'river') p.z = player.z;
      return p && Math.abs(player.y - p.y) < 6 && Math.hypot(player.x - p.x, player.z - p.z) < 10 && objectRhythmSlot(object.id) === slot % 32;
    }).slice(0, 1);
  }
  rebuild();
  return { rebuild, at, pointAt, project, pulse, update, nearby, get objects() { return [...objects.values()].filter(o => o.meshes.some(visible)); },
    reset() { pulses.splice(0).forEach(p => p.ring.dispose()); lastSlot = -1; } };
}
