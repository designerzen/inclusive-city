import { BleRobotTransport, GatewayRobotTransport, bluetoothAvailable } from '../robot/physical/transport';
import { RobotFleet } from '../robot/physical/session';
import type { RobotSession } from '../robot/physical/session';
import { makeManifest, manifestHash, validateCalibration } from '../robot/physical/manifest';
import type { PhysicalCalibration } from '../robot/physical/manifest';
import type { PlannedJourney } from '../simulation/plannedJourney';
import { PlannedJourney as Journey } from '../simulation/plannedJourney';
import { createRobotRecord, robotMetadata } from '../robot/robotState';
import { JourneyCreativity } from '../art/JourneyCreativity';
import { PaintingRenderer } from '../art/ProceduralPainting';
import type { mountRouteProjection } from './routeProjection';
import './physicalRobots.css';

export function mountPhysicalRobots(host: HTMLElement, getJourney: () => PlannedJourney | undefined,
  projection: ReturnType<typeof mountRouteProjection>, feedback: (message: string) => void) {
  const panel = document.createElement('details'); panel.className = 'physical-robots';
  panel.innerHTML = `<summary>Physical robots</summary>
    <p>Connect each robot and prepare the same projected route. Each robot uses the current character’s design and creative personality.</p>
    <div class="physical-actions"><button type="button" data-action="ble">Connect Bluetooth robot</button><button type="button" data-action="stop-all">Stop all physical robots</button></div>
    <label>Gateway robot endpoint<input data-gateway type="url" placeholder="wss://gateway/robots/robot-id" /></label>
    <button type="button" data-action="gateway">Connect through gateway</button>
    <fieldset><legend>Measured table calibration</legend>
      <label>Millimetres per city unit<input data-calibration="mmPerCityUnit" type="number" min="0.01" step="0.01" /></label>
      <label>Minimum readable line (mm)<input data-calibration="minLineMm" type="number" min="0.01" step="0.01" /></label>
      <label>Minimum readable bar (mm)<input data-calibration="minBarMm" type="number" min="0.01" step="0.01" /></label>
      <label>Tested maximum speed (mm/s)<input data-calibration="maxSpeedMmS" type="number" min="1" max="1000" /></label>
      <label>Measured stopping distance (mm)<input data-calibration="stoppingDistanceMm" type="number" min="0.01" step="0.01" /></label>
      <label>Marker distance tolerance (mm)<input data-calibration="markerToleranceMm" type="number" min="0.01" max="1000" step="0.01" /></label>
      <label>Tested stopping lease (ms)<input data-calibration="leaseMs" type="number" min="500" max="5000" step="100" /></label>
    </fieldset>
    <p>Prepare opens a separate projector window. Position and size it, then measure the projected line and bars before starting. Moving or resizing it after Start withdraws the stopping lease.</p>
    <label class="physical-confirm"><input type="checkbox" data-calibrated /> I have tested projected sensing, measured this setup, and checked local stopping and table-edge protection.</label>
    <p data-status role="status" aria-live="polite"></p><div data-robots></div>
    <button type="button" data-action="disconnect">Disconnect fleet and close projection</button>`;
  host.append(panel);
  const cards = panel.querySelector<HTMLElement>('[data-robots]')!;
  const status = panel.querySelector<HTMLElement>('[data-status]')!;
  const calibrated = panel.querySelector<HTMLInputElement>('[data-calibrated]')!;
  const bleButton = panel.querySelector<HTMLButtonElement>('[data-action="ble"]')!;
  bleButton.disabled = !bluetoothAvailable();
  status.textContent = bluetoothAvailable() ? 'No physical robots connected.' : 'Direct Bluetooth is unavailable here. Use a gateway or a supported browser.';
  let frozenHash: string | undefined; let firstJourney: PlannedJourney | undefined; let closed = false;
  let frozenWorld: PlannedJourney['world'] | undefined; let nextRecordId = 1000000;
  const busy = new Set<string>();
  const visual = new Map<string, { card: HTMLElement; output: HTMLElement; canvas: HTMLCanvasElement; creation?: JourneyCreativity; cursor: number }>();
  const fleet = new RobotFleet(refresh);
  function refresh() {
    if (closed) return;
    for (const input of panel.querySelectorAll<HTMLInputElement>('[data-calibration]')) input.disabled = !!frozenHash;
    for (const session of fleet.sessions.values()) {
      let view = visual.get(session.identity.hardwareId);
      if (!view) {
        const card = document.createElement('section'); card.className = 'physical-robot-card';
        const title = document.createElement('h3'); title.textContent = `${session.identity.name} · ${session.identity.hardwareId}`;
        card.append(title);
        const output = document.createElement('p'); output.setAttribute('aria-live', 'polite'); card.append(output);
        const actions = document.createElement('div'); actions.className = 'physical-actions';
        for (const [action, text] of [['prepare', 'Prepare route'], ['start', 'Start physical robot'], ['hold', 'Hold'], ['adapt', 'Adapt city at this stop'], ['resume', 'Resume physical robot'], ['stop', 'Stop'], ['save', 'Save physical run']]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
          button.dataset.robot = session.identity.hardwareId; button.dataset.action = action; actions.append(button);
        }
        const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 300;
        canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${session.identity.name}'s physical journey painting`);
        card.append(actions, canvas); cards.append(card);
        view = { card, output, canvas, cursor: 0 }; visual.set(session.identity.hardwareId, view);
      }
      const record = session.journey?.machine.record;
      const progress = Math.round((record?.telemetry?.progress ?? 0) * 100);
      const text = `${session.state} · ${progress}%${session.identity.encoders ? '' : ' (milestone estimate)'}${session.report?.battery === undefined ? '' : ` · battery ${session.report.battery}%`}. ${session.message}`;
      if (view.output.textContent !== text) view.output.textContent = text;
      for (const button of view.card.querySelectorAll<HTMLButtonElement>('button')) {
        const action = button.dataset.action;
        const allowed = action === 'stop' ? !!session.manifest && !['disconnected', 'complete', 'stopped'].includes(session.state)
          : action === 'prepare' ? session.state === 'connected' : action === 'start' ? session.state === 'ready'
          : action === 'hold' ? session.state === 'running' : action === 'adapt' ? session.state === 'held' && !!session.accessProblem : action === 'resume' ? session.state === 'held' && !session.accessProblem : !!record;
        button.disabled = !allowed || action !== 'stop' && busy.has(session.identity.hardwareId);
      }
      if (record && view.creation) {
        const events = record.events.slice(view.cursor); view.cursor = record.events.length;
        for (const event of events) view.creation.consume(event);
        if (events.length) {
          view.creation.advance(record.clock);
          const context = view.canvas.getContext('2d');
          if (context) PaintingRenderer.render(context, view.canvas.width, view.canvas.height, view.creation.painting);
        }
      }
    }
  }
  function calibration(): PhysicalCalibration {
    const entries = [...panel.querySelectorAll<HTMLInputElement>('[data-calibration]')].map(input => [input.dataset.calibration, input.valueAsNumber]);
    return Object.fromEntries(entries) as unknown as PhysicalCalibration;
  }
  async function prepare(session: RobotSession) {
    const source = getJourney(); if (!source) throw new Error('Open the city first.');
    const measured = validateCalibration(calibration());
    const settings = projection.openPhysical(measured.stoppingDistanceMm / measured.mmPerCityUnit);
    const data = makeManifest(source, settings, measured);
    const hash = await manifestHash(data);
    if (closed || !fleet.sessions.has(session.identity.hardwareId)) throw new Error('Preparation cancelled.');
    if (frozenHash && frozenHash !== hash) throw new Error('Every robot must use the same frozen route and calibration. Disconnect the fleet to change them.');
    let journey = source;
    if (firstJourney) {
      const metadata = { ...robotMetadata(source.bot), id: ++nextRecordId, name: session.identity.name };
      const bot = { ...metadata, record: createRobotRecord(metadata) };
      journey = new Journey(bot, structuredClone(frozenWorld!)); journey.enableLineFollowing(); journey.setRoute(source.route);
      for (const id of source.repaired) journey.repaired.add(id);
    }
    frozenHash = hash; frozenWorld ??= structuredClone(source.world); firstJourney ??= source;
    const view = visual.get(session.identity.hardwareId)!;
    view.creation = new JourneyCreativity(journey.bot); view.cursor = 0;
    journey.machine.run.creative = { seed: view.creation.seed, bpm: view.creation.bpm, music: true, art: true, harmony: false, colour: false,
      artist: structuredClone(view.creation.artist), score: view.creation.score, marks: view.creation.marks };
    await session.prepare(data, hash, journey);
  }
  function save(session: RobotSession) {
    if (!session.journey) return;
    const blob = new Blob([JSON.stringify({ version: 1, identity: session.identity, session: session.session, routeHash: session.routeHash,
      manifest: session.manifest, lastReport: session.report, observations: session.observations, record: session.journey.machine.snapshot() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `physical-journey-${session.session}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function action(event: Event) {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]'); if (!button || button.disabled) return;
    const kind = button.dataset.action!, id = button.dataset.robot;
    if (id) busy.add(id); else if (kind === 'ble' || kind === 'gateway') button.disabled = true;
    try {
      if (kind === 'ble' || kind === 'gateway') {
        const transport = kind === 'ble' ? await BleRobotTransport.connect() : await GatewayRobotTransport.connect(panel.querySelector<HTMLInputElement>('[data-gateway]')!.value);
        if (closed) { transport.disconnect(); return; }
        fleet.add(transport); status.textContent = `${fleet.sessions.size} robot(s) connected.`;
      } else if (kind === 'stop-all') {
        await fleet.stopAll('Operator stopped fleet.');
      } else if (kind === 'disconnect') {
        await fleet.stopAll('Operator disconnected fleet.'); fleet.disconnectAll(); projection.closePhysical();
        frozenHash = undefined; firstJourney = undefined; frozenWorld = undefined; cards.replaceChildren(); visual.clear();
        status.textContent = 'Fleet disconnected. Reset the city before preparing another physical route.';
      } else {
        const session = fleet.sessions.get(id!); if (!session) return;
        if (kind === 'prepare') await prepare(session);
        else if (kind === 'start') {
          if (!calibrated.checked || document.hidden || !projection.physicalHealthy()) throw new Error('Confirm the calibrated table and open projection before starting.');
          projection.lockPhysicalViewport(); await session.start();
        } else if (kind === 'hold') await session.hold();
        else if (kind === 'adapt') session.adaptCity();
        else if (kind === 'resume') {
          if (!calibrated.checked || !projection.physicalHealthy() || document.hidden) throw new Error('Check the table and projection before resuming.');
          await session.resume();
        } else if (kind === 'stop') await session.stop();
        else if (kind === 'save') save(session);
      }
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); feedback(status.textContent); }
    finally { if (id) busy.delete(id); else if (kind === 'ble' || kind === 'gateway') button.disabled = kind === 'ble' && !bluetoothAvailable(); refresh(); }
  }
  panel.addEventListener('click', action);
  const timer = window.setInterval(() => {
    if (frozenHash && (!projection.physicalHealthy() || !calibrated.checked)) {
      for (const session of fleet.sessions.values()) if (['running', 'held'].includes(session.state)) session.fail('Projection changed, closed, or calibration confirmation removed.', 'stale');
    }
    fleet.tick(); refresh();
  }, 100);
  function visibility() { if (document.hidden) void fleet.stopAll('Control page hidden.'); }
  document.addEventListener('visibilitychange', visibility);
  function halt(reason: string) { void fleet.stopAll(reason); }
  const unload = () => { for (const session of fleet.sessions.values()) session.fail('Control page closed.'); };
  window.addEventListener('pagehide', unload);
  return { halt, get reserved() { return !!firstJourney?.physicalControl; }, refresh,
    dispose() { halt('City closed.'); closed = true; fleet.disconnectAll(); window.clearInterval(timer); projection.closePhysical();
      panel.removeEventListener('click', action); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', unload); panel.remove(); },
  };
}
