import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createRobot } from '../src/robot/createRobot';
import { createRobotProfile, defaultFunctions } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';
import { defaultAppearance } from '../src/robot/appearance';
import { presetDesign, robotPresets } from '../src/robot/presets';

test('rear AA cells switch at the endurance midpoint and shrink with lower burst power', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const cells = [0, 1].map(index => scene.getTransformNodeByName(`battery-${index}`)!);
    for (const power of [0, 49, 50, 51, 100, 0]) {
      bot.setProfile(createRobotProfile({ ...defaultAbilities(), burstPower: power }, defaultFunctions()));
      const longLife = power <= 50;
      assert.equal(cells.filter(cell => cell.isEnabled()).length, longLife ? 2 : 1);
      assert.equal(cells[0]!.position.x, longLife ? -.23 : 0);
      assert.equal(cells[0]!.scaling.y, .65 + power * .0035);
      for (const cell of cells) {
        assert.ok(cell.position.z > 0, 'batteries sit behind the front-facing negative Z face');
        assert.equal(cell.rotation.length(), 0, 'AA cells stay upright');
        assert.equal(cell.parent?.name, 'upper-body');
        assert.equal(cell.scaling.x, cell.scaling.y);
        const terminal = scene.getMeshByName(`${cell.name}-positive-terminal`)!;
        assert.equal(terminal.isEnabled(), cell.isEnabled());
      }
      bot.setAppearance({ ...defaultAppearance(), width: .8, height: 1.2, depth: 1.3 });
      bot.animateTravel(.2, .1);
      assert.equal(cells[0]!.scaling.y, .65 + power * .0035);
    }
    for (const preset of robotPresets) {
      const design = presetDesign(preset.id, 1);
      bot.setProfile(design.profile);
      bot.setAppearance(design.appearance);
      assert.equal(cells[1]!.isEnabled(), design.profile.abilities.endurance >= 50);
    }
  } finally { scene.dispose(); engine.dispose(); }
});
