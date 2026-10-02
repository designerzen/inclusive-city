# Technical specification

Status: wider proposed architecture with a working designer and city route prototype. Research date: 2 October 2026. Babylon.js is pinned in `source/package.json`. [City prototype](city-prototype.md) documents implemented behaviour and remaining work.

## Stack and responsibilities

| Layer | Proposed technology | Responsibility |
| --- | --- | --- |
| Application | TypeScript with Vite; semantic HTML/CSS UI | Navigation, workshop forms, editor panels, accessible HUD |
| 3D | `@babylonjs/core`; loaders only if needed | Robot meshes, city rendering, orthographic cameras, picking |
| Simulation | Pure TypeScript modules | Road graph, access checks, autonomous behaviour, fixed-step updates |
| Music | Web Audio API | Instruments, timed playback, offline audio rendering |
| Visual art | Canvas 2D; optional SVG renderer later | Event-driven marks, independent high-resolution export |
| Local persistence | IndexedDB | Robots, city documents, sessions, event logs, export metadata |
| Download | Blob/object URLs and browser download controls | PNG, WAV, JSON; optional recording later |
| Validation | Unit tests for simulation/export; browser integration tests | Deterministic behaviour, interaction, restoration, output validity |

Start with a client-only application. Accounts, cloud storage, analytics, multiplayer, and an online gallery are outside the first release. Use procedural modular robot parts and simple city meshes initially. An HTML overlay is preferred for actionable HUD controls; Babylon GUI may supplement in-world labels but cannot be the only accessible control surface.

Keep the scene as a view of application state. Mesh transforms must not be the sole source of road connectivity, robot characteristics, or city access rules.

The workshop's appearance state is defined in `source/src/robot/appearance.ts`. Upper-body width/height/depth scales, shell shape, and palette entry are randomised independently of ability tuning and function selection. Rebuild only torso/head shell meshes when the shape changes, reusing materials and disposing replaced geometry. A parent transform scales the entire upper body; a separate four-wheeled chassis is retained. Balance assistance changes wheel spacing. Robot metadata retains appearance and `locomotion: 'wheels'` alongside the functional profile. Orthographic framing uses current robot bounds and space for rotation. Future city clearance and reach checks must account for these actual proportions.

`source/src/robot/botHistory.ts` holds a page-lifetime collection and navigation cursor. Next restores a cached entry or appends one if the cursor is at the end; Previous stops at the first entry. Cache logical state rather than scene meshes. Each entry has a stable ID, scientist-derived initial name, appearance, and a cloned functional profile. Tuning and rename changes update only the current entry. Names must contain 1–60 characters after trimming and are rendered as text, never HTML. The designer restores the profile on navigation, and the scene metadata receives the current name/ID. Persistent storage across reloads is not yet implemented.

## Camera specification

“Orthogonal camera” in the brief is implemented as an **orthographic camera**. Babylon exposes `Camera.ORTHOGRAPHIC_CAMERA` and the four orthographic bounds; its camera source confirms these properties. [Babylon.js camera implementation](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Cameras/camera.pure.ts)

### Workshop

Use a fixed `UniversalCamera` in orthographic mode, looking horizontally at the robot's visual centre. Rotate the robot's parent `TransformNode` around the vertical axis. This satisfies the directly facing, rotating character view without making the camera orbit. An `ArcRotateCamera` is an option for later inspection controls; Babylon documents its target-centred orbit. [Babylon.js camera documentation source](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/cameras/camera_introduction.md)

Recompute framing from robot bounds and the available canvas area. Fit both height and width with margin, including unusually wide bodies. Manual rotation, pause, and labelled front/side/back views remain available. Cosmetic animation must not mutate simulated characteristics.

### City

The current prototype uses a steep overhead orthographic view tilted to reveal wireframe building edges, stairs, and elevator travel. The strictly vertical setup below remains an option for later editing views.

Use a second orthographic `UniversalCamera`, positioned above the XZ city plane with Y as vertical. Set `upVector` to a horizontal world direction before targeting straight down, so view direction and up vector are not parallel. Maintain a fixed overhead orientation; pan by moving camera and target together. Zoom changes orthographic extents, not camera distance. Leave generic camera input detached and implement editor-aware pan/zoom controls.

Illustrative setup, to be verified against the pinned Babylon version:

```ts
import { Camera, UniversalCamera, Vector3 } from "@babylonjs/core";

const camera = new UniversalCamera("city", new Vector3(0, 40, 0), scene);
camera.upVector = new Vector3(0, 0, 1);
camera.setTarget(Vector3.Zero());
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.minZ = 0.1;
camera.maxZ = 100;

function frameCity(halfHeight: number, aspect: number) {
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
  camera.orthoLeft = -halfHeight * aspect;
  camera.orthoRight = halfHeight * aspect;
}
```

On layout changes, resize the engine and update bounds using the actual render viewport aspect ratio. Preserve circles and dimensions in portrait and landscape. Separate near/far clipping from zoom. Camera transitions must be skippable; a simple cut is appropriate for reduced motion. The HUD remains a DOM overlay independent of the active camera.

## State and module boundaries

```text
Accessible UI -> editor commands -> city document + command history
                                      |
Robot configuration + city document -> navigation graph/access evaluator
                                      |
                               fixed-step simulation
                                      |
                           ordered journey event stream
                             /          |           \
                      Babylon view   music engine   art renderer
                                      |
                          session store and export service
```

Suggested modules: `robot`, `city`, `editor`, `navigation`, `simulation`, `events`, `audio`, `art`, `persistence`, and `ui`. UI and touch editing issue the same validated commands. The simulation emits events; music and art consume them without changing navigation.

Persist these logical records:

| Record | Required contents |
| --- | --- |
| Robot | ID, name, appearance, dimensions/footprint, functional characteristics, preferences, creative identity |
| City | Stable element IDs, transforms, semantic types, connections, access properties, destinations, collectible locations |
| Run | Run ID, initial robot/city snapshot, simulation seed, start state, versions, duration, end state |
| Command | Simulation tick, sequence number, type, target, validated parameters, reversible previous state |
| Journey event | Tick/time, sequence, robot ID, position, route/element IDs, event type, reason, relevant values |
| Creative session | Music/art mapping versions, instrument/sample identifiers, creative seed, generated score and mark instructions |

Use explicit units: world distances in game metres, angles in radians internally, speed in metres/second, durations in seconds, and normalised preferences where appropriate. These are calibrated game values, not clinical assessments or building-code compliance values.

Version schemas separately from simulation and creative algorithms. Replays require the applicable versions or an explicit migration warning; a random seed alone cannot preserve outputs when algorithms change.

The current workshop implements five paired ability budgets in `source/src/robot/abilities.ts`: speed/route memory, agility/balance, visual detail/wide awareness, reach/compactness, and burst power/endurance. Store one 0–100 allocation per pair and derive the complement, rather than allowing contradictory saved values. Forgetfulness equals `100 - routeMemory`. Separate pairs remain independent. The designer publishes the derived profile to the scene and adjusts arm geometry and stance for reach and balance; movement and perception consequences await the city simulation. These are fictional robot resource constraints, not human correlations.

`source/src/robot/functions.ts` adds five module flags: movement, vision, hearing, memory, and balance. Profiles must hold exactly three distinct valid function IDs. Keep their activation order to predict replacement: enabling replaces the oldest activation; disabling enables the first inactive module in display order. Apply the swap in one update. Persist configured ability budgets separately from effective abilities so switching a module back on restores its tuning. Off modules override corresponding effective values with zero (memory-off also makes forgetfulness 100); hearing remains a flag. The scene metadata contains configured abilities, effective abilities, and enabled functions. Future navigation must consume effective capabilities and module flags rather than configured budgets alone.

## Autonomous road-following and access

Represent roads and pedestrian paths as connected segments with centreline polylines or splines, usable widths, heights, slope, surfaces, and endpoints. A visible road mesh is not proof of connectivity. Buildings expose reachable entrance nodes, not destinations at their geometric centres.

For the first version, use a semantic graph and kinematic movement rather than unconstrained rigid-body physics. The robot state holds a current segment and distance along it. Follow its centreline and align the mesh with the tangent. On ramps, interpolate height from the path. Decorative sway conveys movement but does not introduce unlogged randomness.

1. Determine observed/known destinations and choose a goal from collectibles, collaborations, and available charging/rest needs.
2. Evaluate candidate graph edges and transitions against the robot's footprint, turn radius, chassis limits, reach, perception, processing, and current energy.
3. Exclude physically impossible transitions. Apply non-negative costs to feasible routes for distance, effort, environmental load, and uncertainty.
4. Plan with Dijkstra initially. A* is optional once a safe heuristic is established; a Euclidean heuristic needs an appropriate minimum cost bound.
5. Follow the route at a bounded speed, obeying crossings, stopping distance, and dynamic obstacles.
6. Replan at relevant changes or encounters. If no feasible route exists, emit a reason and wait or seek a feasible alternative.

Access evaluation returns structured reasons such as `insufficient-width`, `step-too-high`, `crossing-too-short`, `cue-not-perceived`, or `destination-out-of-reach`. Width checks include clearance; turns use a swept footprint or validated corner geometry. A physically feasible ramp also needs connected endpoints and usable approach space. Signals use phase timing and robot traversal time, not a random failure chance.

Distinguish **physical feasibility** from **information available to the robot**. A route may exist but remain unknown without detectable signs. Do not give the agent omniscient routing that makes vision and memory irrelevant. Maintain an observed graph, landmarks, and route memory; reminders restore usable information. Prefer interpretable, seeded decision rules over arbitrary mistakes.

Behaviour states: `choosing-goal`, `following-route`, `waiting-at-crossing`, `orienting`, `collecting`, `collaborating`, `resting-or-charging`, `blocked`, and `session-ended`. Balance events can cause safe pauses/recovery or avoidance; do not implement repeated falls as a spectacle. Energy depletion ends movement safely and offers restoration or reachable support; it does not erase art or punish the user.

Use a fixed simulation tick, initially 30 Hz, with rendering interpolated independently. Suspend on backgrounding and audio interruption rather than catching up unseen encounters. Log user edits at tick boundaries. Stable ordering, seeded randomness, and explicit state transitions support replay; persist derived score/marks as well to reduce cross-browser rendering differences.

## Editing implementation

Use Babylon picking against an explicit list/predicate of editable objects and map picked meshes to stable city element IDs. Its input implementation provides pointer observables and pick information. [Babylon.js input manager source](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Inputs/scene.inputManager.ts)

Project the pointer ray onto the relevant editing surface; an elevated object must not accidentally place a road at roof height. Convert canvas-relative input coordinates consistently with Babylon's selected picking API and test device-pixel-ratio/zoom cases. Capture the pointer for an active edit, cancel safely on `pointercancel`, and release on completion.

Define interaction priority: HUD control, active handle, selected object, placement mode, camera gesture. Pause simulation during transform preview. On commit, validate geometry, create one undoable command, update meshes and access properties together, rebuild affected graph sections, and replan. Cancelling a gesture restores the original state. Commands also power keyboard nudges and tap-place alternatives.

Keep selections stable through rebuilds. Reject invalid sizes or disconnected constructions with visible/text feedback. Undo reverses city edits while simulation time remains forward-moving; log the undo as a new command. It does not remove historical encounters or undo already collected material. “Replay from start” is a separate operation.

## Journey data and real-time creative output

Events include route start/end, progress samples, junction decisions, barrier encounter/recovery, waiting start/end, city edits, support use, collectible pickup, destination reached, and collaboration. Emit transitions once; progress samples can be recorded at 5 Hz initially instead of every rendering frame. Record both successfully collected and still-unreachable opportunities.

Continuous features include travelled distance, speed, turning, energy, waiting duration, uncertainty, and configured environmental load. Define environmental load as a modelled game variable, not a claim about human feelings. Derive it from documented exposure rules and robot preferences. Smooth continuous values and debounce encounters to avoid audiovisual flicker.

The music engine maps the event stream to a bounded score: note start, duration, pitch, instrument, gain, and effects parameters. Keep the robot's motif stable, distinguish event cues from background composition, and schedule notes using the audio clock with a short look-ahead rather than relying on animation-frame timing. Quantise larger musical changes to phrase boundaries; visual/text event feedback remains immediate.

Start/resume sound only after a user action. Allow master volume, mute, independent cue volume, and a calmer palette. Provide gain headroom, smooth parameter changes, and a limiter. Audio must never be required to discover a barrier. Browser audio activation and user control should follow Web Audio guidance. [MDN: Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

The art renderer builds a logical mark list from the same events, including route coordinates, strokes, symbols, layers, and pigments. Render a small live preview in the HUD and a larger independent canvas for export. The artwork is not merely a screenshot of the game. Include a text description of significant events and a visible mapping legend.

Robot identity, route geometry, event order, supports, materials, and creative seed differentiate outputs. Describe them as individually generated; do not promise mathematical uniqueness. User mute, device volume, or reduced-motion preferences must not silently remove events from saved compositions.

## Saving, downloads, and restoration

**Required in the first playable release: PNG artwork, WAV music, and session JSON downloads.** Browser-local autosave supports convenience but does not replace user-owned downloadable files.

| Export | Pipeline | Required verification |
| --- | --- | --- |
| Artwork PNG | Replay marks at chosen resolution; use canvas `toBlob()` | Correct dimensions, all committed marks/layers, valid image, no HUD unless explicitly requested |
| Music WAV | Render recorded score through `OfflineAudioContext`; encode returned PCM samples as WAV | Valid header/sample count, non-empty expected audio, correct duration including effect tails |
| Session JSON | Serialize robot, initial city, edits, events, seed, versions, score, and marks | Valid schema, restore accepted, replay retains causes and collection history |
| Journey summary TXT | Generate from ordered events and city changes | Readable descriptions linked to the saved run |

MDN documents `OfflineAudioContext` rendering into an `AudioBuffer` and canvas `toBlob()` creating image files. WAV encoding is an additional implementation step; the browser does not automatically turn the buffer into WAV. [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext), [canvas toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)

Save flow: pause or snapshot the committed run at a defined tick; show title, duration, image size, and file choices; generate each file from that snapshot; offer separate explicit downloads; report completion or failure per file. Mobile browsers may open a save/share view, so instructions must reflect observed browser behaviour. Use meaningful filenames and revoke temporary object URLs after use. Export can be retried without changing the run.

Reuse the same instrument-building code for live and offline audio graphs. Version and retain any sample assets; start with synthesis to simplify offline reproduction and licensing. Where an effect is non-deterministic, store its parameters/seed or document approximation. Muting the live output changes the final live gain, not the saved score. Exact binary audio/image equality across devices is not promised.

Use IndexedDB for asynchronous structured storage. Handle quota failures, private browsing, and storage clearing with a download reminder; show the last successful autosave. Validate imported JSON, constrain sizes and numeric ranges, and never execute imported content. [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

Start with bounded runs, provisionally five minutes for the guided route. Estimate export memory before allocation; rendering long stereo PCM sessions can be expensive on tablets. Offer shorter sections or lower resolution when necessary and move encoding into a worker. A failed export must retain the session and provide a retry.

Optional later exports: SVG from vector marks, MIDI from note events, a ZIP creative bundle, and audiovisual recordings. MIDI preserves note instructions rather than the rendered sound. For recordings, combine an explicitly composited canvas with the audio stream; DOM HUDs are not automatically included in a canvas capture. Detect supported media formats at runtime and label the actual format instead of promising MP4 everywhere. `MediaRecorder.isTypeSupported()` is the documented capability check. [MDN: MediaRecorder format detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)

Use original or suitably licensed samples, fonts, patterns, and contributions; retain attribution metadata in exports. Agree a clear user right to download and reuse their generated outputs before launch. Cloud publication, if added, requires an explicit user action and separate consent.

## Performance and validation

Use modest geometry, shared materials/instances for repeated props, bounded particles, and adjustable render resolution. Rebuild only affected navigation data after an edit. Provisionally target 60 fps on desktop and usable 30 fps on the agreed reference tablet, with selection feedback within 100 ms and graph updates within 200 ms for the small neighbourhood. These are engineering targets to measure, not current results.

Required checks:

- Graph/access tests: narrow passage, swept turns, connected ramps, crossing timing, unreachable goals, information-dependent wayfinding, energy support, and edits under the robot.
- Replay tests: identical version/seed/commands reproduce logical state and event order; pickups and encounter transitions are not duplicated.
- Input tests: touch move/resize/add, camera gesture conflicts, cancellation, undo/redo, portrait resize, keyboard and non-drag alternatives.
- Creative tests: a known event fixture yields expected notes and marks; pause/resume has no duplicate notes; live mute does not change exports.
- Export/restore tests: decode PNG and WAV, inspect dimensions/duration, reopen JSON, exercise failure and retry, and test mobile saving.
- Accessibility review: screen-reader task completion, keyboard-only tasks, focus visibility, contrast, zoom/reflow, reduced motion, muted play, and readable event summaries.
- Browser/device checks: agreed desktop Chromium/Firefox/Safari coverage plus Android Chrome and iOS/iPadOS Safari; verify actual target versions at implementation time.

Build sequence: accessible workshop and state schemas; semantic city and autonomous navigation; touch editor and command history; event stream and live music/art; downloads and restoration; co-designed scenario expansion. Export and accessibility work are part of the first playable milestone, not post-launch additions.
