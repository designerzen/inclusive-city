import { cityBarriers, cityPickups, cityPowerups, cityRoute } from '../city/cityLayout';
import type { BarrierId, CityBarrier, PowerupId, RoutePoint } from '../city/cityLayout';
import type { ArtBot } from '../robot/botHistory';
import { RobotStateMachine, robotMetadata } from '../robot/robotState';
import type { RobotEvent } from '../robot/robotState';
import { CityDocument } from '../city/cityDocument';
import type { CityValue, CityEditId } from '../city/cityDocument';
import { buildingProperty, doorBuilding, pavementEdge } from '../city/buildingDimensions';

export const TRAVEL_UNITS_PER_STEP = 1;

export class CityJourney {
  edge = 0;
  distanceOnEdge = 0;
  private isPaused = false;
  readonly city = new CityDocument();
  get fixed() { return new Set(this.city.changedFeatures); }
  readonly events: RobotEvent[] = [];
  readonly machine: RobotStateMachine;
  readonly bot: ArtBot;
  blocked: CityBarrier | null = null;
  private lastEncounter: BarrierId | null = null;
  readonly plannedPowerups = new Set<PowerupId>();
  private excursion: { id: PowerupId; points: RoutePoint[]; leg: number; distance: number } | null = null;
  get exploring() { return this.excursion?.id ?? null; }

  canExplore(id: PowerupId) {
    const pickup = cityPowerups.find(item => item.id === id)!;
    return !!pickup && !this.complete && this.machine.run.status === 'active'
      && !this.machine.run.pickups.some(item => item.id === id)
      && (pickup.node > this.edge || (pickup.node === this.edge && this.distanceOnEdge === 0));
  }
  explore(id: PowerupId) {
    if (!this.canExplore(id) || this.plannedPowerups.has(id)) return false;
    this.plannedPowerups.add(id);
    this.emit('exploration', { id });
    return true;
  }

  get heading() {
    const points = this.excursion?.points ?? cityRoute;
    const index = this.excursion?.leg ?? this.edge;
    const a = points[index], b = points[index + 1];
    return a && b && (a.x !== b.x || a.z !== b.z) ? Math.atan2(a.x - b.x, a.z - b.z) : null;
  }

  constructor(bot: ArtBot, planning = false) {
    this.bot = { ...robotMetadata(bot), record: bot.record };
    this.machine = new RobotStateMachine(bot.record, () => ({ edge: this.edge, position: this.position }));
    this.machine.start(robotMetadata(bot), [], planning);
    this.machine.run.citySnapshot = this.city.snapshot();
    this.syncTelemetry();
  }
  private syncTelemetry() {
    this.machine.record.telemetry = { edge: this.edge, position: this.position, speed: this.speed, progress: this.complete ? 1 : (this.edge + this.distanceOnEdge / Math.hypot(cityRoute[this.edge + 1]!.x - cityRoute[this.edge]!.x, cityRoute[this.edge + 1]!.y - cityRoute[this.edge]!.y, cityRoute[this.edge + 1]!.z - cityRoute[this.edge]!.z)) / (cityRoute.length - 1) };
  }
  get state() { return this.machine.state; }
  get metrics() { return this.machine.run.metrics; }
  // A step counts a whole unit of travel, independently of rendering or wheel rotation.
  get stepCounter() { return this.metrics.stepsTaken; }
  get paused() { return this.isPaused; }
  get ready() { return this.state === 'ready'; }
  start() {
    if (!this.ready) return;
    this.machine.run.citySnapshot = this.city.snapshot();
    this.machine.run.environment.accessibleFeatures = cityBarriers.filter(b => !this.inaccessible(b)).map(b => b.id);
    this.machine.depart();
  }
  set paused(value: boolean) {
    if (this.ready || this.complete || value === this.isPaused) return;
    this.isPaused = value;
    this.machine.transition(value ? 'paused' : this.blocked ? 'blocked' : 'following');
  }
  private emit(type: RobotEvent['type'], data: RobotEvent['data'] = {}, barrier?: BarrierId) {
    this.events.push(this.machine.emit(type, data, barrier));
  }

  get complete() { return this.edge >= cityRoute.length - 1; }
  get speed() { return this.bot.profile.enabledFunctions.includes('movement') ? 0.8 + this.bot.profile.effectiveAbilities.speed * 0.025 : 1.4; }
  get footprint() { return (2 * (0.95 + this.bot.profile.abilities.reach * 0.004) + 0.35) * this.bot.appearance.width * 0.55; }

  private inaccessible(barrier: CityBarrier, value = this.city.get(barrier.id)): boolean {
    const functions = this.bot.profile.enabledFunctions;
    switch (barrier.id) {
      case 'transport': return !value && !functions.includes('movement');
      case 'crossing': return 6 / this.speed > Number(value);
      case 'guidance': return !value && (!functions.includes('vision') || this.bot.profile.effectiveAbilities.routeMemory < 25);
      case 'sidewalk': return this.footprint + 0.15 > Number(value);
      default: return !value;
    }
  }
  inaccessibleFeature(id: BarrierId) { return this.inaccessible(cityBarriers.find(b => b.id === id)!); }

  get position(): RoutePoint {
    if (this.excursion) {
      const { points, leg, distance } = this.excursion;
      const a = points[leg]!, b = points[leg + 1]!;
      const t = distance / Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
    if (this.complete) return { ...cityRoute[cityRoute.length - 1]! };
    const a = cityRoute[this.edge]!, b = cityRoute[this.edge + 1]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const t = this.distanceOnEdge / length;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }

  update(seconds: number) {
    if (this.ready || this.complete || this.machine.run.status !== 'active' || seconds <= 0 || !Number.isFinite(seconds)) return;
    if (this.paused) { this.machine.advance(seconds, 'pausedSeconds'); return; }
    let remaining = seconds;
    while (remaining > 0 && !this.complete) {
      this.blocked = cityBarriers.find(barrier => barrier.edge === this.edge && this.inaccessible(barrier)) ?? null;
      if (this.blocked) {
        this.machine.transition('blocked');
        if (this.lastEncounter !== this.blocked.id) {
          this.machine.add('failures', 1);
          this.machine.record.failures.push({ kind: 'environment-barrier', barrier: this.blocked.id, runId: this.machine.run.id, time: this.machine.record.clock, resolvedAt: null });
          this.emit('blocked', { reason: this.blocked.explanation }, this.blocked.id);
        }
        this.lastEncounter = this.blocked.id;
        this.machine.advance(remaining, 'blockedSeconds');
        return;
      }
      if (!this.excursion && this.distanceOnEdge === 0) {
        const pickup = cityPowerups.find(item => item.node === this.edge && this.plannedPowerups.has(item.id)
          && !this.machine.run.pickups.some(collected => collected.id === item.id));
        if (pickup) {
          const anchor = cityRoute[this.edge]!;
          this.excursion = { id: pickup.id, points: [anchor, ...pickup.path, ...pickup.path.slice(0, -1).reverse(), anchor], leg: 0, distance: 0 };
        }
      }
      if (this.excursion) {
        const excursion = this.excursion;
        const a = excursion.points[excursion.leg]!, b = excursion.points[excursion.leg + 1]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        const distance = Math.min(length - excursion.distance, remaining * this.speed, Math.max(1e-8, this.metrics.stepsTaken + 1 - this.metrics.distance));
        excursion.distance += distance;
        const duration = distance / this.speed;
        this.advanceMovement(distance, duration, this.speed);
        remaining = Math.max(0, remaining - duration);
        if (excursion.distance >= length - 1e-8) {
          const pickup = cityPowerups.find(item => item.id === excursion.id)!;
          if (excursion.leg + 1 === pickup.path.length) this.recordPickup(pickup.id, pickup.kind);
          excursion.leg++; excursion.distance = 0;
          if (excursion.leg >= excursion.points.length - 1) { this.plannedPowerups.delete(excursion.id); this.excursion = null; }
        }
        this.syncTelemetry();
        continue;
      }
      const a = cityRoute[this.edge]!, b = cityRoute[this.edge + 1]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      // The elevator moves vertically on the same route at a steady cab speed.
      const speed = a.x === b.x && a.z === b.z ? 0.9 : this.speed;
      const nextStep = (this.stepCounter + 1) * TRAVEL_UNITS_PER_STEP - this.metrics.distance;
      const distance = Math.min(length - this.distanceOnEdge, remaining * speed, Math.max(1e-8, nextStep));
      this.distanceOnEdge += distance;
      const duration = distance / speed;
      this.advanceMovement(distance, duration, speed);
      remaining = Math.max(0, remaining - duration);
      if (this.distanceOnEdge >= length - 1e-8) {
        this.edge++; this.distanceOnEdge = 0;
        this.machine.add('segmentsCompleted', 1);
        this.emit('segment', { segment: this.edge - 1 });
        for (const pickup of cityPickups) if (pickup.node === this.edge) this.recordPickup(pickup.id, pickup.kind, pickup.value);
      }
      this.syncTelemetry();
    }
    if (this.complete) {
      this.machine.transition('arrived');
      this.machine.add('journeysCompleted', 1);
      this.machine.achievement('gallery-reached');
      if (this.metrics.failures === 0) this.machine.achievement('uninterrupted-route');
      this.emit('arrived', { distance: this.metrics.distance, steps: this.metrics.stepsTaken });
      this.machine.end('completed');
    }
  }

  private advanceMovement(distance: number, duration: number, speed: number) {
    this.machine.add('distance', distance);
    this.machine.advance(duration, 'movingSeconds');
      if (this.metrics.distance >= (this.stepCounter + 1) * TRAVEL_UNITS_PER_STEP - 1e-8) {
      this.machine.add('stepsTaken', 1);
      this.emit('step', { step: this.metrics.stepsTaken, distance: this.metrics.distance, speed });
    }
  }

  intervene(id: BarrierId) {
    if (!this.inaccessible(cityBarriers.find(b => b.id === id)!)) return false;
    return this.edit(id, this.suggestedValue(id));
  }
  suggestedValue(id: BarrierId): CityValue {
    if (id === 'sidewalk') return Math.ceil((this.footprint + 0.25) * 10) / 10;
    if (id === 'crossing') return Math.ceil((6 / this.speed + 1) * 10) / 10;
    return true;
  }
  canEdit(id: CityEditId) {
    if (pavementEdge(id) !== null) return this.ready || this.complete || !(this.edge === pavementEdge(id) && (this.distanceOnEdge > 0 || this.excursion));
    if (buildingProperty(id) || doorBuilding(id)) return true;
    if (this.ready || this.complete) return true;
    // Editing a surface occupied by the robot must not strand it mid-segment.
    if (id === 'transport' && (this.distanceOnEdge > 0 || this.excursion)) return false;
    return !(cityBarriers.find(b => b.id === id)!.edge === this.edge && this.distanceOnEdge > 0);
  }
  edit(id: CityEditId, value: CityValue) {
    if (!this.canEdit(id)) return false;
    const edit = this.city.set(id, value);
    if (!edit) return false;
    this.afterEdit(id, edit.before, edit.after, 'edit'); return true;
  }
  undo() {
    const edit = this.city.undoEdit;
    if (!edit || !this.canEdit(edit.id)) return false;
    this.city.undo(); this.afterEdit(edit.id, edit.after, edit.before, 'undo'); return true;
  }
  redo() {
    const edit = this.city.redoEdit;
    if (!edit || !this.canEdit(edit.id)) return false;
    this.city.redo(); this.afterEdit(edit.id, edit.before, edit.after, 'redo'); return true;
  }
  private afterEdit(id: CityEditId, before: CityValue, after: CityValue, action: string) {
    // Completed runs remain immutable; edits are captured in the next run snapshot.
    if (this.complete || this.machine.run.status !== 'active') return;
    this.emit('city_edit', { feature: id, before, after, action });
    if (this.ready) { this.machine.run.citySnapshot = this.city.snapshot(); return; }
    if (buildingProperty(id) || doorBuilding(id) || pavementEdge(id) !== null) return;
    const barrier = cityBarriers.find(b => b.id === id)!;
    const accessible = !this.inaccessible(barrier);
    if (accessible && this.inaccessible(barrier, before)) {
      this.machine.add('interventions', 1);
      const failure = [...this.machine.record.failures].reverse().find(item => item.runId === this.machine.run.id && item.barrier === id && item.resolvedAt === null);
      if (failure) failure.resolvedAt = this.machine.record.clock;
      this.emit('intervention', { action }, id as BarrierId);
      this.machine.achievement('access-improved');
    }
    if (accessible && this.blocked?.id === id) {
      this.blocked = null;
      if (!this.paused) this.machine.transition('following');
    }
    if (!accessible && this.lastEncounter === id && !this.blocked) this.lastEncounter = null;
  }

  recordPickup(id: string, kind: string, value = 1): boolean {
    if (this.complete || this.paused || this.blocked || this.machine.run.status !== 'active') return false;
    if (!id.trim() || !kind.trim() || !Number.isFinite(value) || value < 0) throw new Error('Invalid pickup');
    if (this.machine.run.pickups.some(item => item.id === id)) return false;
    this.machine.transition('collecting');
    this.machine.run.pickups.push({ id, kind, value, time: this.machine.record.clock });
    this.machine.add('pickups', 1); this.machine.add('pickupValue', value);
    this.emit('pickup', { id, kind, value });
    this.machine.achievement('first-pickup');
    this.machine.transition('following');
    return true;
  }

  leave() {
    this.machine.end('interrupted');
    this.machine.transition('designer');
  }

  restart(planning = false) {
    this.machine.end('interrupted');
    this.machine.transition('designer');
    this.edge = 0;
    this.distanceOnEdge = 0;
    this.isPaused = false;
    this.blocked = null;
    this.lastEncounter = null;
    this.excursion = null;
    this.plannedPowerups.clear();
    this.events.length = 0;
    this.machine.start(robotMetadata(this.bot), cityBarriers.filter(b => !this.inaccessible(b)).map(b => b.id), planning);
    this.machine.run.citySnapshot = this.city.snapshot();
    this.syncTelemetry();
    // City improvements persist; restarting demonstrates the accessible route.
  }
}
