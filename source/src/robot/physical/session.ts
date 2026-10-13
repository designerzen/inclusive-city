import type { PlannedJourney } from '../../simulation/plannedJourney';
import type { PhysicalManifest } from './manifest';
import type { RobotTransport } from './transport';
import type { HardwareState, RobotCommand, RobotReport } from './protocol';
export type ConnectionState = 'connected' | 'preparing' | 'ready' | 'running' | 'held' | 'stopped' | 'stale' | 'fault' | 'disconnected' | 'complete';
export class RobotSession {
  state: ConnectionState = 'connected'; message = 'Connected. Calibrate and prepare a route.';
  report?: RobotReport;
  manifest?: PhysicalManifest;
  routeHash = 'unprepared'; readonly session = crypto.getRandomValues(new Uint32Array(1))[0]!.toString(16).padStart(8, '0');
  journey?: PlannedJourney;
  readonly observations: { receivedAt: number; report: RobotReport }[] = [];
  private commandId = 0; private sequence = -1; private timeMs = -1; private receivedAt = 0;
  private nextMarker = 0; private distanceMm = 0; private offsetMm = 0; private lastEncoder?: number;
  private appliedDistanceMm = 0;
  private pending = new Map<number, { type: RobotCommand['type']; resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private lease = false; private heartbeatInFlight = false; private lastHeartbeat = 0;
  private movementAuthorised = false; private closed = false;
  private confirmed = new Set<number>(); private pickupApplied = new Set<number>();
  private eventId = -1;
  private heldMarker?: number;
  get accessProblem() {
    const marker = this.heldMarker === undefined ? undefined : this.manifest?.markers[this.heldMarker];
    return marker ? this.journey?.physicalAccessProblem(marker.routeIndex, marker.code) ?? null : null;
  }
  adaptCity() {
    const marker = this.heldMarker === undefined ? undefined : this.manifest?.markers[this.heldMarker];
    if (this.state !== 'held' || !marker) return false;
    const result = this.journey?.adaptPhysicalStop(marker.routeIndex, marker.code) ?? false;
    this.message = this.accessProblem ?? 'City access improved. Check the table before resuming.'; this.changed(); return result;
  }
  constructor(readonly transport: RobotTransport, private changed: () => void = () => {}, private now = () => Date.now()) {
    transport.onReport = report => this.receive(report);
    transport.onDisconnect = reason => { if (!this.closed) this.fail(reason, 'disconnected'); };
  }
  get identity() { return this.transport.identity; }
  private envelope(type: RobotCommand['type'], payload?: unknown): RobotCommand {
    return { version: 1, hardwareId: this.identity.hardwareId, bootId: this.identity.bootId,
      session: this.session, routeHash: this.routeHash, commandId: ++this.commandId, type, ...(payload === undefined ? {} : { payload }) };
  }
  private async request(type: RobotCommand['type'], payload?: unknown) {
    if (this.closed) throw new Error('Robot session is closed.');
    const command = this.envelope(type, payload);
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.commandId); reject(new Error(`${type} was not confirmed by the robot.`));
        this.fail(`${type} acknowledgement timed out.`);
      }, type === 'prepare' ? 15000 : 4000);
      this.pending.set(command.commandId, { type, resolve, reject, timer });
      void this.transport.send(command).catch(error => {
        const item = this.pending.get(command.commandId);
        if (item) { clearTimeout(item.timer); this.pending.delete(command.commandId); item.reject(new Error(String(error))); }
        this.fail(String(error));
      });
    });
  }
  async prepare(manifest: PhysicalManifest, hash: string, journey: PlannedJourney) {
    if (this.state !== 'connected') throw new Error('Reconnect to prepare a new run.');
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid route hash.');
    if (manifest.calibration.maxSpeedMmS > this.identity.maxSpeedMmS) throw new Error('Speed exceeds the firmware limit.');
    this.state = 'preparing'; this.manifest = structuredClone(manifest); this.routeHash = hash;
    this.journey = journey; journey.reservePhysical(); this.changed();
    try {
      // Chunk the manifest; firmware assembles canonical JSON and verifies its full SHA-256.
      const json = JSON.stringify(manifest), chunks = Math.ceil(json.length / 800);
      for (let index = 0; index < chunks; index++) {
        if (this.state !== 'preparing') throw new Error('Preparation interrupted.');
        await this.request('prepare', { index, chunks, json: json.slice(index * 800, (index + 1) * 800) });
      }
      if (this.state !== 'preparing') throw new Error('Preparation interrupted.');
      this.state = 'ready'; this.message = 'Route confirmed. Place this robot at the start.';
      this.receivedAt = this.now(); this.changed();
    } catch (error) { this.fail(String(error)); throw error; }
  }
  async start() {
    if (this.state !== 'ready' || !this.manifest) throw new Error('Prepare the route first.');
    this.receivedAt = this.now(); this.lease = true; this.lastHeartbeat = this.receivedAt - this.manifest.calibration.leaseMs;
    try { await this.request('start', { leaseMs: this.manifest.calibration.leaseMs });
      if (!this.lease) throw new Error('Start interrupted.');
      this.movementAuthorised = true; this.journey?.beginPhysical(); this.state = 'running'; this.changed();
    } catch (error) { this.fail(String(error)); throw error; }
  }
  async hold() {
    this.movementAuthorised = false;
    await this.request('hold'); this.state = 'held'; this.message = 'Robot confirmed hold.'; this.changed();
  }
  async resume() {
    if (this.state !== 'held') throw new Error('Only a confirmed hold can resume.');
    if (this.accessProblem) throw new Error(this.accessProblem);
    await this.request('resume');
    if (!this.lease) throw new Error('Resume interrupted.');
    this.movementAuthorised = true; this.heldMarker = undefined; this.state = 'running'; this.changed();
  }
  async stop(reason = 'Operator stop.') {
    this.lease = false; this.movementAuthorised = false; this.message = `${reason} Awaiting stopped confirmation.`;
    this.changed();
    await this.request('stop'); this.state = 'stopped'; this.message = `${reason} Robot confirmed stopped.`; this.changed();
  }
  // Called by one fleet timer, not render frames. Never accumulate heartbeat writes.
  tick() {
    if (!this.lease || !this.manifest) return;
    const now = this.now();
    if (now - this.receivedAt > this.manifest.calibration.leaseMs) { this.fail('Telemetry expired; stopping lease withdrawn.', 'stale'); return; }
    if (!this.heartbeatInFlight && now - this.lastHeartbeat >= this.manifest.calibration.leaseMs / 3) {
      this.heartbeatInFlight = true; this.lastHeartbeat = now;
      void this.transport.send(this.envelope('heartbeat')).catch(error => this.fail(String(error))).finally(() => { this.heartbeatInFlight = false; });
    }
  }
  private receive(r: RobotReport) {
    if (this.closed || r.hardwareId !== this.identity.hardwareId) return;
    if (r.bootId !== this.identity.bootId) { this.fail('Robot rebooted. Reconnect and prepare a new run.'); return; }
    if (r.session !== this.session || r.routeHash !== this.routeHash) return;
    if (r.eventId !== undefined && r.eventId <= this.eventId) { this.ack(r.sequence, r.eventId); return; }
    if (r.sequence <= this.sequence) return;
    if (r.eventId !== undefined && r.eventId !== this.eventId + 1) { this.fail('A reliable robot event was missed.'); return; }
    if (r.timeMs < this.timeMs) { this.fail('Robot clock moved backwards.'); return; }
    const seconds = this.timeMs < 0 ? 0 : (r.timeMs - this.timeMs) / 1000;
    if (this.lease && this.manifest && seconds > this.manifest.calibration.leaseMs / 1000) { this.fail('Robot reporting interval exceeded the stopping lease.', 'stale'); return; }
    this.sequence = r.sequence; this.timeMs = r.timeMs; this.receivedAt = this.now(); this.report = r;
    this.observations.push({ receivedAt: this.receivedAt, report: structuredClone(r) });
    if (this.observations.length > 2000) this.observations.shift();
    if (r.type === 'result') {
      const item = this.pending.get(r.commandId!);
      if (item) {
        clearTimeout(item.timer); this.pending.delete(r.commandId!);
        const expected = { start: 'following', resume: 'following', hold: 'held', stop: 'stopped', prepare: 'ready' }[item.type as 'start' | 'resume' | 'hold' | 'stop' | 'prepare'];
        if (r.accepted && (!expected || r.state === expected)) item.resolve();
        else { item.reject(new Error(r.reason ?? 'Robot rejected command or reported an inconsistent state.')); this.fail(r.reason ?? 'Robot rejected command or reported an inconsistent state.'); return; }
      }
    }
    if (r.state === 'fault' || r.type === 'fault') { this.fail(r.reason ?? 'Hardware fault.'); return; }
    if (!this.manifest || !this.journey || this.state === 'preparing' || this.state === 'ready' || this.state === 'connected') { this.changed(); return; }
    if (this.state === 'stale' || this.state === 'fault' || this.state === 'disconnected' || this.state === 'stopped' || this.state === 'complete') { this.changed(); return; }
    if (r.state === 'following' && !this.movementAuthorised) {
      // A start/resume result is processed before its awaiting caller resumes.
      if (r.type !== 'result') this.fail('Robot moved without an acknowledged start/resume.');
      return;
    }
    if (r.speedMmS !== undefined && r.speedMmS > this.manifest.calibration.maxSpeedMmS * 1.05) { this.fail('Measured robot speed exceeds its calibrated limit.'); return; }
    if (r.distanceMm !== undefined && this.identity.encoders) {
      if (this.lastEncoder !== undefined && r.distanceMm < this.lastEncoder) { this.fail('Encoder distance moved backwards.'); return; }
      const candidate = r.distanceMm + this.offsetMm;
      if (candidate > this.manifest.lengthMm + this.manifest.calibration.markerToleranceMm) { this.fail('Reported distance exceeds the route.'); return; }
      const delta = this.lastEncoder === undefined ? r.distanceMm : r.distanceMm - this.lastEncoder;
      if (delta > this.manifest.calibration.maxSpeedMmS * (seconds + .2) + this.manifest.calibration.markerToleranceMm) { this.fail('Implausible encoder movement.'); return; }
      this.lastEncoder = r.distanceMm; this.distanceMm = Math.max(this.distanceMm, candidate);
      const expected = this.manifest.markers[this.nextMarker];
      if (r.type !== 'marker' && expected && this.distanceMm > expected.distanceMm + this.manifest.calibration.markerToleranceMm) {
        this.fail('Robot passed an unconfirmed barcode.'); return;
      }
    }
    if (r.type === 'marker') {
      if (r.markerIndex! < this.nextMarker && this.confirmed.has(r.markerIndex!)) { this.ack(r.sequence); this.changed(); return; }
      const marker = this.manifest.markers[this.nextMarker];
      if (!marker || marker.index !== r.markerIndex || marker.code !== r.code
        || this.identity.encoders && Math.abs((r.markerDistanceMm === undefined ? this.distanceMm : r.markerDistanceMm + this.offsetMm) - marker.distanceMm) > this.manifest.calibration.markerToleranceMm) {
        this.fail('Unexpected or ambiguous barcode. Reposition and prepare a new run.'); return;
      }
      this.confirmed.add(this.nextMarker++);
      this.distanceMm = Math.max(this.distanceMm, marker.distanceMm);
      if (this.lastEncoder !== undefined) {
        this.offsetMm = marker.distanceMm - (r.markerDistanceMm ?? this.lastEncoder);
        this.distanceMm = Math.max(this.distanceMm, this.lastEncoder + this.offsetMm);
      }
      if (marker.hold) {
        this.heldMarker = marker.index;
        this.movementAuthorised = false;
        if (r.state === 'held') { this.state = 'held'; this.message = this.accessProblem ?? `Hold at barcode ${marker.index + 1}. Check the physical environment before resuming.`; }
        else { this.fail('Robot passed a mandatory hold cue without stopping.'); return; }
      }
      this.eventId = r.eventId!; this.ack(r.sequence, r.eventId);
    }
    if (r.state === 'held') { this.state = 'held'; this.movementAuthorised = false; }
    if (r.state === 'stopped' && this.state !== 'held') { this.lease = false; this.movementAuthorised = false; this.state = 'stopped'; }
    const scale = this.manifest.calibration.mmPerCityUnit;
    const speed = Math.min(r.speedMmS ?? 0, this.manifest.calibration.maxSpeedMmS) / scale;
    this.journey.observePhysical(this.distanceMm / scale, r.state === 'following' ? speed : 0, seconds,
      r.state === 'ready' ? 'stopped' : r.state, r.reason);
    this.appliedDistanceMm = this.distanceMm;
    for (const marker of this.manifest.markers) if (this.confirmed.has(marker.index) && !this.pickupApplied.has(marker.index)
      && this.distanceMm >= marker.semanticDistanceMm) {
      this.pickupApplied.add(marker.index);
      if (marker.code >= 8 && marker.code <= 11) this.journey.physicalPickup(marker.nodeId);
    }
    if (r.type === 'arrived') {
      if (this.nextMarker !== this.manifest.markers.length || this.identity.encoders && this.manifest.lengthMm - this.distanceMm > this.manifest.calibration.markerToleranceMm || r.state !== 'stopped') {
        this.fail('Arrival was not corroborated by the route markers and stopped state.'); return;
      }
      this.lease = false; this.movementAuthorised = false; this.journey.finishPhysical(); this.state = 'complete'; this.message = 'Physical journey completed.';
      this.eventId = r.eventId!; this.ack(r.sequence, r.eventId);
    }
    this.changed();
  }
  private ack(sequence: number, eventId?: number) { void this.transport.send(this.envelope('ack', { sequence, eventId })).catch(error => this.fail(String(error))); }
  fail(reason: string, state: ConnectionState = 'fault') {
    this.lease = false; this.movementAuthorised = false; this.state = state; this.message = `${reason} Reconnect before another run.`;
    if (this.journey && this.manifest) this.journey.observePhysical(this.appliedDistanceMm / this.manifest.calibration.mmPerCityUnit, 0, 0, 'fault', reason);
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error(reason)); } this.pending.clear();
    if (!this.closed && state !== 'disconnected') void this.transport.send(this.envelope('stop')).catch(() => {});
    this.changed();
  }
  disconnect() {
    this.lease = false; this.movementAuthorised = false;
    this.fail('Session closed.', 'disconnected'); this.closed = true; this.transport.disconnect();
  }
}

export class RobotFleet {
  readonly sessions = new Map<string, RobotSession>();
  constructor(private changed: () => void = () => {}) {}
  add(transport: RobotTransport) {
    if (this.sessions.has(transport.identity.hardwareId)) { transport.disconnect(); throw new Error('This robot is already connected.'); }
    const session = new RobotSession(transport, this.changed); this.sessions.set(session.identity.hardwareId, session); this.changed(); return session;
  }
  tick() { for (const session of this.sessions.values()) session.tick(); }
  stopAll(reason: string) { return Promise.allSettled([...this.sessions.values()].filter(s => s.manifest).map(s => s.stop(reason))); }
  disconnectAll() { for (const session of this.sessions.values()) session.disconnect(); this.sessions.clear(); this.changed(); }
}
