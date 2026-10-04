import { directionLabel } from '../robot/robotCondition';
import type { RobotCondition } from '../robot/robotCondition';

export function mountRobotConditionHud(parent: HTMLElement) {
  const details = document.createElement('details'); details.className = 'city-robot-states';
  const summary = document.createElement('summary'); summary.textContent = 'Robot states';
  const content = document.createElement('div');
  const hint = document.createElement('p'); hint.className = 'city-plan-hint';
  hint.textContent = 'Travel builds fatigue. Obstacles build frustration. Rest and a clear route help robots recover.';
  details.append(summary, content, hint); parent.append(details);
  return (entries: { name: string; state: string; condition: RobotCondition }[]) => {
    if (content.children.length !== entries.length) {
      content.replaceChildren(...entries.map(() => {
        const section = document.createElement('section'), name = document.createElement('strong'), values = document.createElement('dl');
        for (const label of ['State', 'Mood', 'Direction', 'Speed', 'Frustration', 'Fatigue']) {
          const term = document.createElement('dt'); term.textContent = label;
          values.append(term, document.createElement('dd'));
        }
        section.append(name, values); return section;
      }));
    }
    entries.forEach((entry, i) => {
      const section = content.children[i]!;
      if (section.firstElementChild!.textContent !== entry.name) section.firstElementChild!.textContent = entry.name;
      const c = entry.condition;
      const values = [entry.state, c.mood, `${directionLabel(c.direction)} · ${Math.round(((c.direction * 180 / Math.PI) % 360 + 360) % 360)}°`, `${c.speed.toFixed(2)} units/s`, `${Math.round(c.frustration)}%`, `${Math.round(c.fatigue)}%`];
      section.querySelectorAll('dd').forEach((dd, index) => { if (dd.textContent !== values[index]) dd.textContent = values[index]!; });
    });
  };
}
