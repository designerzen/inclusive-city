import { paintNoise, paintStream } from './paintField';
import type { PaintStroke } from './ProceduralPainting';

export const compositionFamilies = ['horizon', 'orbital', 'botanical', 'patchwork', 'calligraphy', 'constellation'] as const;
export type CompositionFamily = typeof compositionFamilies[number];
type Point = { x: number; y: number };
const bound = (v: number) => Math.max(.09, Math.min(.91, v));
const point = (x: number, y: number): Point => ({ x: bound(x), y: bound(y) });

/** Resolve the entire spatial gesture into the saved score; replay needs no generator. */
export function composeGesture(seed: number, family: CompositionFamily, step: number, energy: number) {
  const random = paintStream(seed, `gesture:${step}`), traits = paintStream(seed, 'layout');
  const mirror = traits() < .5, centre = { x: .35 + traits() * .3, y: .35 + traits() * .3 };
  let points: PaintStroke['points'], breadth = 1;
  let motif: PaintStroke['motif'];
  const phase = step % 24 / 24;
  switch (family) {
    case 'horizon': {
      const band = step % 5, y = .24 + band * .125;
      const x = .12 + random() * .22, length = .3 + random() * .42;
      const rise = (random() - .5) * .1;
      points = [point(x, y), point(x + length * .3, y - .08 * random()),
        point(x + length * .7, y + rise), point(x + length, y + rise)];
      breadth = band > 2 ? 1.6 : .65; motif = step % 7 === 0 ? 'ridge' : undefined;
      break;
    }
    case 'orbital': {
      const angle = phase * Math.PI * 2 + traits() * 6, sweep = .35 + random() * .9;
      const radius = .14 + (Math.floor(step / 24) % 3) * .075;
      const at = (a: number) => point(centre.x + Math.cos(a) * radius, centre.y + Math.sin(a) * radius * 1.15);
      points = [at(angle), at(angle + sweep * .33), at(angle + sweep * .66), at(angle + sweep)];
      breadth = .5; motif = step % 9 === 0 ? 'disc' : undefined; break;
    }
    case 'botanical': {
      const branch = step % 9, root = point(centre.x, .84), top = point(.15 + branch / 8 * .7, .15 + random() * .35);
      const t = .15 + random() * .7;
      const start = point(root.x + (top.x - root.x) * t, root.y + (top.y - root.y) * t);
      const side = branch % 2 ? 1 : -1;
      points = [start, point(start.x + side * .06, start.y - .09),
        point(top.x - side * .1, top.y + .08), top];
      breadth = .4; motif = step % 3 === 0 ? 'leaf' : undefined; break;
    }
    case 'patchwork': {
      const column = step % 4, row = Math.floor(step / 4) % 3;
      const x = .18 + column * .205, y = .23 + row * .26;
      points = [point(x - .07, y + .05), point(x - .04, y - .08), point(x + .06, y + .08), point(x + .09, y - .04)];
      breadth = 1.7; motif = step % 3 === 0 ? 'plane' : undefined; break;
    }
    case 'calligraphy': {
      const x = .24 + (Math.floor(step / 12) % 3) * .24;
      const y = .15 + (step % 12) / 12 * .68;
      const sway = (paintNoise(seed, step * .14, 4) - .5) * .28;
      points = [point(x + sway, y), point(x - .18, y + .08), point(x + .18, y + .13), point(x + sway, y + .2)];
      breadth = step % 4 === 0 ? 1.8 : .28; break;
    }
    case 'constellation': {
      const cluster = step % 5, angle = cluster / 5 * Math.PI * 2 + traits() * 3;
      const x = centre.x + Math.cos(angle) * .27, y = centre.y + Math.sin(angle) * .28;
      const spread = .04 + random() * .08;
      points = [point(x, y), point(x - spread, y - spread), point(x + spread, y - spread), point(x + spread, y)];
      breadth = .6; motif = step % 7 === 0 ? 'disc' : undefined; break;
    }
  }
  // Hand variation responds to the journey without erasing the composition's silhouette.
  points = points.map(p => point(mirror ? 1 - p.x : p.x, p.y + (random() - .5) * (.012 + energy * .025))) as PaintStroke['points'];
  return { points, breadth, motif };
}

/** Sparse structural marks give each family a recognisable large-scale silhouette. */
export function renderComposition(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number, height: number, mark: PaintStroke, progress: number) {
  if (!mark.motif && !mark.ground) return;
  const scale = Math.min(width, height), random = paintStream(mark.seed, 'structure');
  ctx.save(); ctx.beginPath(); ctx.rect(width * .04, height * .065, width * .92, height * .87); ctx.clip();
  if (mark.ground) {
    ctx.fillStyle = mark.ground; ctx.globalAlpha = progress;
    ctx.fillRect(width * .04, height * .065, width * .92, height * .87);
  }
  ctx.fillStyle = mark.pigment; ctx.strokeStyle = mark.accent;
  ctx.globalAlpha = mark.opacity * .65 * progress;
  const p = mark.points[0], q = mark.points[3], x = p.x * width, y = p.y * height;
  const radius = scale * (.025 + random() * .065);
  ctx.beginPath();
  switch (mark.motif) {
    case 'ridge':
      ctx.moveTo(x, y); ctx.bezierCurveTo(mark.points[1].x * width, mark.points[1].y * height,
        mark.points[2].x * width, mark.points[2].y * height, q.x * width, q.y * height);
      ctx.lineTo(q.x * width, (q.y + .12) * height); ctx.lineTo(x, y + height * .1); ctx.closePath(); ctx.fill(); break;
    case 'disc':
      ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= .6; ctx.lineWidth = scale * .002;
      ctx.beginPath(); ctx.arc(x, y, radius * 1.35, 0, Math.PI * (1.2 + random() * .6)); ctx.stroke(); break;
    case 'leaf': {
      const dx = (q.x - p.x) * width, dy = (q.y - p.y) * height;
      ctx.moveTo(x, y); ctx.bezierCurveTo(x + dx * .2 - dy * .3, y + dy * .2 + dx * .3,
        x + dx * .8 - dy * .25, y + dy * .8 + dx * .25, q.x * width, q.y * height);
      ctx.bezierCurveTo(x + dx * .7 + dy * .15, y + dy * .7 - dx * .15,
        x + dx * .2 + dy * .2, y + dy * .2 - dx * .2, x, y); ctx.fill(); break;
    }
    case 'plane':
      ctx.translate(x, y); ctx.rotate((random() - .5) * .4);
      ctx.moveTo(-radius, -radius); ctx.lineTo(radius * 1.6, -radius * .7);
      ctx.lineTo(radius * 1.4, radius); ctx.lineTo(-radius * .8, radius * .8); ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
}
