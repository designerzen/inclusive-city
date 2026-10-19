import { instrumentNames, type CityInstrument } from '../audio/cityInstruments';

export interface MusicFocus { x: number; y: number; width: number; height: number }
interface VisualCue {
  name: string; kind: CityInstrument; at: number; onsets: number[]; automatic?: boolean;
  source: () => MusicFocus | null; target?: () => MusicFocus | null; detail?: string; label?: string;
}
const symbols: Record<CityInstrument, string> = { bell: '♬', pluck: '♪', water: '≋', drum: '●', whistle: '♫', robot: '↔' };

/** A single audio clock drives the highlight, note trail and beat dots. */
export function visualNoteState(time: number, at: number, onsets: readonly number[]) {
  const age = time - at;
  let index = -1;
  onsets.forEach((onset, i) => { if (onset <= age + 1e-8) index = i; });
  return { age, index, energy: index < 0 ? 0 : Math.exp(-Math.max(0, age - onsets[index]!) * 7),
    expired: age > Math.max(3, (onsets.at(-1) ?? 0) + 2) };
}

export function mountCityMusicVisuals(map: HTMLElement, summary: HTMLElement) {
  const layer = document.createElement('div'); layer.className = 'city-sound-layer'; layer.setAttribute('aria-hidden', 'true');
  map.append(layer);
  const now = document.createElement('div'); now.className = 'city-sound-now'; now.hidden = true;
  now.setAttribute('aria-hidden', 'true'); summary.append(now);
  const cues: { cue: VisualCue; node: HTMLDivElement; focus: HTMLDivElement; badge: HTMLDivElement;
    notes: HTMLSpanElement[]; targetFocus?: HTMLDivElement; svg?: SVGSVGElement; path?: SVGPathElement; travellers?: SVGTextElement[] }[] = [];
  function show(cue: VisualCue) {
    const previous = cues.findIndex(c => c.cue.name === cue.name && c.cue.kind === cue.kind && !!c.cue.target === !!cue.target);
    if (previous >= 0) cues.splice(previous, 1)[0]!.node.remove();
    // Keep the map readable; explicit taps and meetings take precedence over ambience.
    if (cue.automatic && cues.filter(c => c.cue.automatic).length >= 2) return;
    while (cues.length >= 5) {
      const index = Math.max(0, cues.findIndex(c => c.cue.automatic)); cues.splice(index, 1)[0]!.node.remove();
    }
    const node = document.createElement('div'); node.className = 'city-sound-cue'; node.dataset.instrument = cue.kind;
    if (cue.target) node.classList.add('is-exchange');
    const focus = document.createElement('div'); focus.className = 'city-sound-focus'; node.append(focus);
    const badge = document.createElement('div'); badge.className = 'city-sound-badge';
    const icon = document.createElement('span'); icon.className = 'city-sound-symbol'; icon.textContent = symbols[cue.kind];
    const copy = document.createElement('span'), title = document.createElement('strong'), caption = document.createElement('span');
    title.textContent = cue.name; caption.textContent = cue.detail ?? instrumentNames[cue.kind];
    copy.append(title, caption); badge.append(icon, copy);
    const beat = document.createElement('span'); beat.className = 'city-sound-beats';
    const notes = [...new Set(cue.onsets)].map(() => { const note = document.createElement('span'); note.textContent = '♪'; beat.append(note); return note; });
    badge.append(beat); node.append(badge); layer.append(node);
    const entry: typeof cues[number] = { cue: { ...cue, onsets: [...new Set(cue.onsets)] }, node, focus, badge, notes };
    if (cue.target) {
      const targetFocus = document.createElement('div'); targetFocus.className = 'city-sound-focus city-sound-target'; node.prepend(targetFocus);
      const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
      svg.classList.add('city-melody-link');
      const path = document.createElementNS(ns, 'path'); svg.append(path);
      const travellers = [0, 1, 2].map(() => { const note = document.createElementNS(ns, 'text'); note.textContent = '♪'; svg.append(note); return note; });
      node.prepend(svg); Object.assign(entry, { svg, path, travellers, targetFocus });
    }
    cues.push(entry);
  }
  function update(time: number, reducedMotion: boolean, muted: boolean) {
    const width = map.clientWidth, height = map.clientHeight;
    let latest: typeof cues[number] | undefined;
    const occupied: { left: number; top: number; width: number; height: number }[] = [];
    for (let i = cues.length - 1; i >= 0; i--) {
      const entry = cues[i]!, { cue, node, focus, badge, notes } = entry;
      const state = visualNoteState(time, cue.at, cue.onsets);
      if (state.expired) { node.remove(); cues.splice(i, 1); continue; }
      if (!latest || (!cue.automatic && latest.cue.automatic)) latest = entry;
      node.dataset.motion = reducedMotion ? 'reduced' : 'full';
      node.style.setProperty('--sound-energy', String(reducedMotion ? .5 : state.energy));
      const source = cue.source();
      node.hidden = !source || width < 1 || height < 1;
      if (!source || node.hidden) continue;
      const x = Math.max(28, Math.min(width - 28, source.x)), y = Math.max(28, Math.min(height - 28, source.y));
      focus.style.cssText = `left:${x}px;top:${y}px;width:${Math.min(280, source.width)}px;height:${Math.min(220, source.height)}px`;
      const badgeWidth = Math.min(228, Math.max(120, width - 24));
      const left = Math.max(12, Math.min(width - badgeWidth - 12, x - badgeWidth / 2));
      let top = Math.max(12, Math.min(height - 94, y - Math.min(110, source.height / 2) - 96));
      for (let attempt = 0; attempt < 5 && occupied.some(r => left < r.left + r.width && left + badgeWidth > r.left && top < r.top + r.height && top + 88 > r.top); attempt++) {
        top = top + 96 < height - 94 ? top + 96 : Math.max(12, top - 96);
      }
      badge.style.cssText = `left:${left}px;top:${top}px;width:${badgeWidth}px`;
      occupied.push({ left, top, width: badgeWidth, height: 88 });
      notes.forEach((note, index) => { note.className = index === state.index ? 'is-playing' : index < state.index ? 'is-played' : ''; });
      if (entry.svg && entry.path && entry.travellers) {
        const target = cue.target?.(); entry.svg.style.display = target ? '' : 'none';
        if (entry.targetFocus) entry.targetFocus.hidden = !target;
        if (target) {
          const tx = Math.max(28, Math.min(width - 28, target.x)), ty = Math.max(28, Math.min(height - 28, target.y));
          const mx = (x + tx) / 2, my = Math.max(24, Math.min(y, ty) - 70);
          if (entry.targetFocus) entry.targetFocus.style.cssText = `left:${tx}px;top:${ty}px;width:${Math.min(160, target.width)}px;height:${Math.min(160, target.height)}px`;
          entry.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          entry.path.setAttribute('d', `M ${x} ${y} Q ${mx} ${my} ${tx} ${ty}`);
          entry.travellers.forEach((note, n) => {
            const t = reducedMotion ? (n + 1) / 4 : Math.max(0, Math.min(1, (state.age - n * .2) / 1.6));
            note.setAttribute('x', String((1 - t) ** 2 * x + 2 * (1 - t) * t * mx + t * t * tx));
            note.setAttribute('y', String((1 - t) ** 2 * y + 2 * (1 - t) * t * my + t * t * ty));
          });
        }
      }
    }
    now.hidden = !latest || !!latest.cue.label;
    if (latest && !latest.cue.label) {
      now.dataset.instrument = latest.cue.kind;
      const state = visualNoteState(time, latest.cue.at, latest.cue.onsets);
      const text = `${symbols[latest.cue.kind]} ${latest.cue.label ?? (state.age < 0 ? 'Next beat' : latest.cue.target ? 'Melody exchange' : latest.cue.automatic ? 'Playing nearby' : 'You played')}${muted ? ' · muted' : ''}\n${latest.cue.name}\n${latest.cue.detail ?? instrumentNames[latest.cue.kind]}`;
      if (now.textContent !== text) now.textContent = text;
    }
  }
  return { show, update, clear() { cues.splice(0).forEach(c => c.node.remove()); now.hidden = true; },
    dispose() { cues.splice(0).forEach(c => c.node.remove()); layer.remove(); now.remove(); } };
}
