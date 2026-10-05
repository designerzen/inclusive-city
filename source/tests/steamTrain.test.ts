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
    assert.equal(rail.id,'bridge-2'); assert.equal(rail.kind,'bridge');
    assert.ok(Math.abs(city.steamTrain!.trackStart!.z) < 1);
    assert.ok(Math.abs(city.steamTrain!.trackEnd!.z) < 1);
    const a = city.nodes.find(n => n.id === rail.a)!, b = city.nodes.find(n => n.id === rail.b)!;
    assert.ok(a.z > city.steamTrain!.trackStart!.z);
    assert.ok(b.z < city.steamTrain!.trackEnd!.z);
    assert.ok(city.steamTrain!.trackStart!.x < city.riverX && city.steamTrain!.trackEnd!.x > city.riverX); assert.ok(route.includes(rail.a) && route.includes(rail.b));
    assert.ok(!city.bicycles!.some(b=>b.street===rail.id));
  }
});


test('central railway carries riders across town and exits directly onto the opposite platform only after arrival', () => {
  const city = generateCity(42, [new BotHistory(['Curie','Einstein']).current]);
  const service = city.steamTrain!, street = city.streets.find(s => s.id === service.street)!;
  const west = city.nodes.find(n => n.id === street.a)!, east = city.nodes.find(n => n.id === street.b)!;
  for (const reverse of [false, true]) {
    const a = reverse ? east : west, b = reverse ? west : east;
    const track = reverse ? { trackStart: service.trackEnd, trackEnd: service.trackStart } : service;
    assert.deepEqual(trainRidePose(a,b,0,track).position, { x:a.x,y:a.y,z:a.z });
    for (const t of [0,3,5,8,10,13.99]) {
      const pose = trainRidePose(a,b,t,track);
      assert.equal(pose.exitDoorOpen,false); assert.equal(pose.exitRamp,0);
    }
    const arrived = trainRidePose(a,b,14,track);
    assert.ok(Math.abs(arrived.train.x-track.trackEnd!.x)<1e-8); assert.ok(Math.abs(arrived.train.z-track.trackEnd!.z)<1e-8);
    assert.equal(arrived.exitDoorOpen,false);
    assert.equal(trainRidePose(a,b,17,track).exitDoorOpen,true);
    assert.equal(trainRidePose(a,b,17,track).boardingDoorOpen,false);
    assert.deepEqual(trainRidePose(a,b,19,track).position,{ x:b.x,y:b.y,z:b.z });
    assert.deepEqual(trainRidePose(a,b,24,track).position,{ x:b.x,y:b.y,z:b.z });
  }
});
