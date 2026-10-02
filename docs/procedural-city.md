# Procedural city game

The active game uses `city/proceduralCity.ts`, `simulation/plannedJourney.ts`, and `ui/cityScreen.ts`. The original fixed-route prototype remains as a legacy simulation and test fixture.

Choose **Draw route**, then drag through connected junctions from Workshop to the Duet studio. The next-stop buttons offer the same choices using keyboard or touch. Undo or clear the line before starting. Optional discoveries add music and brushwork; their positions and street connections vary between cities. The robot stays still during planning and follows only the validated line after **Start robot**. It never chooses an automatic detour.

Choose **Change city**, select a street on the map or in the place list, and apply its single named improvement. Hover uses monochrome contrast and opacity to identify the affected geometry. Changes can be made before departure or when the robot stops at a barrier. A street occupied by the robot cannot be edited. Pause allows time to make changes. **Redraw route** returns to the workshop and retains improvements; **New city** generates a fresh layout.

Every generated street graph connects all junctions and includes at least two river crossings. All crossings start raised, separating the workshop and destination, so no robot can complete a new city without a physical city improvement. Narrow passages and short crossing signals are generated against the smallest footprint and fastest speed of every remembered robot. Additional curbs, steps and missing route cues create independent choices and problems. Repairs open individual streets without changing the robot's abilities. Buildings have pitched roofs; the city and interaction highlights use grayscale.

Each city has a reproducible numeric seed, shown in base 36 in the toolbar. A run saves its generated world, drawn route and improvements in `RobotRun.cityPlan`, plus the improvements present at departure in `citySnapshot`. Completed run records remain unchanged when retrying.

`source/tests/proceduralCity.test.ts` checks 250 seeds against all saved robot presets, connectivity, required changes, exact line following, optional discoveries, route validation, pause, retry records and simulation timing. DOM controls retain the global 44 × 44 CSS pixel target floor; desktop and phone layouts provide a scrollable planning panel.
