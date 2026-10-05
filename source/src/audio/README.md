# Musical sound effects

## Web MIDI output

Open the **Options** burger menu on the attract screen. The dialog contains sound, volume, MIDI, soundtrack and animation options. Press **Enable MIDI** and grant the browser's MIDI permission. The first available output is selected automatically; choose another hardware synth or virtual MIDI output and channel (1–16) if needed. MIDI remains enabled throughout the app session, across dialogs, screen changes, mute, pause and playback stop. Only **Disconnect MIDI** disables it. A temporarily unplugged device retains its selection and resumes output for future notes when reconnected. Disconnect also cancels a pending enable request. Reloading starts a new app session. Use HTTPS or localhost in a Web MIDI compatible browser. Unavailable or denied MIDI access leaves browser audio usable. No SysEx permission is requested.

Robot moods, interaction cues, the complete attract soundtrack, live journey composition, and exhibition/presentation replay all use the same resolved scores for Web Audio and MIDI. Audio start times are translated to performance-clock timestamps using `AudioContext.getOutputTimestamp()` when available, following [MIDIOutput.send timestamp semantics](https://developer.mozilla.org/en-US/docs/Web/API/MIDIOutput/send). A 25 ms scheduler submits only the next 75 ms of MIDI messages; long songs remain local so Stop can cancel future notes. MIDI sends score pitches (rounded to semitones), note starts, durations and velocity derived from voice gain and master volume. Synth patch, oscillator effects, echo and pitch modulation remain device-controlled; MIDI does not reproduce the browser timbre. Volume changes affect subsequent MIDI notes.

Mute, zero volume, Stop, backgrounding, device/channel changes and disposal clear queued MIDI notes and release the selected channel. Use a channel dedicated to this app: cleanup sends sustain-off, all-notes-off and all-sound-off on that channel. Repeated overlapping pitches retrigger with note-off/note-on pairs and retain the longest active duration. MIDI plays alongside browser audio; WAV downloads and stored scores remain independent of the connected synth.

`SoundEffect` is a deterministic Web Audio oscillator instrument. `soundPresets.ts` supplies interaction cues and robot moods in a shared C tonal centre: a C minor triad for sadness, an ascending C major arpeggio for happiness, an open suspended voicing for curiosity, and a major-seventh arpeggio for celebration. These are expressive choices for fictional robots, not universal rules about human emotion.

Configure MIDI root, chord intervals, inversion, chord/up/down/up-down pattern, tempo, beat spacing, note length, repeats, waveform, gain, ADSR envelope, unison layers/spread, detune, pitch bend, vibrato, low-pass cutoff/resonance, stereo pan and a single echo. Invalid values throw before nodes are created. All note times use the audio clock.

```ts
const effect = new SoundEffect({
  root: 60, intervals: [0, 4, 7], pattern: 'up', bpm: 120,
  waveform: 'triangle', release: 0.3, echoGain: 0.2,
});
const score = effect.toScore(); // JSON-safe, versioned and detached from the instance
SoundEffect.fromScore(JSON.parse(JSON.stringify(score)))
  .schedule(context, destination, context.currentTime + 0.05);

const sequence = [
  { at: 0, score, label: 'happy' },
  { at: 1, score: robotMoodSound('sad').toScore(), label: 'blocked' },
];
const playback = SoundEffect.scheduleSequence(context, destination, sequence,
  context.currentTime + 0.05);
const buffer = await SoundEffect.renderSequence(sequence); // Stereo AudioBuffer, includes tails
playback.stop();
```

`CitySounds.sequence` returns a detached recording of resolved scores with offsets in seconds from session creation and labels. Persist this data rather than preset names so future preset changes cannot alter recorded notes. Mute/volume affect the live master output only; cues are recorded while muted. Live playback has bounded polyphony, gain smoothing and a compressor. Offline rendering uses the same instrument at its recorded gain, without the user's live master-volume/compressor settings. No procedural randomness or external samples are used. Identical scores preserve pitches, scheduling and synthesis parameters; different browser implementations/sample rates are not guaranteed to produce bit-identical PCM.

The context is created/resumed on user interaction. Page load is silent. Workshop switches, navigation, successful rename, reset, sliders and city controls have cues. Slider cues are throttled and use a major pentatonic scale. Journey events are consumed once and add beat-aligned chord-tone answers to the current arrangement. Pausing the robot leaves a quiet musical bed playing. Leaving the city and hiding the page stop active sounds; resuming does not repeat encounters. The visible mood and barrier text remain usable with sound muted or unavailable.

Every button has its own signature in `buttonSignatures`, played through `CitySounds.button`. Navigation rises/falls, rotation rolls through an open chord, Save rings a high major triad, and each function switch has a distinct register and motif. Map zoom, fit and all four pan buttons are distinct; left/right cues also pan in stereo. Switch off and pause variants give a softer descending answer to their active motif. City entry, restart and access fixes have their own signatures alongside robot mood phrases. Mute records its signature silently and Unmute plays it, respecting the sound setting. Disabled buttons cannot be activated; successful name submission plays the same signature using the button or Enter.

Scheduling and activation follow [MDN Web Audio guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices). This module prepares score data and offline buffers; it does not yet add session persistence or WAV downloads.

`JourneyCreativity` consumes the complete ordered robot event stream. Its seed uses robot ID, appearance, ability/function configuration and artistic preferences. Music starts on city entry and continues while ready, paused or blocked, using a separate city music clock. `JourneyMusicComposer` supplies fifty-five genre grammars: recurring seeded melodies, functional chord progressions, distinctive bass and accompaniment, and oscillator percussion. Waltz, Korean folk-inspired and Irish jig-inspired use three beats; Turkish folk-inspired and Balkan dance-inspired use seven; the other styles use four. The 32 additional world and contemporary arrangements in `worldMusicStyles.ts` supply distinct modal palettes, melodic figures, bass patterns, chord placement and percussion. A sustained chord bridges each full measure; travel adds a pulse and brightens the arrangement with speed. Actual heading and physics-body height drive directional corner flourishes and ascending/descending ramp answers. Steps, state changes, starts, endings, segments, discoveries, exploration, city edits, interventions, achievements and arrival all add chord-tone motifs, quantized to eighth-note boundaries. Repeated frame events coalesce and continuous turns/slopes have cooldowns to bound density. Blocked encounters soften the groove and use a minor chord in the robot's transposed key; repairs resolve with an ascending answer. Harmony powerups enrich chord voices. Designer auditions play four bars using the same robot seed. The procedural painting starts immediately; drawing and colour powerups enrich its brushwork and palette. Resolved scores/strokes are stored in `RobotRun.creative`, including action notes and waiting time. Bars use 150 ms lookahead, and `CitySounds.perform` accepts the current musical origin so future notes retain their offsets. Leaving/backgrounding stops output; an arrival chord continues while studio verses prepare. The exhibition performs the saved score, respecting live mute/volume. See the [style catalogue and procedural painting API](../art/README.md).

Robot musical identity now spans a four-bar contour, articulation and a seeded synth voice (`robotMusicalIdentity.ts`). `robotHarmony.ts` defines ten emotional chord colours, used by journey events, harmony parts, continuous beds and chord-accented reactions. Studio keyboard playback preserves the resolved voices for exhibition and export.
