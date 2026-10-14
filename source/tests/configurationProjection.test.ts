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
