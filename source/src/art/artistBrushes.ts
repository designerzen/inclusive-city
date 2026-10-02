import type { PaintStroke } from './ProceduralPainting';
import { paintRandom } from './paintRandom';
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Distinct brush languages, including reproducible progressive textures. */
export function renderArtistStroke(ctx: Context, width: number, height: number, mark: PaintStroke, progress: number) {
  const random = paintRandom(mark.seed), scale = Math.min(width, height), breadth = Math.max(1, mark.width * scale);
  const event = mark.kind !== 'step' && mark.kind !== 'incident';
  const point = (t: number) => {
    const s = 1 - t, p = mark.points;
    return { x: (s ** 3 * p[0].x + 3 * s * s * t * p[1].x + 3 * s * t * t * p[2].x + t ** 3 * p[3].x) * width,
      y: (s ** 3 * p[0].y + 3 * s * s * t * p[1].y + 3 * s * t * t * p[2].y + t ** 3 * p[3].y) * height };
  };
  const start = point(0), tip = point(progress), centre = point(.5);
  const line = (segments = 32, jitter = 0) => {
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const p = point(i / segments * progress), x = p.x + (random() - .5) * jitter, y = p.y + (random() - .5) * jitter;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  const polygon = (points: { x: number; y: number }[], fill: string, opacity: number, outline = false) => {
    ctx.beginPath(); ctx.moveTo(points[0]!.x, points[0]!.y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.globalAlpha = opacity; ctx.fill();
    if (outline) { ctx.globalAlpha = opacity * .8; ctx.strokeStyle = '#273740'; ctx.lineWidth = scale * .0015; ctx.stroke(); }
  };
  ctx.save(); ctx.beginPath(); ctx.rect(width * .04, height * .065, width * .92, height * .87); ctx.clip();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = mark.pigment; ctx.fillStyle = mark.pigment;
  switch (mark.style) {
    case 'watercolour':
      for (let i = 0; i < 24; i++) {
        const t = random(), p = point(t), radius = breadth * (.4 + random());
        const x = p.x + (random() - .5) * breadth, y = p.y + (random() - .5) * breadth;
        const aspect = .35 + random() * .8, angle = random() * Math.PI;
        if (t > progress) continue;
        ctx.globalAlpha = mark.opacity * .09; ctx.beginPath(); ctx.ellipse(x, y, radius, radius * aspect, angle, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = mark.opacity * .12; ctx.lineWidth = .45; ctx.stroke();
      }
      ctx.globalAlpha = .08; ctx.lineWidth = breadth * .25; line(); break;
    case 'expressionist': case 'expressive':
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = .16 + i * .1; ctx.lineWidth = breadth * (1.4 - i * .25);
        ctx.strokeStyle = i % 3 ? mark.pigment : mark.accent; line(8, breadth * (1 + (mark.expression?.energy ?? .5)));
      }
      for (let i = 0; i < 12; i++) {
        const p = point(random()), x = p.x + (random() - .5) * breadth * 5, y = p.y + (random() - .5) * breadth * 5;
        const size = .5 + random() * breadth * .1; ctx.globalAlpha = .5 * progress; ctx.fillRect(x, y, size, size * 2);
      }
      break;
    case 'cubist': {
      const dx = breadth * (event ? 2.5 : 1), dy = breadth * (1 + random());
      polygon([start, { x: centre.x - dx, y: centre.y - dy }, tip, { x: centre.x + dx, y: centre.y + dy }], mark.pigment, (.25 + random() * .35) * progress, true);
      polygon([start, { x: centre.x + dx, y: centre.y - dy }, tip], mark.accent, .22 * progress, true);
      break;
    }
    case 'geometric': {
      const unit = scale / 18, x = Math.round(centre.x / unit) * unit, y = Math.round(centre.y / unit) * unit;
      const w = unit * (1 + Math.floor(random() * 4)), h = unit * (1 + Math.floor(random() * 3));
      ctx.globalAlpha = .8 * progress;
      if (event || mark.sequence % 5 === 0) { ctx.beginPath(); ctx.arc(x, y, w * .65 * progress, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(x - w / 2, y - h / 2, w * progress, h);
      ctx.strokeStyle = '#283234'; ctx.globalAlpha = .4 * progress; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      break;
    }
    case 'pointillist':
      for (let i = 0; i < (event ? 260 : 160); i++) {
        const t = random(), p = point(t), angle = random() * Math.PI * 2, reach = Math.sqrt(random()) * breadth * (event ? 2.5 : 1.5);
        const radius = scale * (.001 + random() * .003);
        ctx.fillStyle = i % 4 === 0 ? mark.accent : mark.pigment; ctx.globalAlpha = .4 + random() * .45;
        if (t <= progress) { ctx.beginPath(); ctx.arc(p.x + Math.cos(angle) * reach, p.y + Math.sin(angle) * reach, radius, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    case 'ink':
      ctx.strokeStyle = '#202629';
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = .07 + i * .035; ctx.lineWidth = breadth * (.35 - i * .035);
        ctx.setLineDash(i > 3 ? [breadth * .3, breadth * .08] : []); line(26, breadth * .08);
      }
      ctx.setLineDash([]);
      if (event) { ctx.globalAlpha = .55 * progress; ctx.fillStyle = '#a44439'; ctx.fillRect(start.x - breadth * .15, start.y - breadth * .15, breadth * .3, breadth * .3); }
      break;
    case 'surrealist': {
      ctx.globalAlpha = .15; ctx.lineWidth = Math.max(.7, breadth * .035); line();
      if (event || mark.sequence % 7 === 0) {
        const radius = Math.max(scale * .035, breadth * (event ? 2.5 : 1.9));
        const gradient = ctx.createRadialGradient(centre.x - radius * .2, centre.y - radius * .3, 0, centre.x, centre.y, radius);
        gradient.addColorStop(0, mark.accent); gradient.addColorStop(1, mark.pigment);
        ctx.fillStyle = gradient; ctx.globalAlpha = .9 * progress; ctx.beginPath(); ctx.ellipse(centre.x, centre.y, radius, radius * (mark.sequence % 2 ? .45 : 1), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f0e9dc'; ctx.globalAlpha = .65 * progress; ctx.beginPath(); ctx.arc(centre.x + radius * .3, centre.y - radius * .15, radius * .7, 0, Math.PI * 2); ctx.fill();
        if (mark.sequence % 2) { ctx.fillStyle = '#302b47'; ctx.beginPath(); ctx.arc(centre.x, centre.y, radius * .17, 0, Math.PI * 2); ctx.fill(); }
      }
      for (let i = 0; i < 6; i++) { const p = point(random()); ctx.globalAlpha = .3 * progress; ctx.fillStyle = mark.accent; ctx.fillRect(p.x + (random() - .5) * breadth * 6, p.y + (random() - .5) * breadth * 6, 1.2, 1.2); }
      break;
    }
    case 'pop': {
      const radius = breadth * (event ? 2 : 1), teeth = event ? 14 : 8;
      polygon(Array.from({ length: teeth * 2 }, (_, i) => {
        const angle = i / (teeth * 2) * Math.PI * 2, reach = radius * (i % 2 ? .55 : 1);
        return { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach };
      }), mark.sequence % 3 ? mark.pigment : mark.accent, .75 * progress, true);
      ctx.fillStyle = '#242a3b'; ctx.globalAlpha = .45 * progress;
      for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) { ctx.beginPath(); ctx.arc(centre.x + x * radius * .22, centre.y + y * radius * .22, Math.max(.5, radius * .035), 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'minimalist':
      ctx.lineWidth = .6 + scale * .001; ctx.globalAlpha = .22;
      if (event || mark.sequence % 5 === 0) {
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(tip.x, start.y); ctx.stroke();
        ctx.fillStyle = mark.accent; ctx.globalAlpha = .5 * progress; ctx.beginPath(); ctx.arc(tip.x, start.y, Math.max(1, breadth * .18), 0, Math.PI * 2); ctx.fill();
      } else { ctx.globalAlpha = .2 * progress; ctx.fillRect(tip.x, tip.y, 1, 1); }
      break;
    case 'collage': {
      const radius = breadth * (event ? 2.2 : 1.3), angle = random() * Math.PI;
      ctx.translate(centre.x, centre.y); ctx.rotate(angle);
      const torn = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2, reach = radius * (.8 + random() * .4); return { x: Math.cos(a) * reach * 1.5, y: Math.sin(a) * reach * .7 }; });
      ctx.shadowColor = '#3e332422'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1; polygon(torn, mark.pigment, .65 * progress); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = mark.accent; ctx.lineWidth = .6; ctx.globalAlpha = .45 * progress;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-radius, i * radius * .13); ctx.lineTo(radius * .65, i * radius * .13); ctx.stroke(); }
      break;
    }
  }
  ctx.restore();
}
