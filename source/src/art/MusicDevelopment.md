# Musical development

`MusicDevelopment` develops all 56 styles after the opening four bars, alongside Magenta or with procedural fallback. It preserves the genre's bass, drums and chord placement while adding evolving melodic detail.

## Algorithms

- **Markov chains:** a first-order chain learns scale-degree transitions from the robot's genre motif. Observed transitions receive extra weight, with a small prior favouring local movement.
- **Evolutionary computing:** an eight-member population uses weighted parent selection, crossover, Markov-guided mutation and elitism. Fitness balances motif similarity, increasing novelty and smooth melodic movement. The first and last motif genes remain fixed.
- **Cellular automata:** a circular rule-150 binary automaton evolves a sixteenth-note activity grid sized to the selected meter. Active cells gate ornaments and an additional melodic voice.
- **Stochastic distributions:** seeded categorical draws choose transitions and parents, normal draws vary articulation, and exponential interarrival times space the additional voice.

Interior bars develop the procedural or Magenta lead. Each section's opening bar recalls its hook; the final cadence stays clear. Harmony discoveries enable the additional voice, while lead ornaments can develop beforehand. The actual developed notes feed the existing recorded-history primers for subsequent Magenta continuation.

## Growth and limits

Complexity grows over the first twelve development sections, then stays bounded while phrase-specific draws and rhythmic cycles keep varying. Every eighth section reduces density to leave breathing room. Calm, sad, uncertain or blocked passages are sparser, as are spacious genres.

The genetic search runs at most twelve generations, the automaton at most 31 updates, and the plan cache holds at most sixteen entries. Each additional voice has at most twelve notes. Ornamentation stops at a 64-note budget; a longer model-generated lead remains valid without added ornaments. Developed note durations stay inside the measure. Original rhythm anchors, motif endpoints and final cadences remain intact.

Development draws use the robot seed, style and phrase number rather than call order or wall time. Speculative templates, cache eviction and repeated auditions cannot accidentally advance a population. Search reconstructs the selected generation deterministically from the seed. The cache returns copies so callers cannot mutate future plans.

Final notes and voices use the existing `SoundScore` format. Exhibition playback and audio export replay resolved scores without rerunning any of these algorithms or loading a model. Four-bar designer auditions introduce the original motif; live journeys and the longer studio performance expose its development.

## City keys and modulation

`cityMusicKeys.ts` keeps the composition's seeded home key. Only a consumed city action requests a new key: starting/resuming, pausing, encountering an obstacle or collision, requesting a crossing, collecting a discovery, exploring, improving access, achieving a milestone or reaching the studio. The request is applied at the next unplayed bar and held until another action requests a change. Elapsed sections, inferred movement, mood expiry and closing cadences never initiate modulation. Actions use the key of the audible scheduled bar during lookahead. Magenta chord requests receive the same transposed harmony as the procedural lead, bass and accompaniment.

The always-visible toolbar music readout displays note onsets from the scheduled score, including chords, percussion and action responses. A persistent key cue names the city action and resulting key/mode when the change is played. The cue timeline resets with a new journey and remains useful when sound is muted. Existing studio keyboard visuals show the recorded performance.

| City mood | Key area relative to home | Harmonic colour |
| --- | --- | --- |
| Calm | Up a fourth | Major |
| Curious | Up a tone | Major with suspended colour |
| Determined | Dominant | Mixolydian |
| Uncertain | Dominant | Suspended |
| Frustrated | Relative minor | Minor with diminished colour |
| Sad | Relative minor | Minor |
| Relieved | Home | Major |
| Wonder | Up a fourth | Lydian |
| Happy | Home | Major |
| Celebrating | Up a tone | Major |

These are compositional choices for fictional robot moods, not universal emotional properties of keys. World styles keep their own modal melody palettes while the harmony responds to mood. Transposition uses the nearest octave to bound register changes; percussion pitches stay unchanged. Resolved pitches are recorded, so replay does not recompute a key plan.
