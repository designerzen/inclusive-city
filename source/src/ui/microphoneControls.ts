import { discoverMicrophones, onMicrophoneChange, selectedMicrophone, selectMicrophone } from '../audio/microphone';
import type { MicrophoneDevices } from '../audio/microphone';
import { readVoiceCommandModel, saveVoiceCommandModel } from '../audio/voiceCommandSettings';

export function mountMicrophoneControls(container: HTMLElement, media: MicrophoneDevices | undefined = navigator.mediaDevices) {
  container.innerHTML = `<h3 id="options-microphone-title">Microphone</h3>
    <div class="accessibility-field"><label for="app-command-model">Spoken command model</label>
    <select id="app-command-model"><option value="moonshine">Moonshine — transcription to action</option><option value="neudecide">NeuDecide — private model files required</option></select>
    <label for="app-microphone">Speech input</label>
    <select id="app-microphone" aria-describedby="microphone-hint"><option value="">System default</option></select>
    <p id="microphone-hint" class="accessibility-hint">Used for spoken city commands and prompt recording. Changing it stops any recording in progress.</p>
    <button class="secondary" type="button" id="microphone-discover">Find microphones</button>
    <p id="microphone-status" class="accessibility-hint" role="status" aria-live="polite">Choose Find microphones to allow access and show device names. The microphone is released after discovery.</p></div>`;
  const select = container.querySelector<HTMLSelectElement>('#app-microphone')!;
  const model = container.querySelector<HTMLSelectElement>('#app-command-model')!; model.value = readVoiceCommandModel();
  const changeModel = () => { saveVoiceCommandModel(model.value === 'neudecide' ? 'neudecide' : 'moonshine'); };
  model.addEventListener('change', changeModel);
  const button = container.querySelector<HTMLButtonElement>('#microphone-discover')!;
  const status = container.querySelector<HTMLElement>('#microphone-status')!;
  let disposed = false, generation = 0;
  function render(devices: MediaDeviceInfo[]) {
    const saved = selectedMicrophone();
    const options = [new Option('System default', '')];
    devices.forEach((device, index) => options.push(new Option(device.label || `Microphone ${index + 1}`, device.deviceId)));
    if (saved && !devices.some(device => device.deviceId === saved)) options.push(new Option('Saved microphone (unavailable or access needed)', saved));
    select.replaceChildren(...options); select.value = saved;
  }
  render([]);
  async function refresh(requestAccess = false) {
    if (disposed) return;
    if (!media?.enumerateDevices || !media.getUserMedia) {
      button.disabled = true; select.disabled = true; status.textContent = 'Microphone selection needs a supported browser and secure connection.'; return;
    }
    const current = ++generation;
    button.disabled = true;
    try {
      const devices = await discoverMicrophones(media, requestAccess);
      if (disposed || current !== generation) return;
      render(devices);
      status.textContent = selectedMicrophone() && !devices.some(device => device.deviceId === selectedMicrophone())
        ? 'The saved microphone is unavailable or needs permission. Find microphones or choose System default.'
        : devices.length ? 'Microphones updated. Your choice is saved for commands and prompt recording.'
          : 'No named microphones are available yet. Choose Find microphones to allow access, or connect a microphone.';
    } catch (error) {
      if (!disposed && current === generation) status.textContent = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow access in your browser, then try Find microphones again.' : 'Could not find microphones. Check the connection and try again.';
    } finally { if (!disposed && current === generation) button.disabled = false; }
  }
  const change = () => { selectMicrophone(select.value); status.textContent = 'Microphone selected. Use Speak or Record when you are ready.'; };
  const discover = () => { void refresh(true); };
  const deviceChange = () => { void refresh(); };
  const unsubscribe = onMicrophoneChange(() => { select.value = selectedMicrophone(); });
  select.addEventListener('change', change); button.addEventListener('click', discover); media?.addEventListener('devicechange', deviceChange);
  void refresh();
  return { refresh, dispose() {
    disposed = true; ++generation; unsubscribe(); media?.removeEventListener('devicechange', deviceChange);
    select.removeEventListener('change', change); button.removeEventListener('click', discover);
    model.removeEventListener('change', changeModel);
  } };
}
