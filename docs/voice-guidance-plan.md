# Natural-language help for a blocked ArtBot

Research and implementation proposal, 5 October 2026. The first implementation now uses Moonshine Tiny Streaming on-device, with worker inference, manual response completion, typed replies and a local command interpreter. Remaining phases below describe evaluation and possible extensions, rather than guarantees of unrestricted conversation.

Implemented files: `CityVoiceReply.ts`, `cityVoicePanel.ts` and `cityReply.ts`, connected to `cityScreen.ts`. Moonshine 0.1.5 is pinned. `vite.config.ts` preserves the runtime's relative worker URLs, sets development/preview isolation headers and packages `coi-serviceworker` for static hosts. Model downloads use Moonshine's Cache API support; the whole application is not a fully offline PWA. No backend or API keys are required.

Verified in the browser: worker transcription and AudioWorklet capture of a synthetic “Please add a ramp” clip; rejection of that request at a bicycle obstruction; a typed crossing-time request that unblocked the robot; desktop and 390px mobile reply controls meeting the 44px target floor without overlap; and cross-origin isolation on a plain static server through the included service worker. Real-speaker accuracy, low-end mobile resource use and unrestricted language understanding remain evaluation work.

## Recommendation

Build one context-aware help controller shared by typed and spoken input. Prototype **Moonshine Voice (`@moonshine-ai/moonshine-wasm`)** first, comparing its Tiny/Small Streaming models with **sherpa-onnx + an English streaming Zipformer model**. The user requires **on-device processing**: both speech recognition and request interpretation must execute on the user's device. Evaluate Parakeet only if an on-device browser runtime for the chosen model can be demonstrated. Local-server and hosted options below are research comparisons, outside the selected implementation.

This is an engineering fit recommendation, not a measured accuracy ranking. Benchmark with the city rendering and music running before selecting a production model. Model assets may be downloaded initially; once cached, capture, recognition and interpretation must work without a network connection. Unsupported devices retain text and buttons rather than uploading audio.

Speech recognition produces text. A separate interpreter must translate that text and the current obstruction into a validated city action or an explanation. An STT library alone cannot understand what “make it wider” refers to.

## Options researched

| Option | Live recognition and deployment | Fit for this project |
| --- | --- | --- |
| Moonshine Voice / `@moonshine-ai/moonshine-wasm` | Official TypeScript/WASM browser binding, streaming models, live/final transcript callbacks and optional local semantic phrase matching through AgentFlow. | First prototype candidate: a direct browser integration path. Benchmark Tiny and Small Streaming with the city running; default threaded build needs cross-origin isolation. |
| Parakeet Realtime EOU 120M v1 | Cache-aware streaming RNNT; built-in end-of-utterance token; English only; no punctuation/capitalisation. Official setup uses NeMo 2.5.3+, Linux and NVIDIA hardware. | Strong local-server candidate. Browser/CPU execution is a separate feasibility task, not an assumed capability. |
| Parakeet TDT 0.6B v3 | 25 European languages, punctuation and timestamps. High-throughput model; model card also supplies a chunked streaming recipe with seconds of context. | Useful multilingual comparison. Distinguish buffered/chunked decoding from the EOU model’s streaming architecture. |
| sherpa-onnx + streaming Zipformer | Open-source inference runtime with online ASR and documented microphone recognition through WASM. Model choice determines languages, download size and accuracy. | Main comparison and fallback to Moonshine. Run inference in a Worker; validate packaging, memory and mobile performance. |
| Vosk | Offline incremental recognition, small portable models and vocabulary adaptation; official server supports WebSocket/WebRTC. | Lightweight CPU/local-server baseline. A browser WASM wrapper would need its own compatibility and maintenance review. |
| whisper.cpp | Native and WASM examples. Microphone example repeatedly transcribes audio windows. | Useful multilingual fallback or completed-turn baseline; windowed transcription needs deduplication and separate endpointing. |
| Deepgram Flux | Hosted streaming STT with turn detection and configurable end-of-turn behaviour; English and multilingual models. | Attractive hosted comparison when cloud processing is acceptable. Requires a backend for credentials or scoped token issuance. |
| OpenAI Realtime transcription | Official documentation recommends `gpt-live-transcribe`, WebRTC for browser audio, incremental and final transcripts; client controls turn completion. | Another hosted comparison. Use a backend to establish authorised sessions and client-side endpointing/manual completion. |
| Browser Web Speech API | Built-in recognition where supported; implementation can process remotely. On-device `processLocally` remains experimental. | Optional prototype adapter. Capability-check and disclose actual processing mode; unsuitable as the sole cross-browser dependency. |

Primary sources: [Parakeet EOU model card](https://huggingface.co/nvidia/parakeet_realtime_eou_120m-v1), [Parakeet TDT v3 model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), [sherpa WASM build guide](https://k2-fsa.github.io/sherpa/onnx/wasm/build.html), [sherpa online models](https://k2-fsa.github.io/sherpa/onnx/index.html), [Vosk](https://alphacephei.com/vosk/), [Vosk server](https://github.com/alphacep/vosk-server), [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [Flux documentation](https://developers.deepgram.com/docs/flux/quickstart), [official OpenAI documentation](https://developers.openai.com/api/docs/guides/realtime-transcription), [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [on-device recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally).

Parakeet EOU’s advertised 80–160 ms recognition latency is not microphone-to-city-action latency. Its EOU evaluation uses synthetic speech, so it does not establish suitability for people who pause frequently or have atypical speech. The [sherpa request for this exact model](https://github.com/k2-fsa/sherpa-onnx/issues/2805) remains open at inspection; do not assume that sherpa’s Parakeet support includes online EOU recognition. Pin and test exact runtime/model versions. Check each selected model’s redistribution terms and record attribution separately from the runtime licence.

## Existing integration points

### Moonshine-specific findings

Use the current `@moonshine-ai/moonshine-wasm` binding. The older `@moonshine-ai/moonshine-js` repository is [archived and deprecated](https://github.com/moonshine-ai/moonshine-js). Current [model documentation](https://github.com/moonshine-ai/moonshine/blob/main/docs/models/available-models.md) lists English Tiny Streaming (34M parameters), Small Streaming (123M) and Medium Streaming (245M). Start with Tiny/Small; published WER is not a prediction of accuracy for this audience. Streaming STT models are MIT under the [current licence](https://github.com/moonshine-ai/moonshine/blob/main/LICENSE); some legacy non-English non-streaming models have different terms.

The [WASM binding](https://github.com/moonshine-ai/moonshine/blob/main/language-bindings/wasm/README.md) supplies capture, model downloads/caching, transcript updates and cleanup. Its default SIMD/threaded build requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`; a SIMD-only fallback requires a separate build. Check the production host and cross-origin Magenta model loading before adopting those headers. Self-host and pin library/model assets where practical. Verify offline reload of the library as well as model caches. Do not treat parameter count as download size or peak memory.

Moonshine also supplies [AgentFlow semantic phrase matching](https://github.com/moonshine-ai/moonshine/blob/main/docs/using/conversational-agent.md). Evaluate it as a local candidate generator for paraphrases such as “put in a ramp” and “make the steps accessible”. Still run explicit negation, target, quantity, allowed-action and stale-context checks before executing. Semantic similarity alone cannot establish that a change was requested. Keep existing narration initially; AgentFlow's speech-disabled mode can avoid downloading a second voice model. Shared typed/spoken interpretation must remain available independently of microphone ownership.

- `source/src/ui/cityScreen.ts`: `refresh()` detects a new `journey.blocked.id`, opens the controls and selects the obstruction. Add the response panel here and trigger speech prompts once per encounter, outside the per-frame refresh work. The screen already provides feedback and lifecycle hooks for suspend, new city and disposal.
- `source/src/city/createCityScene.ts`: creates **PlannedJourney**, the active simulation. `city.sync()` updates visuals after edits. The older `CityJourney` and `robotGuidance.ts` are not the primary integration target.
- `source/src/simulation/plannedJourney.ts`: existing `repair`, `setFeature`, `editDimension`, `setStudioDoor`, `lowerCrossingPanel`, `undoRepair` and `setPaused` preserve city history and journey events. Reuse them rather than editing the world directly.
- `source/src/city/cityDimensions.ts`: exposes dimension limits and validates values. `proceduralResizer.ts` already separates visual preview from commit.
- `source/src/city/cityPhysics.ts`: distinguishes building walls, other robots and less-specific solid obstructions. A temporary robot obstruction should permit waiting rather than proposing a city repair.
- `source/src/audio/ScreenSpeech.ts`: existing text-to-speech can read barrier explanations and results. It has no speech-recognition support. `CitySounds` must also participate in microphone audio coordination.

## User interaction

1. Robot encounters a barrier. Show its explanation and “Talk to your robot”, a text reply field and the existing choices. Read the explanation when spoken guidance is enabled. Never request microphone access automatically on blocking.
2. User activates a toggle to start listening; another activation or a separate Done control completes the turn. Support keyboard and switch operation without requiring a held button. Show a clear listening indicator and live transcript.
3. Finalise speech on Done or configurable silence. Offer generous timing and manual completion for users with long pauses. Partial transcripts are display-only.
4. Interpret the final text using a snapshot of the obstruction and available actions. Direct, unambiguous, reversible requests can execute immediately, with feedback and Undo. Ambiguous or incomplete requests produce one short clarification with clickable and speakable choices.
5. Verify the result. Say “The ramp is in place” after a successful edit, and claim the route is clear only when the problem checks and subsequent simulation/physics agree. Respect an existing explicit pause; otherwise let the simulation continue when it can.

| Example reply | Intended response |
| --- | --- |
| “Put a ramp there” / “Could you add a ramp?” | At stairs, `setFeature(streetId, true)`. Else clarify the location. |
| “Make it wide enough for you” | At a width barrier, propose a width based on the robot footprint and current limits; do not assume `repair()`’s fixed default is always sufficient. |
| “Give me more time to cross” | At a crossing, change `crossing:<id>` based on crossing length and robot speed, within limits. |
| “I can’t reach the button” | `lowerCrossingPanel(street)`. |
| “Add a beeper” | `setFeature('signals:' + streetId, true)` at a crossing. |
| “Move that bike out of the way” | `repair(bicycleId)` for the identified blocking bicycle. |
| “Why are you stuck?” / “What can I do?” | Explain the current reason and available changes without mutation. |
| “Wait for the other robot” | Leave the city unchanged; temporary obstruction may resolve naturally. |
| “Undo that” / “Don’t add a ramp” | Undo the relevant last edit, or recognise the negation and do not apply an edit. |
| “Go around it” / “Turn left” | Explain the current capability. Mid-journey rerouting needs additional simulation work and is outside the first release. |

## Architecture and implementation sequence

**Phase 1 — typed natural language and shared actions.** Extract existing button handlers into a typed city-action dispatcher. Build `cityHelpContext.ts` from the active run, encounter, city revision, obstruction, robot abilities and allowed edits. Build `interpretCityReply.ts` returning `explain`, `clarify`, `unsupported` or a proposed typed action. Start with local compositional rules for common verbs, synonyms, negation, targets, quantities and units; do not claim this covers unrestricted language. Evaluate a small on-device structured-output language model only if the phrase evaluation shows rules are insufficient and device memory/latency permit it. Browser GPU support and a second model download would need their own spike. A language model may select from supplied actions but cannot call arbitrary methods or invent IDs. No transcript or city context is sent to a cloud interpreter. Text works without STT and becomes the testable foundation.

**Phase 2 — recognition spike and offline browser adapter.** Define `SpeechRecognizer` with initialise/start/finish/cancel/dispose and replaceable partial/final/error events keyed by session and turn. Wrap Moonshine's `MicTranscriber`: `load()` for preparation, `start()` for capture, `onText` for interim display, `onLine` for committed lines, `stop()` to finish and `close()` on disposal. Treat line IDs as opaque strings and verify final flushing on Done. Aggregate lines within a manually controlled response turn so an early silence boundary does not dispatch a half-finished request. Reuse its capture/resampling before writing a duplicate pipeline. Profile decoding on the main thread and in WASM threads; move low-level inference behind a Worker if frame-time measurements require it. Test the exact package's timing/cleanup controls rather than assuming the high-level helper supplies all accessibility behaviours.

For the sherpa comparison, use `getUserMedia` and an AudioWorklet with explicit mono resampling; devices often capture at 44.1/48 kHz. Transfer bounded PCM buffers to `speechRecognition.worker.ts` for decoding and endpointing. In both adapters, bound queued audio, report overload, load pinned assets lazily with download progress, and recover from missing/corrupt caches. Measure first download, warm start and offline restart independently. Verify the production isolation headers for Moonshine or benchmark its separately built single-thread fallback.

**Phase 3 — connect speech to the city.** Add `mountCityVoiceReply.ts` and a help controller in `cityScreen.ts`. Silence narration before capture and temporarily duck city music through a dedicated audio override that preserves user settings. Release microphone tracks, Workers/session handles and audio nodes on stop, navigation, hidden document, new city and disposal. Cancel stale recognition and interpretation when the run or encounter changes. Before dispatch, recheck the target still exists, the context still matches, `canEdit` and dimension limits. Deduplicate turn results so reconnects cannot execute twice. Reuse dispatcher feedback, city sync and undo history for typed, spoken and button actions.

**Phase 4 — on-device hardening and model selection.** Compare Moonshine Tiny/Small Streaming with sherpa Zipformer on the same phrase corpus and hardware. Add a Vosk/browser or whisper.cpp/WASM baseline if both miss the gates. A Parakeet spike must establish the exact model's streaming-state support, conversion/runtime compatibility, browser memory and sustained CPU/GPU use; a native Python/C++ demo is not proof of browser viability. Choose the model by measured intent accuracy and city frame-time impact. Retain no raw audio by default. Verify no outbound audio/transcript requests after model download and no automatic cloud fallback. An unsupported or overloaded device gets typed replies and existing controls. No backend or provider credentials are needed for the selected architecture.

## Validation and release gates

Use representative, consented speech: different accents, quiet/short speech, long pauses, children if part of the intended audience, atypical speech, exhibition noise and the app’s own audio. Compare command/intent accuracy and task completion, not just word error rate. Include corrections, negation, numbers, ambiguous references and speech containing multiple instructions.

Provisional targets: warm listening readiness below 1 second; final transcript below 1 second after the user presses Done or the configured endpoint fires; at least 95% correct intents on an agreed clear-command corpus; no mutations for silence, partial text, negated edits or stale turns. These are proposed gates, not measured results. Record median/p95 latency, early-cutoff rate, clarification rate, memory, model download size, CPU load and city frame-time impact on desktop and a low-end mobile device.

Add meaningful tests for interpretation, allowed actions, limits, duplicate finals, stale contexts, disposal and failed recognition. Integration scenarios should cover stairs, multi-cause crossings, widths, bikes, studio doors, wall collisions and other robots. Include a maximum-size edit that still fails to unblock the robot; the UI must explain the remaining obstacle rather than promise success. Verify permission denial, absent microphones, model-load failure, network loss and microphone release.

Run `pnpm test` and `pnpm check` for implementation changes. Preserve the global minimums in `source/src/accessibility.css`: every control, including disabled/icon-only controls and disclosures, must render at least 44 × 44 CSS pixels without overlap. Verify actual rendered targets, listening states, keyboard focus and transcript behaviour in desktop/mobile browsers. Announce listening and final results politely; avoid screen-reader announcements for every partial token. Keep typed replies and existing city choices available throughout.

The first deliverable should be typed contextual help plus an isolated recognizer benchmark. Select the production STT deployment from those results, then connect microphone replies. No runtime dependencies or control sizes change as part of this planning document.
