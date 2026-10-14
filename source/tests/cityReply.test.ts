import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { interpretCityReply, applyCityReply } from '../src/ui/cityReply';

function fixture(kind = 'stairs') {
  const history = new BotHistory(['Curie', 'Einstein']); history.selectPreset('monet');
  const bot = history.all[0]!;
  const j = new PlannedJourney(bot, generateCity(42, [bot]));
  const street = j.world.streets.find(s => s.kind === kind)!;
  assert.ok(street); j.blocked = { id: street.id, reason: 'This place blocks my route.' };
  return { j, street };
}

test('Start and natural start phrases depart from a ready journey and resume without restarting', () => {
  for (const phrase of ['Start', 'start robot', 'Start the robot', 'please start', 'Could you start moving please?', 'Go', "Let's go", 'Begin the journey', 'Set off', 'resume']) {
    const { j } = fixture(); j.blocked = null;
    const run = j.machine.run.id;
    assert.equal(j.ready, true);
    assert.match(applyCityReply(j, interpretCityReply(phrase, j)), /started/, phrase);
    assert.equal(j.ready, false); assert.equal(j.machine.run.id, run);
    const route = [...j.route];
    assert.match(applyCityReply(j, interpretCityReply('Start', j)), /already/);
    assert.deepEqual(j.route, route);
    j.setPaused(true);
    assert.match(applyCityReply(j, interpretCityReply('Start', j)), /resumed/);
    assert.equal(j.paused, false); assert.deepEqual(j.route, route);
  }
});
test('negated, compound and diagnostic Start phrases do not depart', () => {
  for (const phrase of ["Don't start", 'Do you want to start?', 'Undo and start', 'Add a ramp and start', 'Start and lower the curb']) {
    const { j } = fixture(); assert.equal(interpretCityReply(phrase, j).action, undefined, phrase); assert.equal(j.ready, true);
  }
});
test('Start reports unavailable routes, completed runs and physical control without departing', () => {
  const { j } = fixture(); j.world.streets.length = 0;
  assert.match(applyCityReply(j, interpretCityReply('Start', j)), /no route/); assert.equal(j.ready, true);
  const physical = fixture().j; physical.physicalControl = true;
  assert.match(applyCityReply(physical, interpretCityReply('Start', physical)), /Physical robots/); assert.equal(physical.ready, true);
  const complete = fixture().j; complete.machine.run.status = 'completed';
  assert.match(applyCityReply(complete, interpretCityReply('Start', complete)), /complete/);
});

test('spoken paraphrases use existing edits and undo history', () => {
  const { j, street } = fixture();
  const reply = interpretCityReply('Could you put a ramp there please?', j);
  assert.deepEqual(reply.action, { kind: 'bridge-access', id: street.id, access: 'ramp' });
  applyCityReply(j, reply); assert.ok(j.repaired.has(street.id));
  applyCityReply(j, interpretCityReply('undo that', j)); assert.equal(j.repaired.has(street.id), false);
});
test('negation, explanations, wrong targets and compound requests do not mutate', () => {
  const { j } = fixture();
  for (const text of ["don't add a ramp", 'no ramp please', 'why are you stuck?', 'add a ramp and a beeper', 'add a ramp then continue', 'add a ramp and wait', 'add a beeper', 'fix it', 'turn left', 'ramp', 'remove the ramp', 'remove a ramp', 'do you need a ramp?']) {
    assert.equal(interpretCityReply(text, j).action, undefined, text);
  }
});
test('widths are sized to robot and numeric dimensions respect units and limits', () => {
  const { j, street } = fixture('width');
  const original = street.width;
  applyCityReply(j, interpretCityReply('please make it wider', j)); assert.ok(street.width > original);
  j.blocked = { id: street.id, reason: 'Too narrow' };
  const before = street.width;
  assert.match(applyCityReply(j, interpretCityReply('make it 900 metres wide', j)), /outside/);
  assert.equal(street.width, before);
  assert.equal(interpretCityReply('make it 2 seconds wide', j).action, undefined);
  assert.equal(interpretCityReply('make it 2 wide', j).action, undefined);
});
test('crossing replies distinguish time, panel height and cues', () => {
  const { j, street } = fixture('crossing');
  const time = interpretCityReply('give me 15 seconds to cross', j);
  assert.deepEqual(time.action, { kind: 'dimension', id: `crossing:${street.id}`, value: 15 });
  assert.equal(interpretCityReply('please lower the button', j).action?.kind, 'dimension');
  assert.deepEqual(interpretCityReply('add a beeper', j).action, { kind: 'feature', id: `signals:${street.id}` });
});
test('occupied streets and completed journeys cannot be edited by replies', () => {
  const { j, street } = fixture();
  j.setRoute([j.world.start, j.nextStops[0]!.id]); j.start();
  const occupied = j.currentStreet!; j.blocked = { id: occupied.id, reason: 'Blocked' }; j.distanceOnEdge = .5;
  const before = j.dimensions.get(`width:${occupied.id}`);
  applyCityReply(j, interpretCityReply('make it wider', j));
  assert.equal(j.dimensions.get(`width:${occupied.id}`), before);
  j.machine.run.status = 'completed';
  assert.match(applyCityReply(j, { message: 'Ramp', action: { kind: 'feature', id: street.id } }), /complete/);
});
test('temporary robot obstacles invite waiting rather than city mutation', () => {
  const { j } = fixture(); j.blocked = { id: 'robot:other', reason: 'Another robot is crossing' };
  assert.equal(interpretCityReply('make it wider', j).action, undefined);
  assert.match(interpretCityReply('make it wider', j).message, /wait/);
});
