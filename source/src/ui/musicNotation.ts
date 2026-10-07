import { pitchName } from './cityMusicCues';
export interface MonitorNote { at: number; midi: number; duration: number }
const steps = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
const accidentals: Record<number, string> = { 1: '♯', 3: '♭', 6: '♯', 8: '♭', 10: '♭' };

/** A rolling concert-pitch grand staff, grouping simultaneous score onsets as chords. */
export function musicNotation(notes: readonly MonitorNote[], bpm: number) {
  const times = [...new Set(notes.map(note => note.at))].sort((a, b) => a - b).slice(-12);
  const visible = notes.filter(note => times.includes(note.at));
  const lines = [38, 48, 58, 68, 78, 118, 128, 138, 148, 158]
    .map(y => `<path d="M36 ${y}H620"/>`).join('');
  const glyphs = visible.map(note => {
    const midi = Math.round(note.midi), pitch = ((midi % 12) + 12) % 12;
    const step = Math.floor(midi / 12) * 7 + steps[pitch]!;
    const treble = midi >= 60;
    // Bottom lines: E4 (diatonic step 37) and G2 (step 25).
    const bottom = treble ? 78 : 158, top = bottom - 40;
    const y = bottom - (step - (treble ? 37 : 25)) * 5;
    const x = 62 + times.indexOf(note.at) * 47;
    const beats = note.duration * bpm / 60;
    const stemDown = y < bottom - 20;
    let ledger = '';
    for (let line = bottom + 10; line <= y; line += 10) ledger += `<path d="M${x - 9} ${line}h18"/>`;
    for (let line = top - 10; line >= y; line -= 10) ledger += `<path d="M${x - 9} ${line}h18"/>`;
    const stemX = x + (stemDown ? -6 : 6), stemY = y + (stemDown ? 28 : -28);
    return `${ledger}<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="${beats >= 1.5 ? 'none' : 'currentColor'}" transform="rotate(-15 ${x} ${y})"/>
      ${beats < 3.5 ? `<path d="M${stemX} ${y}V${stemY}"/>` : ''}
      ${beats < .75 ? `<path d="M${stemX} ${stemY}q12 ${stemDown ? -4 : 4} 4 ${stemDown ? -14 : 14}"/>` : ''}
      ${accidentals[pitch] ? `<text x="${x - 20}" y="${y + 5}" stroke="none" fill="currentColor" font-size="17">${accidentals[pitch]}</text>` : ''}`;
  }).join('');
  const ys = visible.map(note => {
    const midi = Math.round(note.midi), pitch = ((midi % 12) + 12) % 12;
    return (midi >= 60 ? 78 : 158) - (Math.floor(midi / 12) * 7 + steps[pitch]! - (midi >= 60 ? 37 : 25)) * 5;
  });
  const minY = Math.min(8, ...ys.map(y => y - 36)), maxY = Math.max(180, ...ys.map(y => y + 36));
  const description = visible.length ? `Recent notes: ${visible.map(note => pitchName(note.midi)).join(', ')}` : 'Waiting for journey music.';
  return `<svg role="img" aria-label="${description}" viewBox="0 ${minY} 640 ${maxY - minY}" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" stroke-width="1.2" fill="none">${lines}${glyphs}</g>
    <text x="4" y="76" fill="currentColor" font-size="48">𝄞</text><text x="7" y="151" fill="currentColor" font-size="38">𝄢</text>
    </svg>`;
}
