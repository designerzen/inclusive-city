# Research and evaluation

Research date: 2 October 2026. This is a desk-research foundation and proposed validation plan. No user study, prototype benchmark, or accessibility audit has yet been conducted.

## Evidence and design implications

| Source | Supported finding | Implication for Inclusive City |
| --- | --- | --- |
| [Scope: social model of disability](https://www.scope.org.uk/social-model-of-disability) | Societal barriers include physical obstacles and attitudes; removing barriers supports choice and independence | Change the city while keeping the robot's characteristics stable; include more than physical obstacles |
| [Nario-Redmond, Gospodinov and Cobb, 2017: disability simulations](https://pubmed.ncbi.nlm.nih.gov/28287757/) | Experiments identified unintended negative effects of simulations, including anxiety and helplessness | Avoid claiming to simulate human disability; evaluate whether users learn about barriers rather than pity |
| [Department for Transport: Inclusive Mobility](https://www.gov.uk/government/publications/inclusive-mobility-making-transport-accessible-for-passengers-and-pedestrians) | Guidance addresses an accessible pedestrian and public transport environment | Use it to research credible street scenarios; separate game thresholds from real engineering requirements |
| [W3C: visual abilities and barriers](https://www.w3.org/WAI/people-use-web/abilities-barriers/visual/) | Visual access needs vary; contrast, resizing, structure, and alternative presentations matter | Model several perception characteristics and provide redundant navigation cues; do not blur the player's screen to simulate low vision |
| [W3C: clear and understandable content](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/) | Clear words, short blocks, unambiguous instructions, and separated content support comprehension | Use predictable signs, reminders, and brief explanations in the city and the actual game UI |
| [W3C: WCAG 2.2 additions](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) | AA requirements include non-drag alternatives and minimum target sizing, subject to defined exceptions | Provide tap-place/nudge controls; adopt a generous project target for handles and buttons |
| [Grond and Berger: parameter mapping sonification](https://sonification.de/handbook/chapters/chapter15/) | Data features can be related to sound synthesis parameters through mapping functions | Give the journey a consistent, explainable musical vocabulary and test whether people understand it |

The studies of disability simulation concern their studied interventions, not this proposed robot game. Applying their findings here is a design inference and a reason to test the framing. The game should explicitly state: “This fictional journey shows how barriers affect access. Disabled people's experiences are diverse.”

The proposed barrier rules, musical mappings, creative effects, and learning outcomes are design hypotheses. The sources do not validate the project's educational effectiveness or establish a universal musical language for emotion.

## Disability-led co-design

Recruit and pay disabled collaborators with varied mobility, sensory, cognitive, and energy-related access needs. Invite them to shape the concept, language, scenarios, robot customisation, accessibility controls, and evaluation criteria before artwork or level design becomes expensive to change.

Provide accessible participation methods, remote/asynchronous options, breaks, readable materials, and control over how lived experience is quoted or credited. Participants should be able to decline personal disclosure. A small group cannot represent all disabled people, so document disagreements and support alternative perspectives.

Review especially the initial “fix them up” story, the language of forgetfulness, humanoid comparisons, falls/traps, service exclusion, and emotional art/music. Retain the story's shift towards environmental responsibility without making disabled people objects of repair or inspiration. Recognise that impairments, pain, fatigue, identity, and support can matter even when barriers are reduced; the game is an explanatory model, not a complete account of disability.

## Accessibility of the game itself

Target WCAG 2.2 AA for the web experience and supplement it with task-based testing of the canvas game. A compliance target is not an audited claim. [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Provide:

- Semantic HTML controls and a city element/destination list with inspect, move, resize, add, and remove actions. Screen-reader users need a complete alternative way to play, not just a canvas description.
- Keyboard operation with visible focus, logical order, discoverable commands, and no focus traps.
- Non-drag and single-pointer alternatives to all essential gestures. Aim for 44 × 44 CSS pixel touch controls as a project choice; WCAG 2.2 AA specifies a 24 × 24 minimum with exceptions.
- Legible text, meaningful labels, contrast, symbol/text redundancy, zoom, reflow, and layout that avoids covering controls with the HUD.
- Text equivalents for journey events, instructions, and meaningful sound; adjustable sound and play without audio.
- Pause/step controls, untimed editing, readable summaries, consistent help, undo, and no mandatory fast response.
- Reduced-motion presentation, pausable workshop rotation, restrained flashes, and gentler sound/visual palettes.
- Accessible export controls, clear progress/error messages, and descriptions accompanying saved artwork and music.

Compare assistive technology tasks with touch tasks throughout development. Testing only the HTML forms would miss inaccessible city editing and HUD interactions.

## Evaluation questions and method

Use a facilitated pilot with disabled and non-disabled participants, including people unfamiliar with the social model. Obtain consent; collect only information needed for the study. Let participants stop or change presentation settings at any time.

| Question | Proposed task or measure |
| --- | --- |
| Do people attribute exclusion to barriers? | Before/after scenario questions: explain why the unchanged robot cannot enter and propose a solution |
| Does learning transfer? | Present a new street/service example without robot framing and ask what could change |
| Do users understand cause and effect? | Ask them to identify which edit opened a route; compare explanation with the event log |
| Does the framing avoid pity and stereotypes? | Discuss interpretations of the robot and human parallels; review responses with disabled collaborators |
| Can people use the editor? | Complete equivalent move, resize, and add tasks through touch, keyboard, and non-drag controls |
| Does music communicate the intended journey? | Compare short clips and ask about perceived interruption, continuity, relief, or connection; avoid leading emotion prompts |
| Is the art legible and valued? | Ask users to connect visible marks with events and decide what they would save |
| Can outputs be owned and revisited? | Download/open PNG and WAV, restore a session, and explain its route history |

Measure task completion, reasons given, errors, recovery, comfort, and accessibility obstacles. Do not use speed alone as a success metric. Predefine a rubric that distinguishes environmental explanations from robot-deficit explanations. Evaluate generalisation to new scenarios, not only recall of tutorial wording. Any before/after claim needs appropriate study design and uncertainty reporting; a small pilot can guide iteration but does not prove effectiveness.

## Decisions to validate before implementation expands

- Primary audience, age range, setting, guided session length, and supported languages.
- Preferred identity language and narrative voice, determined with collaborators rather than assumed universally.
- Exact game thresholds for each robot/city interaction and how much simplification users understand.
- Music styles and whether mappings communicate across different listening preferences and cultures.
- Reference devices, supported browser versions, offline requirements, maximum run length, and export resolution.
- Rights and attribution for contributed samples/art, and the terms allowing users to reuse downloaded outputs.

The current design assumes creative collection, an untimed sandbox, local saving, and no account requirement. These are workable defaults and can change after audience research.
