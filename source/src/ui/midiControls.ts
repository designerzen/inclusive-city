import type { CityMidiOutput } from '../audio/MidiOutput';

export function mountMidiControls(container: HTMLElement, midi: CityMidiOutput) {
  container.innerHTML = `<h3>MIDI output</h3><div class="midi-settings">
    <button id="midi-connect" type="button">Enable MIDI</button>
    <button id="midi-disconnect" type="button" disabled>Disconnect MIDI</button>
    <label for="midi-output">Output device</label><select id="midi-output"></select>
    <label for="midi-channel">Channel</label><select id="midi-channel">${Array.from({ length: 16 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select>
    <p id="midi-status" role="status" aria-live="polite"></p>
    <p>Robot cues, soundtrack and journey music play through this output alongside browser audio.</p>
  </div>`;
  const connect = container.querySelector<HTMLButtonElement>('#midi-connect')!;
  const disconnect = container.querySelector<HTMLButtonElement>('#midi-disconnect')!;
  const output = container.querySelector<HTMLSelectElement>('#midi-output')!;
  const channel = container.querySelector<HTMLSelectElement>('#midi-channel')!;
  const status = container.querySelector<HTMLElement>('#midi-status')!;
  midi.onChange = () => {
    const ports = midi.outputs.map(port => new Option(port.name ?? 'MIDI output', port.id));
    if (!ports.some(port => port.value === midi.outputId)) ports.unshift(new Option(midi.outputId ? 'Selected device unavailable' : 'No output connected', midi.outputId));
    output.replaceChildren(...ports);
    output.value = midi.outputId;
    output.disabled = !midi.isEnabled || !midi.outputs.length;
    channel.value = String(midi.midiChannel);
    status.textContent = midi.supported ? midi.status : 'Web MIDI requires a supported browser and HTTPS or localhost.';
    connect.disabled = !midi.supported || midi.isEnabled;
    disconnect.disabled = !midi.isEnabled;
    channel.disabled = !midi.isEnabled;
  };
  connect.addEventListener('click', () => { void midi.connect(); });
  disconnect.addEventListener('click', () => midi.disconnect());
  output.addEventListener('change', () => midi.select(output.value));
  channel.addEventListener('change', () => midi.setChannel(Number(channel.value)));
  midi.onChange();
}
