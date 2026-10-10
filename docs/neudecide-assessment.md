# NeuDecide assessment for Inclusive City

Investigated 8 October 2026; browser implementation verified by source inspection on 10 October 2026. Recommendation: evaluate it as an optional on-device spoken-command adapter for blocked ArtBots. Keep the current Moonshine path until a browser prototype demonstrates better command success with the intended audience. This investigation changes no application behaviour.

Correction to the initial assessment: the supplied [product page](https://www.neuphonic.com/models/neudecide) has a genuine client-side WASM demo. The web research tool could not retrieve it, but direct HTTP retrieval succeeded. Its [published JavaScript module](https://framerusercontent.com/sites/4YYIO0o9idWrnjaJqnLM7a/NeuDecide.SjC44zT_.mjs) contains the inference implementation. The Python repository alone did not reveal this separate browser implementation.

## What it offers

NeuDecide maps audio plus a tool list directly to function calls, without an intermediate transcript. Neuphonic reports a 43 MB model, CPU execution and offline operation after download, under Apache 2.0. Its published q4 measurements are 46 ms on an M3 MacBook Pro, 82 ms on a Samsung S24+, and 206 ms on a Raspberry Pi 5, with 146–174 MB peak RAM. These are vendor measurements, not measurements in this browser application. [Repository](https://github.com/neuphonic/neudecide).

The first PyPI release, `0.1.0a1`, was published on 7 October 2026 and is marked prerelease. Documented limits include English input, 30 seconds of audio, 1,536 tool tokens and 128 output tokens, with at most ten tools recommended. [Package](https://pypi.org/project/neudecide/).

## Where it could help

The existing flow is microphone → Moonshine Tiny Streaming → text → `interpretCityReply()` → `applyCityReply()`. The interpreter uses explicit rules, and deliberately rejects ambiguous, negated and multiple requests. NeuDecide offers a candidate alternative for interpreting spoken requests; improved paraphrase coverage is a hypothesis to test.

| User request | Proposed model-facing tool | Application responsibility |
| --- | --- | --- |
| “Put a ramp here” | `addRamp()` | Resolve the current eligible stairs/bridge and build the appropriate feature or bridge-access action. |
| “Give me more time to cross” | `extendCrossingTime()` | Calculate a sufficient duration from crossing length and robot speed, within limits. |
| “I cannot reach the button; lower it” | `lowerCrossingPanel()` | Calculate height from the robot's reach and validate the crossing target. |
| “Make room for you” | `widenCurrentPassage()` | Calculate width from the footprint and check dimension limits. |
| “Move that bicycle” | `clearCurrentBicycle()` | Resolve the specific blocking bicycle and reuse repair history. |
| “Why are you stuck?” | `explainCurrentBarrier()` | Return the existing explanation without changing the city. |
| “Don't change anything” | `noAction()` | Give feedback without mutation. |

Generate the short tool list from the current encounter. Bind targets inside the app; avoid asking the model to invent street IDs. Start with no-argument tools so width, reach and crossing calculations remain deterministic. Add numeric arguments only after a separate evaluation of units and quantities.

Potential benefits are hands-free access to city editing, more conversational interaction with the ArtBot, and local interpretation without a cloud language model. None establishes suitability for atypical speech. The educational explanation must remain visible and speakable so voice editing still communicates why changing the environment helps.

Robot customisation and music controls are later candidates. Broad conversation, route planning, and arbitrary artwork instructions are outside this first experiment.

## Integration work

The repository exposes a Python runtime. Its generation code runs an audio encoder, tool encoder and token-by-token decoder with cached attention state. It defaults to q4 `MatMulNBits` graphs. Although the speech encoder is described as streaming, the current high-level API processes an utterance. [Runtime source](https://github.com/neuphonic/neudecide/blob/main/neudecide/model.py).

The website's JavaScript creates ONNX sessions with `executionProviders: ["wasm"]`, imports `onnxruntime-web@1.30.0`, runs inference in a Worker, and selects one thread when cross-origin isolation is unavailable. It includes a JavaScript SentencePiece BPE tokenizer, Python-compatible JSON serialization, attention-cache handling, AudioWorklet microphone capture and resampling. These are direct source findings, not a live inference test. [Published demo module](https://framerusercontent.com/sites/4YYIO0o9idWrnjaJqnLM7a/NeuDecide.SjC44zT_.mjs).

This substantially reduces the browser feasibility uncertainty: an existing browser implementation can inform our adapter instead of designing the whole pipeline from the Python code. However, I did not find a packaged NeuDecide JavaScript SDK or browser example in its public GitHub tree. Check reuse rights for the website module separately from the model/repository licence. Confirm the exact model assets, runtime compatibility, tokenizer parity and offline packaging in our prototype.

The website module uses greedy `argmax` decoding; it does not implement the Python package's llguidance constraint layer. That difference must be evaluated explicitly, with strict validation of every returned call. The published Python dependencies include SentencePiece and llguidance. [Package configuration](https://github.com/neuphonic/neudecide/blob/main/pyproject.toml).

Run inference in a dedicated Worker and reuse the existing AudioWorklet capture design. Preserve microphone cleanup, bounded buffers, narration cancellation and music ducking. Load pinned model assets lazily, verify cached bytes, and test offline restart with the runtime and tokenizer as well as model files. A local Python benchmark can establish a reference result, but a server endpoint would not satisfy the project's on-device browser requirement.

`VoiceFactory` currently emits transcript events, so NeuDecide is not a drop-in replacement. Introduce a separate spoken-action result interface and a context-bound adapter that maps proposed tools into `CityReplyAction`. Keep typed replies using their existing interpreter. Share validation, `applyCityReply()`, city sync, feedback and Undo through the screen's existing submission flow.

## Behaviour that must be preserved

The authors report noise-triggered calls and no calibrated confidence score. They also report 75.5% tool accuracy but 37.5% exact match on their SLURP evaluation; neither predicts accuracy on our users or tools. [Repository results and limitations](https://github.com/neuphonic/neudecide).

The current grammar restricts call shape, tool names and argument keys, while accepting arbitrary JSON values for allowed arguments. It does not enforce the supplied argument enums, types or required fields. Validate all of those independently; grammar correctness does not establish user intent. [Grammar source](https://github.com/neuphonic/neudecide/blob/main/neudecide/grammar.py).

Keep explicit Talk, Done and Cancel. Use voice activity detection to reject empty/noise-only capture, without treating detected speech as permission to edit. During the pilot, show the proposed change for user confirmation. Retain a no-action option and reject malformed, unavailable, multiple, truncated or stale results. Recheck run, encounter, city revision and edit eligibility immediately before applying a confirmed proposal.

Do not silently truncate a long reply. Give a clear retry or typed-input path while preserving generous pauses and manual completion. Keep buttons and text available regardless of model or microphone support. Any new controls must preserve the global 44 × 44 CSS-pixel minimum and receive the desktop/mobile browser verification and `pnpm test` required by AGENTS.md.

## Evaluation and decision

1. Build a consented audio corpus for these tools: paraphrases, negation, questions, conflicting requests, long pauses, irrelevant speech, noise and background music. Include the intended audience and report results by relevant speech/device groups.
2. Compare identical recordings against Moonshine plus the current interpreter and NeuDecide. Score correct final action and arguments, unintended actions, clarification/retry rate and task completion. Transcript accuracy alone is insufficient.
3. Establish Python reference outputs, then prove browser parity. Measure model download, warm start, offline restart, Done-to-proposal latency, memory, city frame time and cleanup on desktop and representative mobile devices with music and rendering active.
4. Require no unintended edits across the negative/lifecycle regression suite and no unexplained capability gaps before offering it beyond the pilot. A finite clean test suite is not a guarantee of zero errors. Agree participant-level success and performance thresholds before collecting the main evaluation data.

Adopt only if the browser implementation and participant results justify its download, memory and maintenance cost. Otherwise retain Moonshine and improve the shared interpreter. The website's browser implementation was inspected, but no model download, inference benchmark or live browser inference test was performed during this investigation.
