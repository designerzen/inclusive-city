import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultProjectionSettings, validateProjectionSettings } from '../src/city/projectionSettings';
import { barcodeWidths, routeProjection } from '../src/city/routeProjection';
import { configurationProjection } from '../src/city/configurationProjection';
import { loadProjectionSettings, saveProjectionSettings } from '../src/ui/projectionShared';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import type { ProceduralCity } from '../src/city/proceduralCity';

test('all supported bit counts encode their full range with guards', () => {
  for (let bits = 1; bits <= 8; bits++) {
    for (let value = 0; value < 2 ** bits; value++) {
      const widths = barcodeWidths(value, defaultProjectionSettings, bits);
      assert.equal(widths.length, bits + 2);
      assert.deepEqual(widths.slice(1, -1), value.toString(2).padStart(bits, '0').split('').map(bit => bit === '1' ? .16 : .08));
    }
    assert.throws(() => barcodeWidths(2 ** bits, defaultProjectionSettings, bits));
  }
  for (const bits of [9, 10, 11, 12, 13, 14, 15, 16]) {
    for (const value of [0, 1, 2 ** bits - 1]) {
      const settings = validateProjectionSettings({ ...defaultProjectionSettings, crossingCode: { bits, value } });
      const widths = barcodeWidths(value, settings, bits);
      assert.equal(widths.length, bits + 2);
      assert.equal(widths.slice(1, -1).map(width => width === settings.longLength ? '1' : '0').join(''), value.toString(2).padStart(bits, '0'));
      assert.equal(configurationProjection('traffic-light', settings).markers[0]!.bits, bits);
    }
    assert.throws(() => barcodeWidths(2 ** bits, defaultProjectionSettings, bits));
  }
  for (const code of [{ bits: 0, value: 0 }, { bits: 17, value: 0 }, { bits: 3, value: 8 }, { bits: 4, value: -1 }, { bits: 4, value: 1.5 }])
    assert.throws(() => validateProjectionSettings({ ...defaultProjectionSettings, crossingCode: code }));
});

test('saved barcode and dimension settings survive reload, including older storage and unavailable storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved = JSON.stringify({ lineWidth: .2 });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } });
  try {
    assert.equal(loadProjectionSettings().lineWidth, .2);
    assert.deepEqual(loadProjectionSettings().crossingCode, { bits: 4, value: 4 });
    const settings = { ...loadProjectionSettings(), crossingCode: { bits: 8, value: 255 }, junctionCode: { bits: 1, value: 0 } };
    saveProjectionSettings(settings);
    assert.deepEqual(loadProjectionSettings(), settings);
    assert.equal(configurationProjection('traffic-light', loadProjectionSettings()).markers[0]!.bars.length, 10);
    assert.ok(configurationProjection('figure-eight', loadProjectionSettings()).markers.every(marker => marker.bits === 1 && marker.code === 0));
    saved = '{broken'; assert.deepEqual(loadProjectionSettings(), defaultProjectionSettings);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Unavailable'); } });
    assert.doesNotThrow(() => saveProjectionSettings(settings));
    assert.deepEqual(loadProjectionSettings(), defaultProjectionSettings);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('city routes draw configured crossing and junction values while retaining event identity and spacing', () => {
  const world: ProceduralCity = { seed: 1, start: 'a', destination: 'd', riverX: 100, rememberedRobots: 1, buildings: [],
    nodes: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, label: id, x: i * 30, y: .16, z: 0 })),
    streets: ['ab', 'bc', 'cd'].map((id, i) => ({ id, a: id[0]!, b: id[1]!, kind: i === 0 ? 'crossing' : 'clear', width: 6, crossingSeconds: 20 })) };
  const journey = new PlannedJourney(new BotHistory(['Curie', 'Einstein']).current, world);
  journey.enableLineFollowing(); journey.setRoute(['a', 'b', 'c', 'd']);
  const settings = { ...defaultProjectionSettings, crossingCode: { bits: 8, value: 255 }, junctionCode: { bits: 1, value: 0 } };
  const projection = routeProjection(journey, settings, 2);
  assert.deepEqual(projection.markers.map(m => [m.eventCode, m.code, m.bits]), [[0, 0, 4], [4, 255, 8], [13, 0, 1], [13, 0, 1], [12, 12, 4]]);
  for (const [index, marker] of projection.markers.entries()) {
    assert.deepEqual(marker.bars.map(b => b.width), barcodeWidths(marker.code, settings, marker.bits).map(w => w * projection.scale));
    if (index) assert.ok(projection.markers[index - 1]!.endDistance + settings.codeGap <= marker.distance + 1e-8);
  }
  const crossing = projection.markers.find(m => m.eventCode === 4)!;
  const defaultCrossing = routeProjection(journey, defaultProjectionSettings, 2).markers.find(m => m.eventCode === 4)!;
  assert.equal(crossing.label, defaultCrossing.label);
  assert.equal(journey.ready, true);
});
