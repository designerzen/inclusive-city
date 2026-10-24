import { BleRobotTransport, bluetoothAvailable, microbitUart } from '../robot/physical/transport';
import { MicrobitFace, journeyFace, type FaceJourney } from '../robot/microbitFace';
import './microbitFace.css';

export function mountMicrobitFaceSetup(host: HTMLElement) {
  const panel = document.createElement('details'); panel.className = 'microbit-face';
  panel.innerHTML = `<summary>micro:bit robot face</summary>
    <p>Power on your flashed micro:bit, then use Pair micro:bit face on the splash screen or city top bar. Its 5 × 5 LEDs mirror your robot’s mood. When it speaks, the mouth moves and its city message scrolls across the display.</p>
    <p><a href="${import.meta.env.BASE_URL}firmware/microbit-face/city-face.hex" download>Download city face firmware (.hex)</a> · Copy it to the MICROBIT USB drive, then keep the board powered by USB or battery.</p>
    <p>After a power cycle or disconnection, the pairing button returns to the city top bar.</p>`;
  host.append(panel);
  return { dispose() { panel.remove(); } };
}

/** One connection survives the splash → designer → city navigation. */
export function createMicrobitFaceConnection(getJourney: () => FaceJourney | undefined,
  connect = () => BleRobotTransport.connect(microbitUart)) {
  const available = window.isSecureContext && bluetoothAvailable();
  let message = available ? 'Look for the Bluetooth symbol on your micro:bit.' : 'Pairing needs HTTPS or localhost and a Web Bluetooth browser such as Chrome or Edge.';
  let face: MicrobitFace | undefined, disposed = false, generation = 0, busy = false, connected = false;
  let showMessage = !available;
  const views: { root: HTMLElement; pair: HTMLButtonElement; status: HTMLElement }[] = [];
  function render() {
    for (const view of views) {
      view.pair.hidden = connected;
      view.pair.disabled = busy || !available;
      view.pair.textContent = busy ? 'Pairing micro:bit…' : 'Pair micro:bit face';
      view.pair.title = `Pair micro:bit face. ${message}`;
      view.status.textContent = message;
      view.status.className = showMessage ? 'microbit-pair-status' : 'sr-only';
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
    busy = true; setMessage('Choose your BBC micro:bit in the Bluetooth chooser.');
    let candidate: MicrobitFace | undefined;
    try {
      const transport = await connect();
      if (disposed || generation !== attempt) { transport.disconnect(); return; }
      candidate = new MicrobitFace(transport, message => { if (!disposed && generation === attempt) reset(message); });
      face = candidate;
      setMessage('Checking city face firmware…');
      await candidate.start();
      if (disposed || generation !== attempt) { candidate.disconnect(); return; }
      connected = true; busy = false;
      setMessage(`Connected to ${transport.name}. LEDs follow your city robot.`);
      tick();
    } catch (error) {
      candidate?.disconnect();
      if (!disposed && generation === attempt) reset(error instanceof Error && error.name === 'NotFoundError' ? 'Pairing cancelled. Choose Pair micro:bit face to try again.' : error instanceof Error ? error.message : String(error));
    }
  }
  const tick = () => {
    const journey = document.hidden ? undefined : getJourney();
    face?.update(journeyFace(journey), Date.now(), journey?.message);
  };
  const timer = window.setInterval(tick, 250);
  document.addEventListener('visibilitychange', tick);
  return {
    mountPair(host: HTMLElement) {
      const root = document.createElement('div'); root.className = 'microbit-pair';
      const button = document.createElement('button'); button.type = 'button';
      const status = document.createElement('span'); status.className = 'sr-only'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      button.addEventListener('click', pair); root.append(button, status); host.append(root);
      views.push({ root, pair: button, status }); render();
    },
    dispose() { disposed = true; generation++; face?.disconnect(); window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); for (const view of views) view.root.remove(); },
  };
}
