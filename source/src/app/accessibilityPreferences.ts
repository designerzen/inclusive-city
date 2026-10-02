export const textSizes = [100, 125, 150, 200] as const;
export const typefaces = {
  default: '',
  system: 'system-ui, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  monospace: 'ui-monospace, Consolas, monospace',
};
export interface AccessibilityPreferences {
  textSize: typeof textSizes[number];
  typeface: keyof typeof typefaces;
  textSpacing: 'standard' | 'spacious';
  motion: 'system' | 'reduce';
}
export const defaultAccessibility: AccessibilityPreferences = {
  textSize: 100, typeface: 'default', textSpacing: 'standard', motion: 'system',
};
const storageKey = 'inclusive-city-accessibility';

/** Only supported choices can reach CSS or scene behaviour, including old saved data. */
export function normalizeAccessibility(value: unknown): AccessibilityPreferences {
  const data = value && typeof value === 'object' ? value as Partial<AccessibilityPreferences> : {};
  return {
    textSize: textSizes.includes(data.textSize!) ? data.textSize! : 100,
    typeface: data.typeface && Object.hasOwn(typefaces, data.typeface) ? data.typeface : 'default',
    textSpacing: data.textSpacing === 'spacious' ? 'spacious' : 'standard',
    motion: data.motion === 'reduce' ? 'reduce' : 'system',
  };
}
export function savedAccessibility(): AccessibilityPreferences {
  try { return normalizeAccessibility(JSON.parse(localStorage.getItem(storageKey) ?? 'null')); }
  catch { return { ...defaultAccessibility }; }
}

/** A shared live preference lets every scene respect both Settings and the device. */
export function createMotionPreference(device: Pick<MediaQueryList, 'matches' | 'addEventListener'>, reduce = false) {
  let forced = reduce;
  let matches = forced || device.matches;
  function update() {
    const next = forced || device.matches;
    if (next === matches) return;
    matches = next;
    preference.dispatchEvent(new Event('change'));
  }
  device.addEventListener('change', update);
  class MotionPreference extends EventTarget {
    get matches() { return matches; }
    setReduced(value: boolean) { forced = value; update(); }
  }
  const preference = new MotionPreference();
  return preference;
}
let motionPreference: ReturnType<typeof createMotionPreference> | undefined;
export function reducedMotionPreference() {
  if (!motionPreference) {
    motionPreference = createMotionPreference(window.matchMedia('(prefers-reduced-motion: reduce)'));
    motionPreference.addEventListener('change', () => {
      document.documentElement.dataset.reducedMotion = String(motionPreference!.matches);
    });
  }
  return motionPreference;
}
export function applyAccessibility(value: AccessibilityPreferences) {
  const preferences = normalizeAccessibility(value);
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(preferences.textSize / 100));
  if (preferences.typeface === 'default') root.style.removeProperty('--reading-font');
  else root.style.setProperty('--reading-font', typefaces[preferences.typeface]);
  root.dataset.textSize = String(preferences.textSize);
  root.dataset.textSpacing = preferences.textSpacing;
  const motion = reducedMotionPreference();
  motion.setReduced(preferences.motion === 'reduce');
  root.dataset.reducedMotion = String(motion.matches);
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Keep the session preference when storage is unavailable. */ }
}
