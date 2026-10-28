export type ProjectionLog = (event: string, data?: unknown) => void;

/** Retain the full session; build the visible history only when requested. */
export function mountProjectionLog(parent: HTMLElement): ProjectionLog {
  const entries: { time: string; event: string; data?: unknown }[] = [];
  const details = document.createElement('details');
  details.className = 'projection-log';
  details.innerHTML = '<summary>Data & event log (0)</summary><button type="button">Download full log</button><ol aria-label="Data and events"></ol>';
  parent.append(details);
  const summary = details.querySelector('summary')!;
  const list = details.querySelector('ol')!;
  let displayed = 0;
  function showEntries() {
    if (!details.open) return;
    for (; displayed < entries.length; displayed++) {
      const entry = entries[displayed]!;
      const item = document.createElement('li');
      item.textContent = `${entry.time} ${entry.event}${entry.data === undefined ? '' : ` ${JSON.stringify(entry.data)}`}`;
      list.append(item);
    }
  }
  details.addEventListener('toggle', showEntries);
  details.querySelector('button')!.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'track-event-log.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return (event, data) => {
    entries.push({ time: new Date().toISOString(), event, data: data === undefined ? undefined : structuredClone(data) });
    summary.textContent = `Data & event log (${entries.length})`;
    showEntries();
  };
}
