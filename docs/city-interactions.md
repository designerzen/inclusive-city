# Low-effort city editing

Investigation and implementation strategy, 2 October 2026. The first editing milestone below is implemented; later construction and direct manipulation remain proposals. This refines the editor architecture in [technical-specification.md](technical-specification.md) and the participation plan in [research-and-evaluation.md](research-and-evaluation.md).

## Implemented milestone

- City entry starts in an untimed `ready` state. **Start journey** begins travel; planning edits do not count as journey movement, failures, or elapsed time.
- A responsive feature editor provides eight neutral, named feature buttons and an optional robot-facts disclosure. Every feature is selectable before departure, while paused, during travel, and after arrival.
- Pavement width and crossing duration have larger/smaller controls. Curb, bridge, ramp, route cues, elevator, and transport have reversible actions. **Help me decide** is optional; encountered barriers expose their explanation and a suitable one-action change.
- Selecting a feature during unblocked travel pauses the journey. **Done editing** restores that running state. Selecting or changing a feature while manually paused never resumes travel.
- `CityDocument` validates values, stores command history, and provides undo/redo. Simulation access checks read the same properties that render city geometry. Edits affecting an occupied feature are unavailable until the robot moves clear.
- **Try again** immediately starts a new journey with city changes and undo history intact. Initial run snapshots record city properties. Completed run records are preserved when the city is edited after arrival.
- Keyboard-operable HTML controls provide a full non-drag editing path. Map selection occurs on release, with a movement threshold separating taps from pan/pinch, and screen-space hit tolerance for small markers. Selections and focused controls survive changes.

Arbitrary object placement, free road construction, draggable handles, session downloads, and formal assistive-technology/user evaluation remain future work. Current width changes also reposition the pavement boundaries; there is no separate free-move tool yet.

## Recommended experience

Make an environmental change possible with one deliberate activation when the robot encounters a barrier, or two activations when the user chooses another feature. Treat “least energy” primarily as physical effort, cognitive effort, and fatigue. Support different access needs rather than assuming the fewest clicks suits everyone.

Editing is available before departure, while paused, while blocked, and during travel. Encountering a barrier never unlocks an editing capability; it only offers contextual help. Anticipating what might prevent access is a core part of the game.

## Plan, test, and improve

Enter the city with the robot stationary and a prominent **Start journey** button. Users can explore and edit immediately, or start without making changes. Show a short invitation: “What would you change before your robot sets off?” Do not require a planning tutorial, checklist, or minimum number of edits.

Before departure and while paused, use the same feature controls as during travel. The map shows neutral named targets such as **Pavement**, **Crossing**, and **Bridge**, rather than marking every predicted problem red or revealing a recommended fix. The equivalent HTML feature list provides the same facts and choices without needing to inspect the map visually.

Selecting **Pavement** might show “Width: 1.2 m” with **Widen** and **Narrow** controls. Selecting **Crossing** shows its current signal time with **More time** and **Less time**. Selecting **Stairs** offers **Add ramp**. These controls make the available changes discoverable while leaving the prediction to the player. Keep robot characteristics available for comparison; interpret dimensions in plain language when requested.

Provide an optional **Help me decide** action on the selected feature. It explains that feature's relationship to the robot and offers a suitable preset. Help must also be available through text and assistive technology. Users can choose support without being forced to infer visually, and the default presentation preserves discovery.

Activate **Start journey** to test the city. During travel, **Pause** gives time to inspect and revise any feature. Opening a geometry adjustment temporarily pauses travel; closing it restores the previous running state. A manually paused or not-yet-started robot never starts because an edit finished. If the robot encounters a problem, offer the contextual one-action card described below. Keep the user's existing selection when they are inspecting another feature.

After changing the city, **Try again** restarts the journey with those changes intact. Resetting the city is separate. Users can make predictions, observe what happens, and revise them without losing their work. Avoid deadlines, forced hints, or penalties for exploratory choices.

## Contextual help during travel

Keep a stable **City features** panel alongside the map on desktop and directly beneath the camera selector on phones. It must remain available in every camera view. Show a short explanation and one prominent action for the selected feature:

> **Narrow pavement**
>
> This pavement is too narrow for your robot.
>
> **Widen pavement**

After activation, update the geometry and announce “Pavement widened.” When contextual help is active and access has been evaluated, also explain whether the robot can pass. During unassisted planning, report the new property without automatically revealing the predicted outcome. Keep the card and keyboard focus in place, show the resulting state, and provide **Undo**. Avoid a confirmation dialog for these reversible edits. Never automatically advance focus to the next feature.

The map and the panel are two ways to reach the same edit. A compact **All features** disclosure contains named buttons in route order, each with its state. The existing dropdown can remain during migration, but it should not be the main discovery mechanism. Feature names must also be usable as speech-control targets.

Automatically offer the current barrier when first encountered, unless the user is already editing another feature. In that case show a quiet “Robot waiting at raised curb” action without replacing their selection. The robot waits indefinitely; editing has no deadline, score penalty, or repeated urgent prompt.

## Interaction budget

| Task | Default interaction | Additional control |
| --- | --- | --- |
| Plan before departure | Select any feature and choose a change | Help me decide, optional |
| Test a planned city | Activate Start journey once | Pause at any time |
| Change the current obstacle | Activate its suggested action once | Undo |
| Change another feature | Select its map label or list button, then activate an action | Focus map, optional |
| Resize a pavement | Select pavement, then choose a width preset | Wider / narrower buttons; optional drag handle |
| Move a boundary | Select it, then choose a named valid position | Directional nudge buttons; optional dragging |
| Add a ramp or route cue | Select the relevant feature, then Add ramp / Add route cue | Valid placement choices if more than one exists |
| Undo a change | Activate persistent Undo | Redo |

These budgets assume the relevant feature is visible. Opening the full list or scrolling adds actions, which should be measured in participant testing.

Use suggested placements, meaningful presets, and snapping. Do not require users to enter dimensions or find a precise pixel. An optional **Adjust** disclosure can expose more control without crowding the first action. Suggestions should be explainable and should not modify the robot or make all city decisions automatically.

## First supported edits

| Feature | Primary action | State to store and render |
| --- | --- | --- |
| Raised curb | Lower curb | Curb height and crossing connection |
| Short crossing signal | Give more crossing time | Crossing duration; visual signal phase |
| Route information | Add route cues | Cue placement and cue types |
| Narrow pavement | Widen pavement | Clear width and boundary positions |
| Raised bridge | Lower bridge | Deck angle and connected state |
| Stairs | Add ramp | Ramp presence and geometry |
| Elevator | Enable elevator | Service availability |
| Movement support | Add transport | Support presence and route service |

Initially constrain move, resize, and add operations to valid positions on the existing route. This provides genuine user-controlled changes with predictable outcomes. Arbitrary road placement and unrestricted construction require navigation and geometry work beyond the current fixed-route simulation.

In contextual help or when the user requests a suggestion, suggested values should respond to the selected robot: clear pavement width derives from its footprint plus a simulation clearance margin; crossing time derives from crossing distance and speed plus a margin. Unassisted planning uses neutral presets or simple increments, rather than silently choosing the correct value. These are game rules, not real-world engineering standards. Explain predicted access when help is requested; observed journey outcomes remain available to everyone.

## Access and fatigue requirements

- Use semantic HTML buttons and controls for all editing. The 3D canvas must never be the only way to select or change an element.
- Aim for at least 48 × 48 CSS pixel primary targets with spacing. This is a project choice above the 44 × 44 enhanced target criterion; WCAG 2.2 AA's minimum is 24 × 24 with exceptions. Enlarge map hit areas in screen space rather than relying on the world-space size of a torus. [W3C target-size guidance](https://www.w3.org/WAI/WCAG21/Understanding/target-size)
- Every drag operation needs both keyboard operation and a single-pointer alternative. Keyboard equivalence alone does not satisfy the non-drag requirement. Use named positions, width presets, and tap-operated nudge buttons. Avoid mandatory pinch, double-tap, long press, hover, or timed gestures. [W3C dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)
- Activate edits on click/release, not pointer-down. Dragging previews a change; release commits one command. Escape, pointer cancellation, or leaving the valid surface cancels the preview. Pinching or panning must never activate a feature accidentally. [W3C pointer cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html)
- Keep keyboard order stable and focus visible and unobscured. Native buttons support Tab, Enter, and Space. Label icons visibly for editing actions; match accessible names to their visible text. Test voice control and switch scanning as well as keyboard use.
- Do not remove or hide the focused action immediately after applying it. Keep an accessible result and nearby Undo. Do not announce status on every frame or steal focus when another obstacle is encountered.
- Communicate state with text and shape as well as colour. Announce completed changes through a restrained polite status region without moving focus. Sound is optional and mute must not remove any information. [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- Respect reduced motion. Freeze follow-camera motion while an edit is in progress and restore the user's camera afterwards. “Focus map” is an explicit optional action; users need not reposition the camera to edit.
- Pause simulation while a user adjusts geometry. Preserve a separate user-pause state: finishing an edit must not resume a robot the user had paused. Single-action edits at an already blocked obstacle need no extra pause/resume activation.
- Provide untimed Undo and preserve changes across journey restart. Distinguish restarting a journey from resetting the city. Session persistence can follow the same city document later.

## Findings in the current code

`src/ui/cityScreen.ts` already selects newly encountered barriers and shows their action, but the intervention panel sits below the canvas. Applying an intervention clears selection and hides the panel, which can lose the user's place and focus. The panel updates every rendered frame; new editing UI should update only when its displayed values change.

`src/city/createCityScene.ts` makes barrier rings pickable, while feature geometry is generally not pickable. Selection has no equivalent visible feature list beyond the dropdown. Canvas pointer movement pans immediately; new object manipulation needs explicit arbitration between selection, editing, panning, and pinch gestures.

Scene interventions mutate meshes in a switch statement. `CityJourney.intervene()` adds a barrier ID to a `fixed` set and records the intervention. It can reject an intervention after journey completion, while the scene still applies its visual change. A shared command result should gate rendering so the city and simulation cannot disagree.

`src/simulation/cityJourney.ts` checks a fixed route and bypasses access checks for IDs in `fixed`. Arbitrary geometry editing would otherwise be cosmetic: moving a wall would not recalculate navigation. A widened pavement or longer signal must be evaluated from city properties, not just a fixed flag.

## Implementation structure

1. Introduce a serializable `CityDocument` containing feature IDs, positions, dimensions, connections, and access properties. Retain initial values separately. Treat it as the source of truth for geometry and access checks.
   Track journey lifecycle separately from editor availability: `ready`, `running`, `paused`, `blocked`, and `complete`. City edits must work in every lifecycle state, subject to occupied-surface validation. Pre-departure edits become part of the initial run snapshot; between-run edits belong to city history rather than a completed robot run.
2. Introduce validated editor commands such as `setPavementWidth`, `setCrossingDuration`, `setBridgeState`, and `addRamp`. Map gestures, panel actions, and keyboard controls issue the same commands. Store before/after state for undo and redo.
3. Commit atomically at a simulation tick boundary during travel, or immediately through the same command processor when stationary. Paused editing cannot depend on a simulation tick that never runs. Validate first, update the document, refresh affected meshes, reassess affected route access, and emit one city-edit event. A rejected command must change neither meshes nor simulation state. Pause reassessment must not transition a ready or manually paused journey into travel.
4. Keep simulation history forward-moving. Undo restores city properties, not past robot encounters, collected items, music, or art. Record the undo as another edit. Recheck access before the robot enters an affected segment.
5. Prevent an edit from removing a surface under the robot. Explain why it cannot currently be changed and offer a safe alternative; never teleport it or silently defer an edit. Undo involving an occupied surface needs the same validation.
6. Add the stable feature card and equivalent HTML feature list first. Add larger labelled map targets and optional snapping handles after that shared control path works.

Suggested modules: `city/cityDocument.ts`, `editor/cityCommands.ts`, `editor/editHistory.ts`, and `ui/cityFeaturePanel.ts`. Reuse existing scene objects and simulation events; no additional UI framework or editing library is needed for this scope.

For computational efficiency, update only changed meshes and access checks, coalesce pointer preview work to animation frames, and record one command per completed gesture. Pause unnecessary scene rendering when the page is hidden. Measure performance before pursuing broader optimisation.

## Delivery order and validation

First deliver pre-departure planning with Start journey, the stable feature card, accessible feature list, optional contextual help, persistent Undo/Redo, and state-backed versions of the existing eight edits. Width and time controls must support exploratory choices as well as suitable presets. Next add named placements and optional direct manipulation. Add free construction only after navigation supports it.

Acceptance tasks: widen a pavement, move a boundary, add a ramp, undo each change, and continue the journey using touch without dragging, keyboard only, and a screen reader. Repeat in overhead and follow views, with sound muted, reduced motion, zoomed text, and a narrow viewport. Verify that a pan never causes an edit, focus survives an action, manual pause survives editing, and geometry/access checks agree after undo and restart.

Also test editing before the first run, editing while manually paused, and revising a completed journey's city. Verify that pre-departure edits do not start the robot, no encounter is required to edit, planning labels do not reveal predicted failures, optional help is equally available through the feature list, and Try again keeps all city changes. Ask participants to predict one obstacle, make a change, observe the journey, and revise their prediction.

Evaluate with disabled participants, including people who experience fatigue, tremor, low vision, and cognitive access barriers. Record effort, comfort, accidental activations, recovery, and completion without assistance. The proposed design reduces required actions; it does not establish accessibility or low fatigue without testing with its users.
