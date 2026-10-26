import type { configurationProjection } from '../city/configurationProjection';

export function renderConfigurationSignals(svg: SVGElement, projection: ReturnType<typeof configurationProjection>) {
  svg.insertAdjacentHTML('beforeend', projection.signals.map((signal, index) => `
    <g class="track-signal" data-approach="${index}" data-code="${signal.code.toString(2).padStart(4, '0')}" transform="translate(${signal.x} ${signal.z})" role="button" tabindex="0">
      <rect class="track-signal-target" x="${-signal.target / 2}" y="${-signal.target / 2}" width="${signal.target}" height="${signal.target}" rx="${signal.target / 10}" fill="transparent"/>
      <rect x="${-signal.target * .2}" y="${-signal.target * .45}" width="${signal.target * .4}" height="${signal.target * .9}" rx="${signal.target * .08}" fill="#17212b"/>
      <circle class="track-signal-red" cx="0" cy="${-signal.target * .28}" r="${signal.target * .12}"/>
      <circle class="track-signal-amber" cx="0" cy="0" r="${signal.target * .12}"/>
      <circle class="track-signal-green" cx="0" cy="${signal.target * .28}" r="${signal.target * .12}"/>
    </g>`).join(''));
  updateConfigurationSignals(svg, svg.dataset.light ?? 'off', Number(svg.dataset.barcodeStop ?? -1), svg.dataset.signalsEnabled === 'true');
}

export function approachLight(light: string, barcodeStop: number, approach: number, count: number) {
  if (light === 'off') return 'off';
  return approach === Math.max(0, barcodeStop) % count ? light : light === 'red' ? 'green' : 'red';
}

export function updateConfigurationSignals(svg: SVGElement, light: string, barcodeStop = -1, enabled = false) {
  svg.dataset.light = light;
  svg.dataset.barcodeStop = String(barcodeStop);
  svg.dataset.signalsEnabled = String(enabled);
  const signals = svg.querySelectorAll<SVGGElement>('.track-signal');
  signals.forEach((signal, index) => {
    const state = approachLight(light, barcodeStop, index, signals.length);
    signal.dataset.light = state;
    signal.setAttribute('aria-disabled', String(!enabled));
    signal.setAttribute('aria-label', `Approach ${index + 1} traffic lights beside barcode ${signal.dataset.code}: ${state}. Continue now${enabled ? '' : ' (pair robot first or wait for confirmation)'}`);
  });
}
