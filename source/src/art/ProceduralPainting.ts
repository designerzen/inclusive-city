import type { RobotEvent } from '../robot/robotState';
import type { CreativePreferences } from '../robot/creativePreferences';
import { painterStyles } from './artistStyles';
import { paintRandom } from './paintRandom';
import { renderArtistStroke } from './artistBrushes';
export { paintRandom } from './paintRandom';

type Point = { x: number; y: number };
type PaintContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type PaintKind = 'step' | 'barrier' | 'repair' | 'discovery' | 'achievement' | 'incident' | 'arrival';
export interface PaintStroke {
  version: 1; sequence: number; kind: PaintKind; time: number;
  x: number; z: number; hue: number; size: number; shape: 'line' | 'circle' | 'diamond';
  points: [Point, Point, Point, Point]; width: number; opacity: number; seed: number;
  pigment: string; accent: string; rich: boolean;
  style?: CreativePreferences['artStyle'];
  expression?: { pressure: number; wetness: number; energy: number; tilt: number; lift: boolean };
}

const palettes = [
  ['#245b80', '#d17a51', '#d8ad60', '#668f85'],
  ['#3a5f62', '#bb624a', '#dbab70', '#7b7d9a'],
  ['#4e527e', '#c18287', '#cda456', '#5b8b8d'],
  ['#266d7c', '#d18760', '#ccac68', '#8b657f'],
] as const;

/** Small seeded PRNG: texture and geometry never depend on render timing or Math.random. */
const clamp = (value: number) => Math.max(0.09, Math.min(0.91, value));

/** Ordered event data becomes a permanent, normalized, JSON-safe painting score. */
export class ProceduralPainting {
  readonly marks: PaintStroke[] = [];
  readonly palette: readonly string[];
  private cursor = 0;
  private steps = 0;
  private rich = false;
  private colourful = false;
  private head: Point;
  private previousPosition: RobotEvent['position'] | null = null;
  private direction: number;
  private focus: Point;
  private focusLife = 0;
  private tension = 0;
  private joy = 0.3;
  lastAction = 'A fresh canvas · every step leaves paint';

  constructor(readonly seed: number, private brushScale = 1, private style?: CreativePreferences['artStyle']) {
    this.palette = style && style !== 'impressionist'
      ? painterStyles.find(item => item.id === (style === 'expressive' ? 'expressionist' : style))!.colours
      : palettes[seed % palettes.length]!;
    this.head = { x: 0.24 + (seed % 29) / 100, y: 0.58 };
    this.direction = seed % 628 / 100;
    this.focus = { x: 0.5, y: 0.5 };
  }

  consume(event: RobotEvent) {
    if (event.sequence <= this.cursor) return;
    this.cursor = event.sequence;
    if (event.type === 'pickup') {
      if (event.data.kind === 'art') this.rich = true;
      if (event.data.kind === 'colour') this.colourful = true;
    }
    let kind: PaintKind | null = null;
    if (event.type === 'step') kind = 'step';
    else if (event.type === 'blocked') kind = 'barrier';
    else if (event.type === 'intervention') kind = 'repair';
    else if (event.type === 'pickup') kind = 'discovery';
    else if (event.type === 'achievement') kind = 'achievement';
    else if (event.type === 'arrived') kind = 'arrival';
    else if (event.type === 'segment' || event.type === 'exploration'
      || (event.type === 'state_changed' && (event.data.to === 'paused' || event.data.from === 'paused'))
      || (event.type === 'journey_ended' && event.data.status === 'interrupted')) kind = 'incident';
    if (!kind) return;
    const random = paintRandom(this.seed ^ Math.imul(event.sequence, 2654435761));
    if (kind === 'barrier') { this.tension = 0.95; this.joy = 0.08; }
    else if (kind === 'repair' || kind === 'achievement') { this.tension *= 0.35; this.joy = 0.95; this.focusLife = 0; }
    else if (kind === 'discovery' || kind === 'arrival') { this.joy = 0.85; this.focusLife = 0; }
    const lift = kind === 'step' && random() < 0.17;
    let start = { ...this.head };
    let end = { ...start };
    if (kind === 'step') {
      this.steps++;
      // The brush wanders between changing focal areas, with occasional lifts and bold leaps.
      // It never follows a periodic orbit or connects every gesture into one continuous line.
      if (--this.focusLife <= 0) {
        this.focus = { x: 0.18 + random() * 0.64, y: 0.18 + random() * 0.64 };
        this.focusLife = 5 + Math.floor(random() * 12);
      }
      const turn = this.previousPosition ? Math.atan2(event.position.z - this.previousPosition.z, event.position.x - this.previousPosition.x) : 0;
      this.direction += (random() - 0.5) * (1.6 + this.tension) + Math.sin(turn - this.direction) * 0.24;
      this.direction += Math.sin(Math.atan2(this.focus.y - this.head.y, this.focus.x - this.head.x) - this.direction) * 0.4;
      if (lift) start = { x: clamp(this.focus.x + (random() - 0.5) * 0.22), y: clamp(this.focus.y + (random() - 0.5) * 0.24) };
      const stride = (0.02 + random() ** 2 * 0.14) * (1 + this.joy * 0.7) * (1 - this.tension * 0.35);
      const dx = Math.cos(this.direction) * stride + (this.focus.x - start.x) * 0.28;
      const dy = Math.sin(this.direction) * stride + (this.focus.y - start.y) * 0.28;
      end = { x: clamp(start.x + dx), y: clamp(start.y + dy) };
      if (end.x !== start.x + dx || end.y !== start.y + dy) this.direction += Math.PI * (0.6 + random() * 0.8);
      this.head = end;
      this.previousPosition = { ...event.position };
      this.tension *= 0.94; this.joy *= 0.98;
    } else if (kind === 'incident') {
      end = { x: clamp(start.x + (random() - 0.5) * 0.11), y: clamp(start.y + (random() - 0.5) * 0.11) };
    }
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const curl = (random() - 0.5) * (kind === 'step' ? 0.23 + this.joy * 0.12 : 0.12);
    const points: PaintStroke['points'] = [start,
      { x: clamp(start.x + (end.x - start.x) * 0.24 - curl), y: clamp(start.y + (end.y - start.y) * 0.4 + curl * 0.8) },
      { x: clamp(start.x + (end.x - start.x) * 0.78 + curl * 0.4), y: clamp(start.y + (end.y - start.y) * 0.65 - curl) }, end];
    const index = this.colourful ? Math.floor(random() * 4) : random() < 0.65 - this.joy * 0.25 ? 0 : 1;
    const pigment = kind === 'barrier' || (kind === 'step' && this.tension > 0.5) ? '#313c4c' : kind === 'repair' || kind === 'achievement' || kind === 'arrival' ? this.palette[2]! : this.palette[index]!;
    const pressure = 0.35 + random() * 0.8 + this.joy * 0.35;
    this.marks.push({ version: 1, sequence: event.sequence, kind, time: event.runTime,
      x: event.position.x, z: event.position.z, hue: this.colourful ? (this.seed % 360 + event.edge * 29 + this.steps * 7) % 360 : this.seed % 360,
      size: kind === 'step' ? 2 + random() * 4 : 7, shape: kind === 'step' ? this.colourful && this.steps % 3 === 0 ? 'circle' : 'line' : 'diamond',
      points, width: (0.012 + random() ** 2 * 0.085 + Math.min(distance, 0.2) * 0.07) * this.brushScale * (this.rich ? 1.2 : 1),
      opacity: 0.16 + random() * (this.rich ? 0.4 : 0.3), seed: Math.floor(random() * 4294967295), pigment,
      accent: this.palette[this.colourful ? 3 : 2]!, rich: this.rich,
      ...(this.style ? { style: this.style } : {}),
      expression: { pressure, wetness: random(), energy: Math.min(1, 0.2 + this.joy * 0.6 + this.tension * 0.6), tilt: random() * Math.PI, lift } });
    this.lastAction = {
      step: 'Walking · a new pigment stroke', barrier: 'Barrier · charcoal and fractured ink',
      repair: 'Access improved · a golden bloom', discovery: 'Discovery · a new colour blossom',
      achievement: 'Accomplishment · loose golden flourishes', incident: 'Incident · a restless ink gesture', arrival: 'Arrival · the finishing flourish',
    }[kind];
  }
}

function bezier(points: PaintStroke['points'], t: number): Point {
  const s = 1 - t;
  return { x: s ** 3 * points[0].x + 3 * s * s * t * points[1].x + 3 * s * t * t * points[2].x + t ** 3 * points[3].x,
    y: s ** 3 * points[0].y + 3 * s * s * t * points[1].y + 3 * s * t * t * points[2].y + t ** 3 * points[3].y };
}

/** Canvas-native paint, with ink grain, translucent pigment, and dry bristle edges. */
export class PaintingRenderer {
  private buffer: HTMLCanvasElement | OffscreenCanvas | null = null;
  private committed = 0;
  private progress = 0;
  constructor(private readonly painting: ProceduralPainting) {}

  static paper(context: PaintContext, width: number, height: number, seed: number) {
    context.fillStyle = '#f0e9dc'; context.fillRect(0, 0, width, height);
    const random = paintRandom(seed);
    context.save(); context.globalAlpha = 0.045;
    for (let i = 0; i < 1800; i++) {
      context.fillStyle = i % 2 ? '#79684f' : '#fffdf6';
      context.fillRect(random() * width, random() * height, 0.5 + random() * 1.5, 0.5 + random() * 1.5);
    }
    context.strokeStyle = '#897963'; context.lineWidth = 0.6;
    context.strokeRect(width * 0.035, height * 0.055, width * 0.93, height * 0.89);
    context.restore();
  }

  static stroke(context: PaintContext, width: number, height: number, stroke: PaintStroke, progress = 1) {
    if (progress <= 0) return;
    if (stroke.style && stroke.style !== 'impressionist') {
      renderArtistStroke(context, width, height, stroke, progress);
      return;
    }
    context.save();
    context.beginPath(); context.rect(width * 0.04, height * 0.065, width * 0.92, height * 0.87); context.clip();
    const random = paintRandom(stroke.seed);
    const expression = stroke.expression ?? { pressure: 0.8, wetness: 0.5, energy: 0.5, tilt: 0, lift: false };
    const p = stroke.points[0];
    const scale = Math.min(width, height);
    const point = (t: number) => { const q = bezier(stroke.points, t); return { x: q.x * width, y: q.y * height }; };
    const vibration = 7 + random() * 17;
    // Uneven water stains: overlapping lobes and a ragged perimeter, never a circular stamp.
    const stain = (cx: number, cy: number, rx: number, ry: number, colour: string, opacity: number) => {
      const rotation = random() * Math.PI;
      const outline = Array.from({ length: 15 }, (_, i) => {
        const angle = i / 15 * Math.PI * 2;
        const reach = 0.55 + random() * 0.6;
        return { x: Math.cos(angle) * rx * reach, y: Math.sin(angle) * ry * reach };
      });
      context.save(); context.translate(cx, cy); context.rotate(rotation);
      context.fillStyle = colour; context.globalAlpha = opacity;
      context.beginPath();
      const last = outline.at(-1)!, first = outline[0]!;
      context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
        context.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      context.closePath(); context.fill(); context.restore();
    };
    const path = (offset = 0, jitter = 0) => {
      context.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40 * progress;
        const q = point(t);
        const displacement = (Math.sin(t * vibration + offset * 9) + Math.sin(t * vibration * 1.71 + stroke.seed % 9) * 0.5) * jitter;
        if (i === 0) context.moveTo(q.x + offset, q.y + offset + displacement);
        else context.lineTo(q.x + offset, q.y + offset + displacement);
      }
    };
    context.lineCap = 'round'; context.lineJoin = 'round';
    if (stroke.kind === 'step' && stroke.style === 'impressionist') {
      // Short overlapping dabs mix colour optically instead of a continuous ribbon.
      for (let i = 0; i < 32; i++) {
        const t = random(), q = point(t), spread = stroke.width * scale;
        const x = q.x + (random() - 0.5) * spread * 2, y = q.y + (random() - 0.5) * spread * 2;
        const rx = scale * (0.003 + random() * 0.009), ry = scale * (0.002 + random() * 0.004);
        if (t > progress) continue;
        context.fillStyle = i % 4 ? stroke.pigment : stroke.accent;
        context.globalAlpha = Math.min(0.8, stroke.opacity + 0.2);
        context.beginPath(); context.ellipse(x, y, rx, ry, expression.tilt, 0, Math.PI * 2); context.fill();
      }
      context.restore(); return;
    }
    if (stroke.kind === 'step' || stroke.kind === 'incident') {
      // Pressure-shaped paint ribbons with irregular edges and feathered, broken bristles.
      const base = stroke.kind === 'incident' ? scale * 0.0015 : stroke.width * scale;
      context.strokeStyle = stroke.pigment;
      const edges = Array.from({ length: 65 }, () => 0.55 + random() * 0.65);
      for (let layer = 0; layer < 3; layer++) {
        const left: Point[] = [], right: Point[] = [];
        const count = Math.max(1, Math.ceil(64 * progress));
        for (let i = 0; i <= count; i++) {
          const t = Math.min(i / 64, progress), q = point(t);
          const before = point(Math.max(0, t - 0.005)), after = point(Math.min(1, t + 0.005));
          const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
          const nx = -(after.y - before.y) / length, ny = (after.x - before.x) / length;
          const pressure = (0.12 + Math.sin(Math.PI * t) ** 0.65) * expression.pressure;
          const radius = base * (1.6 - layer * 0.45) * pressure * edges[Math.min(i, 64)]!;
          left.push({ x: q.x + nx * radius, y: q.y + ny * radius });
          right.push({ x: q.x - nx * radius * (0.55 + edges[64 - Math.min(i, 64)]! * 0.5), y: q.y - ny * radius });
        }
        context.fillStyle = stroke.pigment;
        context.globalAlpha = stroke.opacity * (layer === 0 ? 0.12 : layer === 1 ? 0.35 : 0.65);
        const outline = [...left, ...right.reverse()];
        context.beginPath(); context.moveTo(outline[0]!.x, outline[0]!.y);
        for (let i = 1; i < outline.length; i++) {
          const q = outline[i]!, next = outline[(i + 1) % outline.length]!;
          context.quadraticCurveTo(q.x, q.y, (q.x + next.x) / 2, (q.y + next.y) / 2);
        }
        context.closePath(); context.fill();
      }
      for (let bristle = 0; bristle < (stroke.rich ? 18 : 10); bristle++) {
        const offset = (random() - 0.5) * base * 2;
        context.globalAlpha = 0.06 + random() * 0.28;
        context.lineWidth = Math.max(0.3, base * (0.008 + random() * 0.035));
        context.setLineDash([base * (0.1 + random()), base * (0.04 + random() * 0.3), base * (0.1 + random() * 0.5)]);
        path(offset, base * 0.1); context.stroke();
      }
      context.setLineDash([]);
      const tip = point(progress);
      if (expression.wetness > 0.4) {
        stain(tip.x, tip.y, base * (0.8 + expression.wetness), base * 0.65, stroke.pigment, 0.06 * progress);
        stain(tip.x - base * 0.3, tip.y, base * 0.5, base * 0.6, stroke.accent, 0.035 * progress);
      }
      for (let i = 0; i < 28; i++) {
        const t = random(), q = point(t), scatter = base * (1 + expression.energy * 3);
        const x = q.x + (random() - 0.5) * scatter, y = q.y + (random() - 0.5) * scatter;
        const size = 0.25 + random() ** 3 * base * 0.12;
        context.fillStyle = i % 5 === 0 ? stroke.accent : stroke.pigment;
        context.globalAlpha = 0.08 + random() * 0.35;
        if (t <= progress) { context.beginPath(); context.ellipse(x, y, size, size * 0.55, expression.tilt, 0, Math.PI * 2); context.fill(); }
      }
    } else {
      const radius = scale * (stroke.kind === 'arrival' ? 0.2 : stroke.kind === 'barrier' ? 0.09 : 0.12);
      const cx = p.x * width, cy = p.y * height;
      for (let i = 0; i < 6; i++) {
        stain(cx + (random() - 0.5) * radius, cy + (random() - 0.5) * radius,
          radius * (0.2 + random() * 0.6), radius * (0.15 + random() * 0.4),
          i % 3 ? stroke.pigment : stroke.accent, (0.04 + random() * 0.06) * progress);
      }
      const gestures = stroke.kind === 'barrier' ? 11 : stroke.kind === 'arrival' ? 16 : 7;
      for (let i = 0; i < gestures; i++) {
        const angle = expression.tilt + (random() - 0.5) * 2.8;
        const reach = radius * (0.3 + random());
        const x = cx + (random() - 0.5) * radius, y = cy + (random() - 0.5) * radius;
        context.strokeStyle = i % 4 === 0 ? stroke.accent : stroke.pigment;
        context.lineWidth = stroke.kind === 'barrier' ? 0.6 + random() * scale * 0.007 : scale * (0.0008 + random() * 0.004);
        context.globalAlpha = 0.18 + random() * 0.45;
        context.beginPath(); context.moveTo(x - Math.cos(angle) * reach * 0.3, y - Math.sin(angle) * reach * 0.3);
        if (stroke.kind === 'barrier') {
          context.lineTo(x + Math.cos(angle + 0.4) * reach * 0.4, y + Math.sin(angle - 0.3) * reach * 0.4);
          context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
        } else context.bezierCurveTo(x + Math.cos(angle + 1) * reach, y + Math.sin(angle + 1) * reach,
          x + Math.cos(angle - 0.9) * reach * 1.3, y + Math.sin(angle - 0.9) * reach,
          x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * 0.6);
        if (i / gestures < progress) context.stroke();
      }
      context.fillStyle = stroke.pigment;
      for (let i = 0; i < 64; i++) {
        const angle = random() * Math.PI * 2, reach = random() ** 0.5 * radius * 1.4;
        const x = cx + Math.cos(angle) * reach * 1.5, y = cy + Math.sin(angle) * reach * 0.7;
        const size = 0.3 + random() ** 3 * scale * 0.005;
        context.globalAlpha = (0.1 + random() * 0.5) * progress;
        context.beginPath(); context.ellipse(x, y, size, size * (0.3 + random()), angle, 0, Math.PI * 2); context.fill();
      }
    }
    context.restore();
  }

  static render(context: PaintContext, width: number, height: number, painting: ProceduralPainting) {
    PaintingRenderer.paper(context, width, height, painting.seed);
    for (const stroke of painting.marks) PaintingRenderer.stroke(context, width, height, stroke);
  }

  /** Completed strokes are cached; only the wet stroke is redrawn while its brush advances. */
  frame(context: PaintContext, seconds: number, immediate = false) {
    const { width, height } = context.canvas;
    if (!this.buffer || this.buffer.width !== width || this.buffer.height !== height) {
      // Workers own OffscreenCanvas; the browser fallback must also work when its 2D context is unsupported.
      this.buffer = typeof document === 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
      this.buffer.width = width; this.buffer.height = height;
      PaintingRenderer.paper(this.buffer.getContext('2d') as PaintContext, width, height, this.painting.seed);
      this.committed = 0; this.progress = 0;
    }
    const buffer = this.buffer.getContext('2d') as PaintContext;
    this.progress += Math.max(0, Math.min(seconds, 0.2)) * 4;
    while (this.committed < this.painting.marks.length && (immediate || this.progress >= 1)) {
      PaintingRenderer.stroke(buffer, width, height, this.painting.marks[this.committed]!);
      this.committed++; this.progress = Math.max(0, this.progress - 1);
    }
    context.clearRect(0, 0, width, height); context.drawImage(this.buffer, 0, 0);
    if (this.committed < this.painting.marks.length) PaintingRenderer.stroke(context, width, height, this.painting.marks[this.committed]!, this.progress);
    else this.progress = 0;
  }

  get settled() { return this.committed === this.painting.marks.length; }
}
