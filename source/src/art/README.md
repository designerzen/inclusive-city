# Procedural journey painting

`ProceduralPainting` consumes the current run's complete ordered robot event stream. Painting begins immediately, independent of music or art pickups. Every `step` creates one new curved pigment stroke. Barriers add fractured charcoal; interventions create golden blooms; pickups add blossoms; achievements leave luminous seals; route segments, queued detours, pause/resume and interrupted journeys add ink gestures. Arrival adds a finishing flourish. Idle time produces no new marks.

The robot's identity/configuration seeds its palette and composition. Position, heading, edge, step count and event order shape the painting, rather than copying the route onto the canvas. Drawing spark enriches bristle texture, opacity and stroke breadth; Colour prism expands the subsequent pigment palette. Earlier paint stays intact.

The designer's **Creative personality** selects one of eleven painter styles and fifteen musician styles. Painter choices are Impressionist, Watercolourist, Expressionist, Cubist, Geometric abstract artist, Pointillist, Ink painter, Surrealist, Pop artist, Minimalist and Collage artist. Music choices are Melodic explorer, Ambient, Classical, Minimalist, Jazz, Blues, Electronic, Techno, Bells/chimes, Chiptune, Folk, Waltz, Latin-inspired, Cinematic and Lo-fi. These are generative interpretations using Canvas brushes and oscillator instruments, with a visual study and short musical preview in the designer.

`artistStyles.ts` defines the catalogue. `artistBrushes.ts` supplies distinct seeded drawing rules; every mark records its style so worker rendering, finished snapshots and PNG exports preserve the same appearance. `JourneyMusicComposer` controls phrasing, tempo, note selection, swing, chord extensions and accompaniment. Waltz uses three beats; blues follows a twelve-bar progression; jazz uses ii–V–I colours; ambient and cinematic voices use slower sustained notes. Barriers still introduce minor harmony. Resolved scores, chosen styles and the run's configuration snapshot remain separate from subsequent robot edits. Cached robots retain their individual selections, and ability Reset leaves artistic preferences intact.

`ArtworkTitleGenerator` remixes recognizable fragments from two different famous artworks into a poetic title. Robot seed, step count, discoveries, improvements and the ordered stroke seeds determine the pairing. The versioned title and its two inspirations are saved in `RobotRun.creative.title` at completion and reused on the catwalk and exhibition; replay never renames an existing work.

Brushes wander between changing focal areas, lift and reposition, and alternate tentative touches with broad overlapping gestures. Barriers leave lingering tension in subsequent dark, restless strokes; discoveries and access improvements restore warmer, more open gestures. Each stroke records pressure, wetness, energy, tilt and lift alongside its geometry. Tapered pigment ribbons, ragged stains, broken dry bristles, pooling and splashes replace uniform-width lines and repeated radial stamps. All variation is seeded and recorded, so expressive output remains reproducible.

Each `PaintStroke` is a versioned, JSON-safe instruction containing normalized cubic control points, brush width, pigment/accent colours, opacity, texture seed and source event information. `RobotRun.creative.marks` keeps these resolved instructions. To restore a finished painting:

```ts
const painting = new ProceduralPainting(saved.seed);
painting.marks.push(...structuredClone(saved.marks));
PaintingRenderer.render(context, canvas.width, canvas.height, painting);
```

`PaintingRenderer` renders textured paper, translucent pigment washes, dry bristles, ink fractures and decorative blooms entirely with Canvas 2D. Its live renderer caches completed strokes and draws the current wet stroke progressively over roughly 250 ms. The saved painting is independent of frame rate. Reduced motion commits marks immediately. Catwalk rendering uses the same strokes at a higher resolution, without an animated brush overlay. Cross-browser bit-identical pixels are not promised.

`AsyncPaintingRenderer` runs live strokes, finished snapshots and PNG encoding in a dedicated module worker using `OffscreenCanvas`. Only new marks are sent for live frames, with one frame request in flight at a time; settled paintings stop rendering until the score or canvas size changes. Completed `ImageBitmap`s are copied onto the HUD and closed immediately. Restarting, leaving and disposing terminate the worker and reject outstanding requests. Unsupported or failed workers fall back to the same deterministic renderer on the main thread.

The exhibition recreates its artist from the completed run's appearance and profile, standing in front of the painting. `JourneyDance` derives choreography from saved note onsets, pitches, gain, tempo and meter, sampled against `CitySounds.perform()`'s audible output clock. Motion is independent of frame accumulation; quiet gaps settle, playback stop/finish returns to a presentation pose, and reduced motion keeps the robot still. The separate transparent 3D canvas does not enter the painting PNG. Its scene is disposed on exit and only renders while dancing or when a still frame needs refreshing.

The HUD stays visible throughout the journey, with a stroke count and a short explanation of the latest mark. The canvas has a text description; mobile layouts place it beneath the city view. Hovering or focusing either artwork reveals a PNG download button (always visible on touch screens), exporting a frozen 2400 × 1200 snapshot of the score. No images, fonts or random external assets are downloaded.
