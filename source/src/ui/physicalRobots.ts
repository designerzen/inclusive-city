import { BleRobotTransport, GatewayRobotTransport, bluetoothAvailable, nordicUart } from '../robot/physical/transport';
import { getMicrocontrollerSettings, microcontrollerChanges } from '../robot/physical/microcontroller';
import { RobotFleet, defaultCommands } from '../robot/physical/session';
import type { RobotSession, RobotAction, CommandSettings } from '../robot/physical/session';
import { PhysicalJourney } from '../robot/physical/physicalJourney';
import { PlannedJourney } from '../simulation/plannedJourney';
import { robotMetadata, createRobotRecord } from '../robot/robotState';
import { routeProjection } from '../city/routeProjection';
import { JourneyCreativity } from '../art/JourneyCreativity';
import { PaintingRenderer } from '../art/ProceduralPainting';
import type { mountRouteProjection } from './routeProjection';
import './physicalRobots.css';

export function mountPhysicalRobots(host: HTMLElement, getJourney: () => PlannedJourney | undefined,
  projection: ReturnType<typeof mountRouteProjection>, feedback: (message: string) => void,
  getCreation?: () => JourneyCreativity | undefined) {
  const panel = document.createElement('details'); panel.className = 'physical-robots';
  panel.innerHTML = `<summary>Physical robots</summary>
    <label>Robot connection<select data-profile><option value="settings">Microcontroller from Settings</option><option value="custom">Custom BLE override</option></select></label>
    <button type="button" data-action="connect">Connect another robot</button>
    <p>Each robot has its own connection, commands and sensor readings. Changing the microcontroller in Settings reconnects robots using that profile. Custom BLE overrides stay independent.</p>
    <details><summary>BLE and command settings</summary>
      <label>Service UUID<input data-uuid="service" /></label><label>Command characteristic UUID<input data-uuid="write" /></label>
      <label>Sensor characteristic UUID (optional)<input data-uuid="notify" /></label>
      <label>Start command<input data-command="start" maxlength="512" /></label><label>Hold command<input data-command="hold" maxlength="512" /></label>
      <label>Resume command<input data-command="resume" maxlength="512" /></label><label>Stop command<input data-command="stop" maxlength="512" /></label>
      <label>Command ending<select data-ending><option value="newline">New line</option><option value="none">None</option></select></label>
      <p>Use the commands your robots already accept. The micro:bit must expose its Bluetooth UART service.</p>
    </details>
    <details><summary>Existing gateway connection</summary><label>Robot WebSocket endpoint<input data-gateway type="url" placeholder="wss://gateway/robot-id" /></label><button type="button" data-action="gateway">Connect through gateway</button></details>
    <label>Millimetres per city unit (for map tracking)<input data-scale type="number" min="0.01" max="10000" step="0.01" /></label>
    <p>Use “Track on city route” to connect received distance and barcode readings to this game. It opens the line in a separate projector window. Command sending works without route tracking.</p>
    <p data-status role="status" aria-live="polite"></p><div data-robots></div>
    <button type="button" data-action="disconnect">Disconnect all robots</button>`;
  host.append(panel);
  const status = panel.querySelector<HTMLElement>('[data-status]')!, cards = panel.querySelector<HTMLElement>('[data-robots]')!;
  const profile = panel.querySelector<HTMLSelectElement>('[data-profile]')!;
  const connect = panel.querySelector<HTMLButtonElement>('[data-action="connect"]')!;
  connect.disabled = !bluetoothAvailable();
  status.textContent = bluetoothAvailable() ? 'No robots connected.' : 'Open this app in Chrome or Edge for direct Bluetooth, or use an existing gateway.';
  for (const input of panel.querySelectorAll<HTMLInputElement>('[data-command]')) input.value = defaultCommands[input.dataset.command as RobotAction];
  function applyProfile() {
    for (const input of panel.querySelectorAll<HTMLInputElement>('[data-uuid]')) input.readOnly = profile.value !== 'custom';
    if (profile.value === 'custom') return;
    const preset = getMicrocontrollerSettings().ble;
    for (const input of panel.querySelectorAll<HTMLInputElement>('[data-uuid]')) input.value = preset[input.dataset.uuid as 'service' | 'write' | 'notify'];
  }
  applyProfile(); profile.addEventListener('change', applyProfile);
  try {
    const saved = JSON.parse(localStorage.getItem('inclusive-city-robot-ble') ?? 'null');
    if (saved && typeof saved === 'object') {
      if (saved.profile === 'custom') profile.value = 'custom';
      for (const input of panel.querySelectorAll<HTMLInputElement>('[data-uuid], [data-command]')) {
        const value = saved[input.dataset.uuid ?? input.dataset.command!]; if (typeof value === 'string' && value.length <= 512) input.value = value;
      }
      if (saved.ending === 'none') panel.querySelector<HTMLSelectElement>('[data-ending]')!.value = 'none';
    }
  } catch { /* Settings are optional. */ }
  applyProfile();
  const saveSettings = () => {
    const values: Record<string, string> = { profile: profile.value, ending: panel.querySelector<HTMLSelectElement>('[data-ending]')!.value };
    for (const input of panel.querySelectorAll<HTMLInputElement>('[data-uuid], [data-command]')) values[input.dataset.uuid ?? input.dataset.command!] = input.value;
    try { localStorage.setItem('inclusive-city-robot-ble', JSON.stringify(values)); } catch { /* Continue without persistence. */ }
  };
  panel.addEventListener('change', saveSettings);
  function commands(): CommandSettings {
    const result = { ...defaultCommands };
    for (const input of panel.querySelectorAll<HTMLInputElement>('[data-command]')) result[input.dataset.command as RobotAction] = input.value;
    result.ending = panel.querySelector<HTMLSelectElement>('[data-ending]')!.value === 'none' ? 'none' : 'newline'; return result;
  }
  let closed = false, firstJourney: PlannedJourney | undefined, frozenWorld: PlannedJourney['world'] | undefined, nextId = 1000000;
  let profileGeneration = 0, switching = false, reconfigureRequested = false;
  const settingsRobots = new Set<string>();
  let trackingInvalidated = false;
  const views = new Map<string, { card: HTMLElement; output: HTMLElement; log: HTMLElement; canvas: HTMLCanvasElement;
    run?: PhysicalJourney; creation?: JourneyCreativity; shared: boolean; cursor: number; busy: boolean }>();
  const fleet = new RobotFleet(refresh);
  async function reconfigure() {
    if (closed) return;
    if (switching) { reconfigureRequested = true; return; }
    if (profile.value === 'settings') applyProfile();
    const attempt = ++profileGeneration, settings = getMicrocontrollerSettings().ble;
    const sessions = [...fleet.sessions.values()].filter(session => settingsRobots.has(session.id) && session.transport instanceof BleRobotTransport);
    if (!sessions.length) return;
    switching = true; connect.disabled = true;
    const failures: string[] = [];
    for (const session of sessions) { const view = views.get(session.id); if (view) { view.busy = true; view.run?.freeze(); } }
    status.textContent = 'Microcontroller changed. Stopping and reconnecting Bluetooth robots…'; refresh();
    await Promise.all(sessions.map(async session => {
      const view = views.get(session.id);
      try {
        if (session.connected) await session.command('stop', commands());
        session.disconnect();
        if (closed || attempt !== profileGeneration) return;
        const transport = await (session.transport as BleRobotTransport).reconnect(settings);
        if (closed || attempt !== profileGeneration) { transport.disconnect(); return; }
        fleet.sessions.delete(session.id);
        // Reset the sensor decoder and require explicit route attachment after reconnecting.
        if (view) { view.run = undefined; view.cursor = 0; }
        fleet.add(transport);
      } catch (error) {
        session.disconnect();
        failures.push(`${session.name}: ${error instanceof Error ? error.message : String(error)}`);
      } finally { if (view) view.busy = false; }
    }));
    if (!closed && attempt === profileGeneration) {
      switching = false; connect.disabled = !bluetoothAvailable(); refresh();
      status.textContent = failures.length
        ? `Could not reconnect ${failures.join('; ')}. Remove disconnected robots and use Connect another robot to grant the new Bluetooth service.`
        : 'Bluetooth robots reconnected. Attach a route and start when ready.';
      if (reconfigureRequested) { reconfigureRequested = false; void reconfigure(); }
    }
  }
  const settingsChanged = () => { void reconfigure(); };
  microcontrollerChanges.addEventListener('change', settingsChanged);
  function refresh() {
    if (closed) return;
    panel.querySelector<HTMLInputElement>('[data-scale]')!.disabled = !!frozenWorld;
    for (const session of fleet.sessions.values()) {
      let view = views.get(session.id);
      if (!view) {
        const card = document.createElement('section'); card.className = 'physical-robot-card';
        const title = document.createElement('h3'); title.textContent = session.name; card.append(title);
        const output = document.createElement('p'); output.setAttribute('aria-live', 'polite'); card.append(output);
        const actions = document.createElement('div'); actions.className = 'physical-actions';
        for (const [action, text] of [['track', 'Track on city route'], ['start', 'Start'], ['hold', 'Hold'], ['resume', 'Resume'], ['stop', 'Stop'], ['save', 'Save run and readings'], ['remove', 'Disconnect robot']]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.dataset.action = action; button.dataset.robot = session.id; actions.append(button);
        }
        const label = document.createElement('label'); label.textContent = 'Custom command'; const input = document.createElement('input'); input.dataset.custom = ''; input.maxLength = 512; label.append(input);
        const send = document.createElement('button'); send.type = 'button'; send.textContent = 'Send command'; send.dataset.action = 'send'; send.dataset.robot = session.id;
        const log = document.createElement('pre'); log.className = 'physical-sensor-log'; log.setAttribute('aria-label', `${session.name} sensor readings`);
        const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 300; canvas.hidden = true;
        canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${session.name}'s journey painting`);
        card.append(actions, label, send, log, canvas); cards.append(card);
        view = { card, output, log, canvas, shared: false, cursor: 0, busy: false }; views.set(session.id, view);
      }
      const progress = Math.round((view.run?.journey.machine.record.telemetry?.progress ?? 0) * 100);
      const stale = session.lastReceived && Date.now() - session.lastReceived > 3000;
      const text = `${session.connected ? 'Connected' : 'Disconnected'}${session.report?.status ? ` · reported ${session.report.status}` : ''}${view.run ? ` · route ${progress}%` : ''}${stale ? ' · sensor data stale' : ''}. ${session.message}`;
      if (view.output.textContent !== text) view.output.textContent = text;
      const logText = [...session.messages.slice(-4).map(m => m.text), session.pendingText].filter(Boolean).join('\n'); if (view.log.textContent !== logText) view.log.textContent = logText;
      for (const button of view.card.querySelectorAll<HTMLButtonElement>('button')) {
        const action = button.dataset.action;
        button.disabled = switching || (action === 'save' ? !session.messages.length && !view.run : action === 'remove' ? false
          : !session.connected || action === 'track' && !!view.run || action !== 'stop' && view.busy);
      }
      if (view.run && view.creation) {
        const record = view.run.journey.machine.record, events = record.events.slice(view.cursor); view.cursor = record.events.length;
        for (const event of events) view.creation.consume(event);
        if (!view.shared) view.creation.advance(record.clock);
        if (events.length) { const context = view.canvas.getContext('2d'); if (context) PaintingRenderer.render(context, 600, 300, view.creation.painting); }
        if (!session.connected || stale) view.run.freeze();
      }
    }
  }
  function track(session: RobotSession) {
    if (trackingInvalidated) throw new Error('The city route changed. Disconnect the fleet before binding a new route.');
    const source = getJourney(); if (!source) throw new Error('Open the city first.');
    const scale = panel.querySelector<HTMLInputElement>('[data-scale]')!.valueAsNumber;
    if (!Number.isFinite(scale) || scale <= 0 || scale > 10000) throw new Error('Enter measured millimetres per city unit for map tracking.');
    const settings = projection.openPhysical(0);
    let journey = source;
    if (firstJourney) {
      const metadata = { ...robotMetadata(source.bot), id: ++nextId, name: session.name }, bot = { ...metadata, record: createRobotRecord(metadata) };
      journey = new PlannedJourney(bot, structuredClone(frozenWorld!)); journey.enableLineFollowing(); journey.setRoute(source.route);
    }
    frozenWorld ??= structuredClone(source.world); firstJourney ??= source;
    const view = views.get(session.id)!;
    view.run = new PhysicalJourney(journey, scale, routeProjection(source, settings).markers, session.report?.distanceMm);
    view.creation = journey === source ? getCreation?.() ?? new JourneyCreativity(journey.bot) : new JourneyCreativity(journey.bot);
    view.shared = journey === source && !!getCreation?.(); view.canvas.hidden = false;
    if (!view.shared) journey.machine.run.creative = { seed: view.creation.seed, bpm: view.creation.bpm, music: true, art: true, harmony: false, colour: false,
      artist: structuredClone(view.creation.artist), score: view.creation.score, marks: view.creation.marks };
    session.onReport = (report, time) => { try { view.run?.observe(report, time); } catch (error) { view.run?.freeze(); throw error; } refresh(); };
    session.message = 'City tracking attached. Movement comes from sensor reports.'; refresh();
  }
  function save(session: RobotSession) {
    const run = views.get(session.id)?.run;
    const blob = new Blob([JSON.stringify({ robot: { id: session.id, name: session.name }, commands: commands(), readings: session.messages,
      ...(run ? { mmPerCityUnit: run.mmPerUnit, markers: run.markers, record: run.journey.machine.snapshot() } : {}) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'physical-robot-run.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function click(event: Event) {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]'); if (!button || button.disabled || switching) return;
    const attempt = profileGeneration;
    const action = button.dataset.action!, id = button.dataset.robot, view = id ? views.get(id) : undefined;
    if (view) view.busy = true; else button.disabled = true;
    try {
      if (action === 'connect' || action === 'gateway') {
        const usingSettings = profile.value === 'settings';
        const settings = { ...(usingSettings ? getMicrocontrollerSettings().ble : nordicUart) };
        for (const input of panel.querySelectorAll<HTMLInputElement>('[data-uuid]')) settings[input.dataset.uuid as 'service' | 'write' | 'notify'] = input.value.trim();
        if (!usingSettings) settings.namePrefix = undefined;
        const transport = action === 'connect' ? await BleRobotTransport.connect(settings, new Set(fleet.sessions.keys())) : await GatewayRobotTransport.connect(panel.querySelector<HTMLInputElement>('[data-gateway]')!.value);
        if (closed || attempt !== profileGeneration) { transport.disconnect(); return; }
        if (action === 'connect' && usingSettings) settingsRobots.add(transport.id); else settingsRobots.delete(transport.id);
        fleet.add(transport); status.textContent = `${fleet.sessions.size} robot(s) connected.`;
      } else if (action === 'disconnect') {
        await fleet.stopAll(commands()); for (const view of views.values()) view.run?.freeze(); fleet.disconnectAll();
        settingsRobots.clear(); views.clear(); cards.replaceChildren(); projection.closePhysical(); firstJourney = undefined; frozenWorld = undefined; trackingInvalidated = false;
        status.textContent = 'Disconnected. Reset the city before attaching another route.';
      } else {
        const session = fleet.sessions.get(id!); if (!session) return;
        if (action === 'track') track(session);
        else if (action === 'save') save(session);
        else if (action === 'remove') { if (session.connected) await session.command('stop', commands()); session.disconnect(); view?.run?.freeze(); fleet.sessions.delete(id!); settingsRobots.delete(id!); view?.card.remove(); views.delete(id!); }
        else if (action === 'send') {
          const text = view!.card.querySelector<HTMLInputElement>('[data-custom]')!.value;
          if (!text) throw new Error('Enter a command.'); await session.send(text + (commands().ending === 'newline' ? '\n' : ''));
        } else {
          if ((action === 'start' || action === 'resume') && view?.run) {
            projection.lockPhysicalViewport(); view.run.activate();
          }
          await session.command(action as RobotAction, commands());
          if (action === 'stop') view?.run?.freeze();
        }
      }
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); feedback(status.textContent); }
    finally { if (view) view.busy = false; else button.disabled = action === 'connect' && !bluetoothAvailable(); refresh(); }
  }
  panel.addEventListener('click', click);
  function halt(reason: string) {
    for (const view of views.values()) view.run?.freeze();
    if (![...fleet.sessions.values()].some(s => s.connected)) return;
    void fleet.stopAll(commands()).then(results => {
      const failed = results.filter(r => r.status === 'rejected').length;
      status.textContent = failed ? `${reason} ${failed} Stop command(s) could not be sent.` : `${reason} Stop command sent to connected robots.`;
    });
  }
  const visibility = () => { if (document.hidden) halt('Control page hidden.'); };
  document.addEventListener('visibilitychange', visibility);
  const unload = () => halt('Control page closed.'); window.addEventListener('pagehide', unload);
  const timer = window.setInterval(() => {
    if (firstJourney && !projection.physicalHealthy()) { halt('Projection closed or changed.'); firstJourney = undefined; }
    refresh();
  }, 500);
  return { halt, routeChanged() { halt('City route changed.'); trackingInvalidated = !!frozenWorld; projection.closePhysical(); }, get reserved() { return [...fleet.sessions.values()].some(s => s.connected); }, refresh,
    open() { panel.open = true; panel.scrollIntoView({ block: 'nearest' }); },
    dispose() { halt('City closed.'); closed = true; profileGeneration++; microcontrollerChanges.removeEventListener('change', settingsChanged); fleet.disconnectAll(); window.clearInterval(timer); projection.closePhysical(); panel.remove();
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', unload); },
  };
}
