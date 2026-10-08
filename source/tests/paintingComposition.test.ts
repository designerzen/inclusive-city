import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeGesture, compositionFamilies } from '../src/art/paintingComposition';
import { ProceduralPainting } from '../src/art/ProceduralPainting';
import type { RobotEvent } from '../src/robot/robotState';

test('composition families have distinct spatial silhouettes using the same seed and journey', () => {
  const signatures = new Set<string>();
  for (const family of compositionFamilies) {
    const gestures = Array.from({ length: 100 }, (_, i) => composeGesture(42661, family, i + 1, .5));
    for (const gesture of gestures) {
      for (const p of gesture.points) assert.ok(p.x >= .09 && p.x <= .91 && p.y >= .09 && p.y <= .91);
      assert.ok(gesture.breadth > 0);
    }
    const centres = gestures.map(g => ({ x: (g.points[0].x + g.points[3].x) / 2, y: (g.points[0].y + g.points[3].y) / 2 }));
    const occupancy = new Array(64).fill(0);
    for (const p of centres) occupancy[Math.floor(p.y * 8) * 8 + Math.floor(p.x * 8)]++;
    signatures.add(JSON.stringify(occupancy));
    if (family === 'horizon') assert.ok(gestures.every(g => Math.abs(g.points[3].x - g.points[0].x) > .25));
    if (family === 'botanical') assert.ok(gestures.every(g => g.points[3].y < g.points[0].y));
  }
  assert.equal(signatures.size, compositionFamilies.length);
});

test('new runs cover every composition and save ground and motifs without changing step counts', () => {
  const families = new Set<string>(), grounds = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const painting = new ProceduralPainting(seed, .7, 'impressionist');
    families.add(painting.family);
    for (let i = 0; i < 30; i++) {
      const event: RobotEvent = { sequence: i + 1, botId: 1, runId: 1, time: i, runTime: i,
        type: 'step', state: 'following', edge: 0, position: { x: i, y: 0, z: 0 }, data: {} };
      painting.consume(event);
    }
    assert.equal(painting.marks.length, 30);
    assert.equal(painting.marks.filter(m => m.ground).length, 1);
    grounds.add(painting.marks[0]!.ground!);
    assert.ok(painting.marks.every(m => m.composition === painting.family));
    assert.deepEqual(JSON.parse(JSON.stringify(painting.marks)), painting.marks);
    if (painting.family !== 'calligraphy') assert.ok(painting.marks.some(m => m.motif));
  }
  assert.equal(families.size, 6); assert.equal(grounds.size, 5);
});
