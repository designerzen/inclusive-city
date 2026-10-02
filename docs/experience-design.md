# Experience and game design

Status: proposed product specification. Research date: 2 October 2026.

## Purpose and learning outcomes

Inclusive City teaches the social model of disability through a creative city-building game. Scope describes disability in terms of societal barriers, including physical obstacles and attitudes, and explains how their removal supports independence and choice. This is the project's educational foundation. [Scope: social model of disability](https://www.scope.org.uk/social-model-of-disability)

By the end of a session, a user should be able to identify a barrier, explain the relationship between an environment and a person's access needs, propose an environmental change, and recognise that accessibility extends beyond ramps. They should also see that different people can need different routes and supports.

The game models interactions between fictional robot characteristics and environments. It does not claim to reproduce an individual's lived experience or diagnose a human condition. Each paired ability has a shared robot engineering budget; separate pairs combine independently. Avoid assigning a diagnosis to a preset or presenting these tradeoffs as human biology.

## Story: from fixing an artbot to changing a city

You have invested in an artbot: a robot that lives to make art with humans. You bring it to your workshop, personalise it, give it a creative identity, and prepare it for its first city commission. You initially expect to fix it up and put it to work.

Outside, a doorway is too narrow, a crossing changes too quickly, and a destination is signed only in small, low-contrast lettering. The artbot is ready to create, but the city excludes it. Your job becomes making the city accessible and inclusive.

The workshop repairs ordinary wear and gives the artbot self-expression. Progress in the city comes from changing the environment. Avoid an upgrade tree that rewards removing the robot's access needs. The artbot remains a creative collaborator with preferences and choices; its value does not depend on speed, output, or productivity.

Suggested opening line: “Your artbot has ideas. Let's give those ideas somewhere to go.” Suggested first barrier explanation: “The doorway is narrower than this artbot. Widen the entrance or create another accessible route.”

## Session flow

1. Meet the artbot and choose a name, body, characteristics, and creative style.
2. Preview its movement and preferences in a small, accessible workshop.
3. Place it at a valid road start in the city and begin its autonomous journey.
4. Observe a barrier, read or hear the reason, and change the city.
5. Watch the same robot reach new places and collect creative material.
6. Inspect the live music and artwork through the HUD.
7. Compare the route before and after changes; save the art, music, and session.

Initial assumption: a browser experience for the general public, with optional facilitated use in schools, museums, or workshops. Audience age and session length remain to be validated; use a short guided neighbourhood plus an untimed sandbox.

## Element 1: create your character

The camera uses **orthographic projection**, looking directly at the robot around torso height. The robot turns on a workshop platform; the user can pause rotation, rotate it manually, or use labelled view buttons. Reframe when its size changes so the whole robot remains visible. Respect reduced-motion settings.

Character creation should offer meaningful combinations without a single best build. Provide visual controls, plain-language descriptions, and an accessible summary of the robot's needs. Show effects before committing changes.

| Category | Choices | Consequence in the city |
| --- | --- | --- |
| Body dimensions | Short/tall, narrow/wide, shallow/deep; continuous sliders within supported limits | Door clearance, path width, overhead clearance, turning space |
| Body shape | Rounded, angular, capsule, box, asymmetrical shells | Visual identity; functional footprint shown separately |
| Locomotion | Wheels on every robot; future wheel size and traction choices | Surface, step, and turning requirements; no wheel configuration grants universal access |
| Movement | Preferred speed, acceleration, braking, turning radius | Crossing time, safe stopping distance, tight corners |
| Balance | Stability and recovery time | Sensitivity to uneven paving, steep cross-slopes, and abrupt turns |
| Vision | Detail range, contrast sensitivity, glare sensitivity, colour discrimination | Readability of signs and route markers; redundant cues improve access |
| Hearing | Cue detection and preferred cue modality | Audio-only crossings or announcements can exclude; visual/text cues help |
| Memory | Route recall duration, reminder preference; user-facing “forgetfulness” explained neutrally | Consistent landmarks and reminders reduce repeated uncertainty |
| Processing | Decision time and information density preference | Short instructions, predictable layouts, and generous timing help |
| Sensory preferences | Noise, crowd, light, and visual-clutter tolerance | Quiet routes and calmer public spaces support participation |
| Energy | Battery capacity, movement cost, rest/charging preference | Long detours and inaccessible charging points restrict opportunities |
| Reach | Interaction height and reach distance | Collection points, buttons, and workstations must be reachable |
| Personality | Curious, deliberate, sociable, exploratory | Choice among feasible destinations; no moral ranking |
| Artistic identity | Timbre family, motif, palette, mark shape, texture | Recognisable musical and visual signature independent of access needs |
| Appearance | Paint, patterns, head/face, antennae, attachments, name | Self-expression; cosmetic changes do not secretly change access rules |

Body geometry and simulation values must agree: a wider robot needs more clearance. Decorative antennae affect height only when the interface explicitly says so. Validate combinations and explain any chassis limits rather than silently correcting them.

Offer curated starting personalities and a randomise button, followed by full editing. Do not label configurations “normal”, “broken”, “easy disability”, or “hard disability”. Let users save several robots and compare them later.

### Implemented ability tradeoffs

The workshop starter uses five dichotomous sliders. Each stores a primary allocation from 0 to 100 and derives the paired value as `100 - allocation`. The default is 50/50. No pair is an upgrade: city design should support different allocations.

| Increase | Automatically decreases | Fictional mechanism |
| --- | --- | --- |
| Speed | Route memory | Drive processing leaves less time for retaining directions; forgetfulness increases with speed |
| Agility | Balance | Quick-turning chassis trades planted stability for manoeuvrability |
| Visual detail | Wide awareness | Shared sensing budget favours fine focus or broad scanning |
| Reach | Compactness | Longer arms need more clearance |
| Burst power | Endurance | Higher motor output trades sustained energy for short bursts |

Both values and relevant city supports are displayed beside each slider. Native range controls support touch and keyboard. Reach and balance change the workshop robot's arms and wheel spacing; other values are held in its profile for the future simulation. Reset restores the shared budgets.

The implemented **Show next art bot** button creates a new design when viewing the last bot in the collection, changing upper-body proportions, shape, and colour. Box, rounded, and cylindrical torso/head combinations share attached arms, face, and antennae. **Show previous art bot** returns to earlier designs; moving forward through existing bots restores them instead of generating replacements. Each robot has a random name from a scientist list and a rename form. Saved names, appearance, tuning, and function selections are cached per bot for the open page. Reloading starts a new collection; persistent library saving remains planned. New designs inherit the current bot's tuning and three enabled functions. The camera reframes larger or wider bodies. All robots use wheels; leg-based locomotion is excluded. Further manual appearance controls remain planned.

### Implemented functionality switches

Five switches enable or disable movement, vision, hearing, route memory, and balance assistance. Exactly three functions remain enabled at all times. Each action is an atomic swap: enabling a function replaces the longest-active function; disabling one enables the first inactive function in the displayed order. The interface previews that replacement and announces the result. The starting selection is movement, vision, and route memory; Reset restores it.

Off modules retain tuning but contribute no effective capability. A vision-off robot has no visual detail/awareness, memory-off has zero route memory, movement-off has no powered locomotion, and balance-off has no active stabilisation. Hearing is represented by its enabled flag. Unused tuning controls are disabled where both sides of the pair are inactive. The workshop reflects sensor state in eye, antenna, and chest lights and balance assistance in the stance. Workshop rotation is an inspection tool and remains available even when movement is off.

This is a fictional analogy for varied access needs. A robot lacking a function still belongs in the city: equivalent information, assisted transport, reminders, and level surfaces are potential environmental supports. The three-of-five limit is a character-design constraint, not a statement about human disability. Actual navigation and support interactions are future simulation work.

## Element 2: put the character in the city

Use a **top-down orthographic camera**, looking down at roads, paths, crossings, buildings, and the robot. Keep roof heights or cutaways from obscuring selectable features. The robot follows the connected road/path beneath it and makes its own route decisions. The player edits the city rather than steering its body through obstacles.

For the first version, “pick up” means collecting creative materials and inspiration for a commission: colour fragments, rhythm tokens, shapes, and collaboration invitations. Delivery jobs or passenger pickup are potential later modes.

The robot chooses reachable goals using its preferences and knowledge, follows a route, collects material, and seeks rest or charge when needed. A barrier can make it slow down, pause, seek another path, request help, or wait for an environmental change. A blocked robot explains what happened and remains recoverable. Waiting is a legitimate response, not failure.

### Hazards, traps, and real-world parallels

Use hazards as consequences of city design and maintenance. A trap might be an apparent shortcut with a narrow exit or a dead-end lacking turning space; reveal and explain it, allow recovery, and avoid repeated damage as entertainment. The following are proposed game abstractions, not engineering standards. The Department for Transport's Inclusive Mobility guidance is a reference for pedestrian and transport design. [Inclusive Mobility](https://www.gov.uk/government/publications/inclusive-mobility-making-transport-accessible-for-passengers-and-pedestrians)

| Barrier or trap | Robot interaction | City intervention |
| --- | --- | --- |
| Steps or raised kerb | Chassis cannot traverse the transition | Add a connected ramp, dropped kerb, or lift |
| Narrow passage, doorway, or street furniture | Body and safety clearance do not fit | Widen the route, move furniture, or add an equivalent route |
| Tight corner or dead end | Insufficient turning space | Enlarge the turning area or connect a return route |
| Broken paving, steep ramp, or cross-slope | Balance or traction threshold exceeded | Repair surface, reduce gradient, add level landings |
| Crossing with a short interval | Cannot clear crossing at its own pace | Extend the interval or add a safe refuge |
| Low-contrast sign, glare, colour-only markers | Destination or route cue is not detected | Add contrast, shade, symbols, text, and optional audio/tactile cues |
| Audio-only announcement | Information unavailable to this robot | Add equivalent visual/text information |
| Confusing junction or inconsistent signs | Route memory expires or decision remains uncertain | Add consistent landmarks, repeated directions, and reminders |
| Noisy, bright, crowded plaza | Environmental load exceeds configured preference | Add a quiet route, reduce clutter, create a calmer space |
| Long detour without rest or charge | Energy runs low before reaching destination | Add reachable rest/charging points and shorten the accessible route |
| High terminal or collection shelf | Item is outside reach | Lower or reposition it; add an equivalent interaction point |
| Locked accessible entrance or restricted opening hours | An apparently usable route is unavailable | Change access policy or provide equivalent access at the main entrance |
| Unwelcoming venue or service rule | Robot is denied a commission despite reaching it | Change venue policy and offer inclusive collaboration |

The last two examples show institutional and attitudinal barriers. They should be portrayed through city/service rules and respectful dialogue, with disabled co-designers reviewing the framing.

### Touch editing

Tap an element to select it and see its function, access properties, and editing handles. Drag to move; use large handles to resize; choose an element from the tray and tap a placement point to add it. Support pinch zoom and two-finger pan, with explicit camera controls as alternatives. Separate object resizing from camera zoom through a visible edit mode.

Show a preview of affected routes before committing. Snap connected paths, expose endpoint connections, and highlight gaps. A ramp helps only if it joins usable surfaces at both ends; widening one segment does not solve a narrow entrance downstream. Restrict edits to sensible sizes and show why an invalid connection fails.

Every edit supports undo/redo. Pause simulation while an object is actively moved or resized; commit the command before navigation resumes. Users can also pause, inspect, and edit for as long as they need. If an edit removes the surface under the robot, preserve its position in a waiting state and offer a visible return-to-last-safe-point action.

Provide tap-select/tap-place, nudge buttons, size fields, rotate buttons, and a list of editable elements. All essential operations must work by keyboard and without dragging or multi-finger gestures. W3C specifically requires alternatives to dragging at WCAG 2.2 AA. [W3C: what's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

### Collectibles and power-ups

Creative collectibles add a distinct material to the art/music dataset: a colour token adds a pigment, a rhythm token introduces a motif, and a human collaboration point contributes a licensed local pattern or phrase. Reachable placement is part of the challenge.

Power-ups represent support: a charging station restores energy; a route beacon provides a reminder; a quiet zone lowers environmental load. Record what was available, reached, and used. Essential access supports persist and are not hidden behind rare collectibles. Optional temporary creative boosts can add musical layers, but they never cure a trait or grant access only by changing the robot.

### Feedback and progress

Show reachable creative destinations, places visited, repeated encounters, barrier-related waiting, and access improvements. Avoid a single score equating fast movement with success. Offer a route history with “before this edit” and “after this edit” markers and an explanation such as “Widening the alley opened the workshop route.”

Later, test the edited city with several different robots. A quiet path and a lively collaboration plaza can coexist; provide alternatives rather than assuming one solution meets every need.

## Element 3: live music and art HUD

The third element is an **overlay on the city view**, not a separate world. Display an evolving artwork, a compact music timeline, meaningful journey events, and playback/export controls. The overlay can expand, minimise, or move so it does not hide editing targets. Provide the same event history in readable text.

Each robot has an artistic signature; its actual route, collected materials, waiting, supports, and environmental encounters shape the composition. Suggested mappings are design hypotheses to test with listeners, not scientifically established emotion measurements.

| Journey data | Musical expression | Visual expression |
| --- | --- | --- |
| Robot identity | Stable motif and instrument family | Palette and mark vocabulary |
| Progress along route | Phrase progression and controlled pulse variation | Growing route ribbon |
| Turning and branching | Melodic contour and phrase variation | Curves, branching strokes, orientation |
| Barrier encountered | Interrupted phrase or restrained unresolved texture | Interrupted line and labelled marker |
| Waiting or uncertainty | Space, sustained tones, repeated fragments | Layering or repeating marks |
| Support used | Motif returns with a new accompaniment | Reconnected strokes or supporting shapes |
| Material collected | New note, rhythm, or timbral layer | New pigment, texture, or symbol |
| Collaboration/reached destination | Completed phrase; robot keeps its identity | A gathering of earlier marks |

Use a few intelligible mappings before adding complexity. Do not equate disability with dissonance or distress, or make art from an inaccessible route inherently worse. Calm, curiosity, frustration, relief, and connection are creative interpretations of the journey. Explain the mappings and let users choose a gentler sound palette, mute music, and reduce animation. Parameter mapping sonification supplies a researched method for relating data features to sound parameters. [The Sonification Handbook, chapter 15](https://sonification.de/handbook/chapters/chapter15/)

**Saving is a core requirement:** users must be able to download the finished or current artwork as PNG, music as WAV, and the robot/city/journey as a reusable session file. Provide artwork descriptions and a text journey summary alongside visual and audio outputs. The technical specification defines the export pipeline and distinguishes these downloads from browser-local autosave.

## First playable scope and acceptance

Build one neighbourhood with a workshop, plaza, gallery, and charging point. Include six barriers covering width, level changes, surface/balance, timing, visual information, and wayfinding; three supports; and colour/rhythm/shape collectibles. Include body size/shape, appearance, speed, balance, vision, and memory controls, plus artistic identity. Expand to policy and sensory scenarios after co-design review.

The milestone is accepted when:

- The same robot reaches a previously inaccessible collectible after a city edit, with a visible explanation of the changed barrier.
- Movement is autonomous and remains attached to valid road/path segments; an unreachable goal produces a recoverable waiting state.
- Moving, resizing, and adding city elements work through touch and equivalent keyboard/non-drag controls.
- Each collected material and significant encounter appears once in the event history and affects the creative output.
- Music and art develop while playing; mute changes listening, not the saved composition.
- PNG, WAV, and session JSON downloads open successfully; the session can be restored and replayed.
- Users can pause, undo, inspect, compare, and export without a time penalty.
