import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { createRobot } from '../src/robot/createRobot';
import { bodyShapes, cycleShape, defaultAppearance } from '../src/robot/appearance';
import { easeOutBack } from '../src/robot/shapeTransition';
import { BotHistory } from '../src/robot/botHistory';

test('head and body cycle independently through every shape and survive storage', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const history = new BotHistory(['Ada', 'Grace'], () => .5, storage);
  let appearance = defaultAppearance();
  for (const part of ['head', 'body'] as const) {
    const visited = new Set<string>();
    for (const _ of bodyShapes) {
      const other = part === 'head' ? appearance.shape : appearance.headShape ?? appearance.shape;
      appearance = cycleShape(appearance, part);
      visited.add(part === 'head' ? appearance.headShape! : appearance.shape);
      assert.equal(part === 'head' ? appearance.shape : appearance.headShape, other);
    }
    assert.equal(visited.size, bodyShapes.length);
  }
  history.updateAppearance(cycleShape(appearance, 'head'));
  assert.deepEqual(new BotHistory(['Ada', 'Grace'], () => .5, storage).current.appearance, history.current.appearance);
});

test('shape morph overshoots, settles, handles rapid clicks and reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const head = scene.getMeshByName('head')!, body = scene.getMeshByName('body')!;
    const vertices = (mesh: typeof head) => [...mesh.getVerticesData(VertexBuffer.PositionKind)!];
    const originalHead = vertices(head), originalBody = vertices(body);
    const value = { ...defaultAppearance(), headShape: 'rounded' as const };
    bot.setAppearance(value, true);
    assert.deepEqual(vertices(head), originalHead);
    bot.updateShapeTransition(.24);
    assert.notDeepEqual(vertices(head), originalHead);
    assert.deepEqual(vertices(body), originalBody);
    assert.ok(easeOutBack(.6) > 1);
    const interrupted = vertices(head);
    bot.setAppearance({ ...value, headShape: 'diamond' }, true);
    assert.deepEqual(vertices(head), interrupted);
    bot.updateShapeTransition(.01, true);
    const settled = vertices(head);
    bot.updateShapeTransition(1);
    assert.deepEqual(vertices(head), settled);
    assert.ok(settled.every(Number.isFinite));
    assert.equal(scene.getMeshByName('head'), head);
    assert.equal(easeOutBack(1), 1);
  } finally { scene.dispose(); engine.dispose(); }
});
