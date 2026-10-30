import polygonClipping from 'polygon-clipping';
import type { BodyModel, Point } from './bodyNet';
import { materialArea } from './bodyExposure';
import { shellPayload, shellQr, shellQrSvg } from './shellIdentity';

/** A QR sticker and its quiet zone must lie on one uncut, uncreased panel.
 * Five extra mm of clear stock surround the 36 mm printed label. */
export function bodyShellLabel(model: BodyModel, id: string, size = 36) {
  const payload = shellPayload(id);
  if (!model.geometryValid) return undefined;
  for (let face = 0; face < model.faces.length; face++) {
    const f = model.faces[face].flat, dx = f[1][0] - f[0][0], dy = f[1][1] - f[0][1], length = Math.hypot(dx, dy);
    const across: Point = [dx / length, dy / length], up: Point = [-across[1], across[0]];
    for (const t of [.25, .5, .75, .15, .85, .35, .65]) {
      const centre = [0, 1].map(k => ((f[0][k] + f[1][k]) * (1 - t) + (f[2][k] + f[3][k]) * t) / 2);
      const square = (width: number): Point[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [centre[0] + (across[0] * x + up[0] * y) * width / 2, centre[1] + (across[1] * x + up[1] * y) * width / 2]);
      const clear = size + 10, flat = square(size);
      if (materialArea(polygonClipping.intersection(model.exposure.panelPolygons[face], [square(clear)])) < clear * clear - .01) continue;
      return { id, payload, size, face, flat, across, up };
    }
  }
  return undefined;
}
export function shellLabelGuide(model: BodyModel, id: string) {
  const label = bodyShellLabel(model, id); if (!label) return '';
  const { across: a, up: b, size } = label, p = label.flat[0];
  const units = shellQr(id).count + 8;
  const artwork = shellQrSvg(id, size).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<g id="PRINT_SHELL_QR" stroke="none" transform="matrix(${a[0]} ${a[1]} ${b[0]} ${b[1]} ${p[0]} ${p[1]}) scale(${size / units})">${artwork}</g>`;
}
