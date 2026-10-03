import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { bodyColours, bodyShapes, defaultAppearance } from '../robot/appearance';
import { createRobot } from '../robot/createRobot';
import { neighbours } from './proceduralCity';
import type { ProceduralCity } from './proceduralCity';
import type { createCityPhysics } from './cityPhysics';

/** Local street wandering: choose a neighbour, pause, and turn back if stuck. */
export function createAutonomousBots(scene: Scene, world: ProceduralCity, physics: ReturnType<typeof createCityPhysics>) {
  let seed = world.seed >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const starts = world.nodes.filter(n => n.id !== world.start && n.id !== world.destination && neighbours(world, n.id).length);
  const bots = Array.from({ length: Math.min(6, starts.length) }, (_, i) => {
    const node = starts[Math.floor(i * starts.length / Math.min(6, starts.length))]!;
    const model = createRobot(scene);
    model.setAppearance({ ...defaultAppearance(), colour: bodyColours[(i + 1) % bodyColours.length]!, shape: bodyShapes[i % bodyShapes.length]!, width: .75, height: .8 });
    model.robot.name = `city-bot-${i + 1}`;
    model.robot.scaling.setAll(.5);
    model.robot.getChildMeshes().forEach(mesh => { mesh.isPickable = false; mesh.metadata = { autonomousBot: i + 1 }; });
    const radius = .55, height = 1.725;
    const character = physics.addRobot(`city-bot-${i + 1}`, new Vector3(node.x, .075 + height / 2, node.z), radius, height);
    return { model, character, node, target: node, previous: '', heading: 0, wait: .3 + random(), stuck: 0, speed: .8 + random() * .6, verticalVelocity: 0, distance: 0, turns: 0 };
  });
  function update(seconds: number, reducedMotion = false) {
    let remaining = Math.min(.1, Math.max(0, seconds));
    while (remaining > 1e-9) {
      const dt = Math.min(1 / 60, remaining);
      for (const bot of bots) {
        const before = bot.character.controller.getPosition().clone();
        const distanceToTarget = Math.hypot(bot.target.x - before.x, bot.target.z - before.z);
        if (distanceToTarget < .12) {
          bot.previous = bot.node.id; bot.node = bot.target;
          const options = neighbours(world, bot.node.id);
          const forward = options.filter(n => n.id !== bot.previous);
          const choices = forward.length ? forward : options;
          bot.target = choices[Math.floor(random() * choices.length)] ?? bot.node;
          bot.wait = .3 + random() * .7;
        }
        const dx = bot.target.x - before.x, dz = bot.target.z - before.z;
        const distance = Math.hypot(dx, dz);
        const desired = Math.atan2(-dx, -dz);
        const turn = Math.atan2(Math.sin(desired - bot.heading), Math.cos(desired - bot.heading));
        const delta = Math.sign(turn) * Math.min(Math.abs(turn), dt * 2.5);
        bot.heading += delta;
        bot.wait = Math.max(0, bot.wait - dt);
        const speed = bot.wait > 0 || Math.abs(turn) > .1 ? 0 : Math.min(bot.speed, distance / dt);
        bot.verticalVelocity = Math.max(-10, bot.verticalVelocity - 9.81 * dt);
        physics.moveRobot(bot.character, new Vector3(distance ? dx / distance * speed : 0, bot.verticalVelocity, distance ? dz / distance * speed : 0), dt, new Vector3(0, -9.81, 0));
        bot.verticalVelocity = bot.character.controller.getVelocity().y;
        const p = bot.character.controller.getPosition();
        const moved = Math.hypot(p.x - before.x, p.z - before.z);
        bot.distance += moved;
        bot.stuck = speed > 0 && moved < speed * dt * .1 ? bot.stuck + dt : 0;
        if (bot.stuck > .65 + bots.indexOf(bot) * .1) {
          // Reverse toward the last junction without teleporting out of contact.
          const target = bot.target; bot.target = bot.node; bot.node = target;
          bot.wait = .2 + random() * .4; bot.stuck = 0; bot.turns++;
        }
        bot.model.robot.position.set(p.x, p.y - bot.character.height / 2 - .04, p.z);
        bot.model.robot.rotation.y = bot.heading;
        bot.model.animateTravel(moved, dt, reducedMotion, speed === 0, delta);
      }
      remaining -= dt;
    }
  }
  update(1 / 60, true);
  return { bots, update };
}
