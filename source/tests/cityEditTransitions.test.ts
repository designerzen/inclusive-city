import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { cityEditDuration, createCityEditTransitions, easeOutBack } from '../src/city/cityEditTransitions';

test('city edits overshoot then settle, restoring committed transforms between frames', () => {
  const engine = new NullEngine(), scene = new Scene(engine), node = new TransformNode('wall', scene);
  const transitions = createCityEditTransitions([node]);
  try {
    assert.ok(Math.abs(easeOutBack(0)) < 1e-12);
    assert.equal(easeOutBack(1), 1);
    node.position.x = 10; node.scaling.x = 2;
    transitions.apply(0, false);
    assert.equal(node.position.x, 0); assert.equal(node.scaling.x, 1);
    transitions.restore();
    assert.equal(node.position.x, 10); assert.equal(node.scaling.x, 2);
    transitions.apply(cityEditDuration * .6, false);
    assert.ok(node.position.x > 10); assert.ok(node.scaling.x > 2);
    transitions.restore(); transitions.apply(cityEditDuration * .4, false);
    assert.equal(node.position.x, 10); assert.equal(node.scaling.x, 2);
    transitions.restore();
  } finally { scene.dispose(); engine.dispose(); }
});

test('repeated edits start from the visible transform and reduced motion finishes immediately', () => {
  const engine = new NullEngine(), scene = new Scene(engine), node = new TransformNode('panel', scene);
  const transitions = createCityEditTransitions([node]);
  try {
    node.position.y = 3;
    transitions.apply(0, false); transitions.restore();
    transitions.apply(.15, false);
    const visible = node.position.y;
    transitions.restore(); node.position.y = 1;
    transitions.apply(0, false);
    assert.equal(node.position.y, visible);
    transitions.restore(); transitions.apply(0, true);
    assert.equal(node.position.y, 1);
    transitions.restore(); node.scaling.x = .001;
    transitions.apply(cityEditDuration * .6, false);
    assert.ok(node.scaling.x > 0);
    transitions.restore(); assert.equal(node.scaling.x, .001);
  } finally { scene.dispose(); engine.dispose(); }
});

test('an expensive edit still gets a visible first animation frame', () => {
  const engine = new NullEngine(), scene = new Scene(engine), node = new TransformNode('wall', scene);
  const transitions = createCityEditTransitions([node]);
  try {
    node.position.x = 10;
    transitions.apply(2, false);
    assert.equal(node.position.x, 0);
    transitions.restore(); transitions.apply(.2, false);
    assert.ok(node.position.x > 0 && node.position.x < 10);
  } finally { scene.dispose(); engine.dispose(); }
});

test('rebuilt road geometry eases from its old width, including interrupted width edits', () => {
  const engine = new NullEngine(), scene = new Scene(engine), road = new TransformNode('road', scene);
  const transitions = createCityEditTransitions([road]);
  try {
    transitions.roadWidth(road, 'z', .5);
    transitions.apply(0, false); assert.equal(road.scaling.z, .5);
    transitions.restore(); transitions.apply(.2, false);
    const visible = road.scaling.z;
    transitions.restore(); transitions.roadWidth(road, 'z', 2 / 3);
    transitions.apply(0, false); assert.ok(Math.abs(road.scaling.z - visible * 2 / 3) < 1e-12);
    transitions.restore(); transitions.apply(cityEditDuration, false);
    assert.equal(road.scaling.z, 1);
  } finally { scene.dispose(); engine.dispose(); }
});
