import type { BridgeAccess } from '../city/humpbackBridge';
export type EnvironmentChoiceKind = 'curb' | 'stairs' | 'bridge' | 'guidance' | 'communication' | 'signals' | 'elevator';

export const environmentChoices: Record<EnvironmentChoiceKind, readonly [string, string, string, string]> = {
  curb: ['Raised curb · no cut', 'Curb cut · sloped edge', 'A vertical edge between road and pavement.', 'A gentle slope connects road and pavement.'],
  stairs: ['Steps', 'Ramp', 'Separate steps lead to the higher level.', 'One continuous slope leads to the higher level.'],
  bridge: ['Bridge raised', 'Bridge lowered', 'The bridge deck is up, leaving a gap.', 'The bridge deck connects both banks.'],
  guidance: ['No route cues', 'Route cues', 'A plain path with no direction markers.', 'Repeated arrows show the way along the path.'],
  communication: ['No communication board', 'Symbol board available', 'No alternative way to share messages or request help.', 'Symbols let the robot share its needs and request help.'],
  signals: ['Visual signal only', 'Sound + tactile cues', 'The crossing uses a light signal.', 'The light also has a beeper and a tactile indicator.'],
  elevator: ['Elevator off', 'Elevator enabled', 'The lift is closed and cannot carry the robot.', 'The lift opens and carries the robot between levels.'],
};

/** Small orthographic isometric drawings: matching viewpoints make differences easy to compare. */
export function environmentIllustration(kind: EnvironmentChoiceKind, enabled: boolean): string {
  const point = (x: number, y: number, z: number) => `${110 + (x - y) * 14},${65 + (x + y) * 7 - z * 14}`;
  const polygon = (points: number[][], fill: string) => `<polygon points="${points.map(p => point(p[0]!, p[1]!, p[2]!)).join(' ')}" fill="${fill}" stroke="#334155" stroke-width="1.3" stroke-linejoin="round"/>`;
  const box = (x: number, y: number, w: number, d: number, z: number, h: number, top = '#e3e9ee') =>
    polygon([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]], top) +
    polygon([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]], '#9eafbf') +
    polygon([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]], '#778b9f');
  const slope = (x: number, y: number, w: number, d: number, height: number) =>
    polygon([[x,y,0.3+height],[x+w,y,0.3+height],[x+w,y+d,0.3],[x,y+d,0.3]], '#8cddc6') +
    polygon([[x+w,y,0.3],[x+w,y,0.3+height],[x+w,y+d,0.3]], '#4b9f8a');
  let drawing = box(-3,-3,6,6,0,.3, '#dbe4eb');
  if (kind === 'curb') {
    drawing += box(-3,-3,6,2.5,.3,.9);
    if (enabled) drawing += slope(-1.3,-.5,2.6,2.2,.9);
  } else if (kind === 'stairs') {
    drawing += box(-2,-3,4,1.4,.3,2.4);
    if (enabled) drawing += slope(-2,-1.6,4,4.2,2.4);
    else for (let i = 0; i < 4; i++) drawing += box(-2,-1.6+i,4,1,.3,2.4-i*.6);
  } else if (kind === 'bridge') {
    drawing = box(-3,-3,6,6,0,.3,'#93cfe8') + box(-3,-3,6,1.7,.3,.5) + box(-3,1.3,6,1.7,.3,.5);
    drawing += enabled ? box(-1.5,-1.3,3,2.6,.6,.25,'#8cddc6') : slope(-1.5,-1.3,3,2.6,2.5);
  } else if (kind === 'guidance') {
    if (enabled) for (const y of [-1.7,0,1.7]) drawing += polygon([[-.7,y+.3,.32],[0,y-.5,.32],[.7,y+.3,.32],[.25,y+.3,.32],[.25,y+.8,.32],[-.25,y+.8,.32],[-.25,y+.3,.32]], '#087b63');
  } else if (kind === 'communication') {
    drawing += box(-.8,-.8,1.6,1.6,.3,1.4,'#ffd479');
    if (enabled) {
      drawing += '<rect x="135" y="24" width="55" height="42" rx="4" fill="#8cddc6" stroke="#334155" stroke-width="2"/><path d="M143 34h14m-7-7v14M169 30l10 10m0-10-10 10M143 52h35" stroke="#334155" stroke-width="3"/><path d="M161 66v27" stroke="#334155" stroke-width="4"/>';
    }
  } else if (kind === 'signals') {
    for (let i = 0; i < 4; i++) drawing += polygon([[-2.5,-2+i*1.2,.32],[1,-2+i*1.2,.32],[1,-1.4+i*1.2,.32],[-2.5,-1.4+i*1.2,.32]], '#ffffff');
    drawing += box(1.6,-2,.25,.25,.3,2.7) + box(1.3,-2.2,.9,.6,3,1.1,'#334155');
    drawing += `<circle cx="${110+(1.75+1.6)*14}" cy="${65+(1.75-1.6)*7-3.55*14}" r="4" fill="#70e0aa"/>`;
    if (enabled) {
      drawing += box(1.2,-1.6,.8,.6,1.5,.5,'#ffd479');
      drawing += '<path d="M173 29q12 8 0 16 M179 24q20 13 0 26" fill="none" stroke="#087b63" stroke-width="3" stroke-linecap="round"/>';
      drawing += polygon([[.8,-.3,.32],[2.5,-.3,.32],[2.5,1,.32],[.8,1,.32]], '#ffd479');
      for (let i=0;i<4;i++) drawing += `<circle cx="${110+(1.1+i*.35-.3)*14}" cy="${65+(1.1+i*.35+.3)*7-5}" r="1.7" fill="#334155"/>`;
    }
  } else {
    drawing += box(-1.8,-2,3.6,2,.3,3.8);
    drawing += polygon([[-1.3,.02,.3],[1.3,.02,.3],[1.3,.02,3.4],[-1.3,.02,3.4]], enabled ? '#334155' : '#bac8d5');
    if (enabled) drawing += box(-.8,-.2,1.6,1.6,.3,.2,'#8cddc6');
    drawing += `<path d="M169 51v-18m-5 6 5-6 5 6" fill="none" stroke="${enabled ? '#087b63' : '#64748b'}" stroke-width="3"/>`;
    if (!enabled) drawing += '<path d="m100 58 17 17m0-17-17 17" stroke="#9e3939" stroke-width="3"/>';
  }
  return `<svg class="environment-illustration" viewBox="0 0 220 125" aria-hidden="true" focusable="false">${drawing}</svg>`;
}

export function environmentChoiceCards(kind: EnvironmentChoiceKind, current: boolean, disabled: boolean): string {
  const labels = environmentChoices[kind];
  return `<p class="environment-choice-prompt">Choose one setting. Your selection changes the city immediately.</p><div class="environment-choice-grid" role="group" aria-label="${kind === 'signals' ? 'Crossing cues' : kind} settings">${[false, true].map(value => `<button type="button" class="environment-choice" data-environment-value="${value}" aria-pressed="${value === current}" ${disabled ? 'disabled' : ''}>${environmentIllustration(kind, value)}<strong>${labels[value ? 1 : 0]}</strong><span>${labels[value ? 3 : 2]}</span><span class="environment-choice-state">${value === current ? '✓ Current setting' : 'Choose this setting'}</span></button>`).join('')}</div>`;
}

export function studioDoorChoiceCards(current: string, disabled: boolean): string {
  const doors = [
    ['revolving', 'Revolving door', 'Needs 60 agility to turn with the rotating panels.'],
    ['automatic', 'Automatic door', 'Opens for the robot. No pushing or handle needed.'],
    ['push', 'Push door', 'Needs 40 burst power and reach to a 1.20 m push bar.'],
  ];
  return `<p class="environment-choice-prompt">Choose a studio door. Every door still needs enough width for your robot.</p><div class="environment-choice-grid" role="group" aria-label="Studio door choices">${doors.map(([type, label, description]) => `<button type="button" class="environment-choice" data-studio-door="${type}" aria-pressed="${type === current}" ${disabled ? 'disabled' : ''}><svg class="environment-illustration" viewBox="0 0 220 125" aria-hidden="true"><rect x="65" y="12" width="90" height="105" rx="4" fill="#334155"/><rect x="74" y="20" width="72" height="97" fill="#93cfe8"/>${type === 'revolving' ? '<ellipse cx="110" cy="69" rx="32" ry="43" fill="none" stroke="#334155" stroke-width="4"/><path d="M110 25v90m-30-66 60 40m-60 0 60-40" stroke="#334155" stroke-width="4"/>' : type === 'automatic' ? '<path d="M110 20v97M91 63H77l7-7m-7 7 7 7m45-7h14l-7-7m7 7-7 7" fill="none" stroke="#087b63" stroke-width="4"/>' : '<path d="M85 70h50" stroke="#334155" stroke-width="7"/>'}</svg><strong>${label}</strong><span>${description}</span><span class="environment-choice-state">${type === current ? '✓ Current setting' : 'Choose this door'}</span></button>`).join('')}</div>`;
}



function humpbackIllustration(access: BridgeAccess) {
  const steps = '<path d="M20 98h25v-12h14v-12h14V62h14V50h46v12h14v12h14v12h14v12h25" fill="none" stroke="#64748b" stroke-width="8" stroke-linejoin="round"/>';
  const accessible = access === 'ramp' ? '<path d="M20 101 87 53h46l67 48" fill="none" stroke="#087b63" stroke-width="7" stroke-linejoin="round"/>' : access === 'elevator' ? '<path d="M38 101V40h18v61m108 0V40h18v61M47 53h126" fill="none" stroke="#087b63" stroke-width="6"/><path d="m43 82 4-8 4 8m118-8 4 8 4-8" fill="none" stroke="#334155" stroke-width="2"/>' : '';
  return `<svg class="environment-illustration" viewBox="0 0 220 125" aria-hidden="true" focusable="false"><path d="M12 110h196" stroke="#334155" stroke-width="3"/>${steps}${accessible}</svg>`;
}

export function bridgeAccessCards(current: BridgeAccess, disabled: boolean): string {
  const choices: [BridgeAccess, string, string][] = [
    ['steps', 'Steps only', 'Steps climb and descend the humpback bridge. Wheels need another way across.'],
    ['ramp', 'Ramp', 'Continuous slopes reach the raised deck. The steps stay beside the ramp.'],
    ['elevator', 'Elevators', 'A lift at each end carries the robot up to the bridge and back down.'],
  ];
  return `<p class="environment-choice-prompt">Choose access over the humpback bridge.</p><div class="environment-choice-grid" role="group" aria-label="Humpback bridge access">${choices.map(([value, label, description]) => `<button type="button" class="environment-choice" data-bridge-access="${value}" aria-pressed="${current === value}" ${disabled ? 'disabled' : ''}>${humpbackIllustration(value)}<strong>${label}</strong><span>${description}</span><span class="environment-choice-state">${current === value ? '✓ Current setting' : 'Choose this setting'}</span></button>`).join('')}</div>`;
}
