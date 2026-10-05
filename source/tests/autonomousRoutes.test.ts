import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autonomousRoutes } from '../src/city/autonomousRoutes';
import { generateCity, routeToGoal } from '../src/city/proceduralCity';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { BotHistory } from '../src/robot/botHistory';

test('ambient routes remove whole dead-end branches and keep the studio approach clear', () => {
  const points = [[-30, 0], [-20, 0], [-20, 8], [-30, 8], [-12, 0], [-4, 0], [0, 0]];
  const world: ProceduralCity = { seed: 1, start: 'start', destination: '6', rememberedRobots: 1, riverX: 50, buildings: [],
    nodes: points.map(([x, z], i) => ({ id: String(i), label: String(i), x: x!, z: z!, y: .16 })),
    streets: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [4, 5], [5, 6]].map(([a, b], i) => ({ id: String(i), a: String(a), b: String(b), kind: 'clear', width: 3, crossingSeconds: 20 })) };
  const routes = autonomousRoutes(world);
  assert.deepEqual([...routes.keys()], ['0', '1', '2', '3']);
  assert.deepEqual(routes.get('1')!.map(n => n.id), ['0', '2']);
});

test('250 generated cities reserve ten metres around the goal and give every bot junction a way through', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed = 0; seed < 250; seed++) {
    const world = generateCity(seed, [bot]), routes = autonomousRoutes(world);
    const goal = world.nodes.find(n => n.id === world.destination)!;
    assert.ok(!routes.has(world.start) && !routes.has(world.destination));
    for (const id of routeToGoal(world)!) assert.ok(!routes.has(id), `seed ${seed}: player route stays clear`);
    for (const [id, next] of routes) {
      assert.ok(next.length >= 2, `seed ${seed}: ${id} has an exit`);
      const a = world.nodes.find(n => n.id === id)!;
      for (const b of next) {
        assert.ok(routes.has(b.id));
        for (let t = 0; t <= 1; t += .1) assert.ok(Math.hypot(a.x + (b.x - a.x) * t - goal.x, a.z + (b.z - a.z) * t - goal.z) >= 10 - 1e-8);
      }
    }
  }
});
