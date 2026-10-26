import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configurationProjection } from '../src/city/configurationProjection';
import { defaultProjectionSettings } from '../src/city/projectionSettings';

test('traffic light has one crossing barcode centred midway on its straight line', () => {
  const projection = configurationProjection('traffic-light', defaultProjectionSettings);
  assert.equal(projection.markers.length, 1);
  const marker = projection.markers[0]!;
  assert.equal(marker.code, 4);
  assert.equal(marker.bars.length, 6);
  assert.ok(marker.bars.every(bar => bar.z === 0));
  const first = marker.bars[0]!, last = marker.bars.at(-1)!;
  assert.ok(Math.abs(first.x - first.width / 2 + last.x + last.width / 2) < 1e-8);
});

test('figure eight closes its loop and puts both complete barcodes before the crossing', () => {
  const projection = configurationProjection('figure-eight', defaultProjectionSettings);
  assert.deepEqual(projection.points[0], projection.points.at(-1));
  assert.equal(projection.markers.length, 2);
  projection.markers.forEach((marker, index) => {
    assert.equal(marker.code, 13);
    assert.equal(marker.bars.length, 6);
    assert.ok(marker.bars.every(bar => bar.z < 0 && (index === 0 ? bar.x < 0 : bar.x > 0)));
    const last = marker.bars.at(-1)!;
    assert.ok(Math.hypot(last.x, last.z) - last.width / 2 >= defaultProjectionSettings.barcodeWidth / 2);
  });
});

test('oversized barcodes shrink only when fitting is enabled', () => {
  const settings = { ...defaultProjectionSettings, shortLength: 3, longLength: 6, markerLength: 12, barGap: 3 };
  assert.ok(configurationProjection('figure-eight', settings).scale < 1);
  assert.throws(() => configurationProjection('figure-eight', { ...settings, autoFit: false }), /does not fit/);
});

test('signals stay beside their own complete barcode and clear of every track segment', () => {
  for (const configuration of ['traffic-light', 'figure-eight'] as const) {
    for (const settings of [defaultProjectionSettings, { ...defaultProjectionSettings, barcodeWidth: 10, lineWidth: 3, shortLength: 3, longLength: 6, markerLength: 12, barGap: 3 }]) {
      const projection = configurationProjection(configuration, settings);
      assert.equal(projection.signals.length, projection.markers.length);
      for (const [index, signal] of projection.signals.entries()) {
        const marker = projection.markers[index]!;
        assert.equal(signal.code, marker.code);
        const first = marker.bars[0]!, last = marker.bars.at(-1)!;
        const dx = last.x - first.x, dz = last.z - first.z, length = Math.hypot(dx, dz);
        // Placement starts at this barcode and finds nearby free space.
        assert.ok(Math.hypot(signal.x - signal.anchor.x, signal.z - signal.anchor.z) < Math.max(settings.barcodeWidth, settings.lineWidth) / 2 + 8);
        assert.ok(Math.hypot(signal.x - signal.anchor.x, signal.z - signal.anchor.z) >= settings.barcodeWidth / 2 + 2.3 - 1e-8);
        for (const [i, b] of projection.points.entries()) {
          if (!i) continue;
          const a = projection.points[i - 1]!, vx = b.x - a.x, vz = b.z - a.z;
          const t = Math.max(0, Math.min(1, ((signal.x - a.x) * vx + (signal.z - a.z) * vz) / (vx * vx + vz * vz || 1)));
          assert.ok(Math.hypot(signal.x - a.x - t * vx, signal.z - a.z - t * vz) >= settings.lineWidth / 2 + 2.3 - 1e-8);
        }
        for (const bar of marker.bars) {
          const along = Math.abs(((signal.x - bar.x) * dx + (signal.z - bar.z) * dz) / length);
          const across = Math.abs(((signal.x - bar.x) * dz - (signal.z - bar.z) * dx) / length);
          assert.ok(Math.hypot(Math.max(0, along - bar.width / 2), Math.max(0, across - settings.barcodeWidth / 2)) >= 2.3 - 1e-8);
        }
        const [x, z, width, height] = projection.viewBox.split(' ').map(Number);
        assert.ok(signal.x - 1.8 >= x! && signal.x + 1.8 <= x! + width!);
        assert.ok(signal.z - 1.8 >= z! && signal.z + 1.8 <= z! + height!);
      }
    }
  }
});
