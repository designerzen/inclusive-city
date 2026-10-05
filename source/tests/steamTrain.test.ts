import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { generateCity, routeToGoal } from '../src/city/proceduralCity';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { trainRidePose } from '../src/city/steamTrainRide';

test('boarding and exit use opposite sides, with ramps stowed before travel', () => {
  const a = { x: 0, y: .16, z: 0 }, b = { x: 0, y: .16, z: 8 };
  assert.equal(trainRidePose(a, b, 2).train.z, 0);
  assert.equal(trainRidePose(a, b, 5).phase, 'boarding');
  assert.ok(trainRidePose(a, b, 5).position.x < 2.6);
  assert.equal(trainRidePose(a, b, 10).boardingRamp, 0);
  assert.equal(trainRidePose(a, b, 10).exitRamp, 0);
  assert.ok(trainRidePose(a, b, 18).position.x > 2.6);
  assert.equal(trainRidePose(a, b, 18).train.z, 8);
  assert.deepEqual(trainRidePose(a, b, 24).position, b);
  assert.equal(trainRidePose(a, b, 24).exitRamp, 0);
});

test('train journey supports pause, reverse, restart and continuation past the train with physics', () => {
  for (const reverse of [false, true]) {
    const bot = new BotHistory(['Curie', 'Einstein']).current;
    const ids = reverse ? ['b', 'a', 'c'] : ['a', 'b', 'c'];
    const world: ProceduralCity = { seed: 1, nodes: [{id:'a',label:'A',x:0,y:.16,z:0},{id:'b',label:'B',x:0,y:.16,z:8},{id:'c',label:'C',x:8,y:.16,z:8}], streets: [{id:'rail',a:'a',b:'b',kind:'clear',width:4,crossingSeconds:20},{id:'walk',a:ids[1]!,b:'c',kind:'clear',width:4,crossingSeconds:20}], buildings: [], steamTrain: { street: 'rail' }, start:ids[0]!,destination:'c',riverX:20,rememberedRobots:1 };
    const j = new PlannedJourney(bot, world); j.repair('communication'); j.setRoute(ids); j.start();
    let sweeps = 0; j.constrainTravel = (from, to) => { sweeps++; return { distance: Math.hypot(to.x-from.x,to.z-from.z) }; };
    j.update(10); assert.equal(j.trainPose!.phase, 'travelling'); assert.equal(sweeps, 0);
    j.setPaused(true); const p = j.position; j.update(30); assert.deepEqual(j.position,p);
    j.setPaused(false); j.update(100); assert.equal(j.complete,true); assert.ok(sweeps > 0);
    assert.equal(j.lastTrainPose!.exitRamp,0);
    j.restart(); assert.equal(j.trainSeconds,0); assert.equal(j.lastTrainPose,null);
  }
});

test('generated trains are short links on the automatic route without a bicycle on the rails', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed=0;seed<250;seed++) {
    const city=generateCity(seed,[bot]); const route=routeToGoal(city)!;
    const rail=city.streets.find(s=>s.id===city.steamTrain!.street)!;
    assert.equal(rail.kind,'clear'); assert.ok(route.includes(rail.a) && route.includes(rail.b));
    assert.ok(!city.bicycles!.some(b=>b.street===rail.id));
  }
});
