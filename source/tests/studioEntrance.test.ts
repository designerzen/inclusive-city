import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { robotFootprint, studioEntranceProblem } from '../src/city/proceduralCity';
import type { ProceduralCity } from '../src/city/proceduralCity';

function setup() {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  bot.profile.effectiveAbilities.agility = 50;
  bot.profile.effectiveAbilities.burstPower = 50;
  bot.profile.effectiveAbilities.reach = 50;
  const world: ProceduralCity = { seed: 1, start: 'a', destination: 'b', riverX: 20, rememberedRobots: 1, buildings: [], nodes: [{id:'a',label:'Workshop',x:0,y:.16,z:0},{id:'b',label:'Duet studio',x:10,y:.16,z:0}], streets:[{id:'road',a:'a',b:'b',kind:'clear',width:6,crossingSeconds:20}], studioEntrance: {width:.5,doorType:'revolving'} };
  return { bot, world, j: new PlannedJourney(bot, world) };
}

test('studio entrance stops the robot outside, keeps width and door obstacles independent, and resumes only when both work', () => {
  const {bot,world,j} = setup(); j.start(); j.update(100);
  assert.equal(j.blocked?.id,'studio-entrance'); assert.equal(j.complete,false);
  assert.ok(j.position.x < 8); const stopped = j.position; j.update(100); assert.deepEqual(j.position,stopped);
  assert.equal(j.machine.record.failures.length,1);
  j.setStudioDoor('automatic'); assert.ok(j.entranceProblem?.includes('Widen'));
  j.update(100); assert.equal(j.complete,false);
  j.editDimension('studio:width', robotFootprint(bot)+.2); assert.equal(j.entranceProblem,null);
  j.update(100); assert.equal(j.complete,true);
  assert.equal(j.machine.record.failures[0]!.resolvedAt !== null,true);
  assert.equal(j.machine.run.cityPlan!.world.studioEntrance!.doorType,'automatic');
  assert.equal(world.studioEntrance!.width,j.dimensions.get('studio:width'));
});

test('revolving and push doors check abilities, while automatic doors still require clearance', () => {
  const {bot} = setup(), width = robotFootprint(bot)+.2;
  assert.ok(studioEntranceProblem({width,doorType:'revolving'},bot));
  bot.profile.effectiveAbilities.agility=60;
  assert.equal(studioEntranceProblem({width,doorType:'revolving'},bot),null);
  assert.equal(studioEntranceProblem({width,doorType:'push'},bot),null);
  bot.profile.effectiveAbilities.reach=0;
  assert.ok(studioEntranceProblem({width,doorType:'push'},bot));
  bot.profile.effectiveAbilities.reach=50; bot.profile.effectiveAbilities.burstPower=39;
  assert.ok(studioEntranceProblem({width,doorType:'push'},bot));
  assert.equal(studioEntranceProblem({width,doorType:'automatic'},bot),null);
  assert.ok(studioEntranceProblem({width:.5,doorType:'automatic'},bot));
});

test('studio edits validate choices, undo individually, survive restart and preserve old snapshots', () => {
  const {j} = setup(); const saved=structuredClone(j.machine.run.cityPlan);
  assert.equal(j.editDimension('studio:type',.5),false);
  assert.equal(j.editDimension('studio:width',7),false);
  j.setStudioDoor('push'); j.editDimension('studio:width',4);
  assert.equal(j.undoRepair(),true); assert.equal(j.world.studioEntrance!.width,.5);
  assert.equal(j.undoRepair(),true); assert.equal(j.world.studioEntrance!.doorType,'revolving');
  j.setStudioDoor('automatic'); j.editDimension('studio:width',4); j.restart();
  assert.equal(j.world.studioEntrance!.doorType,'automatic'); assert.equal(j.world.studioEntrance!.width,4);
  assert.equal(saved!.world.studioEntrance!.width,.5);
});

