# Interface design review

Reviewed 2 October 2026. The interface keeps its playful robot, artwork and colour while giving navigation and instructions a clearer hierarchy.

## Guidance used

- [GOV.UK button guidance](https://design-system.service.gov.uk/components/button/): describe the action in sentence case, give the main action the greatest emphasis, and distinguish secondary actions.
- [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): at least 4.5:1 for normal text. Shared primary, selected-state and helper colours are checked in both themes.
- [W3C use of colour](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): supplement colour with words or other visible cues. Selected city tools have a pressed edge and bold text; barrier status includes a written reason.
- [W3C focus visibility](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html): retain clear keyboard focus indicators. Screen transitions focus a heading and settings restore focus to their trigger.
- [W3C target size, enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) and the repository's AGENTS.md: preserve the global 44 × 44 CSS pixel minimum, including disabled buttons, selects and disclosure triggers.

## Changes

| Issue | Result |
| --- | --- |
| Small “Start” button over the robot | A prominent “Start!” button sits below the preview, without an extra explanatory card. |
| Primary and secondary actions looked similar in light mode | Shared contrasting primary colours work in both themes; robot browsing stays secondary. |
| Arrow-only robot navigation and an unlabelled-looking name field | Visible navigation labels, a name label, a save hint and visible save feedback. |
| Three-function swapping and paired slider rules were hidden from sight | Visible section headings, the three-function rule, per-function swap previews and slider explanations. |
| Settings placement | Settings are available only on the attract screen. MIDI is behind a labelled disclosure. |
| Missing city camera controls | Map view, 3D view, Follow robot and Robot eye have labelled buttons with a visible selected state. |
| City tools and main action had the same emphasis | Lavender identifies the selected tool, green identifies the main action, and disabled actions use neutral colours. The map remains neutral. |
| Map movement depended on pointer gestures | Labelled zoom and pan buttons provide keyboard alternatives. Route stops and street changes also have buttons/selects. |
| Fixed mobile offsets could overlap or squeeze the map | Grid rows reserve the map's full minimum height and panel space. The toolbar stays accessible on short screens; controls wrap. |
| Painting download appeared only on hover/focus | The download control is visible by default. Artwork/player captions use larger text. |

## Verification

The browser review covers the welcome screen, designer, preset carousel, settings and city planning in light and dark themes. Rendered controls were measured at 1440 × 900, 375 × 667 and 320 × 568; no undersized targets or horizontal page overflow remained in the checked layouts. The shortest mobile city layout also retained a 12 px gap between map and panel after scrolling to the zoom/pan controls.

Interaction checks include preset selection, opening/closing settings, theme changes with focus restoration, drawing a route with stop buttons, street improvements, zoom/pan, and starting, pausing and resuming the robot. Starting now requires no route planning: the robot follows connected streets towards the studio and stops at barriers for help. Drawing a route is optional. The destination has a coloured ring, a checkered finish flag, a labelled map marker and a Show goal camera control.

`pnpm test` checks control sizing, theme contrast and the simulation/creative features. `pnpm check` and `pnpm build` validate TypeScript and the production bundle. This review is not a formal WCAG conformance audit or a substitute for usability testing with disabled participants.
