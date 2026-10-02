import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { createRobot } from '../src/robot/createRobot';

test('eye silhouettes convey moods, open on surprise, and freeze when paused', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const left = scene.getMeshByName('left-eye')!, right = scene.getMeshByName('right-eye')!;
    const pupil = scene.getMeshByName('pupil-1')!;
    const contour = () => Array.from(right.getVerticesData(VertexBuffer.PositionKind)!);
    bot.animateTravel(0, .1, true);
    const curious = contour();
    assert.notEqual(left.scaling.y, right.scaling.y);
    bot.characterAnimation.mood = 'sad'; bot.animateTravel(0, .1, true);
    const sad = contour();
    assert.notDeepEqual(sad, curious);
    assert.ok(left.rotation.z > 0 && right.rotation.z < 0);
    assert.ok(pupil.isEnabled());
    bot.characterAnimation.mood = 'happy'; bot.animateTravel(0, .1, true);
    const happy = contour();
    assert.notDeepEqual(happy, sad);
    assert.equal(pupil.isEnabled(), false);
    // The lower centre rises above the lens baseline to make a smiling crescent.
    assert.ok(happy[1 + 19 * 3]! > 0);
    bot.characterAnimation.react('surprise'); bot.animateTravel(0, .4);
    assert.ok(right.scaling.y > 1);
    assert.ok(pupil.isEnabled());
    const surprised = contour();
    bot.animateTravel(0, 1, false, true);
    assert.deepEqual(contour(), surprised);
    assert.equal(right.parent, scene.getTransformNodeByName('head-rig'));
  } finally { scene.dispose(); engine.dispose(); }
});
