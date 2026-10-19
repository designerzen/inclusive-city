import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { SoundEffect } from '../src/audio/SoundEffect';
import { pianoSynthScore } from '../src/audio/pianoSynth';
import { createStudioInstruments } from '../src/app/createStudioInstruments';
import { JourneyDance } from '../src/robot/journeyDance';
import { musicDuration } from '../src/art/finishedJourney';
import type { FinishedJourney } from '../src/art/finishedJourney';
import { createExhibitionPerformer } from '../src/app/createExhibitionPerformer';
import { createCityCamera } from '../src/city/cityCamera';
import { createRobot } from '../src/robot/createRobot';
import { defaultAppearance, robotAccessories } from '../src/robot/appearance';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

test('studio presentation clears camera bank and fits the full accessorised robot and instruments on resize', t => {
  let onResize = () => {};
  const globals = {
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), removeEventListener() {} },
    document: { hidden: true, removeEventListener() {} },
    ResizeObserver: class {
      constructor(callback: () => void) { onResize = callback; }
      observe() {} disconnect() {}
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); });
  }
  const engine = new NullEngine(), scene = new Scene(engine);
  t.mock.method(engine, 'runRenderLoop', () => {});
  t.mock.method(engine, 'resize', () => {});
  const controls = createCityCamera(engine, scene, () => ({ position: Vector3.Zero(), heading: 0, eyeHeight: 1.8 }));
  const camera = controls.camera;
  const canvas = {
    getAttribute: () => null, setAttribute() {}, removeAttribute() {},
    parentElement: { insertBefore() {} }, nextSibling: null,
    classList: { add() {}, remove() {} },
  } as unknown as HTMLCanvasElement;
  const appearance = { ...defaultAppearance(), height: 1.25, width: 1.3, accessories: robotAccessories.map(item => item.id) };
  const journey = { name: 'ArtBot', robot: { appearance } } as FinishedJourney;
  const bot = createRobot(scene); bot.setAppearance(appearance);
  const instruments = createStudioInstruments(scene, appearance.height);
  const performer = createExhibitionPerformer(canvas, journey, scene, camera, bot,
    instruments, new JourneyDance([], 120), () => controls.update());
  const bank = () => {
    camera.rotation.set(.4, .7, .35); camera.getViewMatrix(true);
    camera.rotation.z = 0; camera.getViewMatrix(true);
  };
  const assertUpright = () => {
    const vertical = Vector3.TransformNormal(Vector3.Up(), camera.getViewMatrix(true));
    assert.ok(Math.abs(vertical.x) < 1e-5); assert.ok(vertical.y > 0);
  };
  try {
    bank(); performer.enter({ append() {} } as unknown as HTMLElement); assertUpright();
    bank(); onResize(); assertUpright();
    for (const [width, height] of [[2048, 562], [390, 490], [844, 250]]) {
      t.mock.method(engine, 'getRenderWidth', () => width!);
      t.mock.method(engine, 'getRenderHeight', () => height!);
      onResize();
      const view = camera.getViewMatrix(true);
      for (const mesh of [...bot.robot.getChildMeshes(), ...instruments.root.getChildMeshes()]) {
        if (!mesh.isEnabled() || !mesh.isVisible) continue;
        for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
          const point = Vector3.TransformCoordinates(corner, view);
          assert.ok(point.x > camera.orthoLeft! && point.x < camera.orthoRight!, `${mesh.name} fits horizontally at ${width}×${height}`);
          assert.ok(point.y > camera.orthoBottom! && point.y < camera.orthoTop!, `${mesh.name} fits vertically at ${width}×${height}`);
        }
      }
    }
  } finally { performer.dispose(); scene.dispose(); engine.dispose(); }
});

test('studio synth preserves robot patches, notes and timing for playback and MP3 export', () => {
  const score = [{ at: 12, label: 'melody', score: new SoundEffect({ root: 60, waveform: 'square', pan: -.2 }).toScore() }];
  const saved = structuredClone(score), piano = pianoSynthScore(score);
  assert.deepEqual(piano[0]!.score.notes, score[0]!.score.notes);
  assert.equal(piano[0]!.at, 12); assert.equal(piano[0]!.score.voice.pan, -.2);
  assert.deepEqual(piano, score);
  piano[0]!.score.voice.cutoff = 600;
  assert.notEqual(piano[0]!.score.voice.cutoff, score[0]!.score.voice.cutoff);
  assert.ok(musicDuration(piano) > 0);
  assert.doesNotThrow(() => SoundEffect.fromScore(piano[0]!.score));
  assert.deepEqual(score, saved);
});

test('shared stage has a keyboard, stand and microphone; keys follow audible notes and reduced motion', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const stage = createStudioInstruments(scene);
    for (const name of ['piano-synth', 'microphone-stand', 'studio-microphone', 'microphone-grille']) assert.ok(scene.getMeshByName(name));
    stage.setScore([{ at: 20, score: new SoundEffect({ root: 60, intervals: [0] }).toScore() }]);
    const key = scene.getMeshByName('piano-key-60')!, rest = key.material;
    stage.update(.05, true, false); assert.notEqual(key.material, rest);
    stage.update(.05, true, true); assert.equal(key.material, rest);
    stage.update(.05, false, false); assert.equal(key.material, rest);
    assert.ok(scene.meshes.every(mesh => !mesh.isPickable));
  } finally { scene.dispose(); engine.dispose(); }
});

test('keyboard performance stays at the instrument, moves arms to the keys and respects reduced motion', () => {
  const dance = new JourneyDance([{ at: 0, score: new SoundEffect().toScore() }], 120);
  const pose = dance.pianoPose(.1);
  assert.equal(pose.x, 0); assert.equal(pose.yaw, 0); assert.equal(pose.lift, 0);
  assert.ok(pose.armSwing > 1);
  assert.deepEqual(dance.pianoPose(.1, true, true), dance.pianoPose(3, true, true));
});
