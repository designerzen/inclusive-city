import { getMicrocontrollerSettings, microcontrollerPreset, microcontrollers, setMicrocontrollerSettings } from '../robot/physical/microcontroller';
import type { createMicrobitFaceConnection } from './microbitFace';
import './microcontrollerControls.css';

export function mountMicrocontrollerControls(host: HTMLElement, connection: ReturnType<typeof createMicrobitFaceConnection>) {
  host.classList.add('microcontroller-settings');
  host.innerHTML = `<h3 id="options-microcontroller-title">Microcontroller</h3>
    <label for="app-microcontroller">Board</label>
    <select id="app-microcontroller" aria-describedby="app-microcontroller-help">${microcontrollers.map(board => `<option value="${board.id}">${board.label}</option>`).join('')}</select>
    <p id="app-microcontroller-help" class="accessibility-hint">Changing board reconnects Bluetooth. Choose the powered board in the Bluetooth chooser. Arduino presets use Nordic UART with the City Face Arduino firmware.</p>
    <p data-mcu-firmware></p>
    <p data-mcu-help class="accessibility-hint"></p>
    <details><summary>Bluetooth profile</summary>
      <label>Service UUID<input data-mcu="service" spellcheck="false" /></label>
      <label>Write characteristic UUID<input data-mcu="write" spellcheck="false" /></label>
      <label>Notification / indication UUID<input data-mcu="notify" spellcheck="false" /></label>
      <label>Device name prefix (optional)<input data-mcu="namePrefix" maxlength="248" /></label>
      <label>Write mode<select data-mcu="writeMode"><option value="auto">Automatic</option><option value="with-response">With response</option><option value="without-response">Without response</option></select></label>
      <label>Maximum packet size (bytes)<input data-mcu="chunkSize" type="number" min="1" max="512" value="20" /></label>
      <p class="accessibility-hint">Use UUIDs and packet limits from your firmware. Leave notifications empty for command-only physical robots. Start with 20-byte packets. Bluetooth Classic modules such as HC-05 need a gateway.</p>
      <button class="primary" type="button" data-mcu-apply>Apply Bluetooth profile and reconnect</button>
    </details>
    <p data-mcu-status role="status" aria-live="polite"></p>
    <div data-mcu-pair></div><button class="secondary" type="button" data-mcu-disconnect>Disconnect robot face</button>`;
  const board = host.querySelector<HTMLSelectElement>('#app-microcontroller')!;
  const status = host.querySelector<HTMLElement>('[data-mcu-status]')!;
  function render() {
    const settings = getMicrocontrollerSettings(); board.value = settings.board;
    const microbit = settings.board === 'microbit';
    host.querySelector<HTMLElement>('[data-mcu-firmware]')!.innerHTML = microbit
      ? `<a href="${import.meta.env.BASE_URL}firmware/microbit-face/city-face.hex" download>Download micro:bit City Face firmware (.hex)</a>`
      : `<a href="${import.meta.env.BASE_URL}firmware/arduino-city-face/arduino-city-face.ino" download>Download Arduino City Face firmware (.ino)</a> · <a href="${import.meta.env.BASE_URL}firmware/arduino-city-face/README.md" target="_blank" rel="noopener">Setup instructions</a>`;
    host.querySelector<HTMLElement>('[data-mcu-help]')!.textContent = microbit
      ? 'Copy the firmware to the MICROBIT USB drive, then keep the board powered. LEDs show the robot’s face and scroll city messages. A: fix the current issue. B: read and scroll the issue again. A+B: mute or unmute board music.'
      : 'The Arduino firmware uses the built-in LED and USB serial output. Add an external display for a full robot face. Other boards need compatible city face firmware.';
    for (const field of host.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-mcu]')) {
      const key = field.dataset.mcu as keyof typeof settings.ble;
      field.value = String(settings.ble[key] ?? (key === 'writeMode' ? 'auto' : key === 'chunkSize' ? 20 : ''));
    }
  }
  function changeBoard() {
    setMicrocontrollerSettings(microcontrollerPreset(board.value)); render();
    status.textContent = 'Board saved. Bluetooth pairing uses this profile.';
  }
  function apply() {
    try {
      const ble = { ...getMicrocontrollerSettings().ble };
      for (const key of ['service', 'write', 'notify', 'namePrefix'] as const) ble[key] = host.querySelector<HTMLInputElement>(`[data-mcu="${key}"]`)!.value.trim();
      ble.writeMode = host.querySelector<HTMLSelectElement>('[data-mcu="writeMode"]')!.value as typeof ble.writeMode;
      ble.chunkSize = host.querySelector<HTMLInputElement>('[data-mcu="chunkSize"]')!.valueAsNumber;
      if (!setMicrocontrollerSettings({ board: getMicrocontrollerSettings().board, ble })) connection.reconnect();
      render();
      status.textContent = 'Bluetooth profile saved.';
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  }
  render(); connection.mountPair(host.querySelector<HTMLElement>('[data-mcu-pair]')!, true);
  board.addEventListener('change', changeBoard);
  host.querySelector('[data-mcu-apply]')!.addEventListener('click', apply);
  host.querySelector('[data-mcu-disconnect]')!.addEventListener('click', connection.disconnect);
  return () => {
    board.removeEventListener('change', changeBoard);
    host.querySelector('[data-mcu-apply]')!.removeEventListener('click', apply);
    host.querySelector('[data-mcu-disconnect]')!.removeEventListener('click', connection.disconnect);
  };
}
