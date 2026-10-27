import './robotComms.css';
import { BleRobotTransport, bluetoothAvailable, bluetoothUnavailableReason, microbitUart } from './robot/physical/transport';
import { CommsDecoder, commsMessages, encodeCommand, messagePixels, parseCommsFrame } from './robot/commsProtocol';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const connect = element<HTMLButtonElement>('connect'), disconnect = element<HTMLButtonElement>('disconnect');
const autoOn = element<HTMLButtonElement>('auto-on'), autoOff = element<HTMLButtonElement>('auto-off');
const log = element<HTMLOListElement>('log');
let transport: BleRobotTransport | undefined, decoder = new CommsDecoder(), connecting = false;
let pending: number | undefined, ackTimer: ReturnType<typeof setTimeout> | undefined, writing = false;
const encoder = new TextEncoder();
const buttons = commsMessages.map((name, code) => {
  const button = document.createElement('button'); button.classList.add('secondary');
  button.innerHTML = `<span class="code">${code.toString(16).toUpperCase()} · ${code.toString(2).padStart(4, '0')}</span>${name}`;
  button.disabled = true;
  button.addEventListener('click', () => { void sendCommand(code); });
  element('commands').append(button); return button;
});
const leds = Array.from({ length: 25 }, () => { const led = document.createElement('span'); led.className = 'led'; led.ariaHidden = 'true'; element('leds').append(led); return led; });
function addLog(direction: string, text: string) {
  const item = document.createElement('li'); item.textContent = `${new Date().toLocaleTimeString()}  ${direction}  ${text}`;
  log.prepend(item); while (log.children.length > 200) log.lastElementChild?.remove();
}
function updateControls() {
  connect.disabled = connecting || !!transport || !bluetoothAvailable() || !window.isSecureContext;
  connect.textContent = connecting ? 'Connecting…' : 'Connect micro:bit';
  disconnect.disabled = !transport;
  for (const button of [...buttons, autoOn, autoOff]) button.disabled = !transport || writing || pending !== undefined;
}
function clearPending() { clearTimeout(ackTimer); ackTimer = undefined; pending = undefined; }
function reset(reason: string) {
  const old = transport; transport = undefined; old?.disconnect();
  clearPending(); writing = false; decoder = new CommsDecoder();
  element('status').textContent = 'Disconnected'; element('status-dot').classList.remove('connected');
  element('notice').textContent = reason; element('ack').textContent = 'No active command. Reconnect to continue.';
  element('auto-status').textContent = 'Occasional signals: off (disconnected).';
  updateControls(); addLog('INFO', reason);
}
function receive(bytes: Uint8Array) {
  for (const line of decoder.accept(bytes)) {
    addLog('RX', line); const frame = parseCommsFrame(line);
    if (!frame) { addLog('WARN', 'Unrecognised frame. Check that Robot Comms firmware is installed.'); continue; }
    if (frame.kind === 'ACK') {
      if (pending === frame.code) { clearPending(); element('ack').textContent = `Confirmed: ${commsMessages[frame.code]} (${frame.code.toString(16).toUpperCase()}) received by micro:bit.`; updateControls(); }
      else addLog('WARN', 'Unexpected acknowledgement; no matching pending command.');
    } else if (frame.kind === 'SIG' || frame.kind === 'CMD') {
      element('latest').textContent = `${frame.code.toString(16).toUpperCase()} · ${commsMessages[frame.code]}`;
      element('received').textContent = `${frame.kind === 'CMD' ? 'Command' : 'Signal'} from micro:bit at ${new Date().toLocaleTimeString()}`;
      const pixels = messagePixels(frame.code); leds.forEach((led, i) => led.classList.toggle('on', pixels[i]!));
      element('leds').ariaLabel = `Message ${frame.code.toString(16).toUpperCase()}: ${commsMessages[frame.code]}, binary ${frame.code.toString(2).padStart(4, '0')}`;
    } else if (frame.kind === 'AUTO') element('auto-status').textContent = `Occasional signals: ${frame.enabled ? 'on — one random message every 8 seconds' : 'off'}.`;
    else if (frame.kind === 'ERR') { element('notice').textContent = `Firmware error: ${frame.reason}`; }
  }
}
async function write(text: string) {
  const current = transport; if (!current) return false;
  writing = true; updateControls();
  try { await current.send(encoder.encode(text)); if (transport !== current) return false; addLog('TX', text.trim()); return true; }
  catch (error) { if (transport === current) reset(`Write failed: ${String(error)}`); return false; }
  finally { writing = false; updateControls(); }
}
async function sendCommand(code: number) {
  if (!transport || writing || pending !== undefined) return;
  pending = code; element('ack').textContent = `Awaiting acknowledgement: ${commsMessages[code]}…`;
  // Start before writing: an ACK may arrive before the write promise resolves.
  ackTimer = setTimeout(() => {
    clearPending(); element('ack').textContent = 'No ACK after 5 seconds. Delivery is unconfirmed; check firmware and try again.';
    addLog('WARN', 'ACK timeout. Command was not retried.'); updateControls();
  }, 5000);
  await write(encodeCommand(code));
}
connect.addEventListener('click', async () => {
  if (connecting || transport) return;
  connecting = true; updateControls();
  try {
    transport = await BleRobotTransport.connect(microbitUart); decoder = new CommsDecoder();
    transport.onData = receive; transport.onDisconnect = reason => reset(reason);
    element('status').textContent = `Connected · ${transport.name}`; element('status-dot').classList.add('connected');
    element('notice').textContent = 'Connected. Send a command below, or press B on the micro:bit.';
    element('ack').textContent = 'No commands awaiting acknowledgement.'; addLog('INFO', `Connected to ${transport.name}`);
    await write('AUTO:0\n');
  } catch (error) { reset(`Could not connect: ${error instanceof Error ? error.message : String(error)}. Check firmware, Bluetooth and OS pairing settings.`); }
  finally { connecting = false; updateControls(); }
});
disconnect.addEventListener('click', () => reset('Disconnected by you.'));
autoOn.addEventListener('click', () => { void write('AUTO:1\n'); });
autoOff.addEventListener('click', () => { void write('AUTO:0\n'); });
element('clear').addEventListener('click', () => log.replaceChildren());
window.addEventListener('pagehide', () => transport?.disconnect());
const unsupported = bluetoothUnavailableReason();
if (unsupported) element('support').textContent = unsupported;
updateControls();
