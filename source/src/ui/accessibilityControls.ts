import { applyAccessibility, defaultAccessibility, normalizeAccessibility, savedAccessibility } from '../app/accessibilityPreferences';

export function mountAccessibilityControls(container: HTMLElement) {
  container.innerHTML = `<h3 id="options-accessibility-title">Accessibility</h3>
    <p class="accessibility-hint" id="accessibility-hint">Changes apply straight away and are saved in this browser.</p>
    <div class="accessibility-field"><label for="accessibility-text-size">Text size</label>
      <select id="accessibility-text-size" aria-describedby="text-size-hint"><option value="100">100% (default)</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select>
      <p class="accessibility-hint" id="text-size-hint">Enlarge text throughout the interface.</p></div>
    <div class="accessibility-field"><label for="accessibility-typeface">Typeface</label>
      <select id="accessibility-typeface"><option value="default">Default</option><option value="system">System font</option><option value="arial">Arial</option><option value="verdana">Verdana</option><option value="georgia">Georgia</option><option value="monospace">Monospace</option></select></div>
    <div class="accessibility-field"><label for="accessibility-text-spacing">Text spacing</label>
      <select id="accessibility-text-spacing" aria-describedby="spacing-hint"><option value="standard">Standard</option><option value="spacious">Roomier</option></select>
      <p class="accessibility-hint" id="spacing-hint">Add space between letters, words and lines.</p></div>
    <p class="accessibility-preview">Your robot makes art. You make the city inclusive.</p>
    <div class="accessibility-field"><label for="accessibility-motion">Motion</label>
      <select id="accessibility-motion" aria-describedby="motion-hint"><option value="system">Device setting</option><option value="reduce">Reduced</option></select>
      <p class="accessibility-hint" id="motion-hint">Reduce decorative animation, robot dancing and camera transitions. Your robot still travels through the city.</p></div>
    <button id="accessibility-reset" type="button">Reset accessibility settings</button>
    <p class="accessibility-hint" id="accessibility-status" role="status" aria-live="polite"></p>`;
  const size = container.querySelector<HTMLSelectElement>('#accessibility-text-size')!;
  const typeface = container.querySelector<HTMLSelectElement>('#accessibility-typeface')!;
  const spacing = container.querySelector<HTMLSelectElement>('#accessibility-text-spacing')!;
  const motion = container.querySelector<HTMLSelectElement>('#accessibility-motion')!;
  const status = container.querySelector<HTMLElement>('#accessibility-status')!;
  function sync(preferences = savedAccessibility()) {
    size.value = String(preferences.textSize); typeface.value = preferences.typeface;
    spacing.value = preferences.textSpacing; motion.value = preferences.motion;
  }
  sync();
  container.addEventListener('change', event => {
    if (![size, typeface, spacing, motion].includes(event.target as HTMLSelectElement)) return;
    applyAccessibility(normalizeAccessibility({ textSize: Number(size.value), typeface: typeface.value, textSpacing: spacing.value, motion: motion.value }));
    status.textContent = 'Accessibility settings updated.';
  });
  container.querySelector('#accessibility-reset')!.addEventListener('click', () => {
    applyAccessibility(defaultAccessibility); sync(defaultAccessibility);
    status.textContent = 'Accessibility settings reset. Motion follows your device preference.';
  });
}
