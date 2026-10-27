import type { BarcodeValue } from '../city/projectionSettings';
import type { configurationProjection } from '../city/configurationProjection';

export function mountBarcodePicker(svg: SVGElement, title: string, getValue: () => BarcodeValue, save: (value: BarcodeValue) => void) {
  const dialog = document.createElement('dialog');
  dialog.className = 'barcode-picker';
  dialog.setAttribute('aria-labelledby', 'barcode-picker-title');
  dialog.innerHTML = `<h2 id="barcode-picker-title">${title} barcode</h2><div class="barcode-tabs" role="tablist" aria-label="Number of bits"></div><p>Choose the value to draw. Changes save automatically.</p><div id="barcode-values" role="tabpanel"></div><button type="button" class="primary barcode-done">Done</button>`;
  document.body.append(dialog);
  const tabs = dialog.querySelector<HTMLElement>('.barcode-tabs')!;
  const values = dialog.querySelector<HTMLElement>('#barcode-values')!;
  let active = getValue().bits;
  let origin = 0;
  function renderValues() {
    const selection = getValue();
    values.setAttribute('aria-labelledby', `barcode-tab-${active}`);
    values.innerHTML = `<fieldset><legend>${active} bit: 0–${2 ** active - 1}</legend><div class="barcode-values">${Array.from({ length: 2 ** active }, (_, value) => `<label><input type="radio" name="barcode-value" value="${value}" ${selection.bits === active && selection.value === value ? 'checked' : ''}><span>${value}<small>${value.toString(2).padStart(active, '0')}</small></span></label>`).join('')}</div></fieldset>`;
    tabs.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      const selected = Number(button.dataset.bits) === active;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }
  for (let bits = 1; bits <= 8; bits++) {
    const tab = document.createElement('button'); tab.classList.add('tertiary');
    tab.type = 'button'; tab.role = 'tab'; tab.id = `barcode-tab-${bits}`;
    tab.dataset.bits = String(bits); tab.textContent = `${bits} bit`;
    tab.setAttribute('aria-controls', 'barcode-values');
    tab.addEventListener('click', () => { active = bits; renderValues(); });
    tab.addEventListener('keydown', event => {
      let next = bits;
      if (event.key === 'ArrowRight') next = bits % 8 + 1;
      else if (event.key === 'ArrowLeft') next = (bits + 6) % 8 + 1;
      else if (event.key === 'Home') next = 1;
      else if (event.key === 'End') next = 8;
      else return;
      event.preventDefault(); active = next; renderValues();
      tabs.querySelector<HTMLButtonElement>(`[data-bits="${next}"]`)!.focus();
    });
    tabs.append(tab);
  }
  values.addEventListener('change', event => {
    if (event.target instanceof HTMLInputElement) save({ bits: active, value: Number(event.target.value) });
  });
  dialog.querySelector('button.barcode-done')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => svg.querySelector<SVGGElement>(`[data-barcode-index="${origin}"]`)?.focus());
  function activate(event: Event) {
    const target = event.target instanceof Element ? event.target.closest<SVGGElement>('.track-barcode') : null;
    if (!target) return;
    event.preventDefault(); origin = Number(target.dataset.barcodeIndex);
    active = getValue().bits; renderValues(); dialog.showModal();
    tabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')!.focus();
  }
  svg.addEventListener('click', activate);
  svg.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') activate(event); });
}

export function renderBarcodeTargets(svg: SVGElement, projection: ReturnType<typeof configurationProjection>, targetSize: number) {
  const groups = svg.querySelectorAll<SVGGElement>('g[data-code]');
  projection.markers.forEach((marker, index) => {
    const group = groups[index]!;
    // Axis-aligned bounds include every bar, with a full CSS-sized target even for tiny codes.
    const bounds = marker.bars.flatMap(bar => {
      const angle = bar.angle * Math.PI / 180;
      const x = (Math.abs(Math.cos(angle)) * projection.barcodeWidth + Math.abs(Math.sin(angle)) * bar.width) / 2;
      const z = (Math.abs(Math.sin(angle)) * projection.barcodeWidth + Math.abs(Math.cos(angle)) * bar.width) / 2;
      return [{ x: bar.x - x, z: bar.z - z }, { x: bar.x + x, z: bar.z + z }];
    });
    const minX = Math.min(...bounds.map(p => p.x)), maxX = Math.max(...bounds.map(p => p.x));
    const minZ = Math.min(...bounds.map(p => p.z)), maxZ = Math.max(...bounds.map(p => p.z));
    const width = Math.max(targetSize, maxX - minX), height = Math.max(targetSize, maxZ - minZ);
    group.classList.add('track-barcode'); group.dataset.barcodeIndex = String(index);
    group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
    group.setAttribute('aria-haspopup', 'dialog');
    group.setAttribute('aria-label', `Edit ${marker.label} barcode: ${marker.bits} bit, value ${marker.code}`);
    group.insertAdjacentHTML('afterbegin', `<rect class="barcode-target" x="${(minX + maxX - width) / 2}" y="${(minZ + maxZ - height) / 2}" width="${width}" height="${height}" fill="transparent"/>`);
  });
}
