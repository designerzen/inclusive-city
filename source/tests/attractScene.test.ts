import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { createAttractScene } from '../src/app/createAttractScene';

test('welcome robot has hearing and keeps its spectrum visible across screen re-entry', t => {
  for (const [key, value] of Object.entries({
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), removeEventListener() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); });
  }
  const engine = new NullEngine();
  t.mock.method(engine, 'runRenderLoop', () => {});
  t.mock.method(engine, 'resize', () => {});
  const attract = createAttractScene(engine as unknown as Engine, {} as HTMLCanvasElement, () => true);
  try {
    const scene = engine.scenes[0]!;
    const assertHearing = () => {
      assert.ok(scene.getTransformNodeByName('artbot')!.metadata.enabledFunctions.includes('hearing'));
      const bars = scene.meshes.filter(mesh => /^tummy-spectrum-\d+$/.test(mesh.name));
      assert.equal(bars.length, 16);
      assert.ok(bars.every(bar => bar.isEnabled()));
    };
    assertHearing();
    attract.leave(); attract.enter(); assertHearing();
  } finally { attract.dispose(); engine.dispose(); }
});
