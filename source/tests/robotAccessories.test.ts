import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createRobot } from '../src/robot/createRobot';
import { defaultAppearance, robotAccessories } from '../src/robot/appearance';
import { BotHistory } from '../src/robot/botHistory';

test('accessories mix independently, follow animated rigs and reset for undecorated robots', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const count = scene.meshes.length;
    bot.setAppearance({ ...defaultAppearance(), accessories: robotAccessories.map(item => item.id) });
    bot.animateTravel(.2, .1);
    for (const { id } of robotAccessories) {
      const root = scene.getTransformNodeByName(`accessory-${id}`)!;
      assert.equal(root.isEnabled(), true);
      assert.equal(root.parent?.name, ['wings', 'bowTie'].includes(id) ? 'upper-body' : 'head-rig');
    }
    bot.setAppearance({ ...defaultAppearance(), accessories: ['monocle'] });
    assert.equal(scene.getTransformNodeByName('accessory-monocle')!.isEnabled(), true);
    assert.equal(scene.getTransformNodeByName('accessory-wings')!.isEnabled(), false);
    bot.setAppearance(defaultAppearance());
    for (const { id } of robotAccessories) assert.equal(scene.getTransformNodeByName(`accessory-${id}`)!.isEnabled(), false);
    assert.equal(scene.meshes.length, count, 'toggling reuses meshes');
  } finally { scene.dispose(); engine.dispose(); }
});

test('accessories survive saving, design changes and returning to a previous robot', () => {
  let saved = '';
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  const history = new BotHistory(['Turing', 'Hopper'], () => .3, storage);
  history.updateAppearance({ ...history.current.appearance, accessories: ['moustache', 'wings'] });
  const restored = new BotHistory(['Turing', 'Hopper'], () => .3, storage);
  assert.deepEqual(restored.current.appearance.accessories, ['moustache', 'wings']);
  restored.next();
  assert.deepEqual(restored.current.appearance.accessories, ['moustache', 'wings']);
  restored.updateAppearance({ ...restored.current.appearance, accessories: [] });
  restored.previous();
  assert.deepEqual(restored.current.appearance.accessories, ['moustache', 'wings']);
});
