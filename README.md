# Inclusive City — Artbot

An interactive public education project about the social model of disability. Create a distinctive art-making robot, watch it explore a city autonomously, and change the environment so it can participate. Its journey becomes live music and visual art that the user can save.

The central lesson is demonstrated through play: **the same robot can do more when barriers in the city are removed.**

Use the burger menu’s **Options → Appearance → Colour mode** to choose Dark or Light. The setting changes the interface, workshop and city materials immediately, including streets, route lines, buildings, labels and access markers. Switching preserves the current journey; the choice is remembered on this browser when storage is available.

In **Settings → Accessibility**, choose text size (100–200%), a default, system, Arial, Verdana, Georgia or monospace typeface, roomier text spacing, and reduced motion. Changes apply immediately across the interface and are remembered in this browser when storage is available. Motion follows the device preference by default; **Reset accessibility settings** restores these defaults without changing colour or sound settings.

## Documentation

- [Experience and game design](docs/experience-design.md): story, character creation, city editing, barriers, collectibles, and the live creative HUD.
- [Technical specification](docs/technical-specification.md): Babylon.js, orthographic cameras, autonomous navigation, event data, audio/art generation, persistence, and exports.
- [Research and evaluation](docs/research-and-evaluation.md): sources, educational framing, accessibility requirements, co-design, and validation.
- [Interface design review](docs/ui-design-review.md): researched design rules, changes to the main flow, and desktop/mobile checks.
- [Robot state and metrics](docs/robot-state-and-metrics.md): per-bot state machines, lifetime/run metrics, achievements, failures, pickups, and timestamped events for stage 3.

These documents describe the wider proposed game, researched on 2 October 2026. The repository includes a working Babylon.js robot designer, a playable city route, collectible art fragments, and interaction/mood audio in `source/`. Full journey composition, art exports, and freeform city editing remain planned.

## Run the starter

Requires Node.js 20.19+ or 22.12+ and pnpm 12.3.4. From the repository root:

```sh
pnpm install
pnpm start
```

Open the local URL printed by Vite (usually http://localhost:5173). A dancing artbot welcomes you on an animated neon attract screen. **Play soundtrack** enables a looping groove composed from the game's synthesized sound effects; mute and volume controls apply to it. **Pause animation** freezes the dance and background effects, and reduced-motion preferences start them paused. **Create your robot** transitions into the robot editor and stops the opening soundtrack. The editor renders a rotating artbot through an orthographic camera. Rotation can be paused and respects reduced-motion preferences. All scene assets are generated locally; no model, texture, or font downloads are needed.

Root scripts run workspace tasks through Turborepo. `pnpm start` runs the Vite development server without caching; `pnpm check` checks TypeScript; `pnpm build` checks and creates a production build in `source/dist/`; `pnpm test` verifies ability tradeoffs, switches, bot caching, the surname dataset, and city navigation. Turborepo caches successful checks, tests, and build outputs in `.turbo/`. You can also run these commands directly from `source/`.

The designer has five linked ability sliders: speed/route memory, agility/balance, visual detail/wide awareness, reach/compactness, and burst power/endurance. Each pair shares 100 points, so increasing one reduces the other. Higher speed also displays higher forgetfulness. Reach and balance update the robot's arms and stance immediately; the remaining values form its future city profile. Reset restores all pairs to 50/50. These relationships are fictional engineering choices, not claims about human abilities.

Five functionality switches control communication, vision, hearing, route memory, and balance assistance. Exactly three are always enabled: enabling a function replaces the longest-active one; disabling a function enables the first inactive one in the displayed order. Each switch previews its swap, and changes are announced. Off functions retain slider settings but have no effective capability; sensor lights and the balance stance reflect their state. Reset restores communication, vision, and route memory.

**Start** takes the selected bot into a dark, orthographic city with wireframe buildings, streets, zebra crossings, sidewalks, raised curbs, a river, a bridge, stairs, and an elevator. A bright white line leads from the workshop to the gallery. The bot follows this route automatically, including its changes in height, and stops before an inaccessible section. The HUD explains the barrier and offers an environmental improvement: lower a curb or bridge, extend crossing time, add route cues or a ramp, widen a sidewalk, enable the elevator, or provide a communication board. Tap an access ring or use the dropdown to adapt a feature in advance. The selected bot's communication, speed, vision, memory, body width, and reach influence access checks; improvements leave its profile intact.

Drag to pan and pinch or scroll to zoom; labelled map buttons offer keyboard alternatives. Pause freezes the journey, Restart keeps city improvements, and Designer returns to the cached bot. Entering the city again starts a fresh city. This prototype follows one authored route with explicit access checks rather than general collision avoidance or route finding. [City implementation details](docs/city-prototype.md) explain the model and its limits.

Source modules are organised under `source/src/`: `app`, `robot`, `city`, `editor`, `navigation`, `simulation`, `events`, `audio`, `art`, `persistence`, and `ui`. Empty feature directories reserve space for the documented architecture; static files belong in `source/public/`.

Every robot uses four wheels. **Show next art bot** generates a new upper-body design at the end of the collection, changing width, height, depth, shape (box, rounded, or cylinder), and colour. **Show previous art bot** returns to earlier designs; moving forward through existing bots restores the cached bot. Each has a random scientist name that can be edited using **Save name**. Designs, names, ability tuning, and enabled functions are retained independently for every bot while the page is open; reloading starts a new collection. New designs inherit the current bot's ability settings. The wheeled chassis stays intact and the camera reframes automatically.

The UI presents the preview, editable name with Save, navigation, five switches, and paired sliders. Previous and rotation use labelled icon buttons. Descriptions are provided through accessible labels and tooltips; switch swaps show a short confirmation. Introductory headings, repeated explanations, profile summaries, and visible engine diagnostics are omitted.

Generated names use 2,476 scientist surnames from [scientist-surnames.txt](source/src/data/scientist-surnames.txt), one per line. [Dataset provenance](source/src/data/README.md) documents its Wikidata source. The list is bundled with the application; renaming and per-bot caching work as before.

Interaction sounds and robot mood chords use Web Audio synthesis. Sound controls offer mute and master volume; page load is silent. Blocked robots play a minor triad, access improvements play a major arpeggio, and reaching the gallery plays a celebratory major-seventh phrase. The configurable `SoundEffect` class stores versioned JSON note scores and supports timed sequences and offline rendering. See the [sound API and replay examples](source/src/audio/README.md).

The city also has four creative powerups on coloured detours. Melody spark starts a robot-specific score; Drawing spark enriches its procedural brushwork. Both are queued near the workshop. Click Harmony bloom or Colour prism on the map or in the exploration panel to add their detours and unlock layered chords or an expanded painting palette. Robots collect items only by travelling to them, and detours preserve existing access barriers. Music varies with robot configuration, route progress and encounters; its resolved note scores and paint strokes are retained with the run record. Pause, mute and leaving the city retain their existing behaviour.

The live painting HUD grows from the first step. Each step paints a curved, textured pigment stroke onto warm paper; barriers leave fractured charcoal, access improvements bloom in gold, and discoveries, achievements and incidents alter the composition. The brush paints progressively over cached dry layers. Robot configuration and journey data shape a reproducible abstract painting. Reduced motion renders each stroke immediately. See the [procedural painting API](source/src/art/README.md).

The designer's **Creative personality** settings offer eleven painter styles (including Surrealist, Cubist, Pointillist, Ink painter, Pop artist and Collage artist) and twenty-three musician styles. Familiar musical choices include Jazz, Blues, Classical piano, Baroque counterpoint, Romantic piano, Ragtime, Funk, Reggae/dub, Disco/house, Synth-pop, Synthwave, Bossa nova and Drum & bass. Each uses distinctive melodic phrasing, bass patterns, chord placement and oscillator voices. A painting study previews the selected brush language; changing musician plays a four-bar audition using the robot's own musical seed. Settings stay with each cached robot and shape its actual journey artwork and music. The selected styles appear in the city HUD and final exhibition, and are retained with the saved run. See the [full style catalogue and replay details](source/src/art/README.md).

The final route leads to a raised catwalk beside the gallery. On arrival, the camera frames the robot presenting its finished painting on a stage display while its recorded journey music plays. After a brief catwalk moment, a soft fade opens a dedicated exhibition screen with a large framed painting, journey highlights, and a player for the robot's recorded musical score. Hovering or focusing the artwork reveals a PNG download. **Return to city** revisits the completed map; **Create another journey** returns to the designer. Reduced-motion preferences remove animated screen transitions. Restart creates a new composition and collection run while retaining city access improvements.

The robot appears in front of its painting in the exhibition. **Play journey music** starts a dance driven by the recorded notes and audible playback clock: beat-aligned sways, head bobs, arm gestures and small rolling steps. Silent passages settle; Stop, completion and leaving the screen end the dance. Reduced motion uses a still presentation pose, and PNG downloads contain only the painting.

## Deploy to GitHub Pages

In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source. The workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and deploys the site on every push to `main`, or manually from the Actions tab.

The workflow uses the pnpm version pinned in `package.json`, installs dependencies from the lockfile, and publishes `source/dist/`. It sets Vite's base path from the Pages configuration so assets load correctly at the repository URL or on a custom domain. The deployment URL appears in the workflow's `github-pages` environment.

## Three connected elements

The editor's controls also trigger character reactions. Speed changes produce eager or thoughtful poses; agility twists or steadies the bot; visual detail focuses its gaze or broadens its look; reach extends or tucks its arms; burst power flexes while endurance relaxes. Function switches animate the affected module, and Reset gives a settling gesture. Feedback is driven by actual user edits, with continuous slider drags blended rather than repeatedly restarting the pose. Loading a cached profile is silent. Reactions work with preview rotation paused and respect reduced motion; disabled functions retain their real sensor and capability states.

The city is ready to play immediately: press **Start robot** and help it through barriers on its way to the Duet studio. A coloured ring, checkered finish flag and labelled map marker identify the goal; **Show goal** returns to the full map. Drawing a route is optional, and Start robot completes any partial line to the goal. Walls, doorways and street widths can be resized by dragging or with a slider. **Undo city change** reverses edits, and restarting keeps the city's improvements.

Robots now use cartoon character acting: anticipatory squash and stretch before setting off, startled double takes and worried slumps at barriers, springy relief when access improves, delighted pickup poses, and victory waves at the gallery. Blinks, eye and brow expressions, smiles and gasps, swinging arms, elastic antenna follow-through, turn overshoot, and brief star accents add personality. The designer also shows idle glances and a welcoming reaction to new designs. These cosmetic poses preserve configured proportions and journey metrics, keep the wheeled chassis grounded, freeze on pause, and use static expressions with reduced motion.

1. **Create your character:** a rotating robot viewed directly through an orthographic camera, with broad choices of body, appearance, communication, perception, memory, and artistic personality.
2. **Make the city inclusive:** a top-down orthographic city view. The robot follows the roads beneath it, pursues collection opportunities, and encounters barriers. Users primarily touch, move, resize, and add city elements to improve access.
3. **See and hear the journey:** an overlaid heads-up display (HUD) turns route and interaction data into music and art in real time. Users can download the artwork and music, save the session, and revisit its story.

## First playable milestone

One configurable robot, one small editable neighbourhood, six contrasting barriers, three support types, creative collectibles, autonomous navigation, a live art/music HUD, and working PNG, WAV, and session JSON downloads. Keyboard and non-drag editing alternatives belong in this milestone.
