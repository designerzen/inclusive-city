# AI accompaniment

The browser uses `@magenta/music` 1.23.1 and its chord-conditioned MusicRNN
checkpoint, `chord_pitches_improv` (ImprovRNN). The existing shared model continues
the robot's most recent one or two played melody bars into a four-bar response,
conditioned on the primer's chords and the upcoming progression. Every genre can
use these melodic answers while keeping its procedural drums, bass and synth
voice. Each section opens with the robot's recurring motif; subsequent bars can
use the generated lead. Harmony discoveries also enable a quiet counter-melody.
Passing tones, rests and melodic contour survive conversion; strong notes follow
the harmony, swing styles retain swing, and waltz uses twelve steps per bar.
Mood controls generation temperature. Action sounds use the current procedural
harmony without launching inference.

The journey prepares the next section two bars ahead, using notes already played.
Studio verses use the recorded journey as their primer and finish on the robot's
tonic. Designer auditions and studio preparation wait up to eight seconds for
their requested sections, then use playable procedural fallbacks. These operations
reuse the same worker, model, audio context and score playback path.

Before the start screen, `requireModels` checks actual saved files for Magenta
and Moonshine Tiny Streaming. First launch automatically downloads missing
models with one progress bar: music, speech, then initialization. The setup
screen explains on-device processing, browser caching, and microphone privacy.
Failure keeps the setup screen open with Retry. When both models are saved,
later launches skip the setup screen entirely.

Config, manifest and every weight shard are retained in the versioned Cache API
store `inclusive-city-magenta-improv-v1`. Downloads save each successful file and
resume missing files after interruption. Web Locks serialize downloads across
tabs. Saved files never trigger HTTP revalidation; the worker's fetch function
reads exclusively from that store and rejects missing files instead of quietly
redownloading. Startup requests `navigator.storage.persist()`.
Storage belongs to this browser profile and site origin. Browsers can deny
persistence, users can clear site data, and private sessions can erase it; no
website can guarantee permanent storage under those conditions. A missing
model returns to the setup screen. Changing origins or profiles
also requires a separate download.

Inference runs on the CPU in a background worker so it cannot block the city
or audio clock. Robot data is never uploaded. The service serializes inference,
deduplicates requests, limits its queue to eight and caches at most 64 responses.
Auditions and studio requests take priority over speculative future sections.
The service exposes readiness, queue, cache and inference timing diagnostics.
During a journey, inference failures and a 45-second timeout leave procedural
music playing. Ready responses enter subsequent
phrases, never notes already scheduled. Generated music is stochastic; recorded
scores contain the resolved notes and replay identically without the model.

Magenta RealTime / MRT2 generates continuous audio and requires a separate
native inference runtime. It does not fit this browser app's editable note
scores, oscillator playback and MIDI output. No backend, API key or native
runtime is needed for this integration.

Sources:
- https://github.com/magenta/magenta-js/blob/master/music/README.md
- https://github.com/magenta/magenta-js/blob/master/music/checkpoints/README.md
- https://github.com/magenta/magenta-js/blob/master/music/src/music_rnn/model.ts
- https://magenta.tensorflow.org/mrt2

For high-traffic deployments, mirror the checkpoint on your own host as
requested by Magenta's hosted checkpoint documentation, and update
`magentaCheckpoint` in `magentaProtocol.ts`.
