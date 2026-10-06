import { mapIcon } from './mapIcons';

export function buttonIcon(label: string, id = ''): Parameters<typeof mapIcon>[0] {
  const modules: Record<string, Parameters<typeof mapIcon>[0]> = { vision: 'eye', communication: 'message', memory: 'route', balance: 'angled', hearing: 'volume' };
  if (id.startsWith('function-')) return modules[id.slice(9)] ?? 'robot';
  if (/settings|options/i.test(label)) return 'settings';
  if (id === 'random-name') return 'reset';
  if (id === 'exhibition-play') return 'play';
  if (id === 'exhibition-rewind') return 'undo';
  if (id.startsWith('exhibition-download')) return 'download';
  if (/close|clear|disconnect/i.test(label)) return 'clear';
  if (/unmute/i.test(label)) return 'volume';
  if (/mute/i.test(label)) return 'mute';
  if (/download/i.test(label)) return 'download';
  if (/undo|previous/i.test(label)) return /previous/i.test(label) ? 'left' : 'undo';
  if (/next robot|next preset/i.test(label)) return 'right';
  if (/reset|retry|redraw|replay|again|new city/i.test(label)) return 'reset';
  if (/pause|Ⅱ/i.test(label)) return 'pause';
  if (/stop/i.test(label)) return 'stop';
  if (/play|resume|start robot|▶/i.test(label)) return 'play';
  if (/zoom in/i.test(label)) return 'plus';
  if (/zoom out/i.test(label)) return 'minus';
  for (const direction of ['up', 'down', 'left', 'right'] as const) if (label.toLowerCase().includes(`move ${direction}`)) return direction;
  if (/fit|show goal/i.test(label)) return 'fit';
  if (/3d/i.test(label)) return 'angled';
  if (/map view/i.test(label)) return 'overhead';
  if (/follow robot/i.test(label)) return 'follow';
  if (/robot eye/i.test(label)) return 'eye';
  if (/city changed|at studio/i.test(label)) return 'check';
  if (/artwork|painting/i.test(label)) return 'art';
  if (/midi/i.test(label)) return 'connect';
  if (/edit|change|lower|widen|add|remove|ramp|enable|give|restore|convert/i.test(label)) return 'edit';
  if (/robot/i.test(label)) return 'robot';
  if (/soundtrack|music/i.test(label)) return 'music';
  return 'route';
}

/** CSS masks preserve labels and survive controls whose text changes during rendering. */
export function mountButtonIcons(root: HTMLElement) {
  const update = () => {
    for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
      // Illustrated environment choices already have a full explanatory drawing.
      if (button.classList.contains('environment-choice')) continue;
      const icon = buttonIcon(button.getAttribute('aria-label') ?? button.textContent ?? '', button.id);
      if (button.dataset.buttonIcon === icon) continue;
      button.dataset.buttonIcon = icon;
      const svg = mapIcon(icon).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      button.style.setProperty('--button-icon', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    }
  };
  const observer = new MutationObserver(update);
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
  update();
  return () => observer.disconnect();
}
