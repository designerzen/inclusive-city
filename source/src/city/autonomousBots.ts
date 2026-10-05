import { freshCondition, advanceCondition } from '../robot/robotCondition';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { bodyColours, bodyShapes, defaultAppearance } from '../robot/appearance';
import { createRobot } from '../robot/createRobot';
import { streetBetween } from './proceduralCity';
import { autonomousRoutes } from './autonomousRoutes';
import { crossingSignal } from './trafficSignals';
import type { ProceduralCity } from './proceduralCity';
import type { createCityPhysics } from './cityPhysics';

/** Local street wandering: choose a neighbour, pause, and turn back if stuck. */
export function createAutonomousBots(scene: Scene, world: ProceduralCity, physics: ReturnType<typeof createCityPhysics>) {
  let seed = world.seed >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const routes = autonomousRoutes(world);
  const starts = world.nodes.filter(n => routes.has(n.id));
  const bots = Array.from({ length: Math.min(6, starts.length) }, (_, i) => {
    const node = starts[Math.floor(i * starts.length / Math.min(6, starts.length))]!;
    const model = createRobot(scene);
    model.setAppearance({ ...defaultAppearance(), colour: bodyColours[(i + 1) % bodyColours.length]!, shape: bodyShapes[i % bodyShapes.length]!, width: .75, height: .8 });
    model.robot.name = `city-bot-${i + 1}`;
    model.robot.scaling.setAll(.5);
    model.robot.getChildMeshes().forEach(mesh => { mesh.isPickable = false; mesh.metadata = { autonomousBot: i + 1 }; });
    const radius = .55, height = 1.725;
    const character = physics.addRobot(`city-bot-${i + 1}`, new Vector3(node.x, .075 + height / 2, node.z), radius, height);
    return { id: `city-bot-${i + 1}`, name: `City robot ${i + 1}`, buttonReach: 1.5,
      condition: freshCondition(), model, character, node, target: node, previous: '', avoid: '', returning: false, yielding: false,
      escape: null as { x: number; z: number } | null, escapeSide: i % 2 ? -1 : 1,
      heading: 0, wait: .3 + random(), stuck: 0, speed: .8 + random() * .6, verticalVelocity: 0, distance: 0, turns: 0, crossingEntered: false };
  });
  function retreat(bot: typeof bots[number]) {
    if (bot.returning) return;
    bot.avoid = bot.target.id;
    const target = bot.target; bot.target = bot.node; bot.node = target;
    bot.returning = true; bot.crossingEntered = true;
    bot.wait = 0; bot.stuck = 0; bot.turns++;
  }
  function stepAside(bot: typeof bots[number]) {
    const p = bot.character.controller.getPosition();
    const dx = bot.target.x - bot.node.x, dz = bot.target.z - bot.node.z, length = Math.hypot(dx, dz) || 1;
    const clearance = physics.player.radius + bot.character.radius + .4;
    const goal = world.nodes.find(n => n.id === world.destination)!;
    let escape = { x: p.x + (dz / length || (dx === 0 ? 1 : 0)) * clearance * bot.escapeSide,
      z: p.z - dx / length * clearance * bot.escapeSide };
    if (Math.hypot(escape.x - goal.x, escape.z - goal.z) < 10) escape = { x: 2 * p.x - escape.x, z: 2 * p.z - escape.z };
    bot.escape = escape;
    bot.escapeSide *= -1; bot.wait = 0; bot.stuck = 0;
  }
  function update(seconds: number, reducedMotion = false, signalTime = 0) {
    let remaining = Math.min(.1, Math.max(0, seconds));
    while (remaining > 1e-9) {
      const dt = Math.min(1 / 60, remaining);
      for (const bot of bots) {
        const before = bot.character.controller.getPosition().clone();
        const player = physics.player.controller.getPosition();
        const playerContact = physics.collisionPartners(bot.character).includes('player');
        if (playerContact) bot.yielding = true;
        if (Math.hypot(player.x - before.x, player.z - before.z) > physics.player.radius + bot.character.radius + 2) bot.yielding = false;
        // Respond to player-initiated impacts too. If the player is ahead,
        // return to the junction; if behind, hurry forward to clear their path.
        if (playerContact && !bot.returning && !bot.escape && (player.x - before.x) * (bot.target.x - before.x) + (player.z - before.z) * (bot.target.z - before.z) > 0) retreat(bot);
        if (bot.escape && Math.hypot(bot.escape.x - before.x, bot.escape.z - before.z) < .12) { bot.escape = null; bot.stuck = 0; }
        const distanceToTarget = Math.hypot(bot.target.x - before.x, bot.target.z - before.z);
        if (!bot.escape && distanceToTarget < .12) {
          bot.previous = bot.node.id; bot.node = bot.target;
          const options = routes.get(bot.node.id) ?? [];
          const unblocked = options.filter(n => n.id !== bot.avoid);
          const forward = unblocked.filter(n => n.id !== bot.previous);
          let choices = forward.length ? forward : unblocked.length ? unblocked : options;
          if (bot.yielding) choices = choices.filter(n => (n.x - before.x) * (player.x - before.x) + (n.z - before.z) * (player.z - before.z) <= 0);
          bot.target = choices[Math.floor(random() * choices.length)] ?? bot.node;
          bot.returning = false;
          bot.crossingEntered = false;
          bot.wait = bot.yielding ? 0 : .3 + random() * .7;
          if (!choices.length && bot.yielding) stepAside(bot);
        }
        const destination = bot.escape ?? bot.target;
        const dx = destination.x - before.x, dz = destination.z - before.z;
        const distance = Math.hypot(dx, dz);
        const desired = Math.atan2(-dx, -dz);
        const turn = Math.atan2(Math.sin(desired - bot.heading), Math.cos(desired - bot.heading));
        const delta = Math.sign(turn) * Math.min(Math.abs(turn), dt * 2.5);
        bot.heading += delta;
        bot.wait = Math.max(0, bot.wait - dt);
        const street = streetBetween(world, bot.node.id, bot.target.id);
        let waitForGreen = false;
        if (street?.kind === 'crossing' && !bot.crossingEntered && !bot.returning && !bot.escape && !bot.yielding) {
          const signal = crossingSignal(signalTime, street.crossingSeconds);
          const length = Math.hypot(bot.target.x - bot.node.x, bot.target.z - bot.node.z);
          waitForGreen = !signal.green || signal.remaining < length / bot.speed;
          if (!waitForGreen && bot.wait === 0 && Math.abs(turn) <= .1) bot.crossingEntered = true;
        }
        const speed = bot.wait > 0 || waitForGreen || Math.abs(turn) > .1 ? 0 : Math.min(bot.yielding ? Math.max(1.8, bot.speed) : bot.speed, distance / dt);
        bot.verticalVelocity = Math.max(-10, bot.verticalVelocity - 9.81 * dt);
        const movement = physics.moveRobot(bot.character, new Vector3(distance ? dx / distance * speed : 0, bot.verticalVelocity, distance ? dz / distance * speed : 0), dt, new Vector3(0, -9.81, 0));
        bot.verticalVelocity = bot.character.controller.getVelocity().y;
        const p = bot.character.controller.getPosition();
        const moved = Math.hypot(p.x - before.x, p.z - before.z);
        bot.distance += moved;
        bot.stuck = speed > 0 && moved < speed * dt * .1 ? bot.stuck + dt : 0;
        if (movement.contact === 'player') bot.yielding = true;
        if (movement.contact && !bot.returning && !bot.escape) retreat(bot);
        if (bot.stuck > .65 + bots.indexOf(bot) * .1) {
          if (bot.returning || bot.yielding || bot.escape) stepAside(bot);
          else retreat(bot);
        }
        bot.model.robot.position.set(p.x, p.y - bot.character.height / 2 - .04, p.z);
        bot.model.robot.rotation.y = bot.heading;
        advanceCondition(bot.condition, dt, movement.contact || bot.stuck > 0 ? 'blocked' : moved > .0001 ? 'moving' : waitForGreen ? 'waiting' : 'resting');
        bot.condition.direction = bot.heading; bot.condition.speed = moved / dt;
        bot.model.setCondition(bot.condition);
        bot.model.animateTravel(moved, dt, reducedMotion, false, delta);
      }
      remaining -= dt;
    }
  }
  update(1 / 60, true);
  return { bots, update };
}
