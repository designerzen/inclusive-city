import assert from 'node:assert/strict';
import { test } from 'node:test';
import { printTrackBounds } from '../src/ui/projectionPrint';
import { configurationProjection } from '../src/city/configurationProjection';
import { defaultProjectionSettings } from '../src/city/projectionSettings';

test('print bounds preserve every track stroke and rotated bar while removing screen control padding', () => {
  for (const configuration of ['traffic-light', 'figure-eight'] as const) {
    const settings = { ...defaultProjectionSettings, crossingCode: { bits: 16, value: 65535 }, junctionCode: { bits: 12, value: 4095 } };
    const projection = configurationProjection(configuration, settings, 20);
    const bounds = printTrackBounds(projection);
    const [x, z, width, height] = bounds.viewBox.split(' ').map(Number) as [number, number, number, number];
    for (const point of projection.points) {
      assert.ok(point.x - settings.lineWidth / 2 >= x && point.x + settings.lineWidth / 2 <= x + width);
      assert.ok(point.z - settings.lineWidth / 2 >= z && point.z + settings.lineWidth / 2 <= z + height);
    }
    for (const marker of projection.markers) for (const bar of marker.bars) {
      const angle = bar.angle * Math.PI / 180;
      for (const across of [-1, 1]) for (const along of [-1, 1]) {
        const bx = bar.x + across * settings.barcodeWidth / 2 * Math.cos(angle) - along * bar.width / 2 * Math.sin(angle);
        const bz = bar.z + across * settings.barcodeWidth / 2 * Math.sin(angle) + along * bar.width / 2 * Math.cos(angle);
        assert.ok(bx >= x && bx <= x + width && bz >= z && bz <= z + height);
      }
    }
    assert.ok(width < Number(projection.viewBox.split(' ')[2]));
    assert.equal(bounds.landscape, width > height);
  }
});
