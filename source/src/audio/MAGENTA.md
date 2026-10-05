# AI accompaniment

The browser uses `@magenta/music` 1.23.1 and its chord-conditioned MusicRNN
checkpoint, `chord_pitches_improv` (ImprovRNN). It continues a quantized bar of
the robot's original melody with a new bar conditioned on the current chord.
The response becomes a quiet lower counter-melody, resolved to chord tones.
Melodic, ambient, jazz, lo-fi and cinematic styles use it when harmony is active;
other styles retain their defining procedural arrangements. Designer auditions
wait for enhanced responses before playback. Journey creation warms the four-chord
cycle in advance, so music and harmony discoveries can use prepared accompaniment.

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
