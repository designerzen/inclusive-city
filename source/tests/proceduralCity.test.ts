import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity, neighbours, robotFootprint, robotSpeed, streetBetween, streetProblem } from '../src/city/proceduralCity';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { robotPresets } from '../src/robot/presets';

function memories() { const history = new BotHistory(['Curie', 'Einstein']); for (const preset of robotPresets) history.selectPreset(preset.id); return history.all; }
function path(world: ProceduralCity, from = world.start, to = world.destination, allowed = (_id: string) => true) {
  const queue = [[from]], visited = new Set([from]);
  while (queue.length) {
    const route = queue.shift()!;
    if (route.at(-1) === to) return route;
    for (const node of neighbours(world, route.at(-1)!)) {
      const street = streetBetween(world, route.at(-1)!, node.id)!;
      if (!visited.has(node.id) && allowed(street.id)) { visited.add(node.id); queue.push([...route, node.id]); }
    }
  }
  return null;
}

test('procedural seeds are reproducible and change networks, landmarks and buildings', () => {
  const bots = memories(), a = generateCity(42, bots);
  assert.deepEqual(generateCity(42, bots), a);
  assert.notDeepEqual(generateCity(43, bots).streets, a.streets);
  assert.notDeepEqual(generateCity(43, bots).buildings, a.buildings);
  assert.notDeepEqual(generateCity(43, bots).nodes, a.nodes);
  assert.equal(a.nodes.filter(n => n.discovery).length, 6);
  assert.equal(a.rememberedRobots, bots.length);
});

test('250 generated cities are connected, have alternate crossings and cannot be completed unchanged by any remembered robot', () => {
  const bots = memories();
  for (let seed = 0; seed < 250; seed++) {
    const world = generateCity(seed, bots);
    assert.ok(path(world), `seed ${seed} is solvable with city changes`);
    assert.ok(world.streets.filter(s => s.kind === 'bridge').length >= 2);
    for (const node of world.nodes) assert.ok(path(world, world.start, node.id));
    for (const bot of bots) assert.equal(path(world, world.start, world.destination, id => !streetProblem(world.streets.find(s => s.id === id)!, bot)), null, `seed ${seed} must require a city edit for ${bot.name}`);
  }
});

test('width and crossing challenges account for all robots in memory', () => {
  const bots = memories(), world = generateCity(3, bots);
  for (const street of world.streets) for (const bot of bots) {
    if (street.kind === 'width') { assert.ok(street.width < robotFootprint(bot) + .15); assert.ok(streetProblem(street, bot)); }
    if (street.kind === 'crossing') { assert.ok(street.crossingSeconds < 4 / robotSpeed(bot)); assert.ok(streetProblem(street, bot)); }
    assert.equal(streetProblem(street, bot, true), null);
  }
});

test('invalid routes are rejected, while starting needs no drawing and completes a partial route', () => {
  const bot = memories()[0]!, world = generateCity(8, [bot]), j = new PlannedJourney(bot, world);
  const before = j.position;
  assert.equal(j.canStart, true); j.update(100); assert.deepEqual(j.position, before);
  assert.equal(j.setRoute([world.start, world.destination]), false);
  assert.equal(j.appendStop('missing'), false);
  assert.equal(j.setRoute([world.start, 'NaN']), false);
  assert.equal(j.appendStop(j.nextStops[0]!.id), true);
  j.update(Infinity); assert.deepEqual(j.position, before);
  assert.equal(j.undoStop(), true); assert.deepEqual(j.route, [world.start]);
  const next = j.nextStops[0]!.id;
  j.appendStop(next); assert.equal(j.start(), true);
  assert.deepEqual(j.route.slice(0, 2), [world.start, next]);
  assert.equal(j.route.at(-1), world.destination);
});

test('start immediately, repair barriers as they appear, and reach the goal without planning', () => {
  for (let seed = 0; seed < 30; seed++) {
    const bot = memories()[0]!, world = generateCity(seed, [bot]), j = new PlannedJourney(bot, world);
    assert.deepEqual(j.route, [world.start]); assert.equal(j.canStart, true); assert.equal(j.start(), true);
    assert.equal(j.route.at(-1), world.destination);
    for (let i = 0; i < world.streets.length + 2 && !j.complete; i++) {
      j.update(10000);
      if (j.blocked) assert.equal(j.repair(j.blocked.id), true);
    }
    assert.equal(j.complete, true, `seed ${seed} can be played by helping at barriers`);
    const goal = world.nodes.find(n => n.id === world.destination)!;
    assert.deepEqual(j.position, { x: goal.x, y: goal.y, z: goal.z });
  }
});

test('the robot stops before unedited streets and follows only the drawn line after repairs', () => {
  const bot = memories()[0]!, world = generateCity(24, [bot]), j = new PlannedJourney(bot, world);
  const route = path(world)!; assert.equal(j.setRoute(route), true); assert.equal(j.start(), true);
  j.update(10000); assert.equal(j.complete, false); assert.ok(j.blocked);
  const stopped = j.position; j.update(10000); assert.deepEqual(j.position, stopped);
  assert.equal(j.setRoute([world.start, world.destination]), false);
  assert.equal(j.clearRoute(), false);
  for (const street of world.streets) if (street.kind !== 'clear') j.repair(street.id);
  for (let i = 0; i < 6000 && !j.complete; i++) {
    j.update(.05);
    const a = world.nodes.find(n => n.id === route[Math.min(j.edge, route.length - 2)])!, b = world.nodes.find(n => n.id === route[Math.min(j.edge + 1, route.length - 1)])!;
    const p = j.position;
    assert.ok(Math.abs((p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x)) < 1e-6, 'robot remains on the drawn segment');
  }
  assert.equal(j.complete, true); assert.ok(j.repaired.size > 0);
  assert.deepEqual(j.machine.run.cityPlan!.route, route);
  assert.deepEqual(JSON.parse(JSON.stringify(j.machine.run.cityPlan)), j.machine.run.cityPlan);
});

test('discovery choices change the journey; there are no invisible automatic detours', () => {
  const bot = memories()[0]!, world = generateCity(19, [bot]);
  const visit = world.nodes.find(n => n.discovery && n.x < world.riverX)!;
  const route = [...path(world, world.start, visit.id)!, ...path(world, visit.id, world.destination)!.slice(1)];
  const j = new PlannedJourney(bot, world); assert.equal(j.setRoute(route), true);
  for (const street of world.streets) if (street.kind !== 'clear') j.repair(street.id);
  j.start(); j.update(10000); assert.equal(j.complete, true);
  assert.ok(j.machine.run.pickups.some(p => p.id === visit.id));
  assert.ok(j.machine.run.pickups.every(p => route.includes(p.id)));
  assert.ok(Math.abs(j.metrics.distance - j.routeLength) < 1e-6);
});

test('pause, undo, occupied-street protection and retries preserve completed journey records', () => {
  const bot = memories()[0]!, world = generateCity(10, [bot]), j = new PlannedJourney(bot, world);
  const route = path(world)!; j.setRoute(route);
  for (const id of route.slice(1).map((n, i) => streetBetween(world, route[i]!, n)!)) if (id.kind !== 'clear') j.repair(id.id);
  j.start(); j.update(.2); j.setPaused(true);
  const position = j.position; j.update(50); assert.deepEqual(j.position, position);
  assert.equal(j.canEdit(j.currentStreet!.id), false);
  j.setPaused(false); j.update(10000); assert.equal(j.complete, true);
  const run = j.machine.run, saved = structuredClone(run);
  assert.equal(j.repair(world.streets[0]!.id), false);
  j.restart(); assert.equal(j.ready, true); j.clearRoute();
  assert.deepEqual(run, saved); assert.ok(j.repaired.size > 0); assert.deepEqual(j.route, [world.start]);
});

test('travel and discoveries agree across simulation tick sizes', () => {
  const bots = memories(), world = generateCity(90, bots), a = new PlannedJourney(bots[0]!, world), b = new PlannedJourney(bots[1]!, world);
  // Use identical metadata with independent records.
  b.bot.profile = structuredClone(a.bot.profile); b.bot.appearance = structuredClone(a.bot.appearance);
  for (const j of [a, b]) { j.setRoute(path(world)!); world.streets.filter(s => s.kind !== 'clear').forEach(s => j.repair(s.id)); j.repair('transport'); j.start(); }
  a.update(300); for (let i = 0; i < 9000; i++) b.update(1 / 30);
  assert.equal(a.complete, true); assert.equal(b.complete, true);
  assert.ok(Math.abs(a.metrics.distance - b.metrics.distance) < 1e-6);
  assert.ok(Math.abs(a.metrics.movingSeconds - b.metrics.movingSeconds) < 1e-6);
  assert.deepEqual(a.machine.run.pickups.map(p => p.id), b.machine.run.pickups.map(p => p.id));
});

test('workshop transport and independent street repairs are reversible without changing robot abilities', () => {
  const bot = memories()[0]!;
  bot.profile.enabledFunctions = bot.profile.enabledFunctions.filter(f => f !== 'movement');
  const original = structuredClone(bot.profile), world = generateCity(22, [bot]), j = new PlannedJourney(bot, world);
  const route = path(world)!; j.setRoute(route); j.start(); j.update(1);
  assert.equal(j.blocked?.id, 'transport'); assert.equal(j.metrics.distance, 0);
  assert.equal(j.repair('transport'), true);
  assert.equal(j.undoRepair(), true); j.update(1); assert.equal(j.blocked?.id, 'transport');
  j.repair('transport');
  const crossings = world.streets.filter(s => s.kind === 'bridge');
  j.repair(crossings[0]!.id);
  assert.equal(j.problem(crossings[0]!), null); assert.ok(j.problem(crossings[1]!));
  for (const id of route.slice(1).map((n, i) => streetBetween(world, route[i]!, n)!)) if (id.kind !== 'clear') j.repair(id.id);
  j.update(10000); assert.equal(j.complete, true);
  assert.deepEqual(j.bot.profile, original); assert.deepEqual(bot.profile, original);
});
