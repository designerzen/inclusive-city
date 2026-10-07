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

/** Static box colliders and robot capsules, independent of decorative mesh complexity. */
export function createCityPhysics(scene: Scene, journey: PlannedJourney, solids: readonly Mesh[], instance: Awaited<ReturnType<typeof HavokPhysics>>) {
  const gravity = new Vector3(0, -9.81, 0), down = new Vector3(0, -1, 0);
  const plugin = new HavokPlugin(true, instance);
  scene.enablePhysics(gravity, plugin);
  scene.getPhysicsEngine()!.setTimeStep(1 / 60);
  const colliders = new Map<Mesh, { key: string; aggregate: PhysicsAggregate }>();
  function sync() {
    for (const mesh of solids) {
      const old = colliders.get(mesh);
      const enabled = mesh.isEnabled() && !mesh.isDisposed() && !mesh.metadata?.decorative;
      mesh.computeWorldMatrix(true);
      const key = Array.from(mesh.getWorldMatrix().m).join('|') + ':' + (mesh.metadata?.surfaceRevision ?? '');
      if (enabled && old?.key === key) continue;
      old?.aggregate.dispose(); colliders.delete(mesh);
      if (enabled) {
        mesh.computeWorldMatrix(true);
        colliders.set(mesh, { key, aggregate: new PhysicsAggregate(mesh, mesh.metadata?.roadSurface ? PhysicsShapeType.MESH : PhysicsShapeType.BOX, { mass: 0, friction: .8, restitution: 0 }, scene) });
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
  const characters = [{ controller, radius, height, id: 'player' }];
  type Character = typeof characters[number];
  const contacts = new Map<string, { a: Character; b?: Character; mesh?: Mesh }>();
  function refreshContacts() {
    for (const [key, { a, b, mesh }] of contacts) {
      const p = a.controller.getPosition();
      if (b) {
        const q = b.controller.getPosition();
        if (Math.hypot(p.x - q.x, p.z - q.z) > a.radius + b.radius + .12 || Math.abs(p.y - q.y) > (a.height + b.height) / 2) contacts.delete(key);
      } else if (mesh) {
        const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
        if (!mesh.isEnabled() || mesh.isDisposed() || Math.hypot(Math.max(min.x - p.x, 0, p.x - max.x), Math.max(min.z - p.z, 0, p.z - max.z)) > a.radius + .12) contacts.delete(key);
      }
    }
  }
  function collision(a: Character, speed: number, b?: Character, mesh?: Mesh) {
    const other = b?.id ?? `solid:${mesh!.name}`;
    const key = b ? [a.id, b.id].sort().join('|') : `${a.id}|solid:${mesh!.uniqueId}`;
    if (contacts.has(key)) return;
    contacts.set(key, { a, b, mesh });
    const p = a.controller.getPosition();
    const event = journey.machine.emit('collision', { actor: a.id, other, kind: b ? 'robot' : 'world', speed });
    event.position = { x: p.x, y: p.y - a.height / 2, z: p.z };
  }
  function collisionPartners(character: Character) {
    return [...contacts.values()].flatMap(({ a, b }) => b && a === character ? [b.id] : b === character ? [a.id] : []);
  }
  function addRobot(id: string, position: Vector3, radius: number, height: number) {
    const controller = new PhysicsCharacterController(position, { capsuleRadius: radius, capsuleHeight: height }, scene);
    controller.keepDistance = .01; controller.keepContactTolerance = .03;
    controller.maxStepHeight = .18; controller.maxSlopeCosine = Math.cos(Math.PI / 4);
    const character = { controller, radius, height, id };
    characters.push(character);
    return character;
  }
  // Sweep against the other capsules explicitly as well: their Havok animated
  // bodies are committed during rendering, whereas several bots move per tick.
  function moveRobot(character: typeof characters[number], velocity: Vector3, seconds: number, gravity = Vector3.Zero()) {
    refreshContacts();
    const before = character.controller.getPosition().clone();
    const dx = velocity.x * seconds, dz = velocity.z * seconds, lengthSquared = dx * dx + dz * dz;
    let fraction = 1, contact: string | undefined;
    if (lengthSquared > 0) for (const other of characters) {
      if (other === character) continue;
      const p = other.controller.getPosition();
      if (Math.abs(p.y - before.y) >= (character.height + other.height) / 2) continue;
      const x = before.x - p.x, z = before.z - p.z;
      const radius = character.radius + other.radius + .02;
      const dot = x * dx + z * dz;
      if (dot >= 0) continue;
      const c = x * x + z * z - radius * radius;
      const discriminant = dot * dot - lengthSquared * c;
      if (discriminant < 0) continue;
      const hit = Math.max(0, (-dot - Math.sqrt(discriminant)) / lengthSquared);
      if (hit < fraction) { fraction = hit; contact = other.id; }
    }
    const support = character.controller.checkSupport(seconds, down);
    character.controller.setVelocity(new Vector3(velocity.x * fraction, velocity.y, velocity.z * fraction));
    character.controller.integrate(seconds, support, gravity);
    const after = character.controller.getPosition();
    const speed = Math.hypot(velocity.x, velocity.z);
    if (contact) collision(character, speed, characters.find(c => c.id === contact)!);
    if (lengthSquared > 0 && !contact && (after.x - before.x) * dx + (after.z - before.z) * dz < lengthSquared * .9) {
      const feet = after.y - character.height / 2;
      let nearest: Mesh | undefined, best = character.radius + .12;
      for (const mesh of colliders.keys()) {
        const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
        // Ground and walkable step tops are support, rather than impacts.
        if (max.y <= feet + character.controller.maxStepHeight || min.y >= after.y + character.height / 2) continue;
        const distance = Math.hypot(Math.max(min.x - after.x, 0, after.x - max.x), Math.max(min.z - after.z, 0, after.z - max.z));
        if (distance < best) { best = distance; nearest = mesh; }
      }
      if (nearest) { contact = `solid:${nearest.name}`; collision(character, speed, undefined, nearest); }
    }
    return { distance: Vector3.Distance(before, character.controller.getPosition()), contact };
  }
  let verticalVelocity = 0;
  let stationarySeconds = 0;
  function reset() {
    const p = journey.position;
    controller.setPosition(new Vector3(p.x, p.y - .085 + height / 2, p.z));
    controller.setVelocity(Vector3.Zero()); verticalVelocity = 0; stationarySeconds = 0;
  }
  journey.syncTransport = reset;
  function update(seconds: number) {
    refreshContacts();
    if (journey.onTrainLink || journey.onBridgeElevator) { reset(); return; }
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
    const other = characters.find(c => c.controller !== controller && Math.hypot(c.controller.getPosition().x - p.x, c.controller.getPosition().z - p.z) < radius + c.radius + .1);
    if (other) return { id: `robot:${other.id}`, reason: 'Another robot is crossing the path. Waiting for it to move.' };
    let nearest: Mesh | undefined, best = radius + .15;
    for (const mesh of colliders.keys()) {
      const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
      // Identify the actual obstruction, including features on adjacent streets.
      // Floors and walkable tops are support, not barriers to repair.
      const feet = p.y - height / 2;
      if (max.y <= feet + controller.maxStepHeight || min.y >= p.y + height / 2) continue;
      const distance = Math.hypot(Math.max(min.x - p.x, 0, p.x - max.x), Math.max(min.z - p.z, 0, p.z - max.z));
      if (distance < best) { nearest = mesh; best = distance; }
    }
    const street = journey.world.streets.find(s => s.id === nearest?.metadata?.street);
    if (street && ['curb', 'stairs', 'bridge'].includes(street.kind) && !journey.repaired.has(street.id)) {
      return { id: street.id, reason: journey.problem(street)! };
    }
    if (nearest?.metadata?.building) return {
      id: `wall:${nearest.metadata.building}:${nearest.metadata.side ?? 'front'}`,
      reason: 'This building blocks the robot’s path. Move its wall to make room, then resume.',
    };
    return { id: journey.currentStreet!.id, reason: 'A solid object blocks this street. Move the nearby wall or widen the passage, then resume.' };
  }
  journey.constrainTravel = (from, to, seconds) => {
    const dx = to.x - from.x, dz = to.z - from.z, requested = Math.hypot(dx, dz);
    const before = controller.getPosition().clone();
    // Steer toward the next point on the line, correcting any lateral contact drift.
    moveRobot(characters[0]!, new Vector3((to.x - before.x) / seconds, 0, (to.z - before.z) / seconds), seconds);
    const after = controller.getPosition();
    const distance = Math.max(0, Math.min(requested, ((after.x - before.x) * dx + (after.z - before.z) * dz) / requested));
    stationarySeconds = distance < Math.min(requested * .1, 1e-4) ? stationarySeconds + seconds : 0;
    // Havok discards sub-millimetre residual motion in its contact solver. Treat
    // that tolerance as completed so a route milestone cannot retry forever.
    return { distance: requested - distance <= 2e-4 ? requested : distance, blocker: stationarySeconds >= .25 ? blocker() : undefined };
  };
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true; journey.constrainTravel = undefined; journey.syncTransport = undefined;
    characters.forEach(c => c.controller.dispose()); characters.length = 0;
    colliders.forEach(({ aggregate }) => aggregate.dispose()); colliders.clear(); contacts.clear();
  }
  scene.onDisposeObservable.addOnce(dispose);
  return { sync, update, reset, dispose, controller, addRobot, moveRobot, collisionPartners, player: characters[0]!,
    get position() { const p = controller.getPosition(); return new Vector3(p.x, p.y - height / 2 - .04, p.z); },
    get colliderCount() { return colliders.size; } };
}
