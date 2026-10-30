import assert from 'node:assert/strict';
import { test } from 'node:test';
import jsQR from 'jsqr';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { newShellId, shellPayload, parseShellPayload, shellQr, shellQrSvg } from '../src/robot/shellIdentity';
import { robotPresets } from '../src/robot/presets';
import { CityJourney } from '../src/simulation/cityJourney';
import { BotHistory } from '../src/robot/botHistory';
import { createRobot } from '../src/robot/createRobot';
import { defaultBody, makeBody, bodySvg } from '../src/robot/bodyNet';
import { defaultExposure } from '../src/robot/bodyExposure';
import { bodyShellLabel } from '../src/robot/bodyShellLabel';
import { sensorReport, parseSensorText } from '../src/robot/physical/session';

test('shell QR labels independently decode to the exact stable identity, including quiet zone', () => {
  for (const id of ['TEST-SHELL', newShellId(), 'a'.repeat(64)]) {
    const qr = shellQr(id), scale = 5, width = (qr.count + 8) * scale, data = new Uint8ClampedArray(width * width * 4).fill(255);
    qr.cells.forEach((row, y) => row.forEach((dark, x) => {
      if (!dark) return;
      for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
        const offset = (((y + 4) * scale + yy) * width + (x + 4) * scale + xx) * 4;
        data[offset] = data[offset + 1] = data[offset + 2] = 0;
      }
    }));
    assert.equal(jsQR(data, width, width)?.data, shellPayload(id));
    assert.match(shellQrSvg(id), /width="36mm"/);
    assert.equal(parseShellPayload(shellPayload(id)), id);
  }
  for (const bad of ['', '<script>', 'x'.repeat(65), 'https://example.com']) assert.throws(() => shellPayload(bad));
});

test('shell identity survives renaming, appearance changes, preset selection and reload', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const history = new BotHistory(['Lovelace', 'Turing'], () => .5, storage);
  const id = history.current.shellId;
  history.rename('My robot'); history.updateAppearance({ ...history.current.appearance, width: 1.1 });
  assert.equal(history.current.shellId, id);
  assert.equal(history.current.record.metadata.shell.id, id);
  history.next(); assert.notEqual(history.current.shellId, id); history.previous();
  assert.equal(history.current.shellId, id);
  history.selectPreset(robotPresets[0].id); const presetId = history.current.shellId;
  history.selectPreset(robotPresets[0].id); assert.equal(history.current.shellId, presetId);
  while (history.canGoBack) history.previous();
  const journey = new CityJourney(history.current); journey.restart();
  assert.equal(journey.bot.shellId, id); assert.equal(journey.machine.record.metadata.shell.id, id);
  const restored = new BotHistory(['Lovelace', 'Turing'], () => .5, storage);
  assert.equal(restored.current.shellId, id);
  assert.equal(restored.current.record.metadata.shell.qrPayload, shellPayload(id!));
});

test('every rendered robot carries a real QR mesh and a reader, with replaceable identity', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const robot = createRobot(scene, 'FIRST');
    assert.ok(robot.robot.getChildMeshes().some(m => m.name === 'shell-qr-reader'));
    assert.ok(scene.getMeshByName('shell-qr-modules')!.getTotalVertices() > 100);
    robot.setShellId('SECOND'); robot.setName('A new name');
    assert.equal(robot.robot.metadata.shell.qrPayload, shellPayload('SECOND'));
    assert.equal(scene.getMeshByName('shell-qr-label')!.metadata.shellId, 'SECOND');
  } finally { scene.dispose(); engine.dispose(); }
});

test('body labels occupy uncut stock and QR print artwork never enters the cutting layer', () => {
  const model = makeBody({ ...defaultBody, sides: 4, diameter: 240, height: 280, taper: 100, thickness: 1.2 }, defaultExposure);
  const label = bodyShellLabel(model, 'TEST-SHELL'); assert.ok(label);
  assert.equal(label.size, 36);
  assert.ok(model.exposure.zones.some(z => z.key === 'qrReader'));
  assert.ok(bodySvg(model, true, 'TEST-SHELL').includes('PRINT_SHELL_QR'));
  assert.ok(!bodySvg(model, false, 'TEST-SHELL').includes('PRINT_SHELL_QR'));
  const noStock = { ...model, exposure: { ...model.exposure, panelPolygons: model.faces.map(() => []) } };
  assert.equal(bodyShellLabel(noStock, 'TEST-SHELL'), undefined);
});

test('hardware QR reports remain separate from track barcodes and reject arbitrary content', () => {
  assert.deepEqual(parseSensorText('QR:IC:SHELL:OTHER-ROBOT'), { qrPayload: 'IC:SHELL:OTHER-ROBOT', shellId: 'OTHER-ROBOT' });
  assert.deepEqual(sensorReport({ qrPayload: 'IC:SHELL:OTHER-ROBOT', distanceMm: 200 }), { qrPayload: 'IC:SHELL:OTHER-ROBOT', shellId: 'OTHER-ROBOT', distanceMm: 200 });
  assert.deepEqual(parseSensorText('MARKER:2'), { event: 'marker', code: 2 });
  assert.throws(() => sensorReport({ qrPayload: 'javascript:alert(1)' }));
});
