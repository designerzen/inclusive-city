import { musicMonitorChanges, musicMonitorPreferences, setMusicMonitorPreferences } from '../app/musicMonitorPreferences';

export function mountMusicMonitorControls(container: HTMLElement, prefix: string) {
  container.innerHTML = `<label for="${prefix}-enabled">Realtime music monitor</label>
    <select id="${prefix}-enabled"><option value="off">Off</option><option value="on">On</option></select>
    <label for="${prefix}-mode">Monitor display</label>
    <select id="${prefix}-mode"><option value="notes">Note names</option><option value="notation">Staff notation</option></select>
    <p>Shows journey music as it plays. Turning the monitor off keeps the music playing.</p>`;
  const [enabled, mode] = container.querySelectorAll<HTMLSelectElement>('select');
  function sync() {
    const preference = musicMonitorPreferences();
    enabled!.value = preference.enabled ? 'on' : 'off';
    mode!.value = preference.mode; mode!.disabled = !preference.enabled;
  }
  container.addEventListener('change', () => setMusicMonitorPreferences({ enabled: enabled!.value === 'on', mode: mode!.value as 'notes' | 'notation' }));
  musicMonitorChanges.addEventListener('change', sync); sync();
  return () => musicMonitorChanges.removeEventListener('change', sync);
}
