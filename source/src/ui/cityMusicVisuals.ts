import { type CityInstrument } from '../audio/cityInstruments';

export interface MusicFocus { x: number; y: number; width: number; height: number }
interface VisualCue {
  name: string; kind: CityInstrument; at: number; onsets: number[]; automatic?: boolean;
  source: () => MusicFocus | null; target?: () => MusicFocus | null; detail?: string; label?: string;
}

/** A single audio clock drives the highlight, note trail and beat dots. */
export function visualNoteState(time: number, at: number, onsets: readonly number[]) {
  const age = time - at;
  let index = -1;
  onsets.forEach((onset, i) => { if (onset <= age + 1e-8) index = i; });
  return { age, index, energy: index < 0 ? 0 : Math.exp(-Math.max(0, age - onsets[index]!) * 7),
    expired: age > Math.max(3, (onsets.at(-1) ?? 0) + 2) };
}

export function mountCityMusicVisuals(map: HTMLElement) {
  const layer = document.createElement('div'); layer.className = 'city-sound-layer'; layer.setAttribute('aria-hidden', 'true');
  map.append(layer);
  const cues: { cue: VisualCue; node: HTMLDivElement; focus: HTMLDivElement; targetFocus?: HTMLDivElement; svg?: SVGSVGElement; path?: SVGPathElement; travellers?: SVGTextElement[] }[] = [];
  function show(cue: VisualCue) {
    const previous = cues.findIndex(c => c.cue.name === cue.name && c.cue.kind === cue.kind && !!c.cue.target === !!cue.target);
    if (previous >= 0) cues.splice(previous, 1)[0]!.node.remove();
    // Keep the map readable; explicit taps and meetings take precedence over ambience.
    if (cue.automatic && cues.length > 0) return;
    while (cues.length >= 1) {
      const index = Math.max(0, cues.findIndex(c => c.cue.automatic)); cues.splice(index, 1)[0]!.node.remove();
    }
    const node = document.createElement('div'); node.className = 'city-sound-cue'; node.dataset.instrument = cue.kind;
    if (cue.target) node.classList.add('is-exchange');
    const focus = document.createElement('div'); focus.className = 'city-sound-focus'; node.append(focus);
    layer.append(node);
    const entry: typeof cues[number] = { cue: { ...cue, onsets: [...new Set(cue.onsets)] }, node, focus };
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
  function update(time: number, reducedMotion: boolean) {
    const width = map.clientWidth, height = map.clientHeight;
    for (let i = cues.length - 1; i >= 0; i--) {
      const entry = cues[i]!, { cue, node, focus } = entry;
      const state = visualNoteState(time, cue.at, cue.onsets);
      if (state.expired) { node.remove(); cues.splice(i, 1); continue; }
      node.dataset.motion = reducedMotion ? 'reduced' : 'full';
      node.style.setProperty('--sound-energy', String(reducedMotion ? .5 : state.energy));
      const source = cue.source();
      node.hidden = !source || width < 1 || height < 1;
      if (!source || node.hidden) continue;
      const x = Math.max(28, Math.min(width - 28, source.x)), y = Math.max(28, Math.min(height - 28, source.y));
      focus.style.cssText = `left:${x}px;top:${y}px;width:${Math.min(280, source.width)}px;height:${Math.min(220, source.height)}px`;
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
  }
  return { show, update, clear() { cues.splice(0).forEach(c => c.node.remove()); },
    dispose() { cues.splice(0).forEach(c => c.node.remove()); layer.remove(); } };
}
