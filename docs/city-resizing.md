# Direct city resizing

The city canvas fills the viewport. Camera controls, journey status, live painting and the collapsible **Edit city** / **Create** panels float above it as a HUD. Panels scroll internally, leaving map size unaffected. On small screens, expanding one panel closes the others.

Press and drag a building face to move that wall along its normal. The opposite wall stays fixed, while the roof, windows, foundation and doorway follow the resized footprint. In overhead view, pressing near a roof edge selects its nearest wall; use the 45° camera to press a front or side face directly.

Drag a door-frame post horizontally to expand or contract the opening. Pavement edges resize across the path, keeping the bright route centred. Empty-map dragging still pans, and two-finger gestures zoom. Adding a second pointer cancels a size preview before beginning the pinch gesture.

The **Resize places** disclosure in the city editor provides equivalent labelled place selection and a keyboard-operable size slider. New controls reserve at least 44 × 44 CSS pixels. Selecting a resize target pauses a moving robot; the user resumes the journey explicitly.

Pointer movement previews geometry; release commits one city edit. Cancellation restores the original size. Each committed edit participates in the existing Undo/Redo history, journey event stream and city snapshots, and survives Try again. Occupied route pavements cannot be resized beneath the robot.

Buildings stay within their authored plots through bounded wall travel; frames have bounded widths. General route pavements retain a minimum safe width, while the authored narrow pavement can be widened to resolve its existing robot-access check. Door-frame dimensions are visual city properties; this prototype's route does not enter building interiors or test passage through their doors.

The marked staircase blocks wheeled travel. Selecting it reveals **Convert to ramp**, which replaces the steps with a continuous sloping surface and lets the same robot continue. The edit panel opens automatically on reaching the staircase. Undo can restore the steps once the robot has moved clear.
