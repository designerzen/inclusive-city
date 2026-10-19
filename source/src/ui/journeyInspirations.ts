import type { JourneyInspiration } from '../city/journeyInspirations';
export { journeyInspiration, type JourneyInspiration } from '../city/journeyInspirations';

/** Descriptions remain readable by touch, keyboard, with muted audio and reduced motion. */
export function inspirationItem(inspiration: JourneyInspiration) {
  const item = document.createElement('li'), symbol = document.createElement('span');
  symbol.textContent = inspiration.symbol; symbol.setAttribute('aria-hidden', 'true');
  const copy = document.createElement('div'), name = document.createElement('strong'), description = document.createElement('p');
  name.textContent = inspiration.name; description.textContent = inspiration.description;
  copy.append(name, description); item.append(symbol, copy); return item;
}
