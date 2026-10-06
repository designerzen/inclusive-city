import type { SoundSequenceEntry } from '../audio/SoundEffect';
import type { ArtBot } from '../robot/botHistory';
import { normaliseArtist } from './artistStyles';
import type { ArtistPreferences } from './artistStyles';
import { JourneyMusicComposer } from './JourneyMusicComposer';
import type { JourneyExpression } from './JourneyMusicComposer';
import type { RobotEvent } from '../robot/robotState';
import type { RobotMood } from '../audio/robotHarmony';
import { PaintingRenderer, ProceduralPainting } from './ProceduralPainting';
import type { PaintStroke } from './ProceduralPainting';

export type ArtMark = PaintStroke;

/** A new journey varies the composition; replay uses the seed already saved with its run. */
export function freshCompositionSeed(previous?: number, draw = () => crypto.getRandomValues(new Uint32Array(1))[0]!) {
  const seed = draw() >>> 0;
  return seed === previous ? (seed + 1) >>> 0 : seed;
}

/** Event-driven creative modes. Resolved AI accompaniment is captured in the score. */
export class JourneyCreativity {
  readonly seed: number;
  readonly bpm: number;
  music = true;
  art = true;
  harmony = false;
  colour = false;
  readonly painting: ProceduralPainting;
  get marks(): ArtMark[] { return this.painting.marks; }
  readonly score: SoundSequenceEntry[] = [];
  private nextPhrase: number | null = null;
  private phrase = 0;
  private steps = 0;
  private edge = 0;
  private blocked = false;
  private lastSequence = 0;
  private expression: JourneyExpression = { moving: false, turning: 0, slope: 0, paused: false, speed: 0 };
  private pending = new Map<string, number>();
  private collisions: RobotEvent[] = [];
  private previousMotion: { position: RobotEvent['position']; heading: number; time: number } | null = null;
  private lastTurn = -Infinity;
  private lastSlope = -Infinity;
  private mood: RobotMood | undefined;
  private moodBars = 0;
  private keyMood: RobotMood | null = null;
  private state: RobotEvent['state'] = 'ready';
  private scheduledHarmony: { at: number; phrase: number; blocked: boolean; mood?: RobotMood; keyMood: RobotMood | null }[] = [];
  readonly artist: ArtistPreferences;
  private readonly composer: JourneyMusicComposer;

  constructor(bot: ArtBot, compositionSeed?: number) {
    this.artist = normaliseArtist(bot.creative ? {
      painter: bot.creative.artStyle === 'expressive' ? 'expressionist' : bot.creative.artStyle,
      musician: bot.creative.musicStyle,
    } : bot.profile.artist);
    const identity = JSON.stringify([bot.id, bot.appearance, bot.profile.abilities, bot.profile.enabledFunctions, this.artist]);
    let seed = 2166136261;
    for (const character of identity) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
    this.seed = compositionSeed === undefined ? seed : compositionSeed >>> 0;
    this.composer = new JourneyMusicComposer(this.artist.musician, this.seed, bot.profile.abilities.speed);
    this.bpm = this.composer.bpm;
    this.composer.prepareAccompaniment();
    this.painting = new ProceduralPainting(this.seed, bot.appearance.width, bot.creative?.artStyle ?? this.artist.painter);
  }

  consume(event: RobotEvent) {
    if (event.sequence <= this.lastSequence) return;
    this.lastSequence = event.sequence;
    this.painting.consume(event);
    this.state = event.state;
    const moods: Partial<Record<RobotEvent['type'], RobotMood>> = {
      journey_started: 'determined', blocked: 'frustrated', collision: 'uncertain',
      intervention: 'relieved', pickup: 'happy', exploration: 'wonder',
      crossing_requested: 'uncertain', achievement: 'celebrating', arrived: 'celebrating',
      journey_ended: event.state === 'arrived' ? 'celebrating' : 'sad',
    };
    if (moods[event.type]) { this.mood = moods[event.type]; this.moodBars = 2; }
    // Coalesce repeated events within one frame; the phrase still reflects every state change.
    if (event.type === 'collision') this.collisions.push(structuredClone(event));
    else this.pending.set(event.type, 0);
    this.edge = event.edge;
    if (event.type === 'blocked') this.blocked = true;
    if (event.type === 'intervention') this.blocked = false;
    if (event.type === 'state_changed') {
      this.blocked = event.state === 'blocked';
      this.expression.paused = event.state === 'paused';
    }
    if (event.type === 'pickup') {
      const kind = event.data.kind;
      if (kind === 'music' || kind === 'harmony') {
        this.music = true;
        this.composer.prepareAccompaniment();
      }
      if (kind === 'art' || kind === 'colour') this.art = true;
      if (kind === 'harmony') this.harmony = true;
      if (kind === 'colour') this.colour = true;
    }
    if (event.type === 'step') {
      this.steps = Number(event.data.step);
    }
  }

  /** Actual rendered travel includes turning in place and the physics body's ramp height. */
  observeMotion(position: RobotEvent['position'], heading: number, time: number, paused = false) {
    const previous = this.previousMotion;
    this.previousMotion = { position: { ...position }, heading, time };
    this.expression.paused = paused;
    if (!previous || time <= previous.time) return;
    const elapsed = time - previous.time;
    const distance = Math.hypot(position.x - previous.position.x, position.z - previous.position.z);
    const turn = Math.atan2(Math.sin(heading - previous.heading), Math.cos(heading - previous.heading));
    const slope = distance > .001 ? (position.y - previous.position.y) / distance : 0;
    this.expression = { paused, moving: !paused && (distance > .001 || Math.abs(turn) > .001),
      speed: distance / elapsed, turning: Math.max(-1, Math.min(1, turn / elapsed)), slope: Math.max(-1, Math.min(1, slope)) };
    if (Math.abs(turn) > .005 && time - this.lastTurn > .65) {
      this.pending.set('turn', Math.sign(turn)); this.lastTurn = time;
    }
    if (Math.abs(slope) > .06 && time - this.lastSlope > .8) {
      this.pending.set(slope > 0 ? 'climb' : 'descend', 0); this.lastSlope = time;
    }
  }

  /** City music time keeps running while the robot waits. Look ahead to avoid gaps between bars. */
  advance(time: number, paused = false, ending = false): SoundSequenceEntry[] {
    if (!this.music || paused || !Number.isFinite(time)) return [];
    const length = this.composer.beats * 60 / this.bpm;
    if (this.nextPhrase === null) this.nextPhrase = time;
    // Skip unseen measures after an interruption; never emit a catch-up burst.
    if (time - this.nextPhrase > length) this.nextPhrase = time;
    const result: SoundSequenceEntry[] = [];
    const currentMood = this.blocked ? 'frustrated' : this.expression.paused ? 'calm'
      : this.moodBars > 0 ? this.mood : this.state === 'waiting' ? 'uncertain'
      : this.state === 'arrived' ? 'celebrating' : this.expression.moving ? 'determined' : undefined;
    const plannedKeyMood = this.phrase % 4 === 0 ? currentMood ?? null : this.keyMood;
    if (!ending) this.composer.prepareAccompaniment({ at: this.nextPhrase, phrase: this.phrase,
      steps: this.steps, edge: this.edge, blocked: this.blocked, harmony: this.harmony,
      mood: this.blocked ? 'frustrated' : this.expression.paused ? 'calm' : this.moodBars > 0 ? this.mood
        : this.state === 'waiting' ? 'uncertain' : this.expression.moving ? 'determined' : undefined,
      expression: this.expression, keyMood: plannedKeyMood });
    if (!ending && time + .15 >= this.nextPhrase) {
      this.keyMood = plannedKeyMood;
      const at = this.nextPhrase;
      this.nextPhrase += length;
      const mood = this.blocked ? 'frustrated' : this.expression.paused ? 'calm'
        : this.moodBars > 0 ? this.mood : this.state === 'waiting' ? 'uncertain'
        : this.state === 'arrived' ? 'celebrating' : this.expression.moving ? 'determined' : undefined;
      result.push(...this.composer.compose({ at, phrase: this.phrase, steps: this.steps, edge: this.edge,
        blocked: this.blocked, harmony: this.harmony, mood, keyMood: this.keyMood, expression: this.expression }));
      this.composer.remember(result);
      this.moodBars = Math.max(0, this.moodBars - 1);
      this.phrase++;
      this.scheduledHarmony.push({ at, phrase: this.phrase - 1, blocked: this.blocked, mood, keyMood: this.keyMood });
      this.scheduledHarmony = this.scheduledHarmony.slice(-2);
    }
    const beat = 60 / this.bpm;
    const barStart = this.nextPhrase - length;
    const at = barStart + Math.ceil((time - barStart) / (beat / 2)) * (beat / 2);
    const activeHarmony = [...this.scheduledHarmony].reverse().find(bar => bar.at <= at + 1e-8);
    const phrase = activeHarmony?.phrase ?? Math.max(0, this.phrase - 1);
    for (const [kind, direction] of this.pending) result.push(this.composer.react(kind, {
      at: Math.max(time, at), phrase, steps: this.steps, edge: this.edge, blocked: activeHarmony?.blocked ?? this.blocked,
      harmony: this.harmony, mood: ending && kind === 'arrived' ? 'celebrating' : activeHarmony?.mood,
      keyMood: activeHarmony ? activeHarmony.keyMood : this.keyMood, expression: this.expression,
    }, direction));
    // Each impact leaves its own saved musical answer, even within one frame.
    this.collisions.forEach((event, index) => {
      const reaction = this.composer.react('collision', { at: Math.max(time, at) + index * beat / 4,
        phrase, steps: this.steps, edge: this.edge, blocked: activeHarmony?.blocked ?? this.blocked,
        harmony: this.harmony, mood: activeHarmony?.mood, keyMood: activeHarmony ? activeHarmony.keyMood : this.keyMood,
        expression: this.expression }, Math.min(1, Number(event.data.speed) / 3));
      reaction.label = `journey:action:collision:${event.sequence}:${event.data.actor}:${event.data.other}`;
      result.push(reaction);
    });
    this.collisions = [];
    this.pending.clear();
    if (!result.length) return result;
    result.sort((a, b) => a.at - b.at);
    this.score.push(...structuredClone(result));
    this.score.sort((a, b) => a.at - b.at);
    return result;
  }

  draw(context: CanvasRenderingContext2D, width: number, height: number) {
    PaintingRenderer.render(context, width, height, this.painting);
  }

  /** Designer auditions share the finished journey's identity, key and melodic seed. */
  previewMusic(): SoundSequenceEntry[] { return this.composer.preview(); }
  previewEnhancedMusic(): Promise<SoundSequenceEntry[]> { return this.composer.enhancedPreview(); }

  /** Every studio arrival has a saved track, even without a musical discovery. */
  finishMusic() {
    if (!this.score.length) this.score.push(...structuredClone(this.composer.preview()));
    this.music = true;
    return this.score;
  }

  async extendStudioMusic() {
    this.finishMusic();
    const measure = this.composer.beats * 60 / this.bpm;
    const first = this.score[0]!.at;
    const last = Math.max(...this.score.map(entry => entry.at));
    const bars = Math.floor((last - first) / measure + 1e-8) + 1;
    const verses = await this.composer.studioVerses(first + bars * measure, bars, this.steps, this.edge, this.score);
    this.score.push(...structuredClone(verses));
    this.harmony = true;
    return this.score;
  }
}
