import { BleRobotTransport, bluetoothAvailable } from '../robot/physical/transport';
import { getMicrocontrollerSettings } from '../robot/physical/microcontroller';
import { RobotTrafficLight } from '../robot/physical/trafficLight';

export function mountConfigurationRobot(parent: HTMLElement, lightChanged: (light: string, barcodeStop: number) => void) {
  const section = document.createElement('section');
  section.className = 'configuration-robot';
  section.ariaLabel = 'Robot traffic lights';
  section.innerHTML = `<div class="robot-connection"><p role="status" aria-live="polite"></p><div class="robot-actions"><button type="button" data-pair>Pair robot & start</button><button type="button" data-stop disabled>Stop & disconnect</button><a href="./robot-comms.html" target="_blank" rel="noopener">Bluetooth code & testing</a></div></div>`;
  parent.append(section);
  const pair = section.querySelector<HTMLButtonElement>('[data-pair]')!;
  const stop = section.querySelector<HTMLButtonElement>('[data-stop]')!;
  const status = section.querySelector('p')!;
  const supported = window.isSecureContext && bluetoothAvailable();
  let controller: RobotTrafficLight | undefined, connecting = false, generation = 0;
  function refresh() {
    const phase = controller?.phase ?? 'disconnected';
    pair.disabled = !supported || connecting || phase !== 'disconnected';
    pair.textContent = connecting ? 'Pairing…' : 'Pair robot & start';
    stop.disabled = phase === 'disconnected' && !connecting;
    status.textContent = connecting ? 'Choose your robot. It will start following the line when connected.' : controller?.message ?? (supported ? 'Pair your robot to start following the line.' : 'Pairing needs HTTPS or localhost and a Bluetooth browser such as Chrome or Edge.');
    const light = phase === 'following' ? 'green' : ['waiting', 'resuming', 'fault'].includes(phase) ? 'red' : 'off';
    lightChanged(light, controller?.barcodeStop ?? -1);
  }
  pair.addEventListener('click', async () => {
    const attempt = ++generation;
    connecting = true; refresh();
    try {
      const settings = getMicrocontrollerSettings().ble;
      if (!settings.notify) throw new Error('A notification characteristic is required to receive the robot stop signal.');
      const transport = await BleRobotTransport.connect(settings);
      if (attempt !== generation) { transport.disconnect(); return; }
      controller = new RobotTrafficLight(transport, refresh);
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
}
