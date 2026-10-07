import type { PlannedJourney } from '../simulation/plannedJourney';

/** Place the doorway across the final line, including a finish on a road bend. */
export function studioApproach(journey: PlannedJourney) {
  const world = journey.world, goal = world.nodes.find(n => n.id === world.destination)!;
  if (journey.route.at(-1) === goal.id && journey.trajectory.points.length > 1) {
    const path = journey.trajectory, finish = path.sample(path.length).position;
    const entrance = path.sample(Math.max(0, path.length - 2)).position;
    return { goal: { ...goal, x: finish.x, z: finish.z }, x: entrance.x, z: entrance.z,
      heading: Math.atan2(finish.x - entrance.x, finish.z - entrance.z) };
  }
  const incoming = world.streets.find(s => s.a === goal.id || s.b === goal.id);
  const previous = world.nodes.find(n => n.id === (incoming?.a === goal.id ? incoming.b : incoming?.a)) ?? world.nodes.find(n => n.id !== goal.id) ?? { x: goal.x, z: goal.z - 1 };
  const dx = goal.x - previous.x, dz = goal.z - previous.z, length = Math.hypot(dx, dz);
  return { goal, x: goal.x - dx / length * 2, z: goal.z - dz / length * 2, heading: Math.atan2(dx, dz) };
}
