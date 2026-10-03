import type { ArtBot } from '../robot/botHistory';
import { RobotStateMachine, robotMetadata } from '../robot/robotState';
import { neighbours, robotSpeed, streetBetween, streetProblem, routeToGoal } from '../city/proceduralCity';
import type { CityStreet, ProceduralCity } from '../city/proceduralCity';
import type { RoutePoint } from '../city/cityLayout';
import { TURN_RADIANS_PER_SECOND } from './cityJourney';
import { CityDimensions } from '../city/cityDimensions';

/** Follow a street route; drawing one is optional, while barriers still need help. */
export class PlannedJourney {
  readonly machine: RobotStateMachine;
  readonly bot: ArtBot;
  private path: string[];
  readonly repaired = new Set<string>();
  private history: { id: string; before: boolean | number }[] = [];
  readonly dimensions: CityDimensions;
  dimensionRevision = 0;
  edge = 0;
  distanceOnEdge = 0;
  heading = 0;
  paused = false;
  blocked: { id: string; reason: string } | null = null;
  private encountered: string | null = null;
  constructor(bot: ArtBot, readonly world: ProceduralCity) {
    this.dimensions = new CityDimensions(world);
    this.bot = { ...robotMetadata(bot), record: bot.record };
    this.path = [world.start];
    this.machine = new RobotStateMachine(bot.record, () => ({ edge: this.edge, position: this.position }));
    this.machine.start(robotMetadata(bot), [], true);
    this.machine.run.environment.routeId = `procedural-${world.seed}`;
    this.savePlan(); this.telemetry();
  }
  get route(): readonly string[] { return this.path; }
  get ready() { return this.machine.state === 'ready'; }
  get complete() { return this.machine.run.status === 'completed'; }
  get speed() { return robotSpeed(this.bot); }
  get metrics() { return this.machine.run.metrics; }
  get canStart() { return this.ready && !!routeToGoal(this.world, this.path.at(-1)!); }
  get nextStops() { return this.ready && this.path.at(-1) !== this.world.destination ? neighbours(this.world, this.path.at(-1)!) : []; }
  get currentStreet() { return streetBetween(this.world, this.path[this.edge]!, this.path[this.edge + 1]!); }
  get undoAvailable() { const last = this.history.at(-1); return !!last && this.canEdit(last.id); }
  get routeLength() {
    return this.path.slice(1).reduce((sum, id, i) => { const a = this.node(this.path[i]!), b = this.node(id); return sum + Math.hypot(b.x - a.x, b.z - a.z); }, 0);
  }
  private node(id: string) { return this.world.nodes.find(n => n.id === id)!; }
  appendStop(id: string) {
    if (!this.ready || !this.nextStops.some(n => n.id === id) || this.path.length >= 160) return false;
    this.path.push(id); this.savePlan(); return true;
  }
  undoStop() { if (!this.ready || this.path.length < 2) return false; this.path.pop(); this.savePlan(); return true; }
  clearRoute() { if (!this.ready) return false; this.path = [this.world.start]; this.savePlan(); return true; }
  setRoute(route: readonly string[]) {
    if (!this.ready || route.length < 1 || route.length > 160 || route[0] !== this.world.start || route.some((id, i) => !this.world.nodes.some(n => n.id === id) || i > 0 && !streetBetween(this.world, route[i - 1]!, id))) return false;
    const destinationIndex = route.indexOf(this.world.destination);
    if (destinationIndex !== -1 && destinationIndex !== route.length - 1) return false;
    this.path = [...route]; this.savePlan(); return true;
  }
  start() {
    if (!this.canStart) return false;
    const remaining = routeToGoal(this.world, this.path.at(-1)!)!;
    this.path.push(...remaining.slice(1));
    const a = this.node(this.path[0]!), b = this.node(this.path[1]!);
    this.heading = Math.atan2(a.x - b.x, a.z - b.z);
    this.savePlan();
    this.machine.depart(); this.collectAt(this.path[0]!); return true;
  }
  get position(): RoutePoint {
    const a = this.node(this.path[this.edge]!);
    const b = this.world.nodes.find(n => n.id === this.path[this.edge + 1]);
    if (!b) return { x: a.x, y: a.y, z: a.z };
    const t = this.distanceOnEdge / Math.hypot(b.x - a.x, b.z - a.z);
    return { x: a.x + (b.x - a.x) * t, y: a.y, z: a.z + (b.z - a.z) * t };
  }
  problem(street: CityStreet) { return streetProblem(street, this.bot, street.kind !== 'width' && street.kind !== 'crossing' && this.repaired.has(street.id)); }
  canEdit(id: string) { const street = id.replace(/^(width|crossing):/, ''); return !this.complete && (street !== this.currentStreet?.id || this.distanceOnEdge === 0) && (id !== 'transport' || this.ready || this.metrics.distance === 0); }
  editDimension(id: string, value: number) {
    if (!this.canEdit(id)) return false;
    const before = this.dimensions.get(id);
    if (before === undefined || !this.dimensions.set(id, value)) return false;
    this.history.push({ id, before }); this.dimensionChanged(id, before, value); return true;
  }
  private dimensionChanged(id: string, before: number, value: number, action = 'resize') {
    this.dimensionRevision++;
    const street = this.world.streets.find(s => `width:${s.id}` === id || `crossing:${s.id}` === id);
    if (street && (street.kind === 'width' || street.kind === 'crossing')) {
      if (this.problem(street)) this.repaired.delete(street.id); else this.repaired.add(street.id);
      if (!this.problem(street)) {
        const failure = [...this.machine.record.failures].reverse().find(f => f.runId === this.machine.run.id && f.barrier === street.id && f.resolvedAt === null);
        if (failure) failure.resolvedAt = this.machine.record.clock;
        if (this.blocked?.id === street.id) { this.blocked = null; this.encountered = null; if (!this.paused) this.machine.transition('following'); }
      }
    }
    this.machine.emit('city_edit', { feature: id, before, after: value, action });
    if (action === 'resize') { this.machine.add('interventions', 1); this.machine.emit('intervention', { action }, id); }
    this.savePlan();
  }
  repair(id: string) {
    const street = this.world.streets.find(s => s.id === id);
    if ((!street && id !== 'transport') || street?.kind === 'clear' || this.repaired.has(id) || !this.canEdit(id)) return false;
    if (street?.kind === 'width') return this.editDimension(`width:${id}`, Math.min(6, Math.max(3.8, street.width)));
    if (street?.kind === 'crossing') return this.editDimension(`crossing:${id}`, 20);
    this.history.push({ id, before: false }); this.applyRepair(id, true); return true;
  }
  undoRepair() {
    if (!this.undoAvailable) return false;
    const edit = this.history.pop()!;
    if (typeof edit.before === 'number') {
      const before = this.dimensions.get(edit.id)!;
      this.dimensions.set(edit.id, edit.before); this.dimensionChanged(edit.id, before, edit.before, 'undo');
    } else this.applyRepair(edit.id, edit.before);
    return true;
  }
  private applyRepair(id: string, value: boolean) {
    if (value) this.repaired.add(id); else this.repaired.delete(id);
    this.machine.emit('city_edit', { feature: id, before: !value, after: value, action: value ? 'repair' : 'undo' });
    if (value) { this.machine.add('interventions', 1); this.machine.emit('intervention', { action: 'repair' }, id); }
    const failure = [...this.machine.record.failures].reverse().find(f => f.runId === this.machine.run.id && f.barrier === id && f.resolvedAt === null);
    if (value && failure) failure.resolvedAt = this.machine.record.clock;
    if (this.blocked?.id === id && value) { this.blocked = null; this.encountered = null; if (!this.paused) this.machine.transition('following'); }
    this.savePlan();
  }
  setPaused(value: boolean) {
    if (this.ready || this.complete) return;
    this.paused = value; this.machine.transition(value ? 'paused' : this.blocked ? 'blocked' : 'following');
  }
  private savePlan() {
    this.machine.run.cityPlan = { world: structuredClone(this.world), route: [...this.path], improvements: [...this.repaired] };
    this.machine.run.citySnapshot = { ...this.dimensions.snapshot(), ...Object.fromEntries([...this.repaired].map(id => [id, true])) };
  }
  private telemetry() { this.machine.record.telemetry = { edge: this.edge, position: this.position, speed: this.speed, progress: this.path.length < 2 ? 0 : this.complete ? 1 : (this.edge + this.distanceOnEdge / Math.max(1, this.currentStreet ? Math.hypot(this.node(this.currentStreet.a).x - this.node(this.currentStreet.b).x, this.node(this.currentStreet.a).z - this.node(this.currentStreet.b).z) : 1)) / (this.path.length - 1) }; }
  private collectAt(id: string) {
    const node = this.node(id);
    if (!node.discovery || this.machine.run.pickups.some(p => p.id === id)) return;
    this.machine.transition('collecting');
    this.machine.run.pickups.push({ id, kind: node.discovery, value: 1, time: this.machine.record.clock });
    this.machine.add('pickups', 1); this.machine.add('pickupValue', 1);
    this.machine.emit('pickup', { id, kind: node.discovery, value: 1 }); this.machine.transition('following');
  }
  update(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.ready || this.machine.run.status !== 'active') return;
    if (this.paused) { this.machine.advance(seconds, 'pausedSeconds'); return; }
    let remaining = seconds;
    while (remaining > 1e-9 && this.edge < this.path.length - 1) {
      const street = this.currentStreet!;
      const transport = !this.bot.profile.enabledFunctions.includes('movement') && !this.repaired.has('transport');
      const reason = transport ? 'The drive is disabled. Add transport at the workshop before this robot can follow the line.' : this.problem(street);
      if (reason) {
        const id = transport ? 'transport' : street.id;
        this.blocked = { id, reason }; this.machine.transition('blocked');
        if (this.encountered !== id) {
          this.encountered = id; this.machine.add('failures', 1);
          this.machine.record.failures.push({ kind: 'environment-barrier', barrier: id, runId: this.machine.run.id, time: this.machine.record.clock, resolvedAt: null });
          this.machine.emit('blocked', { reason }, id);
        }
        this.machine.advance(remaining, 'blockedSeconds'); this.telemetry(); return;
      }
      this.blocked = null; this.encountered = null; this.machine.transition('following');
      const a = this.node(this.path[this.edge]!), b = this.node(this.path[this.edge + 1]!);
      const target = Math.atan2(a.x - b.x, a.z - b.z);
      const delta = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      if (Math.abs(delta) > 1e-8) {
        const time = Math.min(remaining, Math.abs(delta) / TURN_RADIANS_PER_SECOND);
        this.heading += Math.sign(delta) * time * TURN_RADIANS_PER_SECOND;
        this.machine.advance(time, 'movingSeconds'); remaining -= time; continue;
      }
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const distance = Math.min(length - this.distanceOnEdge, remaining * this.speed, this.metrics.stepsTaken + 1 - this.metrics.distance);
      const duration = distance / this.speed;
      this.distanceOnEdge += distance; this.machine.add('distance', distance); this.machine.advance(duration, 'movingSeconds'); remaining = Math.max(0, remaining - duration);
      if (this.metrics.distance >= this.metrics.stepsTaken + 1 - 1e-8) { this.machine.add('stepsTaken', 1); this.machine.emit('step', { step: this.metrics.stepsTaken, distance: this.metrics.distance, speed: this.speed }); }
      if (this.distanceOnEdge >= length - 1e-8) {
        this.edge++; this.distanceOnEdge = 0; this.machine.add('segmentsCompleted', 1);
        this.machine.emit('segment', { segment: this.edge - 1 }); this.collectAt(this.path[this.edge]!);
      }
      this.telemetry();
    }
    if (this.edge === this.path.length - 1) {
      this.machine.transition('arrived'); this.machine.add('journeysCompleted', 1); this.machine.achievement('gallery-reached');
      this.machine.emit('arrived', { distance: this.metrics.distance, steps: this.metrics.stepsTaken }); this.machine.end('completed'); this.telemetry();
    }
  }
  restart() {
    this.machine.end('interrupted'); this.machine.transition('designer');
    this.edge = 0; this.distanceOnEdge = 0; this.paused = false; this.blocked = null; this.encountered = null;
    this.machine.start(robotMetadata(this.bot), [...this.repaired], true);
    this.machine.run.environment.routeId = `procedural-${this.world.seed}`; this.savePlan(); this.telemetry();
  }
  leave() { this.machine.end('interrupted'); this.machine.transition('designer'); }
}
