import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { SoundSequenceEntry } from '../audio/SoundEffect';

/** The same keyboard and standing microphone accompany both performances. */
export function createStudioInstruments(scene: Scene, robotHeight = 1) {
  const root = new TransformNode('studio-instruments', scene);
  const mat = (name: string, colour: string, glow = false) => {
    const value = new StandardMaterial(name, scene); value.diffuseColor = Color3.FromHexString(colour);
    value.specularColor = new Color3(.2, .2, .2);
    if (glow) value.emissiveColor = value.diffuseColor.scale(.6);
    return value;
  };
  const dark = mat('synth-charcoal', '#233b40'), white = mat('synth-ivory', '#f5f0dc');
  const black = mat('synth-black', '#102026'), metal = mat('microphone-metal', '#9aaeb4');
  const lit = mat('synth-playing', '#b7ef87', true);
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.parent = root; mesh.position.set(x, y, z); mesh.material = material; mesh.isPickable = false; return mesh;
  }
  const keyboardY = 1.05 + 1.1 * robotHeight, microphoneY = 1.05 + 2.08 * robotHeight;
  box('piano-synth', 0, keyboardY - .13, -1.1, 3.2, .2, .8, dark);
  for (const side of [-1, 1]) {
    box(`synth-stand-${side}`, side * 1.1, (keyboardY - .2) / 2, -1.1, .09, keyboardY - .2, .09, metal);
    box(`synth-foot-${side}`, side * 1.1, .07, -1.1, .5, .07, .6, dark);
  }
  const keys: { midi: number; mesh: ReturnType<typeof box>; material: StandardMaterial }[] = [];
  const whites = [0, 2, 4, 5, 7, 9, 11];
  for (let i = 0; i < 21; i++) {
    const x = -1.4 + i * .14, midi = 48 + Math.floor(i / 7) * 12 + whites[i % 7]!;
    keys.push({ midi, mesh: box(`piano-key-${midi}`, x, keyboardY, -1.17, .13, .065, .49, white), material: white });
    if ([0, 1, 3, 4, 5].includes(i % 7) && i < 20) keys.push({ midi: midi + 1,
      mesh: box(`piano-key-${midi + 1}`, x + .07, keyboardY + .06, -1.02, .085, .08, .25, black), material: black });
  }
  box('synth-display', .9, keyboardY + .01, -.78, .42, .025, .12, lit);
  const stand = MeshBuilder.CreateCylinder('microphone-stand', { height: microphoneY - .1, diameter: .055, tessellation: 16 }, scene);
  stand.parent = root; stand.position.set(1.65, microphoneY / 2, -.65); stand.material = metal;
  const base = MeshBuilder.CreateCylinder('microphone-base', { height: .08, diameter: .65, tessellation: 24 }, scene);
  base.parent = root; base.position.set(1.65, .06, -.65); base.material = dark;
  const boom = box('microphone-boom', 1.28, microphoneY - .05, -.65, .8, .055, .055, metal); boom.rotation.z = -.15;
  const mic = MeshBuilder.CreateCapsule('studio-microphone', { height: .38, radius: .095, tessellation: 16 }, scene);
  mic.parent = root; mic.position.set(.9, microphoneY, -.65); mic.rotation.z = Math.PI / 2; mic.material = black;
  const grille = MeshBuilder.CreateSphere('microphone-grille', { diameter: .22, segments: 16 }, scene);
  grille.parent = root; grille.position.set(.7, microphoneY, -.65); grille.material = metal;
  [stand, base, mic, grille].forEach(mesh => { mesh.isPickable = false; });
  let notes: { midi: number; start: number; end: number }[] = [];
  let longestNote = 0;
  const active = new Set<number>();
  return {
    root,
    setScore(score: readonly SoundSequenceEntry[]) {
      const origin = score[0]?.at ?? 0;
      notes = score.flatMap(entry => entry.score.notes.map(n => ({ midi: 48 + ((n.midi - 48) % 36 + 36) % 36,
        start: entry.at - origin + n.start, end: entry.at - origin + n.start + n.duration }))).sort((a, b) => a.start - b.start);
      longestNote = Math.max(0, ...notes.map(note => note.end - note.start));
    },
    update(time: number, playing: boolean, reducedMotion: boolean) {
      active.clear();
      if (playing && !reducedMotion) {
        let lo = 0, hi = notes.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (notes[mid]!.start <= time) lo = mid + 1; else hi = mid; }
        for (let i = lo - 1; i >= 0 && notes[i]!.start >= time - longestNote; i--) {
          if (notes[i]!.end > time) active.add(notes[i]!.midi);
        }
      }
      keys.forEach(key => { key.mesh.material = active.has(key.midi) ? lit : key.material; });
    },
  };
}
