import type { SoundScore } from '../audio/SoundEffect';

/** All draws belong to a phrase/section, never the animation clock or call order. */
export class MusicRandom {
  constructor(private state: number) {}
  uniform() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(this.state ^ this.state >>> 15, this.state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
  normal() {
    return Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, this.uniform()))) * Math.cos(2 * Math.PI * this.uniform());
  }
  exponential(mean: number) { return -Math.log(1 - this.uniform()) * mean; }
  weighted<T>(choices: readonly T[], weights: readonly number[]): T {
    let threshold = this.uniform() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let i = 0; i < choices.length; i++) {
      threshold -= weights[i]!;
      if (threshold < 0) return choices[i]!;
    }
    return choices.at(-1)!;
  }
}

/** First-order chain learned from the robot's genre motif, with local-motion priors. */
export class MotifMarkovChain {
  private readonly states: number[];
  private readonly transitions = new Map<number, Map<number, number>>();
  constructor(motif: readonly number[]) {
    this.states = [...new Set(motif)].sort((a, b) => a - b);
    for (let i = 1; i < motif.length; i++) {
      const from = motif[i - 1]!, to = motif[i]!;
      const row = this.transitions.get(from) ?? new Map<number, number>();
      row.set(to, (row.get(to) ?? 0) + 1);
      this.transitions.set(from, row);
    }
  }
  next(from: number, random: MusicRandom) {
    const row = this.transitions.get(from);
    return random.weighted(this.states, this.states.map(to =>
      (row?.get(to) ?? 0) * 3 + 1 / (1 + Math.abs(to - from))));
  }
}

/** Elementary binary cellular automaton on a circular sixteenth-note grid. */
export function nextMusicCells(cells: readonly number[], rule: number): number[] {
  return cells.map((_, i) => {
    const neighbourhood = cells[(i + cells.length - 1) % cells.length]! * 4
      + cells[i]! * 2 + cells[(i + 1) % cells.length]!;
    return (rule >>> neighbourhood) & 1;
  });
}

export interface DevelopmentPlan {
  generation: number;
  genes: readonly number[];
  cells: readonly number[];
  density: number;
  fitness: readonly number[];
}
interface DevelopmentContext {
  phrase: number; beat: number; root: number; scale: readonly number[];
  motif: readonly number[]; harmony: boolean; restrained: boolean; sparse: boolean;
  cadence: boolean; swing: boolean;
}
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Bounded genetic search: elitism, parent selection, crossover and Markov-guided mutation.
 * Reconstructing from the seed makes speculative templates and out-of-order auditions harmless.
 */
export class MusicDevelopment {
  private readonly cache = new Map<string, DevelopmentPlan>();
  private readonly seed: number;
  constructor(seed: number, style: string, private readonly beats: number) {
    this.seed = [...style].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), seed | 0);
  }

  plan(motif: readonly number[], section: number): DevelopmentPlan {
    if (!motif.length) throw new RangeError('A development motif must contain notes.');
    const generation = clamp(Math.floor(section), 0, 12);
    // Motifs are small fixed genre hooks, not the unbounded stream of model-generated notes.
    const original = motif.slice(0, 16).map(value => clamp(Math.round(value), -4, 12));
    const key = `${section}:${original.join(',')}`;
    const cached = this.cache.get(key);
    if (cached) return structuredClone(cached);
    const random = new MusicRandom(this.seed);
    const chain = new MotifMarkovChain(original);
    const targetNovelty = .15 + generation * .025;
    const fitness = (genes: readonly number[]) => {
      const novelty = genes.filter((gene, i) => gene !== original[i]).length / genes.length;
      const leaps = genes.slice(1).reduce((sum, gene, i) => sum + Math.max(0, Math.abs(gene - genes[i]!) - 3), 0);
      const drift = genes.reduce((sum, gene, i) => sum + Math.abs(gene - original[i]!), 0) / genes.length;
      return 10 - Math.abs(novelty - targetNovelty) * 6 - leaps / genes.length - drift * .15;
    };
    const mutate = (parent: readonly number[], probability: number) => parent.map((gene, i) =>
      i > 0 && i < parent.length - 1 && random.uniform() < probability
        ? chain.next(parent[i - 1]!, random) : gene);
    let population = [original, ...Array.from({ length: 7 }, () => mutate(original, .35))];
    const scores: number[] = [];
    for (let epoch = 0; epoch <= generation; epoch++) {
      population.sort((a, b) => fitness(b) - fitness(a));
      scores.push(fitness(population[0]!));
      if (epoch === generation) break;
      const parents = population.slice(0, 3);
      population = [population[0]!, ...Array.from({ length: 7 }, () => {
        const a = random.weighted(parents, [4, 2, 1]), b = random.weighted(parents, [4, 2, 1]);
        const split = 1 + Math.floor(random.uniform() * Math.max(1, original.length - 2));
        return mutate(a.map((gene, i) => i < split ? gene : b[i]!), .2 + epoch * .015);
      })];
    }
    const rhythm = new MusicRandom(this.seed ^ 0x51ed270b);
    let cells = Array.from({ length: this.beats * 4 }, () => Number(rhythm.uniform() < .4));
    cells[0] = 1;
    // At most 32 synchronous steps even for a very long journey.
    for (let i = 0; i < section % 32; i++) cells = nextMusicCells(cells, 150);
    if (!cells.some(Boolean)) cells[0] = 1;
    const plan: DevelopmentPlan = { generation, genes: [...population[0]!], cells,
      // Every eighth section breathes; complexity is bounded rather than endlessly escalating.
      density: Math.min(.65, .15 + generation * .055) * (section % 8 === 7 ? .55 : 1), fitness: scores };
    this.cache.set(key, plan);
    if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value!);
    return structuredClone(plan);
  }

  develop(source: SoundScore['notes'], context: DevelopmentContext) {
    const lead = source.map(note => ({ ...note })), counter: SoundScore['notes'] = [];
    const section = Math.floor(context.phrase / 4);
    if (section < 1 || context.cadence || !source.length) return { lead, counter };
    const plan = this.plan(context.motif, section);
    const random = new MusicRandom(this.seed ^ Math.imul(context.phrase, 0x45d9f3b));
    const density = plan.density * (context.restrained ? .3 : 1) * (context.sparse ? .45 : 1);
    const length = this.beats * context.beat;
    const pitch = (degree: number) => clamp(context.root + 12
      + context.scale[((degree % context.scale.length) + context.scale.length) % context.scale.length]!
      + Math.floor(degree / context.scale.length) * 12, 36, 100);
    const nearest = (midi: number) => {
      const candidates = Array.from({ length: 4 }, (_, octave) => context.scale.map(interval => context.root + (octave - 1) * 12 + interval)).flat();
      return candidates.reduce((best, value) => Math.abs(value - midi) < Math.abs(best - midi) ? value : best);
    };
    // Opening bars recall the full hook; interior bars vary without moving genre rhythm anchors.
    if (context.phrase % 4 !== 0) {
      for (let i = 1; i < lead.length - 1; i++) {
        const note = lead[i]!;
        const cell = Math.floor(note.start / context.beat * 4) % plan.cells.length;
        if (plan.cells[cell] && random.uniform() < density) {
          const target = pitch(plan.genes[i % plan.genes.length]!);
          note.midi = clamp(nearest(note.midi + clamp(target - note.midi, -5, 5)), 0, 127);
          note.duration = Math.max(.001, Math.min(length - note.start, note.duration * clamp(1 + random.normal() * .12, .7, 1.3)));
          const next = lead[i + 1]!.start;
          const onset = note.start + context.beat / 4;
          if (lead.length + counter.length < 64 && onset < next && onset < length && random.uniform() < density * .5) {
            note.duration = Math.min(note.duration, onset - note.start);
            counter.push({ midi: pitch(plan.genes[(i + 1) % plan.genes.length]!), start: onset,
              duration: Math.max(.001, Math.min(context.beat / 5, next - onset, length - onset)) });
          }
        }
      }
    }
    // Ornamentation belongs to the lead, so it does not depend on a harmony discovery.
    lead.push(...counter.splice(0));
    for (const note of lead) note.duration = Math.max(.001, Math.min(note.duration, length - note.start));
    lead.sort((a, b) => a.start - b.start);
    if (context.harmony) {
      let cell = Math.max(1, Math.ceil(random.exponential(2 / density)));
      while (cell < plan.cells.length && counter.length < 12) {
        if (plan.cells[cell]) {
          const grid = context.swing && cell % 4 === 2 ? cell + 2 / 3 : cell;
          const start = grid * context.beat / 4;
          counter.push({ midi: pitch(plan.genes[(cell + context.phrase) % plan.genes.length]!) - 12, start,
            duration: Math.max(.001, Math.min(context.beat * clamp(.3 + random.normal() * .08, .12, .5), length - start)) });
        }
        cell += Math.max(1, Math.ceil(random.exponential(1 / density)));
      }
    }
    return { lead, counter };
  }
}
