import { BleRobotTransport, bluetoothUnavailableReason, type BleSettings } from '../robot/physical/transport';
import { getMicrocontrollerSettings, microcontrollerChanges } from '../robot/physical/microcontroller';
import { MicrobitFace, journeyFace, type FaceJourney, type FaceAction } from '../robot/microbitFace';
import './microbitFace.css';

export function mountMicrobitFaceSetup(host: HTMLElement) {
  const panel = document.createElement('details'); panel.className = 'microbit-face';
  panel.innerHTML = `<summary>micro:bit robot face</summary>
    <p>Power on your flashed micro:bit, then use Pair micro:bit face in Settings. Its 5 × 5 LEDs show your robot’s mood briefly, scroll its city message, then return to the face. Press A to fix the current issue, B to read and scroll it again, or A+B to mute or unmute board music.</p>
    <p><a href="${import.meta.env.BASE_URL}firmware/microbit-face/city-face.hex" download>Download city face firmware (.hex)</a> · Copy it to the MICROBIT USB drive, then keep the board powered by USB or battery.</p>
    <p>After a power cycle or disconnection, the pairing button is available in Settings.</p>`;
  host.append(panel);
  return { dispose() { panel.remove(); } };
}

/** One connection survives the splash → designer → city navigation. */
export function createMicrobitFaceConnection(getJourney: () => FaceJourney | undefined,
  connect = (settings: BleSettings) => BleRobotTransport.connect(settings),
  action: (action: FaceAction) => void = () => {}) {
  const unsupported = bluetoothUnavailableReason();
  const available = unsupported === undefined;
  let message = unsupported ?? 'Power on your microcontroller, then choose Pair to connect over Bluetooth.';
  let face: MicrobitFace | undefined, disposed = false, generation = 0, busy = false, connected = false;
  let showMessage = !available;
  const views: { root: HTMLElement; pair: HTMLButtonElement; status: HTMLElement; alwaysShowStatus: boolean }[] = [];
  const pairLabel = () => getMicrocontrollerSettings().board === 'microbit' ? 'Pair micro:bit face' : 'Pair Bluetooth robot face';
  function render() {
    for (const view of views) {
      view.pair.hidden = connected;
      view.pair.disabled = busy || !available;
      view.pair.textContent = busy ? 'Pairing Bluetooth…' : pairLabel();
      view.pair.title = `${pairLabel()}. ${message}`;
      view.status.textContent = message;
      view.status.className = showMessage || view.alwaysShowStatus ? 'microbit-pair-status' : 'sr-only';
    }
  }
  function reset(message: string) {
    generation++; face?.disconnect(); face = undefined;
    busy = false; connected = false; showMessage = true; setMessage(message);
  }
  function setMessage(value: string) { message = value; render(); }
  async function pair() {
    if (busy || connected || disposed) return;
    const attempt = ++generation;
    showMessage = false;
    busy = true; setMessage('Choose your microcontroller in the Bluetooth chooser.');
    let candidate: MicrobitFace | undefined;
    try {
      const settings = getMicrocontrollerSettings().ble;
      if (!settings.notify) throw new Error('The city face needs a notification characteristic to confirm its firmware. Command-only profiles can be used in Physical robots.');
      const transport = await connect(settings);
      if (disposed || generation !== attempt) { transport.disconnect(); return; }
      candidate = new MicrobitFace(transport, message => { if (!disposed && generation === attempt) reset(message); }, command => {
        if (!disposed && generation === attempt && !document.hidden && getJourney()) { action(command); tick(); }
      });
      face = candidate;
      setMessage('Checking city face firmware…');
      await candidate.start();
      if (disposed || generation !== attempt) { candidate.disconnect(); return; }
      connected = true; busy = false;
      setMessage(`Connected to ${transport.name}. City face firmware is ready.`);
      tick();
    } catch (error) {
      candidate?.disconnect();
      if (!disposed && generation === attempt) reset(error instanceof Error && error.name === 'NotFoundError' ? `Pairing cancelled. Choose ${pairLabel()} to try again.` : error instanceof Error ? error.message : String(error));
    }
  }
  const tick = () => {
    const journey = document.hidden ? undefined : getJourney();
    face?.update(journeyFace(journey), Date.now(), journey?.message, journey?.moving);
  };
  const timer = window.setInterval(tick, 250);
  document.addEventListener('visibilitychange', tick);
  const disconnect = () => reset('Microcontroller disconnected. Pair again when ready.');
  const reconfigure = () => {
    reset(unsupported ?? 'Microcontroller changed. Reconnecting Bluetooth…');
    if (available && !disposed) void pair();
  };
  microcontrollerChanges.addEventListener('change', reconfigure);
  return {
    disconnect,
    reconnect: reconfigure,
    mountPair(host: HTMLElement, alwaysShowStatus = false) {
      const root = document.createElement('div'); root.className = 'microbit-pair';
      const button = document.createElement('button'); button.classList.add('primary'); button.type = 'button';
      const status = document.createElement('span'); status.className = 'sr-only'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      button.addEventListener('click', pair); root.append(button, status); host.append(root);
      views.push({ root, pair: button, status, alwaysShowStatus }); render();
    },
    dispose() { disposed = true; generation++; face?.disconnect(); window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); microcontrollerChanges.removeEventListener('change', reconfigure); for (const view of views) view.root.remove(); },
  };
}
