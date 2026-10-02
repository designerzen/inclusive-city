# Playable city prototype

The designer and city share the procedural four-wheeled robot factory in `source/src/robot/createRobot.ts`. Entering the city copies the selected bot's identity, appearance, and profile. A second Babylon scene uses a fixed, steep overhead orthographic camera; its tilt exposes building edges and changes in level. Buildings use wireframe materials, edge rendering, and floor outlines against a dark background. Streets, crossings, sidewalks, river banks, a raised bridge, stairs, an elevator shaft and cab, and the gallery are procedural meshes.

`city/cityLayout.ts` supplies one route and its access features. A white emissive tube draws exactly the coordinates used by the robot's interpolation. `simulation/cityJourney.ts` advances the agent along these segments, including the ramp and vertical elevator segment. The UI runs a 30 Hz simulation, caps elapsed time per rendered frame, and suspends work while the document is hidden. Access is checked before entering a segment, including when one update spans several segments, so a slow frame cannot bypass a barrier.

| Feature | Access check | City intervention |
| --- | --- | --- |
| Workshop transport | Powered movement disabled | Supply an external carrier |
| Raised curb | Blocks this wheeled route | Lower the curb |
| Crossing | Crossing time exceeds signal time | Extend the crossing window |
| Route information | Vision disabled or effective route memory below 25 | Add accessible route cues |
| Narrow sidewalk | Body and arm envelope plus clearance exceeds width | Widen the sidewalk and move its boundaries |
| Bridge | Bridge raised | Lower the bridge deck |
| Stairs | Steps interrupt the wheeled route | Replace steps with a ramp |
| Elevator | Service unavailable | Enable the cab and ride to the upper level |

The HUD shows the current stop, its explanation, and one corrective action. Access rings can be picked in the scene; a native dropdown offers the same features without precise canvas interaction. The robot resumes after the blocking feature is adapted. Actions can also be taken before arrival. Pause, Restart, Designer, zoom, pan, and Fit are available as labelled DOM controls. Drag pans the map; pinch and wheel gestures zoom.

Improvements change city state and visible geometry without enabling disabled bot functions. Restart preserves those improvements and demonstrates the same robot completing the adapted route. Returning to the designer preserves the cached robot; entering the city again creates a new city. Each bot retains its state machine, run archives, lifetime metrics, achievements, environmental failures, and timed events. Three art fragments are collected along the route. [Robot state and musical data](robot-state-and-metrics.md) documents the record and stage 3 interface.

This is a deterministic access demonstration. It does not yet include a road graph, freeform geometry editing, traffic simulation, collision avoidance, full journey music composition, artwork, or exports. Width and crossing thresholds use fictional game units; they are not accessibility standards or assessments of real people. The route cue intervention represents accessible information through multiple channels, rather than equating all sensory or memory differences with one support. Co-design should refine those supports before educational deployment.

Automated tests cover stopping without skipping barriers, resumed travel, preserved improvements, different functional profiles, compact and forgetful bots, elevator interpolation, pause, and arrival. The wider design and export requirements remain in the experience and technical specifications.
