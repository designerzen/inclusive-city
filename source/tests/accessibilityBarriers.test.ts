import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { accessibilityBarriers, isAccessibilityBarrier, type AccessibilityBarrierKind } from '../src/city/accessibilityBarriers';
import { createAccessFeature } from '../src/city/createAccessFeature';
import { generateCity, streetProblem, type ProceduralCity } from '../src/city/proceduralCity';
import { generateCityWithBarriers } from '../src/city/cityDifficulty';
import { BotHistory } from '../src/robot/botHistory';
import { createRobotProfile, type FunctionId } from '../src/robot/functions';
import { defaultAbilities, type AbilityAllocation } from '../src/robot/abilities';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { cityIssueAction } from '../src/ui/cityIssueAction';
import { cityRobotAlert } from '../src/ui/cityRobotAlert';
import { cityAlertNarration, upcomingCityNarration } from '../src/ui/cityNarration';
import { applyCityReply, interpretCityReply } from '../src/ui/cityReply';
import { citySpokenChoices } from '../src/ui/citySpokenActions';
import { environmentChoiceCards } from '../src/ui/environmentChoices';
import { routeProjection } from '../src/city/routeProjection';

const kinds = Object.keys(accessibilityBarriers) as AccessibilityBarrierKind[];
function bot(allocation: Partial<AbilityAllocation> = {}, functions: FunctionId[] = ['vision', 'memory', 'communication']) {
  const result = new BotHistory(['Curie', 'Einstein']).current;
  result.profile = createRobotProfile({ ...defaultAbilities(), ...allocation }, functions);
  return result;
}
function fixture(kind: AccessibilityBarrierKind) {
  const world: ProceduralCity = { seed: 1, start: 'a', destination: 'b', riverX: 100, rememberedRobots: 1, buildings: [],
    nodes: [{ id: 'a', label: 'Start', x: 0, y: .16, z: 0 }, { id: 'b', label: 'Studio', x: 30, y: .16, z: 0 }],
    streets: [{ id: 'access-street', a: 'a', b: 'b', kind, width: 3, crossingSeconds: 20 }] };
  return new PlannedJourney(bot(), world);
}

test('access depends on each robot capability, including exact threshold boundaries and disabled senses', () => {
  const cases: [AccessibilityBarrierKind, ReturnType<typeof bot>, ReturnType<typeof bot>][] = [
    ['uneven', bot({ agility: 45 }, ['balance', 'vision', 'communication']), bot({ agility: 46 }, ['balance', 'vision', 'communication'])],
    ['slope', bot({ burstPower: 60 }), bot({ burstPower: 59 })],
    ['rest', bot({ burstPower: 40 }), bot({ burstPower: 41 })],
    ['signage', bot({ visualDetail: 60 }), bot({ visualDetail: 59 })],
    ['announcement', bot({}, ['hearing', 'vision', 'communication']), bot()],
  ];
  for (const [kind, capable, needsSupport] of cases) {
    const street = fixture(kind).world.streets[0]!;
    assert.equal(streetProblem(street, capable), null, kind);
    assert.ok(streetProblem(street, needsSupport), kind);
    assert.equal(streetProblem(street, needsSupport, true), null, kind);
  }
  assert.ok(streetProblem(fixture('uneven').world.streets[0]!, bot({ agility: 0 })));
  assert.ok(streetProblem(fixture('signage').world.streets[0]!, bot({ visualDetail: 100 }, ['hearing', 'memory', 'communication'])));
});

test('every new barrier stops travel, explains itself and supports repair, undo and completion without changing the robot', () => {
  for (const kind of kinds) {
    const journey = fixture(kind), barrier = accessibilityBarriers[kind];
    const original = structuredClone(journey.bot.profile);
    journey.start(); journey.update(1000);
    assert.equal(journey.blocked?.id, 'access-street');
    assert.equal(journey.metrics.distance, 0);
    assert.equal(cityIssueAction(journey), barrier.action);
    assert.equal(cityRobotAlert(journey), barrier.alert);
    assert.ok(cityAlertNarration.includes(barrier.alert));
    assert.ok(upcomingCityNarration(journey).includes(barrier.alert));
    const reply = interpretCityReply(barrier.action, journey);
    assert.deepEqual(reply.action, { kind: 'feature', id: 'access-street' });
    assert.ok(citySpokenChoices(journey).some(choice => choice.phrase === barrier.action));
    assert.ok(environmentChoiceCards(kind, false, false).includes(barrier.after));
    applyCityReply(journey, reply);
    assert.equal(journey.problem(journey.world.streets[0]!), null);
    assert.equal(journey.undoRepair(), true);
    assert.ok(journey.problem(journey.world.streets[0]!));
    journey.update(.1); assert.equal(journey.blocked?.id, 'access-street');
    assert.equal(journey.repair('access-street'), true);
    journey.update(1000); assert.equal(journey.complete, true, kind);
    assert.deepEqual(journey.bot.profile, original);
  }
});

test('new improvement requests preserve negation, diagnosis, compound and wrong-target protections', () => {
  for (const kind of kinds) {
    const journey = fixture(kind); journey.start(); journey.update(1);
    const action = accessibilityBarriers[kind].action;
    for (const text of [`Do not ${action}`, `Why should I ${action}?`, `${action} then add a ramp`, 'Smooth the paving and add rest points']) {
      assert.equal(interpretCityReply(text, journey).action, undefined, text);
    }
    if (kind !== 'uneven') assert.equal(interpretCityReply('Smooth the paving', journey).action, undefined);
    assert.equal(journey.repaired.size, 0);
  }
});

test('generated cities include new barriers and the amount setting removes them in open cities', () => {
  const robot = bot(), found = new Set<string>();
  for (let seed = 0; seed < 30; seed++) {
    const world = generateCity(seed, [robot]);
    world.streets.filter(street => isAccessibilityBarrier(street.kind)).forEach(street => found.add(street.kind));
    assert.deepEqual(world, generateCity(seed, [robot]));
    assert.equal(generateCityWithBarriers(seed, [robot], '0').streets.some(street => isAccessibilityBarrier(street.kind)), false);
  }
  assert.deepEqual([...found].sort(), [...kinds].sort());
});

test('projected routes retain new barrier labels using the access-support marker', () => {
  for (const kind of kinds) {
    const journey = fixture(kind); journey.setRoute(['a', 'b']);
    assert.ok(routeProjection(journey).markers.some(marker => marker.code === 14 && marker.label === accessibilityBarriers[kind].name));
  }
});

test('city features visibly change from barriers to support with selectable meshes', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const before = new StandardMaterial('before', scene), after = new StandardMaterial('after', scene);
    for (const kind of kinds) {
      const feature = createAccessFeature(scene, kind, kind, 0, 0, 0, before, after);
      feature.sync(false);
      const original = feature.root.getChildMeshes().filter(mesh => mesh.isEnabled());
      assert.ok(original.length > 0);
      feature.sync(true);
      const improved = feature.root.getChildMeshes().filter(mesh => mesh.isEnabled());
      assert.ok(improved.length > 0);
      assert.ok(original.every(mesh => !mesh.isEnabled()));
      assert.ok(improved.every(mesh => mesh.metadata.street === kind && mesh.isPickable));
    }
  } finally { scene.dispose(); engine.dispose(); }
});
