import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createRobot } from '../src/robot/createRobot';
import { defaultAppearance } from '../src/robot/appearance';
import { CharacterAnimation } from '../src/robot/characterAnimation';
import { abilityPairs } from '../src/robot/abilities';
import { robotFunctions } from '../src/robot/functions';
import { createRobotProfile, defaultFunctions } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';
import { proximityAttention } from '../src/robot/pointerAttention';

test('fast forward keeps pickup reactions at presentation speed while wheels cover every step', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene), wheel = scene.getMeshByName('wheel-1-1')!;
    bot.characterAnimation.react('pickup');
    bot.animateTravel(.1, .1, false, false, 0, .1);
    const angle = wheel.rotation.x, headLift = bot.characterAnimation.tick(0, false).headLift;
    for (let i = 0; i < 9; i++) bot.animateTravel(.1, .1, false, false, 0, 0);
    assert.notEqual(wheel.rotation.x, angle);
    assert.equal(bot.characterAnimation.tick(0, false).headLift, headLift);
    bot.animateTravel(0, .1, false, false, 0, .1);
    assert.notEqual(bot.characterAnimation.tick(0, false).headLift, headLift);
    bot.animateTravel(0, .1, true);
    assert.equal(bot.characterAnimation.tick(0, false, true).headLift, 0);
  } finally { scene.dispose(); engine.dispose(); }
});

test('speed grows grounded wheels and route memory grows the complete head through animation and reset', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const head = scene.getTransformNodeByName('head-rig')!;
    const wheel = scene.getMeshByName('wheel-1-1')!;
    const hub = scene.getMeshByName('hub-1-1')!;
    for (const speed of [0, 50, 100, 50]) {
      bot.setProfile(createRobotProfile({ ...defaultAbilities(), speed }, defaultFunctions()));
      const wheelScale = .75 + speed / 200, headScale = 1.25 - speed / 200;
      bot.setAppearance({ ...defaultAppearance(), shape: 'cylinder' });
      bot.animateTravel(.1, 1, true);
      assert.equal(wheel.scaling.x, wheelScale);
      assert.equal(hub.scaling.x, wheelScale);
      assert.ok(Math.abs(wheel.position.y - .35 * wheelScale - .25) < 1e-6);
      assert.equal(head.scaling.x, headScale);
      assert.equal(head.scaling.y, headScale);
      assert.ok(Math.abs(head.position.y - (2.25 + (headScale - 1) * .5)) < 1e-6);
      assert.equal(wheel.rotation.x, hub.rotation.x);
      const angle = wheel.rotation.x;
      bot.animateTravel(.1, .1, true);
      assert.ok(Math.abs(wheel.rotation.x - angle + .1 / (.35 * wheelScale)) < 1e-6);
    }
  } finally { scene.dispose(); engine.dispose(); }
});

test('explaining animates the mouth without driving the robot and respects reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene), mouth = scene.getMeshByName('gasp-mouth')!;
    const wheel = scene.getMeshByName('wheel-1-1')!;
    bot.setSpeaking(true); bot.animateTravel(0, .1);
    const opening = mouth.scaling.y;
    bot.animateTravel(0, .1);
    assert.notEqual(mouth.scaling.y, opening);
    assert.equal(wheel.rotation.x, 0);
    bot.animateTravel(0, .1, true);
    assert.equal(mouth.isEnabled(), false);
    bot.setSpeaking(false); bot.animateTravel(0, .1);
    assert.equal(mouth.isEnabled(), false);
  } finally { scene.dispose(); engine.dispose(); }
});

test('compactness scales the entire robot around its contact plane and survives animation and appearance edits', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const model = scene.getTransformNodeByName('model-rig')!;
    const front = scene.getMeshByName('front-wheel')!;
    const head = scene.getMeshByName('head')!;
    let previousHeight = 0;
    for (const reach of [0, 50, 100]) {
      bot.setProfile(createRobotProfile({ ...defaultAbilities(), reach }, defaultFunctions()));
      bot.setAppearance(defaultAppearance());
      bot.animateTravel(0, 1, true);
      const scale = .7 + reach * .006;
      assert.ok(model.scaling.equalsWithEpsilon(new Vector3(scale, scale, scale)));
      for (const mesh of bot.robot.getChildMeshes()) assert.equal(mesh.isDescendantOf(model), true, mesh.name);
      front.computeWorldMatrix(true); head.computeWorldMatrix(true);
      assert.ok(Math.abs(front.getBoundingInfo().boundingBox.minimumWorld.y - .25) < 1e-6);
      const height = head.getBoundingInfo().boundingBox.maximumWorld.y;
      assert.ok(height > previousHeight);
      previousHeight = height;
      const angle = front.rotation.x;
      bot.animateTravel(.1, .1, true);
      assert.ok(Math.abs(front.rotation.x - angle + .1 / (.13 * scale)) < 1e-6);
      front.rotation.x = 0;
    }
  } finally { scene.dispose(); engine.dispose(); }
});

test('balance switches between four steady wheels and three wheels with sway, respecting pause and reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    bot.setProfile(createRobotProfile(defaultAbilities(), defaultFunctions()));
    const mainWheels = [-1, 1].map(side => scene.getMeshByName(`wheel-${side}-1`)!);
    const front = scene.getMeshByName('front-wheel')!;
    const rig = scene.getTransformNodeByName('character-rig')!;
    const visibleWheels = () => scene.meshes.filter(mesh => /^(wheel-[-\d]+-[-\d]+|front-wheel)$/.test(mesh.name) && mesh.isEnabled());
    assert.equal(visibleWheels().length, 3);
    assert.equal(scene.getMeshByName('wheel-1--1')!.isEnabled(), false);
    assert.equal(scene.getMeshByName('front-wheel-fork')!.isEnabled(), true);
    assert.ok(mainWheels.every(wheel => wheel.position.z === 0));
    assert.ok(front.position.z < 0);
    front.computeWorldMatrix(true);
    assert.ok(front.getBoundingInfo().boundingBox.extendSizeWorld.y < .14);
    bot.animateTravel(.1, .2);
    assert.notEqual(rig.rotation.z, 0);
    assert.notEqual(front.rotation.x, 0);
    const roll = front.rotation.x, sway = rig.rotation.z;
    bot.animateTravel(.1, .2, false, true);
    assert.equal(front.rotation.x, roll);
    assert.equal(rig.rotation.z, sway);
    bot.animateTravel(0, .2, true);
    assert.equal(rig.rotation.z, 0);
    bot.animateTravel(0, .2);
    assert.notEqual(rig.rotation.z, 0);
    bot.setProfile(createRobotProfile(defaultAbilities(), ['communication', 'vision', 'balance']));
    assert.equal(visibleWheels().length, 4);
    assert.equal(front.isEnabled(), false);
    assert.equal(scene.getMeshByName('front-wheel-fork')!.isEnabled(), false);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      assert.equal(scene.getMeshByName(`wheel-${side}-${end}`)!.position.z, end * .45);
      assert.equal(scene.getMeshByName(`hub-${side}-${end}`)!.isEnabled(), true);
    }
    assert.equal(rig.rotation.z, 0);
    bot.animateTravel(.1, .2);
    assert.equal(rig.rotation.z, 0);
    for (const speed of [0, 100]) {
      bot.setProfile(createRobotProfile({ ...defaultAbilities(), speed }, defaultFunctions()));
      assert.equal(visibleWheels().length, 3);
      assert.ok(mainWheels.every(wheel => wheel.position.z === 0));
      front.rotation.x = 0;
      front.computeWorldMatrix(true);
      assert.ok(Math.abs(front.getBoundingInfo().boundingBox.minimumWorld.y - .25) < 1e-6);
    }
  } finally { scene.dispose(); engine.dispose(); }
});

test('pivot rolls opposite wheels in opposite directions and pauses with the journey', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const left = scene.getMeshByName('wheel--1-1')!, right = scene.getMeshByName('wheel-1-1')!;
    bot.animateTravel(0, .1, false, false, .1);
    assert.ok(left.rotation.x > 0);
    assert.equal(left.rotation.x, -right.rotation.x);
    assert.equal(left.rotation.x, scene.getMeshByName('hub--1-1')!.rotation.x);
    const angle = left.rotation.x;
    bot.animateTravel(0, .1, false, true, .1);
    assert.equal(left.rotation.x, angle);
  } finally { scene.dispose(); engine.dispose(); }
});

test('travel animates the complete head and rolls wheels about their axles, then settles when idle', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    bot.robot.scaling.setAll(0.55);
    const rig = scene.getTransformNodeByName('head-rig')!;
    for (const name of ['head', 'face', 'left-eye', 'right-eye', 'antenna', 'antenna-tip']) assert.equal(scene.getMeshByName(name)!.isDescendantOf(rig), true);
    const wheel = scene.getMeshByName('wheel-1-1')!;
    const hub = scene.getMeshByName('hub-1-1')!;
    wheel.computeWorldMatrix(true);
    const axle = wheel.getDirection(Vector3.Up()).normalize();
    bot.animateTravel(0.25, 1 / 30);
    assert.notEqual(wheel.rotation.x, 0);
    assert.equal(wheel.rotation.x, hub.rotation.x);
    wheel.computeWorldMatrix(true);
    assert.ok(wheel.getDirection(Vector3.Up()).normalize().equalsWithEpsilon(axle));
    assert.notEqual(rig.position.y, 2.25);
    assert.notEqual(rig.rotation.x, 0);
    const angle = wheel.rotation.x;
    const displacement = Math.abs(rig.position.y - 2.25);
    bot.animateTravel(0, 0.5);
    assert.equal(wheel.rotation.x, angle);
    assert.ok(Math.abs(rig.position.y - 2.25) < displacement);
    bot.setAppearance({ ...defaultAppearance(), shape: 'cylinder', height: 1.3 });
    assert.equal(scene.getMeshByName('head')!.parent, rig);
    bot.animateTravel(0.25, 1, true);
    assert.ok(Math.abs(rig.position.y - 2.25) < 1e-6);
    assert.ok(Math.abs(rig.rotation.x) < 1e-6);
    assert.notEqual(wheel.rotation.x, angle);
  } finally { scene.dispose(); engine.dispose(); }
});

test('mouse interest is local to the robot silhouette and gaze respects vision and reduced motion', () => {
  const head = { x: 300, y: 200 }, feet = { x: 300, y: 500 };
  assert.equal(proximityAttention({ x: 300, y: 350 }, head, feet).amount, 1);
  assert.equal(proximityAttention({ x: 700, y: 200 }, head, feet).amount, 0);
  const right = proximityAttention({ x: 350, y: 200 }, head, feet);
  assert.ok(right.x > 0 && right.amount > 0);
  assert.ok(proximityAttention({ x: 250, y: 200 }, head, feet).x < 0);
  assert.ok(Number.isFinite(proximityAttention(head, head, head).amount));
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    bot.setProfile(createRobotProfile(defaultAbilities(), defaultFunctions()));
    bot.setAttention({ x: 1, y: -1, amount: 1 });
    bot.animateTravel(0, .1);
    const rig = scene.getTransformNodeByName('head-rig')!;
    assert.ok(rig.rotation.y < 0);
    assert.ok(scene.getMeshByName('pupil-1')!.position.x > 0);
    bot.setProfile(createRobotProfile(defaultAbilities(), ['communication', 'memory', 'hearing']));
    bot.animateTravel(0, .1);
    assert.equal(scene.getMeshByName('pupil-1')!.position.x, 0);
    assert.equal(scene.getMeshByName('left-eye')!.material!.name, 'dark-joints');
    bot.setProfile(createRobotProfile(defaultAbilities(), defaultFunctions()));
    bot.animateTravel(0, 1, true);
    assert.ok(Math.abs(rig.rotation.y) < 1e-6);
    assert.ok(scene.getMeshByName('pupil-1')!.position.x > 0);
  } finally { scene.dispose(); engine.dispose(); }
});

test('tummy spectrum follows robot hearing independently of vision and survives profile changes', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const bars = Array.from({ length: 16 }, (_, index) => scene.getMeshByName(`tummy-spectrum-${index}`)!);
    bot.setProfile(createRobotProfile(defaultAbilities(), ['communication', 'vision', 'memory']));
    assert.ok(bars.every(bar => !bar.isEnabled()));
    bot.setProfile(createRobotProfile(defaultAbilities(), ['communication', 'hearing', 'memory']));
    assert.ok(bars.every(bar => bar.isEnabled()));
    assert.equal(scene.getMeshByName('left-eye')!.material!.name, 'dark-joints');
    bot.setProfile(createRobotProfile(defaultAbilities(), ['communication', 'vision', 'memory']));
    assert.ok(bars.every(bar => !bar.isEnabled()));
  } finally { scene.dispose(); engine.dispose(); }
});

test('editor feedback responds to both directions of every tradeoff and distinguishes each module', () => {
  const poses: string[] = [];
  for (const pair of abilityPairs) {
    const up = new CharacterAnimation(), down = new CharacterAnimation();
    up.feel({ type: 'ability', id: pair.id, previous: 50, value: 80 });
    down.feel({ type: 'ability', id: pair.id, previous: 50, value: 20 });
    const pose = up.tick(.25, false);
    assert.notDeepEqual(pose, down.tick(.25, false));
    poses.push(JSON.stringify(pose));
  }
  assert.equal(new Set(poses).size, abilityPairs.length);
  const modulePoses = robotFunctions.map(item => {
    const animation = new CharacterAnimation();
    animation.feel({ type: 'function', id: item.id, enabled: true, swapEnabled: item.id, swapDisabled: item.id === 'communication' ? 'hearing' : 'communication' });
    return JSON.stringify(animation.tick(.25, false));
  });
  assert.equal(new Set(modulePoses).size, robotFunctions.length);
});

test('ears only toggle the spectrum while memory lights and animates the antenna', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    for (const enabled of [false, true]) {
      bot.setProfile(createRobotProfile(defaultAbilities(), enabled
        ? ['communication', 'hearing', 'memory'] : ['communication', 'vision', 'hearing']));
      assert.equal(scene.getMeshByName('antenna-tip')!.material!.name, enabled ? 'warm-light' : 'dark-joints');
      assert.equal(scene.getMeshByName('chest-light')!.material!.name, 'warm-light');

      const ears = new CharacterAnimation(), idle = new CharacterAnimation(), memory = new CharacterAnimation();
      ears.feel({ type: 'function', id: 'hearing', enabled, swapEnabled: 'hearing', swapDisabled: 'vision' });
      assert.deepEqual(ears.tick(.25, false), idle.tick(.25, false));
      memory.feel({ type: 'function', id: 'memory', enabled, swapEnabled: 'memory', swapDisabled: 'vision' });
      assert.notEqual(memory.tick(.25, false).antenna, 0);
    }
  } finally { scene.dispose(); engine.dispose(); }
});

test('editor feedback settles, resets with navigation, and uses still expressions for reduced motion', () => {
  const animation = new CharacterAnimation();
  animation.feel({ type: 'ability', id: 'burstPower', previous: 50, value: 90 });
  const still = animation.tick(.2, false, true);
  assert.equal(still.arms, 0); assert.equal(still.stretch, 1); assert.equal(still.accent, 0);
  animation.tick(2, false);
  assert.equal(animation.tick(.1, false).smile, 0);
  animation.feel({ type: 'ability', id: 'visualDetail', previous: 50, value: 90 });
  animation.react('pickup');
  assert.notEqual(animation.tick(.3, false).eyeWidth, .7);
  animation.feel({ type: 'reset' });
  assert.ok(animation.tick(.25, false).arms > 0);
  animation.reset();
  assert.equal(animation.tick(.1, false).arms, 0);
});

test('cartoon reactions anticipate action, double-take, settle, and retain an emotional pose', () => {
  const animation = new CharacterAnimation();
  animation.react('launch');
  assert.ok(animation.tick(.1, true).stretch < 1);
  assert.ok(animation.tick(.25, true).stretch > 1);
  animation.mood = 'sad';
  animation.react('surprise');
  const firstLook = animation.tick(.11, false);
  const secondLook = animation.tick(.3, false);
  assert.ok(firstLook.headYaw > 0);
  assert.ok(secondLook.headYaw < 0);
  assert.ok(secondLook.eyeWidth > 1);
  assert.ok(secondLook.mouthOpen > 0);
  animation.tick(2, false);
  const sad = animation.tick(.1, false);
  assert.equal(sad.smile, -1);
  assert.ok(sad.headLift < 0);
  animation.mood = 'happy';
  animation.react('relief');
  const happy = animation.tick(.5, false);
  assert.ok(happy.lift > 0);
  assert.ok(happy.arms > 1);
  assert.equal(happy.smile, 1);
  const still = animation.tick(.1, false, true);
  assert.equal(still.stretch, 1);
  assert.equal(still.lift, 0);
  assert.equal(still.smile, 1);
});

test('emotional rig preserves designed proportions, grounded wheels, sensor state and pause', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const bot = createRobot(scene);
    const appearance = { ...defaultAppearance(), width: 1.3, height: 1.25 };
    bot.setAppearance(appearance);
    const upper = scene.getTransformNodeByName('upper-body')!;
    const wheel = scene.getMeshByName('wheel-1-1')!;
    const start = wheel.position.clone();
    bot.characterAnimation.mood = 'sad'; bot.characterAnimation.react('surprise');
    bot.animateTravel(0, .4);
    assert.ok(scene.getTransformNodeByName('character-rig')!.scaling.y > 1);
    assert.equal(upper.scaling.x, appearance.width);
    assert.equal(upper.scaling.y, appearance.height);
    assert.ok(wheel.position.equals(start));
    const head = scene.getTransformNodeByName('head-rig')!;
    const yaw = head.rotation.y;
    bot.animateTravel(0, 1, false, true);
    assert.equal(head.rotation.y, yaw);
    bot.animateTravel(0, 1, true);
    assert.equal(scene.getTransformNodeByName('character-rig')!.scaling.y, 1);
    assert.ok(wheel.position.equals(start));
    assert.deepEqual(bot.robot.metadata.appearance, appearance);
  } finally { scene.dispose(); engine.dispose(); }
});
