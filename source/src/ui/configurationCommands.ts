import { commsMessages, encodeCommand } from '../robot/commsProtocol';
import { defaultTrafficLightCommands, validateTrafficLightCommands } from '../robot/physical/trafficLightCommands';
import type { ProjectionConfiguration } from '../city/configurationProjection';

export function mountConfigurationCommands(panel: HTMLElement, configuration: ProjectionConfiguration) {
  const count = configuration === 'figure-eight' ? 2 : 1;
  const key = `inclusive-city-traffic-commands-${configuration}`;
  let commands = defaultTrafficLightCommands(count);
  try { const saved = localStorage.getItem(key); if (saved) commands = validateTrafficLightCommands(JSON.parse(saved), count); } catch { /* Use defaults for unavailable or invalid storage. */ }
  const section = document.createElement('section');
  section.className = 'configuration-commands';
  section.innerHTML = `<h2>Bluetooth commands</h2><p>After reading the whole barcode and stopping, the robot sends SIG:2. The timer or a click on a traffic light sends the command below. Clicking gives that approach green and the other red.</p>`;
  const rows = [{ label: 'When paired — start following', get: () => commands.start, set: (code: number) => { commands.start = code; } },
    ...Array.from({ length: count }, (_, index) => ({ label: `Barcode — approach ${index + 1} — continue`, get: () => commands.approaches[index]!, set: (code: number) => { commands.approaches[index] = code; } })),
    { label: 'Stop & disconnect', get: () => commands.stop, set: (code: number) => { commands.stop = code; } }];
  for (const row of rows) {
    const label = document.createElement('label'); label.textContent = row.label;
    const select = document.createElement('select');
    for (const [code, name] of commsMessages.entries()) {
      const option = document.createElement('option'); option.value = String(code);
      option.textContent = `${encodeCommand(code).trim()} · ${code.toString(2).padStart(4, '0')} · ${name}`;
      select.append(option);
    }
    select.value = String(row.get()); label.append(select); section.append(label);
    select.addEventListener('change', () => {
      row.set(Number(select.value));
      try { localStorage.setItem(key, JSON.stringify(commands)); } catch { /* Keep session preferences. */ }
    });
  }
  panel.append(section);
  return () => commands;
}
