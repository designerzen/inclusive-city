import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { generateCity, routeToGoal, type ProceduralCity } from '../src/city/proceduralCity';
import { barcodeGap, barcodeUnit, barcodeWidths, routeProjection, straightSections } from '../src/city/routeProjection';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { defaultProjectionSettings, validateProjectionSettings } from '../src/city/projectionSettings';

test('RIX codes read MSB first with double-tape guards and half/single-tape bits', () => {
  assert.deepEqual(barcodeWidths(1), [4, 1, 1, 1, 2, 4].map(n => n * barcodeUnit));
  assert.deepEqual(barcodeWidths(10), [4, 2, 1, 2, 1, 4].map(n => n * barcodeUnit));
  for (const code of [-1, 16, 1.5, NaN]) assert.throws(() => barcodeWidths(code), RangeError);
});

test('projection shares the exact trajectory and covers feature, discovery, train, bicycle and goal events', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  const world: ProceduralCity = { seed: 1, start: 'a', destination: 'd', riverX: 100, rememberedRobots: 1, buildings: [],
    nodes: [{ id: 'a', label: 'Start', x: 0, y: .16, z: 0 }, { id: 'b', label: 'Crossing', discovery: 'music', x: 30, y: .16, z: 0 },
      { id: 'c', label: 'Station', discovery: 'art', x: 30, y: .16, z: 30 }, { id: 'd', label: 'Studio', x: 60, y: .16, z: 30 }],
    streets: [{ id: 'ab', a: 'a', b: 'b', kind: 'curb', width: 6, crossingSeconds: 20 },
      { id: 'bc', a: 'b', b: 'c', kind: 'crossing', width: 6, crossingSeconds: 20 },
      { id: 'cd', a: 'c', b: 'd', kind: 'clear', width: 6, crossingSeconds: 20 }],
    steamTrain: { street: 'cd' }, bicycles: [{ id: 'bike', street: 'bc', location: 'road' }] };
  const journey = new PlannedJourney(bot, world); journey.enableLineFollowing(); journey.setRoute(['a', 'b', 'c', 'd']);
  const projection = routeProjection(journey);
  assert.equal(projection.points, journey.trajectory.points);
  assert.deepEqual(projection.markers.map(marker => marker.code), [0, 1, 4, 7, 8, 6, 9, 12]);
  for (const marker of projection.markers) {
    let distance = marker.distance;
    for (const bar of marker.bars) {
      const sample = journey.trajectory.sample(distance + bar.width / 2);
      assert.equal(bar.x, sample.position.x); assert.equal(bar.z, sample.position.z);
      assert.ok(Math.abs(Math.sin(bar.angle * Math.PI / 180 + sample.heading)) < 1e-8, 'bar crosses the track at right angles');
      distance += bar.width + barcodeGap * projection.scale;
    }
  }
  assert.equal(journey.ready, true, 'projecting does not start the robot');
  const settings = { ...defaultProjectionSettings, lineWidth: .4, barcodeWidth: 2, barGap: .23,
    shortLength: .12, longLength: .24, markerLength: .48, codeGap: .6, bendClearance: .7, autoFit: false };
  const configured = routeProjection(journey, settings);
  assert.equal(configured.scale, 1, 'fixed dimensions are never silently shrunk');
  assert.equal(configured.lineWidth, .4);
  assert.equal(configured.barcodeWidth, 2);
  for (const marker of configured.markers) {
    assert.deepEqual(marker.bars.map(bar => bar.width), barcodeWidths(marker.code, settings));
    const length = barcodeWidths(marker.code, settings).reduce((a, b) => a + b, 0) + settings.barGap * 5;
    assert.ok(straightSections(journey.trajectory, .7).some(section => marker.distance >= section.start - 1e-8
      && marker.distance + length <= section.end + 1e-8));
    for (let i = 1; i < marker.bars.length; i++) {
      const a = marker.bars[i - 1]!, b = marker.bars[i]!;
      const centreDistance = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(Math.abs(centreDistance - (a.width / 2 + settings.barGap + b.width / 2)) < 1e-8);
    }
  }
  assert.throws(() => routeProjection(journey, { ...settings, shortLength: 2, longLength: 4, markerLength: 8 }), /straight track/);
});

test('reachable generated routes cover every junction with non-overlapping event barcodes', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed = 1; seed <= 40; seed++) {
    const world = generateCity(seed, [bot]);
    const journey = new PlannedJourney(bot, world); journey.enableLineFollowing();
    const route = routeToGoal(world, world.start);
    if (!route) continue; // The city planner can reject an unreachable layout.
    journey.setRoute(route);
    const projection = routeProjection(journey);
    const markedNodes = new Set(projection.markers.map(marker => marker.node));
    for (const id of route) assert.ok(markedNodes.has(world.nodes.find(node => node.id === id)!.label), `seed ${seed}: ${id}`);
    for (const marker of projection.markers) {
      assert.equal(marker.bars[0]!.width, defaultProjectionSettings.markerLength * projection.scale);
      assert.equal(marker.bars[5]!.width, defaultProjectionSettings.markerLength * projection.scale);
      const length = (barcodeWidths(marker.code).reduce((a, b) => a + b, 0) + barcodeGap * 5) * projection.scale;
      assert.ok(straightSections(journey.trajectory).some(section => marker.distance >= section.start - 1e-8
        && marker.distance + length <= section.end + 1e-8), 'entire barcode fits on one straight section');
      assert.ok(marker.bars.every(bar => bar.angle === marker.bars[0]!.angle), 'all six bars are parallel');
    }
    for (let i = 1; i < projection.markers.length; i++) {
      const previous = projection.markers[i - 1]!;
      const length = (barcodeWidths(previous.code).reduce((a, b) => a + b, 0) + barcodeGap * 5) * projection.scale;
      assert.ok(previous.distance + length < projection.markers[i]!.distance, 'event codes do not overlap');
    }
  }
});

test('projection dimensions reject invalid or indistinguishable barcode settings', () => {
  for (const change of [{ lineWidth: NaN }, { barGap: 0 }, { shortLength: .2 }, { markerLength: .1 }, { barcodeWidth: .1 }])
    assert.throws(() => validateProjectionSettings({ ...defaultProjectionSettings, ...change }));
  const saved = validateProjectionSettings(defaultProjectionSettings);
  saved.lineWidth = .5;
  assert.equal(defaultProjectionSettings.lineWidth, .16, 'settings do not mutate defaults');
});

test('straight sections merge collinear samples but exclude curves and direction reversals', () => {
  const points = [new Vector3(0, 0, 0), new Vector3(1, 0, 1), new Vector3(3, 0, 3), new Vector3(1, 0, 1)];
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1]! + Vector3.Distance(points[i - 1]!, points[i]!));
  const sections = straightSections({ points, distances });
  assert.equal(sections.length, 2, 'reverse direction begins a separate section');
  assert.ok(Math.abs(sections[0]!.end - (Math.sqrt(18) - .4)) < 1e-8, 'diagonal segments merge');
  const curve = Array.from({ length: 61 }, (_, i) => new Vector3(3 * Math.cos(i * Math.PI / 120), 0, 3 * Math.sin(i * Math.PI / 120)));
  assert.deepEqual(straightSections({ points: curve, distances: curve.map((_, i) => i * .08) }), [], 'curve facets cannot masquerade as straight track');
});
