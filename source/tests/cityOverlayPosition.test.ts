import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityOverlayPosition, type OverlayRect } from '../src/ui/cityOverlayPosition';

const overlaps = (a: OverlayRect, b: OverlayRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('overlay stays clear of the moving robot and controls across desktop and mobile viewports', () => {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 740], [740, 360]]) {
    const controls = [
      { left: 12, top: 12, right: width - 72, bottom: 56 },
      { left: 12, top: 72, right: Math.min(width - 12, 306), bottom: 126 },
      { left: 12, top: height - 128, right: Math.min(width - 12, 310), bottom: height - 12 },
    ];
    let previous: OverlayRect | undefined;
    for (let y = 140; y < height - 130; y += 43) for (let x = 20; x < width - 40; x += 37) {
      const robot = { left: x, top: y, right: x + 40, bottom: y + 60 };
      const label = { left: Math.max(8, x - 50), top: y - 55, right: Math.min(width - 8, x + 90), bottom: y - 18 };
      const obstacles = [...controls, robot, label];
      const placement = cityOverlayPosition(width, height, obstacles, 520, previous);
      assert.ok(placement, `${width}×${height}: robot at ${x},${y}`);
      for (const obstacle of obstacles) assert.equal(overlaps(placement, obstacle), false);
      assert.ok(placement.left >= 12 && placement.top >= 12);
      assert.ok(placement.right <= width - 12 && placement.bottom <= height - 12);
      assert.ok(placement.right - placement.left >= 44 && placement.bottom - placement.top >= 44);
      previous = placement;
    }
  }
});

test('a safe overlay stays still and moves when the robot enters its space', () => {
  const previous = { left: 1076, top: 356, right: 1416, bottom: 876 };
  const robot = { left: 300, top: 400, right: 340, bottom: 460 };
  assert.deepEqual(cityOverlayPosition(1440, 900, [robot], 520, previous), previous);
  const next = cityOverlayPosition(1440, 900, [{ left: 1200, top: 600, right: 1240, bottom: 660 }], 520, previous)!;
  assert.equal(overlaps(next, { left: 1200, top: 600, right: 1240, bottom: 660 }), false);
  assert.notDeepEqual(next, previous);
});

test('panel adapts to larger content and never chooses space covered by an extreme close-up', () => {
  const small = { left: 1000, top: 600, right: 1340, bottom: 800 };
  const large = cityOverlayPosition(1440, 900, [], 700, small)!;
  assert.equal(large.bottom - large.top, 700);
  assert.equal(cityOverlayPosition(390, 844, [{ left: -50, top: -50, right: 440, bottom: 900 }], 500), null);
});
