import { trainRidePose, trainRideDuration, trainPhaseText } from '../city/steamTrainRide';
import type { ArtBot } from '../robot/botHistory';
import { RobotStateMachine, robotMetadata } from '../robot/robotState';
import { neighbours, robotSpeed, streetBetween, streetProblem, routeToGoal, crossingReachProblem, crossingButtonHeight, robotButtonReach, studioEntranceProblem, studioDoorTypes, robotFootprint } from '../city/proceduralCity';
import type { CityStreet, ProceduralCity, StudioDoorType } from '../city/proceduralCity';
import type { RoutePoint } from '../city/cityLayout';
import { TURN_RADIANS_PER_SECOND } from './cityJourney';
import { CityDimensions } from '../city/cityDimensions';
import { crossingSignal } from '../city/trafficSignals';

/** Follow a street route; drawing one is optional, while barriers still need help. */
export class PlannedJourney {
  /** Live positions and capabilities supplied by the city's wandering robots. */
  nearbyRobots: () => readonly { id: string; name: string; position: RoutePoint; buttonReach: number }[] = () => [];
  get nearbyHelp() {
    const street = this.currentStreet;
    if (this.ready || this.complete || !street || this.blocked?.id !== street.id || this.distanceOnEdge !== 0
      || !this.reachProblem(street) || this.hasRequestedCrossing(street)) return null;
    const position = this.position;
    return this.nearbyRobots().find(robot => Number.isFinite(robot.buttonReach)
      && robot.buttonReach + 1e-8 >= crossingButtonHeight(street)
      && Math.hypot(robot.position.x - position.x, robot.position.z - position.z) <= 3
      && Math.abs(robot.position.y - position.y) <= .5) ?? null;
  }
  get blockedExplanation() {
    const helper = this.nearbyHelp;
    return `${this.blocked?.reason ?? ''}${helper ? ` ${helper.name} is nearby and can reach the button. You can ask it to press the button for you.` : ''}`;
  }
  askNearbyRobot() {
    const helper = this.nearbyHelp, street = this.currentStreet;
    if (!helper || !street) return false;
    this.crossingRequestEdge = this.edge;
    this.machine.emit('crossing_requested', { street: street.id, buttonHeight: crossingButtonHeight(street), reach: helper.buttonReach, helper: helper.id }, street.id);
    this.machine.add('interventions', 1);
    this.machine.emit('intervention', { action: 'ask-nearby-robot', helper: helper.id }, street.id);
    this.blocked = null;
    if (!this.paused) this.machine.transition('following');
    return true;
  }
  /** The renderer can constrain route travel to distance actually allowed by physics. */
  constrainTravel?: (from: RoutePoint, to: RoutePoint, seconds: number) => { distance: number; blocker?: { id: string; reason: string } };
  syncTransport?: () => void;
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
  trainSeconds = 0;
  trainFrom: string | null = null;
  lastTrainPose: ReturnType<typeof trainRidePose> | null = null;
  get onTrainLink() { return !!this.world.steamTrain && !this.ready && !this.complete && this.currentStreet?.id === this.world.steamTrain.street; }
  private trainTrack() {
    const service = this.world.steamTrain;
    const reverse = this.currentStreet?.b === this.path[this.edge];
    return reverse ? { trackStart: service?.trackEnd, trackEnd: service?.trackStart } : service;
  }
  get trainPose() { return this.onTrainLink ? trainRidePose(this.node(this.path[this.edge]!), this.node(this.path[this.edge + 1]!), this.trainSeconds, this.trainTrack()) : null; }
  get trainStatus() { return this.trainPose ? trainPhaseText[this.trainPose.phase] : null; }
  paused = false;
  blocked: { id: string; reason: string } | null = null;
  private encountered: string | null = null;
  private crossingRequestEdge = -1;
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
    this.machine.record.condition.direction = this.heading;
    this.machine.depart(); this.collectAt(this.path[0]!); return true;
  }
  get position(): RoutePoint {
    if (this.trainPose) return this.trainPose.position;
    const a = this.node(this.path[this.edge]!);
    const b = this.world.nodes.find(n => n.id === this.path[this.edge + 1]);
    if (!b) return { x: a.x, y: a.y, z: a.z };
    const t = this.distanceOnEdge / Math.hypot(b.x - a.x, b.z - a.z);
    return { x: a.x + (b.x - a.x) * t, y: a.y, z: a.z + (b.z - a.z) * t };
  }
  get signalTime() { return this.machine.record.clock - this.machine.run.startedAt; }
  get waiting() { return this.machine.state === 'waiting'; }
  signal(street: CityStreet) { return crossingSignal(this.signalTime, street.crossingSeconds); }
  crossingLength(street: CityStreet) { const a = this.node(street.a), b = this.node(street.b); return Math.hypot(b.x - a.x, b.z - a.z); }
  hasCrossingCues(street: CityStreet) { return this.repaired.has(`signals:${street.id}`); }
  reachProblem(street: CityStreet) { return crossingReachProblem(street, this.bot); }
  hasRequestedCrossing(street: CityStreet) { return this.currentStreet?.id === street.id && this.crossingRequestEdge === this.edge; }
  lowerCrossingPanel(street: CityStreet) {
    return street.kind === 'crossing' && this.editDimension(`panel:${street.id}`, Math.min(.8, robotButtonReach(this.bot)));
  }
  crossingCue(street: CityStreet): 'visual' | 'audible' | 'tactile' | null {
    if (this.bot.profile.enabledFunctions.includes('vision')) return 'visual';
    if (!this.hasCrossingCues(street)) return null;
    return this.bot.profile.enabledFunctions.includes('hearing') ? 'audible' : 'tactile';
  }
  problem(street: CityStreet) {
    // A helper's button press lasts for this traversal; city settings stay intact.
    const crossing = street.kind === 'crossing' && this.hasRequestedCrossing(street)
      ? { ...street, buttonHeight: Math.min(crossingButtonHeight(street), robotButtonReach(this.bot)) } : street;
    const problem = streetProblem(crossing, this.bot, street.kind !== 'width' && street.kind !== 'crossing' && this.repaired.has(street.id), this.crossingLength(street));
    if (problem) return problem;
    return street.kind === 'crossing' && !this.crossingCue(street)
      ? `${this.bot.name} cannot see the green light. Add an audible beeper and tactile crossing cues.` : null;
  }
  get entranceProblem() { return studioEntranceProblem(this.world.studioEntrance, this.bot); }
  setStudioDoor(type: StudioDoorType) { return this.editDimension('studio:type', studioDoorTypes.indexOf(type)); }
  canEdit(id: string) { const street = id.replace(/^(width|crossing|signals|panel):/, ''); return !this.complete && (street !== this.currentStreet?.id || this.distanceOnEdge === 0) && (id !== 'communication' || this.ready || this.metrics.distance === 0); }
  editDimension(id: string, value: number) {
    if (!this.canEdit(id)) return false;
    const before = this.dimensions.get(id);
    if (before === undefined || !this.dimensions.set(id, value)) return false;
    this.history.push({ id, before }); this.dimensionChanged(id, before, value); return true;
  }
  private dimensionChanged(id: string, before: number, value: number, action = 'resize') {
    this.dimensionRevision++;
    const street = this.world.streets.find(s => `width:${s.id}` === id || `crossing:${s.id}` === id || `panel:${s.id}` === id);
    if (street && (street.kind === 'width' || street.kind === 'crossing')) {
      if (this.problem(street)) this.repaired.delete(street.id); else this.repaired.add(street.id);
      if (!this.problem(street)) {
        const failure = [...this.machine.record.failures].reverse().find(f => f.runId === this.machine.run.id && f.barrier === street.id && f.resolvedAt === null);
        if (failure) failure.resolvedAt = this.machine.record.clock;
        if (this.blocked?.id === street.id) { this.blocked = null; this.encountered = null; if (!this.paused) this.machine.transition('following'); }
      }
    }
    if (id.startsWith('studio:') && !this.entranceProblem) {
      const failure = [...this.machine.record.failures].reverse().find(f => f.runId === this.machine.run.id && f.barrier === 'studio-entrance' && f.resolvedAt === null);
      if (failure) failure.resolvedAt = this.machine.record.clock;
      if (this.blocked?.id === 'studio-entrance') { this.blocked = null; this.encountered = null; if (!this.paused) this.machine.transition('following'); }
    }
    this.machine.emit('city_edit', { feature: id, before, after: value, action });
    if (action === 'resize') { this.machine.add('interventions', 1); this.machine.emit('intervention', { action }, id); }
    this.savePlan();
  }
  repair(id: string): boolean {
    if (this.world.bicycleGarage && this.world.bicycles?.some(bike => bike.id === id)) {
      if (this.complete || this.repaired.has(id)) return false;
      this.history.push({ id, before: false }); this.applyRepair(id, true); return true;
    }
    if (id === 'studio-entrance' && this.world.studioEntrance && this.canEdit(id)) {
      if (this.world.studioEntrance.width < robotFootprint(this.bot) + .15) return this.editDimension('studio:width', Math.min(6, robotFootprint(this.bot) + .2));
      return this.setStudioDoor('automatic');
    }
    if (id.startsWith('signals:')) {
      const crossing = this.world.streets.find(s => `signals:${s.id}` === id && s.kind === 'crossing');
      if (!crossing || this.hasCrossingCues(crossing) || !this.canEdit(id)) return false;
      this.history.push({ id, before: false }); this.applyRepair(id, true); return true;
    }
    const street = this.world.streets.find(s => s.id === id);
    if ((!street && id !== 'communication') || street?.kind === 'clear' || this.repaired.has(id) || !this.canEdit(id)) return false;
    if (street?.kind === 'width') return this.editDimension(`width:${id}`, Math.min(6, Math.max(3.8, street.width)));
    if (street?.kind === 'crossing') {
      if (this.reachProblem(street)) return this.lowerCrossingPanel(street);
      if (!this.bot.profile.enabledFunctions.includes('vision') && !this.hasCrossingCues(street)) return this.repair(`signals:${id}`);
      return this.editDimension(`crossing:${id}`, Math.min(20, Math.max(street.crossingSeconds, this.crossingLength(street) / this.speed + 1)));
    }
    this.history.push({ id, before: false }); this.applyRepair(id, true); return true;
  }
  /** Set either exclusive state directly, keeping every change in undo history. */
  setFeature(id: string, enabled: boolean): boolean {
    const street = this.world.streets.find(s => s.id === id);
    const signal = this.world.streets.find(s => `signals:${s.id}` === id && s.kind === 'crossing');
    if (id !== 'communication' && !signal && (!street || !['curb', 'stairs', 'bridge', 'guidance'].includes(street.kind))) return false;
    const before = this.repaired.has(id);
    if (before === enabled || !this.canEdit(id)) return false;
    this.history.push({ id, before }); this.applyRepair(id, enabled); return true;
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
    const failure = [...this.machine.record.failures].reverse().find(f => f.runId === this.machine.run.id && f.barrier === id.replace(/^signals:/, '') && f.resolvedAt === null);
    const crossing = this.world.streets.find(s => `signals:${s.id}` === id);
    if (value && failure && (!crossing || !this.problem(crossing))) failure.resolvedAt = this.machine.record.clock;
    if ((this.blocked?.id === id || this.blocked?.id === id.replace(/^signals:/, '')) && value) { this.blocked = null; this.encountered = null; if (!this.paused) this.machine.transition('following'); }
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
  private telemetry() { this.machine.record.condition.direction = this.heading; this.machine.record.telemetry = { edge: this.edge, position: this.position, speed: this.speed, progress: this.path.length < 2 ? 0 : this.complete ? 1 : (this.edge + this.distanceOnEdge / Math.max(1, this.currentStreet ? Math.hypot(this.node(this.currentStreet.a).x - this.node(this.currentStreet.b).x, this.node(this.currentStreet.a).z - this.node(this.currentStreet.b).z) : 1)) / (this.path.length - 1) }; }
  private collectAt(id: string) {
    const node = this.node(id);
    if (!node.discovery || this.machine.run.pickups.some(p => p.id === id)) return;
    this.machine.transition('collecting');
    this.machine.run.pickups.push({ id, kind: node.discovery, value: 1, time: this.machine.record.clock });
    this.machine.add('pickups', 1); this.machine.add('pickupValue', 1);
    this.machine.emit('pickup', { id, kind: node.discovery, value: 1 }); this.machine.transition('following');
  }
  update(seconds: number) {
    const before = this.position;
    try { this.updateJourney(seconds); } finally {
      const condition = this.machine.record.condition;
      condition.direction = this.heading;
      condition.speed = Number.isFinite(seconds) && seconds > 0 ? Math.hypot(this.position.x - before.x, this.position.y - before.y, this.position.z - before.z) / seconds : 0;
      if (this.complete) condition.mood = 'happy';
    }
  }

  private updateJourney(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.ready || this.machine.run.status !== 'active') return;
    if (this.paused) { this.machine.advance(seconds, 'pausedSeconds'); return; }
    let remaining = seconds;
    while (remaining > 1e-9 && this.edge < this.path.length - 1) {
      const street = this.currentStreet!;
      const bicycle = this.world.bicycles?.find(bike => bike.street === street.id && !this.repaired.has(bike.id));
      const bicycleStop = bicycle ? Math.max(0, this.crossingLength(street) / 2 - 1 - robotFootprint(this.bot) / 2) : Infinity;
      const bicycleReason = bicycle && this.distanceOnEdge >= bicycleStop - 1e-8
        ? `A bicycle blocks the ${bicycle.location}. Move it into the bicycle garage so the robot can continue.` : null;
      const communication = !this.bot.profile.enabledFunctions.includes('communication') && !this.repaired.has('communication');
      const entranceStop = this.edge === this.path.length - 2 ? Math.max(0, this.crossingLength(street) - 2 - robotFootprint(this.bot) / 2 - .2) : Infinity;
      const entranceReason = this.distanceOnEdge >= entranceStop - 1e-8 ? this.entranceProblem : null;
      const reason = bicycleReason ?? entranceReason ?? (communication ? 'This bot needs a way to share its needs. Add a communication board at the workshop before it sets off.' : this.problem(street));
      if (reason) {
        const id = bicycleReason ? bicycle!.id : entranceReason ? 'studio-entrance' : communication ? 'communication' : street.id;
        this.blocked = { id, reason }; this.machine.transition('blocked');
        if (this.encountered !== id) {
          this.encountered = id; this.machine.add('failures', 1);
          this.machine.record.failures.push({ kind: 'environment-barrier', barrier: id, runId: this.machine.run.id, time: this.machine.record.clock, resolvedAt: null });
          this.machine.emit('blocked', { reason }, id);
        }
        this.machine.advance(remaining, 'blockedSeconds'); this.telemetry(); return;
      }
      this.blocked = null;
      if ((!this.constrainTravel || this.machine.state !== 'blocked') && !this.waiting) this.machine.transition('following');
      const a = this.node(this.path[this.edge]!), b = this.node(this.path[this.edge + 1]!);
      if (this.onTrainLink) {
        const duration = Math.min(remaining, trainRideDuration - this.trainSeconds);
        this.trainFrom = a.id;
        this.trainSeconds += duration;
        this.lastTrainPose = trainRidePose(a, b, this.trainSeconds, this.trainTrack());
        this.distanceOnEdge = this.crossingLength(street) * this.trainSeconds / trainRideDuration;
        this.heading = this.trainPose!.heading;
        this.machine.advance(duration, 'movingSeconds'); remaining -= duration;
        if (this.trainSeconds >= trainRideDuration) {
          this.machine.add('distance', this.crossingLength(street));
          this.machine.add('stepsTaken', Math.max(0, Math.floor(this.metrics.distance) - this.metrics.stepsTaken));
          this.edge++; this.distanceOnEdge = 0; this.trainSeconds = 0;
          this.machine.add('segmentsCompleted', 1); this.machine.emit('segment', { segment: this.edge - 1, transport: 'steam-train' }); this.collectAt(this.path[this.edge]!);
        }
        this.syncTransport?.();
        this.telemetry(); continue;
      }
      const target = Math.atan2(a.x - b.x, a.z - b.z);
      const delta = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      if (Math.abs(delta) > 1e-8) {
        const time = Math.min(remaining, Math.abs(delta) / TURN_RADIANS_PER_SECOND);
        this.heading += Math.sign(delta) * time * TURN_RADIANS_PER_SECOND;
        this.machine.advance(time, 'movingSeconds'); remaining -= time; continue;
      }
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      // Admit only at the kerb, with enough green remaining for the whole crossing.
      // Once admitted, finish the crossing rather than stopping in the road.
      if (street.kind === 'crossing' && this.distanceOnEdge === 0) {
        if (this.crossingRequestEdge !== this.edge) {
          this.crossingRequestEdge = this.edge;
          this.machine.emit('crossing_requested', { street: street.id, buttonHeight: this.dimensions.get(`panel:${street.id}`)!, reach: robotButtonReach(this.bot) }, street.id);
        }
        const signal = this.signal(street);
        if (!signal.green || signal.remaining + 1e-8 < length / this.speed) {
          this.machine.transition('waiting');
          const duration = Math.min(remaining, signal.untilGreen);
          this.machine.advance(duration, 'waitingSeconds'); remaining = Math.max(0, remaining - duration);
          this.telemetry(); continue;
        }
        this.machine.transition('following');
      }
      let distance = Math.min(length - this.distanceOnEdge, remaining * this.speed, this.metrics.stepsTaken + 1 - this.metrics.distance);
      if (this.entranceProblem && this.distanceOnEdge < entranceStop) distance = Math.min(distance, entranceStop - this.distanceOnEdge);
      if (bicycle && this.distanceOnEdge < bicycleStop) distance = Math.min(distance, bicycleStop - this.distanceOnEdge);
      const requestedDuration = distance / this.speed;
      let collision: { id: string; reason: string } | undefined;
      if (this.constrainTravel && distance > 0) {
        const from = this.position;
        const to = { ...from, x: from.x + (b.x - a.x) / length * distance, z: from.z + (b.z - a.z) / length * distance };
        const result = this.constrainTravel(from, to, distance / this.speed);
        distance = Number.isFinite(result.distance) ? Math.max(0, Math.min(distance, result.distance)) : 0;
        collision = result.blocker;
      }
      if (!collision && distance > 1e-4) this.machine.transition('following');
      // A collision sweep consumes its requested time even when a step or
      // contact slows it down. Do not retry a tiny remainder in the same tick.
      const duration = this.constrainTravel && !collision ? requestedDuration : distance / this.speed;
      this.distanceOnEdge += distance; this.machine.add('distance', distance); this.machine.advance(duration, 'movingSeconds'); remaining = Math.max(0, remaining - duration);
      if (this.metrics.distance >= this.metrics.stepsTaken + 1 - 1e-8) { this.machine.add('stepsTaken', 1); this.machine.emit('step', { step: this.metrics.stepsTaken, distance: this.metrics.distance, speed: this.speed }); }
      if (this.distanceOnEdge >= length - 1e-8) {
        this.edge++; this.distanceOnEdge = 0; this.machine.add('segmentsCompleted', 1);
        this.machine.emit('segment', { segment: this.edge - 1 }); this.collectAt(this.path[this.edge]!);
      }
      this.telemetry();
      if (collision || !this.constrainTravel && distance <= 1e-9) {
        this.blocked = collision ?? { id: street.id, reason: 'A solid object blocks this street. Move the nearby wall or widen the passage.' };
        this.machine.transition('blocked');
        if (this.encountered !== this.blocked.id) {
          this.encountered = this.blocked.id; this.machine.add('failures', 1);
          this.machine.record.failures.push({ kind: 'environment-barrier', barrier: this.blocked.id, runId: this.machine.run.id, time: this.machine.record.clock, resolvedAt: null });
          this.machine.emit('blocked', { reason: this.blocked.reason }, this.blocked.id);
        }
        this.machine.advance(remaining, 'blockedSeconds'); return;
      }
      if (this.encountered && distance > 1e-4) {
        const failure = [...this.machine.record.failures].reverse().find(f => f.runId === this.machine.run.id && f.barrier === this.encountered && f.resolvedAt === null);
        if (failure) failure.resolvedAt = this.machine.record.clock;
        this.encountered = null;
      }
    }
    if (this.edge === this.path.length - 1) {
      this.machine.transition('arrived'); this.machine.add('journeysCompleted', 1); this.machine.achievement('gallery-reached');
      this.machine.emit('arrived', { distance: this.metrics.distance, steps: this.metrics.stepsTaken }); this.machine.end('completed'); this.telemetry();
    }
  }
  restart() {
    this.machine.end('interrupted'); this.machine.transition('designer');
    this.edge = 0; this.distanceOnEdge = 0; this.trainSeconds = 0; this.lastTrainPose = null; this.trainFrom = null; this.paused = false; this.blocked = null; this.encountered = null; this.crossingRequestEdge = -1;
    this.machine.start(robotMetadata(this.bot), [...this.repaired], true);
    this.machine.run.environment.routeId = `procedural-${this.world.seed}`; this.savePlan(); this.telemetry();
  }
  leave() { this.machine.end('interrupted'); this.machine.transition('designer'); }
}
