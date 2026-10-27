export interface OverlayRect { left: number; top: number; right: number; bottom: number }

const intersects = (a: OverlayRect, b: OverlayRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Find clear space without moving a panel that already fits. Coordinates are CSS pixels. */
export function cityOverlayPosition(width: number, height: number, obstacles: readonly OverlayRect[], desiredHeight: number, previous?: OverlayRect) {
  let spaces: OverlayRect[] = [{ left: 12, top: 12, right: width - 12, bottom: height - 12 }];
  for (const obstacle of obstacles) {
    const blocked = { left: obstacle.left - 12, top: obstacle.top - 12, right: obstacle.right + 12, bottom: obstacle.bottom + 12 };
    spaces = spaces.flatMap(space => !intersects(space, blocked) ? [space] : [
      { ...space, right: Math.min(space.right, blocked.left) },
      { ...space, left: Math.max(space.left, blocked.right) },
      { ...space, bottom: Math.min(space.bottom, blocked.top) },
      { ...space, top: Math.max(space.top, blocked.bottom) },
    ].filter(rect => rect.right - rect.left >= 44 && rect.bottom - rect.top >= 44));
    // Remove contained spaces to keep repeated per-frame placement inexpensive.
    spaces = spaces.filter((a, i) => !spaces.some((b, j) => j !== i && b.left <= a.left && b.top <= a.top && b.right >= a.right && b.bottom >= a.bottom && (j < i || b.left < a.left || b.top < a.top || b.right > a.right || b.bottom > a.bottom)));
  }
  const preferredWidth = Math.min(340, width - 24);
  const anchor = previous ?? { left: width - preferredWidth - 24, top: height - desiredHeight - 24, right: width - 24, bottom: height - 24 };
  const candidates = spaces.map(space => {
    const w = Math.min(preferredWidth, space.right - space.left), h = Math.min(desiredHeight, space.bottom - space.top);
    const left = Math.max(space.left, Math.min(space.right - w, anchor.left));
    const top = Math.max(space.top, Math.min(space.bottom - h, anchor.top));
    return { left, top, right: left + w, bottom: top + h, area: w * h, wide: w >= Math.min(240, preferredWidth), distance: Math.hypot(left - anchor.left, top - anchor.top) };
  });
  candidates.sort((a, b) => Number(b.wide) - Number(a.wide) || b.area - a.area || a.distance - b.distance);
  const best = candidates[0];
  if (!best) return null;
  // Keep a safe position while the robot moves through the surrounding free space.
  if (previous && previous.right - previous.left >= best.right - best.left - 1 && previous.bottom - previous.top >= best.bottom - best.top - 1 && spaces.some(s => previous.left >= s.left && previous.right <= s.right && previous.top >= s.top && previous.bottom <= s.bottom)) return previous;
  return { left: best.left, top: best.top, right: best.right, bottom: best.bottom };
}
