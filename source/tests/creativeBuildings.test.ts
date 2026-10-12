import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passedFrontage, buildingFrontage } from '../src/city/creativeBuildings';
import { ProceduralPainting } from '../src/art/ProceduralPainting';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import type { RobotEvent } from '../src/robot/robotState';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { generateCity } from '../src/city/proceduralCity';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { createRobotProfile } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';
import { mixPart } from '../src/audio/AudioMix';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { creativeBuildingModel } from '../src/city/creativeBuildingModel';

test('all landmarks build distinct word-free geometry without pickable decorations', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const light = new StandardMaterial('light', scene), dark = new StandardMaterial('dark', scene);
    const counts = ['gallery', 'record-store', 'museum'].map(role => {
      const model = creativeBuildingModel(role as 'gallery' | 'record-store' | 'museum', scene, light, dark);
      const meshes = model.getChildMeshes();
      assert.ok(meshes.length >= 4);
      assert.ok(meshes.every(mesh => !mesh.isPickable));
      return meshes.length;
    });
    assert.equal(new Set(counts).size, 3);
  } finally { scene.dispose(); engine.dispose(); }
});

test('all three landmarks survive generated station and garage clearance', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed = 0; seed < 100; seed++) {
    const world = generateCity(seed, [bot]);
    assert.deepEqual(world.buildings.filter(b => b.creativeRole).map(b => b.creativeRole).sort(), ['gallery', 'museum', 'record-store']);
  }
});

test('travel activates each building once, pause does not activate, restart resets visits', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  bot.profile = createRobotProfile(defaultAbilities(), ['communication', 'vision', 'memory']);
  const world: ProceduralCity = { seed: 1, start: 'a', destination: 'b', riverX: 30, rememberedRobots: 1,
    buildings: [{ name: 'Gallery', x: 8, z: 5, w: 3, d: 3, h: 3, creativeRole: 'gallery' }],
    nodes: [{ id: 'a', label: 'Start', x: 0, y: .16, z: 0 }, { id: 'b', label: 'End', x: 20, y: .16, z: 0 }],
    streets: [{ id: 'road', a: 'a', b: 'b', kind: 'clear', width: 10, crossingSeconds: 100 }] };
  const journey = new PlannedJourney(bot, world);
  const encounters = () => journey.machine.record.events.filter(e => e.type === 'building_encounter' && e.runId === journey.machine.run.id);
  const travel = () => { for (let i = 0; i < 100; i++) journey.update(.1); };
  journey.setRoute(['a', 'b']); journey.start(); journey.setPaused(true); travel();
  assert.equal(encounters().length, 0);
  journey.setPaused(false); travel(); travel();
  assert.equal(encounters().length, 1);
  journey.restart(); journey.start(); travel();
  assert.equal(encounters().length, 1);
});

test('frontage sweep detects skipped zones but excludes stationary, parallel and elevated travel', () => {
  const point = { x: 0, y: 0, z: 0 };
  assert.equal(passedFrontage({ x: -8, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, point), true);
  assert.equal(passedFrontage(point, point, point), false);
  assert.equal(passedFrontage({ x: -8, y: 0, z: 4 }, { x: 8, y: 0, z: 4 }, point), false);
  assert.equal(passedFrontage({ x: -8, y: 2, z: 0 }, { x: 8, y: 2, z: 0 }, point), false);
});

test('frontage follows relocated buildings and excludes bridges', () => {
  const world = { nodes: [{ id: 'a', x: 0, y: 0, z: 0 }, { id: 'b', x: 20, y: 0, z: 0 }, { id: 'c', x: 0, y: 0, z: 10 }, { id: 'd', x: 20, y: 0, z: 10 }],
    streets: [{ id: 'road', a: 'a', b: 'b', kind: 'clear' }, { id: 'bridge', a: 'c', b: 'd', kind: 'bridge' }] } as ProceduralCity;
  const building = { name: 'Gallery', x: 5, z: 8, w: 3, d: 3, h: 3 };
  assert.equal(buildingFrontage(building, world).street, 'road');
  building.x = 15;
  assert.equal(buildingFrontage(building, world).x, 15);
});

test('gallery affects only future marks; museum restores the original painter', () => {
  const painting = new ProceduralPainting(42, 1, 'watercolour');
  const event = (sequence: number, type: RobotEvent['type'], data: RobotEvent['data']) => ({ sequence, type, data, position: { x: sequence, y: 0, z: 0 }, time: sequence, runTime: sequence, state: 'following', edge: 0 } as RobotEvent);
  painting.consume(event(1, 'step', { step: 1 }));
  const first = structuredClone(painting.marks[0]);
  painting.consume(event(2, 'building_encounter', { kind: 'gallery' }));
  assert.equal(painting.marks.at(-1)!.style, 'geometric');
  painting.consume(event(3, 'building_encounter', { kind: 'museum' }));
  assert.equal(painting.marks.at(-1)!.style, 'watercolour');
  assert.deepEqual(painting.marks[0], first);
});

test('landmarks preserve timing and generate saved, distinct additional music parts', () => {
  const composer = new JourneyMusicComposer('waltz', 42, 50, { get: () => undefined });
  const phrase = { at: 0, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: false };
  const original = composer.compose(phrase, false, false);
  composer.galleryInfluence = true; composer.recordLayers = 1; composer.museumInfluence = true;
  const influenced = composer.compose(phrase, false, false);
  assert.equal(composer.beats, 3);
  assert.ok(influenced.some(e => e.label?.includes('record-store')));
  assert.ok(influenced.some(e => e.label?.includes('museum')));
  assert.ok(influenced.filter(e => e.label?.includes('backing:')).every(e => mixPart(e.label) === 'backing'));
  const melody = (score: typeof original) => score.find(e => e.label?.includes(':melody:'))!;
  assert.deepEqual(melody(original).score.notes, melody(influenced).score.notes);
  assert.notDeepEqual(melody(original).score.voice, melody(influenced).score.voice);
  assert.deepEqual(JSON.parse(JSON.stringify(influenced)), influenced);
});
