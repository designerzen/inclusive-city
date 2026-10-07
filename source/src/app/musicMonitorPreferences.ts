export interface MusicMonitorPreferences { enabled: boolean; mode: 'notes' | 'notation' }
const storageKey = 'inclusive-city-music-monitor';
export function normalizeMusicMonitor(value: unknown): MusicMonitorPreferences {
  const data = value && typeof value === 'object' ? value as Partial<MusicMonitorPreferences> : {};
  return { enabled: data.enabled === true, mode: data.mode === 'notation' ? 'notation' : 'notes' };
}
export function savedMusicMonitor(): MusicMonitorPreferences {
  try { return normalizeMusicMonitor(JSON.parse(localStorage.getItem(storageKey) ?? 'null')); }
  catch { return normalizeMusicMonitor(null); }
}
let current: MusicMonitorPreferences | undefined;
export const musicMonitorChanges = new EventTarget();
export function musicMonitorPreferences() { return current ??= savedMusicMonitor(); }
export function setMusicMonitorPreferences(value: MusicMonitorPreferences) {
  current = normalizeMusicMonitor(value);
  try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* Keep the session preference. */ }
  musicMonitorChanges.dispatchEvent(new Event('change'));
}
