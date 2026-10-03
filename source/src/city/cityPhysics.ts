import type HavokPhysics from '@babylonjs/havok';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { CharacterSupportedState, PhysicsCharacterController } from '@babylonjs/core/Physics/v2/characterController';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import type { PlannedJourney } from '../simulation/plannedJourney';
import { robotFootprint } from './proceduralCity';

/** Static box colliders and one capsule, independent of decorative mesh complexity. */
export function createCityPhysics(scene: Scene, journey: PlannedJourney, solids: readonly Mesh[], instance: Awaited<ReturnType<typeof HavokPhysics>>) {
  const gravity = new Vector3(0, -9.81, 0), down = new Vector3(0, -1, 0);
  const plugin = new HavokPlugin(true, instance);
  scene.enablePhysics(gravity, plugin);
  scene.getPhysicsEngine()!.setTimeStep(1 / 60);
  const colliders = new Map<Mesh, { key: string; aggregate: PhysicsAggregate }>();
  function sync() {
    for (const mesh of solids) {
      const old = colliders.get(mesh);
      const enabled = mesh.isEnabled() && !mesh.isDisposed();
      const key = [...mesh.position.asArray(), ...mesh.scaling.asArray(), ...mesh.rotation.asArray()].join('|');
      if (enabled && old?.key === key) continue;
      old?.aggregate.dispose(); colliders.delete(mesh);
      if (enabled) {
        mesh.computeWorldMatrix(true);
        colliders.set(mesh, { key, aggregate: new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: .8, restitution: 0 }, scene) });
      }
    }
  }
  sync();
  const radius = Math.max(.25, robotFootprint(journey.bot) / 2);
  const height = Math.max(radius * 2 + .1, (1.05 + 3 * journey.bot.appearance.height) * .5);
  const start = journey.position;
  const controller = new PhysicsCharacterController(new Vector3(start.x, .075 + height / 2, start.z), { capsuleHeight: height, capsuleRadius: radius }, scene);
  controller.keepDistance = .01; controller.keepContactTolerance = .03;
  controller.maxStepHeight = .18;
  controller.maxSlopeCosine = Math.cos(Math.PI / 4);
  let verticalVelocity = 0;
  let stationarySeconds = 0;
  function reset() {
    const p = journey.position;
    controller.setPosition(new Vector3(p.x, .075 + height / 2, p.z));
    controller.setVelocity(Vector3.Zero()); verticalVelocity = 0; stationarySeconds = 0;
  }
  function update(seconds: number) {
    if (journey.ready && Vector3.DistanceSquared(controller.getPosition(), new Vector3(journey.position.x, controller.getPosition().y, journey.position.z)) > .0001) reset();
    // Small steps keep gravity and support stable after a slow frame.
    let remaining = Math.min(.1, Math.max(0, seconds));
    while (remaining > 1e-9) {
      const dt = Math.min(1 / 60, remaining), support = controller.checkSupport(dt, down);
      verticalVelocity = support.supportedState === CharacterSupportedState.SUPPORTED ? 0 : verticalVelocity + gravity.y * dt;
      controller.setVelocity(new Vector3(0, verticalVelocity, 0));
      controller.integrate(dt, support, gravity);
      verticalVelocity = controller.getVelocity().y;
      remaining -= dt;
    }
  }
  function blocker() {
    const p = controller.getPosition();
    let nearest: Mesh | undefined, best = Infinity;
    for (const mesh of colliders.keys()) {
      if (!mesh.metadata?.building) continue;
      const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
      const distance = Math.hypot(Math.max(min.x - p.x, 0, p.x - max.x), Math.max(min.z - p.z, 0, p.z - max.z));
      if (distance < best) { nearest = mesh; best = distance; }
    }
    return nearest && best < radius + .15
      ? { id: `wall:${nearest.metadata.building}:${nearest.metadata.side ?? 'front'}`, reason: 'This building blocks the robot’s path. Move its wall to make room, then resume.' }
      : { id: journey.currentStreet!.id, reason: 'A solid object blocks this street. Move the nearby wall or widen the passage, then resume.' };
  }
  journey.constrainTravel = (from, to, seconds) => {
    const dx = to.x - from.x, dz = to.z - from.z, requested = Math.hypot(dx, dz);
    const before = controller.getPosition().clone();
    const support = controller.checkSupport(seconds, down);
    controller.setVelocity(new Vector3(dx / seconds, 0, dz / seconds));
    controller.integrate(seconds, support, Vector3.Zero());
    const after = controller.getPosition();
    const distance = Math.max(0, Math.min(requested, ((after.x - before.x) * dx + (after.z - before.z) * dz) / requested));
    stationarySeconds = distance < Math.min(requested * .1, 1e-4) ? stationarySeconds + seconds : 0;
    // Havok discards sub-millimetre residual motion in its contact solver. Treat
    // that tolerance as completed so a route milestone cannot retry forever.
    return { distance: requested - distance <= 1e-4 ? requested : distance, blocker: stationarySeconds >= .25 ? blocker() : undefined };
  };
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true; journey.constrainTravel = undefined;
    controller.dispose(); colliders.forEach(({ aggregate }) => aggregate.dispose()); colliders.clear();
  }
  scene.onDisposeObservable.addOnce(dispose);
  return { sync, update, reset, dispose, controller,
    get position() { const p = controller.getPosition(); return new Vector3(p.x, p.y - height / 2 - .04, p.z); },
    get colliderCount() { return colliders.size; } };
}
