import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { createRobotProfile } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';
import { CityJourney } from '../src/simulation/cityJourney';
import { cityBarriers, cityRoute } from '../src/city/cityLayout';
import { robotMetadata } from '../src/robot/robotState';

const bot = () => structuredClone(new BotHistory(['Curie', 'Einstein'], () => 0).current);

test('steps stop the wheels until the city is converted to a ramp', () => {
  const robot = bot(), profile = structuredClone(robot.profile);
  const journey = new CityJourney(robot);
  for (const barrier of cityBarriers) if (barrier.id !== 'stairs' && barrier.id !== 'elevator') journey.intervene(barrier.id);
  journey.update(1000);
  assert.equal(journey.blocked?.id, 'stairs');
  const position = journey.position;
  journey.update(30); assert.deepEqual(journey.position, position);
  assert.equal(journey.edit('stairs', true), true);
  journey.update(1000);
  assert.equal(journey.blocked?.id, 'elevator');
  assert.ok(journey.position.y > position.y);
  assert.deepEqual(robot.profile, profile);
  assert.ok(journey.events.some(event => event.type === 'intervention' && event.barrier === 'stairs'));
});

test('large time steps stop before a barrier and waiting never moves the robot through it', () => {
  const journey = new CityJourney(bot());
  journey.update(1000);
  assert.equal(journey.blocked?.id, 'curb');
  assert.deepEqual(journey.position, cityRoute[1]);
  journey.update(1000);
  assert.deepEqual(journey.position, cityRoute[1]);
  assert.equal(journey.events.filter(event => event.type === 'blocked').length, 1);
  journey.intervene('curb');
  journey.update(1000);
  assert.equal(journey.blocked?.id, 'crossing');
  assert.deepEqual(journey.position, cityRoute[2]);
});

test('adapting the city lets the same bot finish, and improvements persist on restart', () => {
  const original = bot();
  const journey = new CityJourney(original);
  const encountered: string[] = [];
  for (let i = 0; i < cityBarriers.length + 1 && !journey.complete; i++) {
    journey.update(1000);
    if (journey.blocked) {
      encountered.push(journey.blocked.id);
      journey.intervene(journey.blocked.id);
    }
  }
  assert.deepEqual(encountered, ['curb', 'crossing', 'sidewalk', 'bridge', 'stairs', 'elevator']);
  assert.equal(journey.complete, true);
  assert.deepEqual(journey.position, cityRoute.at(-1));
  assert.deepEqual(robotMetadata(journey.bot), robotMetadata(bot()));
  journey.update(1000);
  assert.equal(journey.events.filter(event => event.type === 'arrived').length, 1);
  journey.restart();
  journey.update(1000);
  assert.equal(journey.complete, true);
  assert.equal(journey.fixed.size, 6);
});

test('movement and sensory support depend on the enabled functions', () => {
  const withoutDrive = bot();
  withoutDrive.profile = createRobotProfile(defaultAbilities(), ['vision', 'memory', 'hearing']);
  const transportJourney = new CityJourney(withoutDrive);
  transportJourney.update(1000);
  assert.equal(transportJourney.blocked?.id, 'transport');
  assert.deepEqual(transportJourney.position, cityRoute[0]);
  transportJourney.intervene('transport');
  transportJourney.update(1000);
  assert.equal(transportJourney.blocked?.id, 'curb');

  const withoutVision = bot();
  withoutVision.profile = createRobotProfile(defaultAbilities(), ['movement', 'memory', 'hearing']);
  const guidanceJourney = new CityJourney(withoutVision);
  guidanceJourney.intervene('curb');
  guidanceJourney.intervene('crossing');
  guidanceJourney.update(1000);
  assert.equal(guidanceJourney.blocked?.id, 'guidance');
  guidanceJourney.intervene('guidance');
  guidanceJourney.update(1000);
  assert.equal(guidanceJourney.blocked?.id, 'sidewalk');
});

test('compact bots fit the narrow sidewalk and forgetful bots need additional route cues', () => {
  const compact = bot();
  compact.appearance.width = 0.75;
  compact.profile = createRobotProfile({ ...defaultAbilities(), reach: 0 }, ['movement', 'vision', 'memory']);
  const journey = new CityJourney(compact);
  journey.intervene('curb');
  journey.intervene('crossing');
  journey.update(1000);
  assert.equal(journey.blocked?.id, 'bridge');
  assert.equal(journey.fixed.has('sidewalk'), false);

  const forgetful = bot();
  forgetful.profile = createRobotProfile({ ...defaultAbilities(), speed: 90 }, ['movement', 'vision', 'memory']);
  const other = new CityJourney(forgetful);
  other.intervene('curb');
  other.intervene('crossing');
  other.update(1000);
  assert.equal(other.blocked?.id, 'guidance');
});

test('elevator follows the vertical route and pause freezes position', () => {
  const journey = new CityJourney(bot());
  for (const barrier of cityBarriers) if (barrier.id !== 'elevator') journey.intervene(barrier.id);
  journey.update(1000);
  assert.deepEqual(journey.position, cityRoute[10]);
  journey.intervene('elevator');
  journey.update(1);
  assert.equal(journey.edge, 10);
  assert.equal(journey.position.x, 15);
  assert.equal(journey.position.z, 4);
  assert.ok(Math.abs(journey.position.y - 1.84) < 1e-8);
  const position = journey.position;
  journey.paused = true;
  journey.update(1000);
  assert.deepEqual(journey.position, position);
  journey.paused = false;
  journey.update(1000);
  assert.equal(journey.complete, true);
});
