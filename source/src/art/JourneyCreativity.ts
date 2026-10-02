import type { SoundSequenceEntry } from '../audio/SoundEffect';
import type { ArtBot } from '../robot/botHistory';
import { normaliseArtist } from './artistStyles';
import type { ArtistPreferences } from './artistStyles';
import { JourneyMusicComposer } from './JourneyMusicComposer';
import type { RobotEvent } from '../robot/robotState';
import { PaintingRenderer, ProceduralPainting } from './ProceduralPainting';
import type { PaintStroke } from './ProceduralPainting';

export type ArtMark = PaintStroke;

/** Event-driven creative modes. Resolved AI accompaniment is captured in the score. */
export class JourneyCreativity {
  readonly seed: number;
  readonly bpm: number;
  music = false;
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
  readonly artist: ArtistPreferences;
  private readonly composer: JourneyMusicComposer;

  constructor(bot: ArtBot) {
    this.artist = normaliseArtist(bot.creative ? {
      painter: bot.creative.artStyle === 'expressive' ? 'expressionist' : bot.creative.artStyle,
      musician: bot.creative.musicStyle,
    } : bot.profile.artist);
    const identity = JSON.stringify([bot.id, bot.appearance, bot.profile.abilities, bot.profile.enabledFunctions, this.artist]);
    let seed = 2166136261;
    for (const character of identity) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
    this.seed = seed;
    this.composer = new JourneyMusicComposer(this.artist.musician, seed, bot.profile.abilities.speed);
    this.bpm = this.composer.bpm;
    this.music = bot.creative?.medium === 'music';
    this.composer.prepareAccompaniment();
    this.painting = new ProceduralPainting(seed, bot.appearance.width, bot.creative?.artStyle ?? this.artist.painter);
  }

  consume(event: RobotEvent) {
    if (event.sequence <= this.lastSequence) return;
    this.lastSequence = event.sequence;
    this.painting.consume(event);
    this.edge = event.edge;
    if (event.type === 'blocked') this.blocked = true;
    if (event.type === 'intervention') this.blocked = false;
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

  /** Time excludes paused time. Returns only newly composed phrases, with saved logical offsets. */
  advance(time: number, paused = false): SoundSequenceEntry[] {
    if (!this.music || paused || !Number.isFinite(time)) return [];
    const length = this.composer.beats * 60 / this.bpm;
    if (this.nextPhrase === null) this.nextPhrase = time;
    // Skip unseen measures after an interruption; never emit a catch-up burst.
    if (time - this.nextPhrase > length) this.nextPhrase = time;
    if (time + 1e-8 < this.nextPhrase) return [];
    const at = this.nextPhrase;
    this.nextPhrase += length;
    const result = this.composer.compose({ at, phrase: this.phrase, steps: this.steps, edge: this.edge, blocked: this.blocked, harmony: this.harmony });
    this.phrase++;
    this.score.push(...structuredClone(result));
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
    const bars = Math.round((last - first) / measure) + 1;
    const verses = await this.composer.studioVerses(first + bars * measure, bars, this.steps, this.edge);
    this.score.push(...structuredClone(verses));
    this.harmony = true;
    return this.score;
  }
}
