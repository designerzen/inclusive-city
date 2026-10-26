import type { configurationProjection } from '../city/configurationProjection';

export function renderConfigurationSignals(svg: SVGElement, projection: ReturnType<typeof configurationProjection>) {
  svg.insertAdjacentHTML('beforeend', projection.signals.map((signal, index) => `
    <g class="track-signal" data-approach="${index}" data-code="${signal.code.toString(2).padStart(4, '0')}" transform="translate(${signal.x} ${signal.z})" role="img">
      <rect x="-.7" y="-1.6" width="1.4" height="3.2" rx=".3" fill="#17212b"/>
      <circle class="track-signal-red" cx="0" cy="-1" r=".44"/>
      <circle class="track-signal-amber" cx="0" cy="0" r=".44"/>
      <circle class="track-signal-green" cx="0" cy="1" r=".44"/>
    </g>`).join(''));
  updateConfigurationSignals(svg, svg.dataset.light ?? 'off', Number(svg.dataset.barcodeStop ?? -1));
}

export function approachLight(light: string, barcodeStop: number, approach: number, count: number) {
  if (light === 'off') return 'off';
  return approach === Math.max(0, barcodeStop) % count ? light : light === 'red' ? 'green' : 'red';
}

export function updateConfigurationSignals(svg: SVGElement, light: string, barcodeStop = -1) {
  svg.dataset.light = light;
  svg.dataset.barcodeStop = String(barcodeStop);
  const signals = svg.querySelectorAll<SVGGElement>('.track-signal');
  signals.forEach((signal, index) => {
    const state = approachLight(light, barcodeStop, index, signals.length);
    signal.dataset.light = state;
    signal.setAttribute('aria-label', `Approach ${index + 1} traffic lights beside barcode ${signal.dataset.code}: ${state}`);
  });
}
