// Standard MIDI 1.0 controller assignments: https://midi.org/midi-1-0-control-change-messages
const controllers: Record<number, string> = {
  0: 'Bank select', 1: 'Modulation wheel', 2: 'Breath', 4: 'Foot controller',
  5: 'Portamento time', 6: 'Data entry', 7: 'Channel volume', 8: 'Balance',
  10: 'Pan', 11: 'Expression', 12: 'Effect control 1', 13: 'Effect control 2',
  16: 'General purpose 1', 17: 'General purpose 2', 18: 'General purpose 3', 19: 'General purpose 4',
  64: 'Sustain pedal', 65: 'Portamento switch', 66: 'Sostenuto pedal', 67: 'Soft pedal',
  68: 'Legato switch', 69: 'Hold 2',
  70: 'Sound 1: variation', 71: 'Sound 2: timbre / harmonic intensity',
  72: 'Sound 3: release time', 73: 'Sound 4: attack time', 74: 'Sound 5: brightness',
  75: 'Sound 6: decay time', 76: 'Sound 7: vibrato rate', 77: 'Sound 8: vibrato depth',
  78: 'Sound 9: vibrato delay', 79: 'Sound 10: device-defined',
  80: 'General purpose 5', 81: 'General purpose 6', 82: 'General purpose 7', 83: 'General purpose 8',
  84: 'Portamento source note', 88: 'High-resolution velocity prefix',
  91: 'Effect 1: reverb send', 92: 'Effect 2: tremolo depth', 93: 'Effect 3: chorus send',
  94: 'Effect 4: detune depth', 95: 'Effect 5: phaser depth',
  96: 'Data increment', 97: 'Data decrement', 98: 'NRPN selection (LSB)',
  99: 'NRPN selection (MSB)', 100: 'RPN selection (LSB)', 101: 'RPN selection (MSB)',
  120: 'All sound off', 121: 'Reset controllers', 122: 'Local control', 123: 'All notes off',
  124: 'Omni off; release notes', 125: 'Omni on; release notes',
  126: 'Mono on; release notes', 127: 'Poly on; release notes',
};

export const midiCcReference = Array.from({ length: 128 }, (_, cc) => {
  const name = cc >= 32 && cc <= 63
    ? `${controllers[cc - 32] ?? 'Undefined controller'} (LSB of CC ${cc - 32})`
    : controllers[cc] ?? 'Undefined / unassigned';
  let values = '0–127';
  if (cc >= 64 && cc <= 69) values = cc === 68 ? '0–63 normal; 64–127 legato' : '0–63 off; 64–127 on';
  if (cc === 96 || cc === 97) values = 'Ignored';
  if (cc >= 120) values = cc === 122 ? '0 off; 127 on' : cc === 126 ? 'Channel count; 0 = receiver voices' : '0';
  if (!controllers[cc] && (cc < 32 || cc > 63)) values = 'Device-defined';
  return { cc, hex: `0x${cc.toString(16).toUpperCase().padStart(2, '0')}`, name, values };
});

export function mountMidiCcReference(container: HTMLElement) {
  const trigger = container.querySelector<HTMLButtonElement>('#midi-cc-reference')!;
  const dialog = document.createElement('dialog');
  dialog.id = 'midi-cc-dialog';
  dialog.className = 'options-dialog midi-cc-dialog';
  dialog.setAttribute('aria-labelledby', 'midi-cc-title');
  dialog.innerHTML = `<header class="midi-cc-heading"><div><p class="midi-cc-eyebrow">MIDI 1.0 · IMPLEMENTATION REFERENCE</p><h2 id="midi-cc-title">Control change codes</h2></div><button type="button" autofocus aria-label="Close MIDI CC reference">Close</button></header>
    <p>Send three bytes: <code>[0xB0 + (channel − 1), CC, value]</code>. Channels are 1–16; CC and value bytes are 0–127. For example, <code>[0xB0, 7, 100]</code> sets channel 1 volume to 100.</p>
    <p>CC 0–31 are coarse (MSB) controls; CC 32–63 supply their fine (LSB) values. Combine as <code>MSB × 128 + LSB</code> for 14-bit resolution. Select RPN with CC 101/100 or NRPN with CC 99/98, then use data entry CC 6/38. RPN 127/127 clears selection.</p>
    <p>Assignments and effect names depend on your instrument. Undefined codes have no standard function; check its MIDI implementation chart. CC 120–127 change channel modes. This app sends notes and uses CC 64, 123 and 120 when stopping playback.</p>
    <div class="midi-cc-table-wrap" tabindex="0" role="region" aria-label="All 128 MIDI control change codes"><table><caption>Complete CC reference · 0–127</caption><thead><tr><th scope="col">CC</th><th scope="col">Hex</th><th scope="col">Function</th><th scope="col">Value</th></tr></thead><tbody>${midiCcReference.map(row => `<tr${row.cc >= 120 ? ' class="midi-cc-mode"' : ''}><th scope="row">${row.cc}</th><td><code>${row.hex}</code></td><td>${row.name}</td><td>${row.values}</td></tr>`).join('')}</tbody></table></div>
    <p class="midi-cc-source">Standard assignments: <a href="https://midi.org/midi-1-0-control-change-messages" target="_blank" rel="noopener noreferrer">MIDI Association reference</a>. Sound and effect labels show common defaults.</p>`;
  document.body.append(dialog);
  trigger.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => trigger.focus());
}
