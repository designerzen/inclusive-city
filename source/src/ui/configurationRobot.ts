import { BleRobotTransport, bluetoothUnavailableReason } from '../robot/physical/transport';
import { getMicrocontrollerSettings } from '../robot/physical/microcontroller';
import { RobotTrafficLight } from '../robot/physical/trafficLight';
import type { TrafficLightCommands } from '../robot/physical/trafficLightCommands';

export function mountConfigurationRobot(parent: HTMLElement, lightChanged: (light: string, barcodeStop: number, enabled: boolean) => void, commands: () => TrafficLightCommands) {
  const section = document.createElement('section');
  section.className = 'configuration-robot';
  section.ariaLabel = 'Robot traffic lights';
  section.innerHTML = `<div class="robot-connection"><p role="status" aria-live="polite"></p><div class="robot-actions"><button type="button" data-pair>Pair robot & start</button><button type="button" data-stop disabled>Stop & disconnect</button><a href="./robot-comms.html" target="_blank" rel="noopener">Bluetooth code & testing</a></div></div>`;
  parent.append(section);
  const pair = section.querySelector<HTMLButtonElement>('[data-pair]')!;
  const stop = section.querySelector<HTMLButtonElement>('[data-stop]')!;
  const status = section.querySelector('p')!;
  const unsupported = bluetoothUnavailableReason();
  const supported = unsupported === undefined;
  let controller: RobotTrafficLight | undefined, connecting = false, generation = 0;
  function refresh() {
    const phase = controller?.phase ?? 'disconnected';
    pair.disabled = !supported || connecting || phase !== 'disconnected';
    pair.textContent = connecting ? 'Pairing…' : 'Pair robot & start';
    stop.disabled = phase === 'disconnected' && !connecting;
    status.textContent = connecting ? 'Choose your robot. It will start following the line when connected.' : controller?.message ?? unsupported ?? 'Pair your robot to start following the line.';
    const light = phase === 'following' ? 'green' : ['waiting', 'resuming', 'fault'].includes(phase) ? 'red' : 'off';
    lightChanged(light, controller?.barcodeStop ?? -1, controller?.canFulfill ?? false);
  }
  pair.addEventListener('click', async () => {
    const attempt = ++generation;
    connecting = true; refresh();
    try {
      const settings = getMicrocontrollerSettings().ble;
      if (!settings.notify) throw new Error('A notification characteristic is required to receive the robot stop signal.');
      const transport = await BleRobotTransport.connect(settings);
      if (attempt !== generation) { transport.disconnect(); return; }
      controller = new RobotTrafficLight(transport, refresh, commands);
      connecting = false; refresh();
      await controller.start();
    } catch (error) {
      if (attempt === generation) { connecting = false; refresh(); status.textContent = `Could not pair: ${error instanceof Error ? error.message : String(error)}`; }
    } finally { if (attempt === generation) { connecting = false; } }
  });
  function close() { generation++; connecting = false; controller?.close(); refresh(); }
  stop.addEventListener('click', close);
  window.addEventListener('pagehide', close);
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
  refresh();
  return { fulfill: (approach: number) => controller?.fulfill(approach) };
}
