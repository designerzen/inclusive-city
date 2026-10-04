import type { RobotAppearance } from './appearance';
import type { RobotProfile } from './functions';
import type { SoundSequenceEntry } from '../audio/SoundEffect';
import type { ArtMark } from '../art/JourneyCreativity';
import type { ArtworkTitle } from '../art/ArtworkTitleGenerator';
import type { CreativePreferences } from './creativePreferences';
import type { ArtistPreferences } from '../art/artistStyles';
import type { ProceduralCity } from '../city/proceduralCity';
import { freshCondition, advanceCondition } from './robotCondition';
import type { RobotCondition } from './robotCondition';

export type RobotState = 'designer' | 'ready' | 'following' | 'waiting' | 'blocked' | 'paused' | 'collecting' | 'arrived';
export interface RobotMetadata {
  id: number; name: string; appearance: RobotAppearance; profile: RobotProfile;
  locomotion: 'wheels'; wheelCount: 4;
  presetId?: string; creative?: CreativePreferences;
}
export interface RobotMetrics {
  // stepsTaken is the counter of whole travel units, not animation frames or leg movements.
  distance: number; stepsTaken: number; segmentsCompleted: number;
  movingSeconds: number; blockedSeconds: number; pausedSeconds: number; waitingSeconds: number;
  failures: number; interventions: number; pickups: number; pickupValue: number;
  journeysStarted: number; journeysCompleted: number;
}
export type RobotEventType = 'state_changed' | 'journey_started' | 'journey_ended' | 'city_edit' | 'blocked' | 'collision' | 'intervention' | 'step' | 'segment' | 'pickup' | 'exploration' | 'crossing_requested' | 'achievement' | 'arrived';
export interface RobotEvent {
  sequence: number; botId: number; runId: number; time: number; runTime: number;
  type: RobotEventType; state: RobotState; edge: number;
  position: { x: number; y: number; z: number }; barrier?: string;
  data: Record<string, string | number | boolean>;
}
export interface RobotRun {
  id: number; metadata: RobotMetadata; status: 'active' | 'completed' | 'interrupted';
  environment: { routeId: string; accessibleFeatures: string[] };
  citySnapshot?: Record<string, boolean | number>;
  cityPlan?: { world: ProceduralCity; route: string[]; improvements: string[] };
  metrics: RobotMetrics; startedAt: number; endedAt: number | null;
  pickups: { id: string; kind: string; value: number; time: number }[];
  creative?: { seed: number; bpm: number; music: boolean; art: boolean; harmony: boolean; colour: boolean; score: SoundSequenceEntry[]; marks: ArtMark[]; title?: ArtworkTitle; artist?: ArtistPreferences };
}
export interface RobotRecord {
  condition: RobotCondition;
  schemaVersion: 1; metadata: RobotMetadata; state: RobotState; clock: number;
  telemetry: { edge: number; position: RobotEvent['position']; speed: number; progress: number } | null;
  metrics: RobotMetrics; runs: RobotRun[]; events: RobotEvent[];
  achievements: { id: string; runId: number; time: number }[];
  failures: { kind: 'environment-barrier'; barrier: string; runId: number; time: number; resolvedAt: number | null }[];
}

export const emptyMetrics = (): RobotMetrics => ({ distance: 0, stepsTaken: 0, segmentsCompleted: 0, movingSeconds: 0, blockedSeconds: 0, pausedSeconds: 0, waitingSeconds: 0, failures: 0, interventions: 0, pickups: 0, pickupValue: 0, journeysStarted: 0, journeysCompleted: 0 });
export function robotMetadata(bot: { id: number; name: string; appearance: RobotAppearance; profile: RobotProfile; presetId?: string; creative?: CreativePreferences }): RobotMetadata {
  return structuredClone({ id: bot.id, name: bot.name, appearance: bot.appearance, profile: bot.profile, locomotion: 'wheels', wheelCount: 4,
    ...(bot.presetId ? { presetId: bot.presetId } : {}), ...(bot.creative ? { creative: bot.creative } : {}) });
}
export function createRobotRecord(bot: Parameters<typeof robotMetadata>[0]): RobotRecord {
  return { condition: freshCondition(), schemaVersion: 1, metadata: robotMetadata(bot), state: 'designer', clock: 0, telemetry: null, metrics: emptyMetrics(), runs: [], events: [], achievements: [], failures: [] };
}

const transitions: Record<RobotState, readonly RobotState[]> = {
  designer: ['ready', 'following'], ready: ['following', 'designer'], following: ['waiting', 'blocked', 'paused', 'collecting', 'arrived', 'designer'],
  waiting: ['following', 'blocked', 'paused', 'designer'],
  blocked: ['following', 'paused', 'designer'], paused: ['following', 'blocked', 'designer'],
  collecting: ['following', 'arrived', 'designer'], arrived: ['following', 'designer'],
};

// The serializable record belongs to the cached bot; the controller owns no Babylon objects.
export class RobotStateMachine {
  constructor(readonly record: RobotRecord, private context: () => { edge: number; position: RobotEvent['position'] }) {}
  get run() { return this.record.runs.at(-1)!; }
  get state() { return this.record.state; }
  transition(next: RobotState) {
    const previous = this.state;
    if (previous === next) return;
    if (!transitions[previous].includes(next)) throw new Error(`Invalid robot transition: ${previous} → ${next}`);
    this.record.state = next;
    if (next !== 'following') this.record.condition.speed = 0;
    if (next === 'arrived') this.record.condition.mood = 'happy';
    this.emit('state_changed', { from: previous, to: next });
  }
  start(metadata: RobotMetadata, accessibleFeatures: string[] = [], planning = false) {
    if (this.record.runs.at(-1)?.status === 'active') this.end('interrupted');
    if (this.state !== 'designer') this.transition('designer');
    this.record.metadata = structuredClone(metadata);
    this.record.condition = freshCondition();
    this.record.runs.push({ id: this.record.runs.length + 1, metadata: structuredClone(metadata), environment: { routeId: 'city-v1', accessibleFeatures: [...accessibleFeatures] }, status: 'active', metrics: emptyMetrics(), startedAt: this.record.clock, endedAt: null, pickups: [] });
    if (planning) this.transition('ready');
    else this.depart();
  }
  depart() {
    this.add('journeysStarted', 1);
    this.transition('following');
    this.emit('journey_started');
  }
  add(key: keyof RobotMetrics, amount: number) { this.record.metrics[key] += amount; this.run.metrics[key] += amount; }
  advance(seconds: number, mode: 'movingSeconds' | 'blockedSeconds' | 'pausedSeconds' | 'waitingSeconds') {
    this.record.clock += seconds; this.add(mode, seconds);
    advanceCondition(this.record.condition, seconds, mode === 'movingSeconds' ? 'moving' : mode === 'blockedSeconds' ? 'blocked' : mode === 'waitingSeconds' ? 'waiting' : 'resting');
  }
  emit(type: RobotEventType, data: RobotEvent['data'] = {}, barrier?: string): RobotEvent {
    const event: RobotEvent = { sequence: this.record.events.length + 1, botId: this.record.metadata.id, runId: this.run.id, time: this.record.clock, runTime: this.record.clock - this.run.startedAt, type, state: this.state, ...structuredClone(this.context()), data: { ...data }, ...(barrier ? { barrier } : {}) };
    this.record.events.push(event);
    return event;
  }
  achievement(id: string) {
    if (this.record.achievements.some(item => item.id === id)) return;
    this.record.achievements.push({ id, runId: this.run.id, time: this.record.clock });
    this.emit('achievement', { id });
  }
  end(status: 'completed' | 'interrupted') {
    if (this.run.status !== 'active') return;
    this.run.status = status; this.run.endedAt = this.record.clock;
    this.emit('journey_ended', { status });
  }
  snapshot(): RobotRecord { return structuredClone(this.record); }
  eventsSince(sequence: number): RobotEvent[] { return structuredClone(this.record.events.filter(event => event.sequence > sequence)); }
}
