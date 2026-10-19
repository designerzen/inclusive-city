import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createRobot } from '../src/robot/createRobot';
import { createRobotProfile, defaultFunctions } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';
import { defaultAppearance } from '../src/robot/appearance';
import { presetDesign, robotPresets } from '../src/robot/presets';
import { freshCondition, drainBattery, advanceCondition } from '../src/robot/robotCondition';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

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

test('charge bars empty downwards, flash below 15%, and stay steady with reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const bar = scene.getMeshByName('battery-0-charge')!;
    const second = scene.getMeshByName('battery-1-charge')!;
    const green = bar.material as StandardMaterial;
    const condition = freshCondition();
    bot.setCondition(condition);
    const full = bar.scaling.y;
    condition.batteryCharge = 50; bot.setCondition(condition);
    assert.equal(bar.scaling.y, full / 2);
    assert.equal(second.scaling.y, bar.scaling.y);
    assert.ok(Math.abs(bar.position.y - bar.scaling.y / 2 - .11) < 1e-8);
    assert.equal(green.disableLighting, true);
    condition.batteryCharge = 15; bot.setCondition(condition);
    const bright = green.emissiveColor.g;
    bot.animateTravel(0, .6);
    assert.ok(green.emissiveColor.g < bright);
    bot.animateTravel(0, .5, false, true);
    assert.ok(green.emissiveColor.g < bright, 'pause freezes flashing');
    bot.animateTravel(0, .5);
    assert.equal(green.emissiveColor.g, bright);
    bot.animateTravel(0, .6, true);
    assert.equal(green.emissiveColor.g, bright);
    condition.batteryCharge = 0; bot.setCondition(condition);
    assert.equal(bar.isEnabled(), false);
    assert.equal(second.isEnabled(), false);
    bot.setCondition(freshCondition());
    assert.equal(bar.isEnabled(), true);
    assert.equal(bar.scaling.y, full);
    bot.setCondition({ ...condition, batteryCharge: undefined });
    assert.equal(bar.scaling.y, full, 'legacy records start fully charged');
  } finally { scene.dispose(); engine.dispose(); }
});

test('actual distance drains charge, longer endurance lasts longer, and idle time does not drain it', () => {
  const short = freshCondition(), long = freshCondition(), stepped = freshCondition();
  drainBattery(short, 40, 0); drainBattery(long, 40, 100);
  assert.equal(short.batteryCharge, 50);
  assert.ok(long.batteryCharge! > short.batteryCharge!);
  for (let i = 0; i < 400; i++) drainBattery(stepped, .1, 0);
  assert.ok(Math.abs(stepped.batteryCharge! - short.batteryCharge!) < 1e-8);
  for (const mode of ['resting', 'waiting', 'blocked'] as const) advanceCondition(short, 10, mode);
  for (const distance of [0, -1, NaN, Infinity]) drainBattery(short, distance, 0);
  assert.equal(short.batteryCharge, 50);
  drainBattery(short, 1000, 0);
  assert.equal(short.batteryCharge, 0);
});
