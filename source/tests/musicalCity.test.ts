import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { createMusicalObjects } from '../src/city/musicalObjects';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { voiceCityObject, objectRhythmSlot, type CityInstrument } from '../src/audio/cityInstruments';
import { SoundEffect } from '../src/audio/SoundEffect';

const world = (): ProceduralCity => ({ seed: 1, start: 'a', destination: 'b', riverX: 30, rememberedRobots: 1,
  buildings: [{ name: 'Gallery', x: 6, z: 3, w: 3, d: 3, h: 3, creativeRole: 'gallery' }],
  nodes: [{ id: 'a', label: 'Start', x: 0, y: .16, z: 0 }, { id: 'b', label: 'End', x: 30, y: .16, z: 0 }],
  streets: [{ id: 'road', a: 'a', b: 'b', kind: 'clear', width: 10, crossingSeconds: 100 }] });

test('robot meetings are proximity based, respect height/pause, and occur once per robot per run', () => {
  const journey = new PlannedJourney(new BotHistory(['Curie', 'Einstein']).current, world());
  let position = { x: 0, y: .16, z: 0 };
  journey.nearbyRobots = () => [{ id: 'city-bot-1', name: 'City robot 1', buttonReach: 1.5, position }];
  const events = () => journey.machine.record.events.filter(e => e.type === 'robot_encounter' && e.runId === journey.machine.run.id);
  journey.update(.01); assert.equal(events().length, 0);
  journey.setRoute(['a', 'b']); journey.start(); journey.setPaused(true);
  journey.update(.01); assert.equal(events().length, 0);
  journey.setPaused(false); position = { x: 0, y: 3, z: 0 };
  journey.update(.01); assert.equal(events().length, 0);
  position = { x: 0, y: .16, z: 0 };
  journey.update(.01); journey.update(.01); assert.equal(events().length, 1);
  assert.ok(Number(events()[0]!.data.variation) >= 1);
  journey.restart(); journey.start(); journey.update(.01); assert.equal(events().length, 1);
});

test('every object instrument is distinct, bounded and replayable; ambience is quieter', () => {
  const score = new SoundEffect().toScore();
  const voices = (['bell', 'pluck', 'water', 'drum', 'whistle', 'robot'] as CityInstrument[]).map(kind => {
    const resolved = voiceCityObject(score, kind, 'object-one', .5);
    assert.deepEqual(SoundEffect.fromScore(resolved).toScore(), resolved);
    assert.ok(resolved.notes.every(n => n.midi >= 24 && n.midi <= 108));
    assert.ok(voiceCityObject(score, kind, 'object-one', .5, true).voice.gain < resolved.voice.gain);
    return JSON.stringify(resolved);
  });
  assert.equal(new Set(voices).size, 6);
  assert.ok(new Set(['river', 'steam-train', 'building:Gallery', 'building:Museum'].map(objectRhythmSlot)).size > 2);
});

test('meeting a robot changes future lead notes without moving the rhythm or bass', () => {
  const composer = new JourneyMusicComposer('jazz', 42, 50, { get: () => undefined });
  const data = { at: 0, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: false };
  const before = composer.compose(data);
  composer.encounterVariation = 1;
  const after = composer.compose(data);
  assert.notDeepEqual(after, before);
  assert.deepEqual(after.slice(1), before.slice(1), 'the lead changes while the arrangement stays intact');
  for (let i = 0; i < before.length; i++) {
    if (JSON.stringify(before[i]) === JSON.stringify(after[i])) continue;
    assert.deepEqual(after[i]!.score.notes.map(n => [n.start, n.duration]), before[i]!.score.notes.map(n => [n.start, n.duration]));
  }
});

test('object sounds align to the audible music, and survive score serialization', () => {
  const creation = new JourneyCreativity(new BotHistory(['Curie', 'Einstein']).current, 123);
  creation.advance(0);
  const answer = creation.playObject('river', 'water', .23);
  const halfBeat = 30 / creation.bpm;
  assert.ok(answer.at >= .28);
  assert.ok(Math.abs(answer.at / halfBeat - Math.round(answer.at / halfBeat)) < 1e-8);
  assert.deepEqual(JSON.parse(JSON.stringify(creation.finishMusic())).find((e: {label: string}) => e.label === answer.label), answer);
});

test('non-pickable decoration becomes an instrument; nearby rhythms and rings do not catch up in bursts', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const wall = MeshBuilder.CreateBox('wall-Gallery', {}, scene); wall.position.set(6, 1, 3); wall.isPickable = false;
    const objects = createMusicalObjects(scene, world());
    const camera = new FreeCamera('camera', new Vector3(6, 1, -10), scene); camera.setTarget(new Vector3(6, 1, 3));
    scene.render();
    const object = objects.objects.find(o => o.id === 'building:Gallery')!;
    assert.ok(object); assert.equal(object.kind, 'bell');
    assert.equal(objects.at(engine.getRenderWidth() / 2, engine.getRenderHeight() / 2)?.id, object.id, 'decoration is clickable even when it is not an editor target');
    const focus = objects.project(object.id)!;
    assert.ok(focus.width >= 48 && focus.height >= 48);
    wall.position.x += 3; scene.render();
    assert.ok(objects.project(object.id)!.x > focus.x, 'the visual focus follows moving geometry');
    assert.equal(objects.project('missing-object'), null);
    const slot = objectRhythmSlot(object.id), time = slot / 4;
    assert.equal(objects.nearby(time, 120, { x: 6, y: 0, z: 0 }).length, 1);
    assert.equal(objects.nearby(time, 120, { x: 6, y: 0, z: 0 }).length, 0);
    assert.ok(objects.nearby(time + 100, 120, { x: 6, y: 0, z: 0 }).length <= 1);
    objects.pulse(object, 1); objects.update(.9, false);
    const ring = scene.getMeshByName('musical-response')!;
    assert.equal(ring.isEnabled(), false);
    objects.update(1.2, true); assert.equal(ring.isEnabled(), true); assert.equal(ring.scaling.x, 1);
    objects.update(2, false); assert.equal(scene.getMeshByName('musical-response'), null);
  } finally { scene.dispose(); engine.dispose(); }
});

