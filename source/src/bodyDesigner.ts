import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { bodyRanges, bodySvg, defaultBody, makeBody, normaliseBody } from './robot/bodyNet';
import earcut from 'earcut';
import type { Polygon } from 'polygon-clipping';
import { defaultExposure, exposureLabels, exposureRanges, normaliseExposure } from './robot/bodyExposure';
import type { ExposureKey } from './robot/bodyExposure';
import type { BodyParameters, Point3 } from './robot/bodyNet';
import type { BodyModel, Point } from './robot/bodyNet';
import { bodyFoldingPose } from './robot/bodyFolding';
import { applyAccessibility, savedAccessibility, reducedMotionPreference } from './app/accessibilityPreferences';
import './bodyDesigner.css';
import './accessibility.css';
import './readingPreferences.css';

applyAccessibility(savedAccessibility());
const labels: Record<keyof BodyParameters, [string, string]> = {
  sides: ['Panels around body', 'panels'], diameter: ['Base across flats', 'mm'], height: ['Body height', 'mm'], taper: ['Top size', '% of base'], tabs: ['Seam tabs', 'tabs'],
  thickness: ['Card thickness', 'mm'], clearance: ['Skeleton clearance', 'mm'], skeletonWidth: ['Skeleton width', 'mm'], skeletonDepth: ['Skeleton depth', 'mm'], skeletonHeight: ['Skeleton height', 'mm'],
};
let parameters = { ...defaultBody };
let exposure = normaliseExposure(defaultExposure);
try { const saved = localStorage.getItem('robot-body-v1'); if (saved) parameters = normaliseBody(JSON.parse(saved)); } catch { /* Defaults also work without storage. */ }
try { const saved = localStorage.getItem('robot-body-exposure-v1'); if (saved) exposure = normaliseExposure(JSON.parse(saved)); } catch { /* Keep the estimated profile. */ }
const root = document.querySelector<HTMLDivElement>('#body-app')!;
const controls = (keys: (keyof BodyParameters)[]) => keys.map(key => {
  const [min, max, step] = bodyRanges[key];
  return `<label class="parameter" for="${key}"><span>${labels[key][0]} <output id="${key}-value" for="${key}"></output></span><input id="${key}" name="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${parameters[key]}"/></label>`;
}).join('');
root.innerHTML = `
  <header class="body-header"><a href="${import.meta.env.BASE_URL}" class="back-link">← Back to the city</a><span>INCLUSIVE CITY / MAKE IT PHYSICAL</span><a href="#making">Folding guide ↗</a></header>
  <main class="body-main"><div class="body-intro"><div><p class="eyebrow">PAPER ENGINEERING LAB · 01</p><h1>A body of your own.</h1><p>One sheet. A few folds. A new shape for your robot.</p></div><span class="sheet-badge">1 sheet<br/><small>zero glue</small></span></div>
  <div class="body-workspace"><aside class="body-panel"><div class="panel-heading"><h2>Shape the card</h2><span>01 — DESIGN</span></div>
    <div class="preset-row" aria-label="Body starting shapes"><button data-preset="gentle">Gentle</button><button data-preset="tower">Tower</button><button data-preset="angular">Angular</button></div>
    ${controls(['sides', 'diameter', 'height', 'taper', 'tabs'])}
    <p class="parameter-help">More panels → more folds. A smaller top makes a tapered shell. Both ends stay open for the skeleton.</p>
    <button id="random-body" class="random-action">↻ Randomise shape</button>
    <section class="exposure-options" aria-labelledby="exposure-title"><h2 id="exposure-title">Keep hardware exposed</h2><p class="parameter-help">Pressed toggles enforce real openings in every preview and cutting net, including random shapes. Front = +Z. Positions are photo-estimated for Maqueen V3; check alignment on your robot.</p>
    ${Object.entries(exposureLabels).map(([key, label]) => `<button type="button" class="exposure-toggle" id="expose-${key}" data-exposure="${key}" aria-pressed="${exposure.enabled[key as ExposureKey]}"><span>${label}</span><span class="exposure-state" id="expose-${key}-state"></span></button>`).join('')}
    <p class="parameter-help">Motion and compass sensors need no optical opening. These toggles do not certify magnetic, temperature or acoustic performance. The LED toggle also protects the micro:bit's light-sensing area.</p>
    <details><summary>Adjust estimated positions</summary>${(Object.entries(exposureRanges) as [keyof typeof exposureRanges, readonly [number, number, number]][]).map(([key, [min, max, step]]) => `<label class="parameter" for="exposure-${key}"><span>${({margin:'Opening margin',frontOffset:'Front sensor position',matrixHeight:'LED matrix centre height',laserHeight:'Laser centre height',laserTilt:'Laser tilt'})[key]} <output id="exposure-${key}-value"></output></span><input type="range" id="exposure-${key}" data-exposure-setting="${key}" min="${min}" max="${max}" step="${step}" value="${exposure[key]}"/></label>`).join('')}<p class="parameter-help">Heights are above the shell's open bottom / ground plane. Front position is forward of its centre. Laser protection includes its 60° × 60° view; the light/IR angles are conservative design assumptions.</p></details><p id="exposure-status" class="parameter-help" role="status" aria-live="polite"></p></section>
    <details><summary>Fit to your skeleton</summary><p class="parameter-help">Measure the whole moving envelope, including wires and moving parts. The amber box is your measurement, not a supplied robot model.</p>${controls(['skeletonWidth', 'skeletonDepth', 'skeletonHeight', 'clearance'])}</details>
    <details><summary>Card & cutting</summary>${controls(['thickness'])}<p class="parameter-help">Slots = card thickness + 0.3 mm. Tabs are 18 × 16 mm with clipped tips. No automatic kerf compensation: test a slot in your chosen card.</p></details>
    <button id="reset-body" class="quiet-action">Reset all dimensions</button>
  </aside>
  <section class="body-preview" aria-label="Body model and cutting net"><div class="preview-toolbar"><div class="view-switch" role="group" aria-label="Preview view"><button id="view-solid" aria-pressed="true">3D body</button><button id="view-net" aria-pressed="false">Flat net</button></div><span class="live-label">● LIVE GEOMETRY</span></div>
    <div class="body-stage"><canvas id="body-canvas" tabindex="0" aria-label="Three-dimensional folded card sleeve. Drag to orbit, scroll to zoom, or use the view buttons."></canvas><div id="flat-preview" hidden></div><p id="renderer-error" hidden>3D rendering is unavailable. The flat net and downloads still work.</p><span class="stage-label">FOLDED CARD / OPEN ENDS</span><div class="view-actions"><button id="orbit-left" aria-label="Rotate body left">↶</button><button id="orbit-right" aria-label="Rotate body right">↷</button><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button><button id="reset-view">Reset view</button></div></div>
    <div class="fold-controls"><label class="parameter" for="fold-progress"><span>Unfolded → folded <output id="fold-value" for="fold-progress">100%</output></span><input id="fold-progress" type="range" min="0" max="100" step="1" value="100" aria-describedby="fold-help"/></label><div class="fold-actions"><button id="unfold-body">Unfold</button><button id="pause-fold" disabled>Pause</button><button id="fold-body">Fold</button></div><p id="fold-help">Scrub through the folds, or choose Unfold / Fold to animate. Seam tab insertion is illustrated, not simulated.</p></div>
    <div class="preview-caption"><label class="envelope-toggle"><input id="show-envelope" type="checkbox" checked/> Show skeleton envelope</label><span id="geometry-summary"></span></div>
    <div class="fabrication-status" id="fit-status" role="status" aria-live="polite"></div>
    <div class="body-export"><div><p class="eyebrow">02 — TAKE IT OFF SCREEN</p><h2>Cut. Crease. Connect.</h2><p id="sheet-size"></p></div><div class="download-actions"><button id="download-cut" class="primary-action">↓ Cutting SVG · 1:1</button><button id="download-guide">↓ Folding guide SVG</button><button id="download-design">↓ Design + instructions</button></div></div>
    <p class="export-note">SVG layers: red CUT, blue SCORE. Assign score lines to a light crease operation in your cutter software. Print at 100%; never “fit to page”. Fabrication exports pause when geometry or fit checks fail.</p>
  </section></div>
  <section class="making-guide" id="making"><p class="eyebrow">03 — FROM A SHEET TO A SHELL</p><h2>Make a small paper test first.</h2><div class="guide-steps"><article><b>01 / CUT</b><h3>Keep it connected</h3><p>Cut the red outline, slots and exposure openings. Keep every tab attached. Blue lines are creases, never through-cuts. The design needs one sheet at least as large as the displayed stock size.</p></article><article><b>02 / FOLD</b><h3>Wrap the panels</h3><p>Numbered faces run around the body. Pre-crease the long blue lines, folding the card into a convex sleeve. Leave both ends open. The final panel meets the first at the rear seam.</p></article><article><b>03 / LOCK</b><h3>Tuck the seam tabs</h3><p>Turn tabs inward at their roots, overlap behind face 1 and feed the tips through its matching slots. Fold each tip back at the second crease to hold the seam. Open the seam again to remove the shell.</p></article></div><p class="prototype-note">The surface geometry unfolds exactly in the zero-thickness model. Real folds, card grain, spring-back and laser kerf affect the finished fit. Exposure openings enforce the estimated profile, not a measured robot. Confirm their alignment and sensor operation on your prototype. Ventilation, mounting and wheel paths still need physical checks.</p></section>
  </main><footer class="body-footer">A little geometry. A lot of possibility.<span>ONE CONNECTED NET / MILLIMETRES</span></footer>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('body-canvas');
let engine: Engine | undefined, scene: Scene | undefined, camera: ArcRotateCamera | undefined;
let meshes: Mesh[] = [];
let foldFraction = 1, foldFrame: number | undefined;
let activeModel: BodyModel;
let bindings: { mesh: Mesh; face: number; vertices: Point[]; line: boolean }[] = [];
const motion = reducedMotionPreference();
function stopFolding() {
  if (foldFrame !== undefined) cancelAnimationFrame(foldFrame);
  foldFrame = undefined; el<HTMLButtonElement>('pause-fold').disabled = true;
}
function updatePose(frameCamera = false) {
  el<HTMLInputElement>('fold-progress').value = String(Math.round(foldFraction * 100));
  el('fold-value').textContent = `${Math.round(foldFraction * 100)}%`;
  el<HTMLInputElement>('fold-progress').setAttribute('aria-valuetext', foldFraction === 0 ? 'Fully unfolded' : foldFraction === 1 ? 'Fully folded' : `${Math.round(foldFraction * 100)}% folded`);
  root.querySelector('.stage-label')!.textContent = canvas.hidden ? 'CUTTING NET / ONE SHEET' : foldFraction === 1 ? 'FOLDED CARD / OPEN ENDS' : foldFraction === 0 ? 'UNFOLDED CARD / ONE SHEET' : 'FOLDING CARD / RIGID PANELS';
  if (!activeModel || !scene) return;
  const pose = bodyFoldingPose(activeModel, foldFraction), all: Point3[] = [];
  for (const binding of bindings) {
    const vertices = binding.vertices.map(p => pose.point(binding.face, p)); all.push(...vertices);
    const positions = vertices.flat(); binding.mesh.updateVerticesData('position', positions, true);
    if (!binding.line) { const normals: number[] = []; VertexData.ComputeNormals(positions, binding.mesh.getIndices()!, normals); binding.mesh.updateVerticesData('normal', normals); }
  }
  if (frameCamera && camera && all.length) {
    const min = [0, 1, 2].map(i => Math.min(...all.map(v => v[i]))), max = [0, 1, 2].map(i => Math.max(...all.map(v => v[i])));
    camera.setTarget(new Vector3(...min.map((v, i) => (v + max[i]) / 2)));
    const radius = Math.hypot(...min.map((v, i) => max[i] - v)) / 2;
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const halfFov = Math.min(camera.fov / 2, Math.atan(Math.tan(camera.fov / 2) * aspect));
    camera.radius = Math.max(180, radius / Math.sin(halfFov) * 1.3);
  }
}
try {
  engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
  scene = new Scene(engine); scene.clearColor = new Color4(.925, .931, .906, 1);
  camera = new ArcRotateCamera('body-camera', .9, 1.12, 570, new Vector3(0, 90, 0), scene);
  camera.attachControl(canvas, true); camera.lowerRadiusLimit = 180; camera.upperRadiusLimit = 10000; camera.wheelPrecision = .5; camera.minZ = 1;
  const light = new HemisphericLight('paper-light', new Vector3(-.4, 1, -.7), scene); light.intensity = 1.2;
  const observer = new ResizeObserver(() => { engine?.resize(); if (!canvas.hidden) updatePose(true); }); observer.observe(canvas);
  engine.runRenderLoop(() => scene?.render());
  import.meta.hot?.dispose(() => { stopFolding(); observer.disconnect(); scene?.dispose(); engine?.dispose(); });
} catch (error) { console.error('Body preview:', error); el('renderer-error').hidden = false; }
const paper = scene ? new StandardMaterial('mint-card', scene) : undefined;
if (paper) { paper.diffuseColor = Color3.FromHexString('#77aa91'); paper.specularColor = new Color3(.07, .07, .07); paper.backFaceCulling = false; }
const amber = scene ? new StandardMaterial('skeleton-envelope', scene) : undefined;
if (amber) { amber.diffuseColor = Color3.FromHexString('#d69d36'); amber.alpha = .24; }
const boardMaterial = scene ? new StandardMaterial('hardware-board', scene) : undefined;
if (boardMaterial) boardMaterial.diffuseColor = Color3.FromHexString('#283c38');
const indicatorMaterial = scene ? new StandardMaterial('hardware-indicator', scene) : undefined;
if (indicatorMaterial) { indicatorMaterial.diffuseColor = Color3.FromHexString('#ffd36a'); indicatorMaterial.emissiveColor = Color3.FromHexString('#b7762c'); }
function draw() {
  const model = makeBody(parameters, exposure);
  stopFolding(); activeModel = model;
  for (const key of Object.keys(labels) as (keyof BodyParameters)[]) {
    el<HTMLInputElement>(key).value = String(parameters[key]); el(`${key}-value`).textContent = `${parameters[key]} ${labels[key][1]}`;
  }
  el('flat-preview').innerHTML = bodySvg(model, true);
  for (const key of Object.keys(exposureLabels) as ExposureKey[]) {
    el(`expose-${key}`).setAttribute('aria-pressed', String(exposure.enabled[key]));
    const cut = model.exposure.zoneCuts.find(z => z.key === key);
    el(`expose-${key}-state`).textContent = !exposure.enabled[key] ? 'Off' : cut && cut.area > .01 ? 'Opening cut' : 'Already clear';
  }
  for (const key of Object.keys(exposureRanges) as (keyof typeof exposureRanges)[]) {
    el<HTMLInputElement>(`exposure-${key}`).value = String(exposure[key]);
    el(`exposure-${key}-value`).textContent = `${exposure[key]}${key === 'laserTilt' ? '°' : ' mm'}`;
  }
  el('exposure-status').textContent = model.exposure.valid ? `${model.exposure.zones.length} exposure constraints enforced. Openings follow the card as it folds.` : `${model.exposure.reason} Change dimensions or positions; selected protections stay on and cutting exports are blocked.`;
  el('geometry-summary').textContent = `${parameters.sides} faces · ${parameters.sides - 1} body folds · ${parameters.tabs} tabs`;
  el('sheet-size').textContent = `Stock ≥ ${Math.ceil(model.bounds.width + 10)} × ${Math.ceil(model.bounds.height + 10)} mm, including 5 mm margins.`;
  const status = el('fit-status'); status.classList.toggle('has-warning', !model.valid || !model.fits);
  status.textContent = !model.exposure.valid ? model.exposure.reason + ' Cutting export blocked; exposure toggles remain enforced.' : !model.valid ? 'Adjust the shape: panels or tab spacing are too small for the seam.' : !model.fits ? `Fit needs adjustment. Smallest opening: ${model.innerDiameter.toFixed(1)} mm across flats; required: ${model.requiredDiameter.toFixed(1)} mm. Height needs ${parameters.skeletonHeight + parameters.clearance} mm.` : `✓ Single connected net · ${model.exposure.zones.length} exposure constraints · conservative skeleton fit passes · inside opening ${model.innerDiameter.toFixed(1)} mm`;
  for (const id of ['download-cut', 'download-guide']) el<HTMLButtonElement>(id).disabled = !model.valid || !model.fits;
  try { localStorage.setItem('robot-body-v1', JSON.stringify(parameters)); } catch { /* Session-only state is fine. */ }
  try { localStorage.setItem('robot-body-exposure-v1', JSON.stringify(exposure)); } catch { /* Session-only state is fine. */ }
  if (!scene) return;
  meshes.forEach(mesh => mesh.dispose()); meshes = []; bindings = [];
  const pose = bodyFoldingPose(model, foldFraction);
  const lineFrom = (name: string, face: number, flat: Point[]) => {
    const vertices = [...flat, flat[0]];
    const line = MeshBuilder.CreateLines(name, { points: vertices.map(p => new Vector3(...pose.point(face, p))), updatable: true }, scene);
    line.color = Color3.FromHexString('#315c48'); meshes.push(line); bindings.push({ mesh: line, face, vertices, line: true });
  };
  const meshFrom = (name: string, face: number, polygon: Polygon) => {
    const rings = polygon.map(ring => ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring);
    const flat = rings.flat(), holes: number[] = []; let count = rings[0].length;
    for (const ring of rings.slice(1)) { holes.push(count); count += ring.length; }
    const vertices = flat.map(p => pose.point(face, p));
    const mesh = new Mesh(name, scene), data = new VertexData(); data.positions = vertices.flat();
    const triangles = earcut(flat.flat(), holes, 2); data.indices = [];
    for (let i = 0; i < triangles.length; i += 3) {
      const [a, b, c] = triangles.slice(i, i + 3).map(index => flat[index]);
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-5) data.indices.push(...triangles.slice(i, i + 3));
    }
    const normals: number[] = []; VertexData.ComputeNormals(data.positions, data.indices, normals); data.normals = normals; data.applyToMesh(mesh, true); mesh.material = paper!; meshes.push(mesh);
    bindings.push({ mesh, face, vertices: flat, line: false });
    rings.forEach((ring, i) => lineFrom(`${name}-edge-${i}`, face, ring));
  };
  model.exposure.panelPolygons.forEach((polygons, face) => polygons.forEach((polygon, i) => meshFrom(`panel-${face + 1}-${i}`, face, polygon)));
  model.exposure.tabs.forEach((polygons, tab) => polygons.forEach((polygon, i) => meshFrom(`tab-${tab + 1}-${i}`, model.p.sides, polygon)));
  if (el<HTMLInputElement>('show-envelope').checked) {
    const box = MeshBuilder.CreateBox('measured-envelope', { width: parameters.skeletonWidth, depth: parameters.skeletonDepth, height: parameters.skeletonHeight }, scene);
    box.position.y = parameters.skeletonHeight / 2; box.material = amber!; box.enableEdgesRendering(); box.edgesColor = new Color4(.7, .42, .08, .8); meshes.push(box);
    const board = MeshBuilder.CreateBox('estimated-microbit', { width: 51.6, height: 42, depth: 2 }, scene);
    board.position.set(0, exposure.matrixHeight + 2, exposure.frontOffset - 2); board.material = boardMaterial!; meshes.push(board);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
      const led = MeshBuilder.CreateBox(`matrix-${row}-${col}`, { size: 2 }, scene);
      led.position.set((col - 2) * 4.5, exposure.matrixHeight + (row - 2) * 4.5, exposure.frontOffset); led.material = indicatorMaterial!; meshes.push(led);
    }
    model.exposure.zones.filter(zone => zone.key !== 'matrix').forEach(zone => {
      const marker = MeshBuilder.CreateSphere(`estimated-${zone.key}`, { diameter: 5, segments: 8 }, scene);
      marker.position.set(...zone.origin); marker.material = indicatorMaterial!; meshes.push(marker);
    });
  }
  updatePose(true);
}
root.querySelectorAll<HTMLInputElement>('input[type="range"][name]').forEach(input => input.addEventListener('input', () => { parameters = normaliseBody({ ...parameters, [input.name]: input.valueAsNumber }); draw(); }));
root.querySelectorAll<HTMLButtonElement>('[data-exposure]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.exposure as ExposureKey; exposure.enabled[key] = !exposure.enabled[key]; draw(); }));
root.querySelectorAll<HTMLInputElement>('[data-exposure-setting]').forEach(input => input.addEventListener('input', () => { exposure = normaliseExposure({ ...exposure, [input.dataset.exposureSetting!]: input.valueAsNumber }); draw(); }));
el<HTMLInputElement>('fold-progress').disabled = !scene;
for (const id of ['fold-body', 'unfold-body']) el<HTMLButtonElement>(id).disabled = !scene;
el('fold-progress').addEventListener('input', () => { const value = el<HTMLInputElement>('fold-progress').valueAsNumber / 100; stopFolding(); foldFraction = value; setView(false); updatePose(true); });
function animateFold(target: number) {
  stopFolding(); setView(false);
  if (motion.matches) { foldFraction = target; updatePose(true); return; }
  const start = foldFraction, started = performance.now(), duration = 1800 * Math.abs(target - start);
  if (!duration) return;
  el<HTMLButtonElement>('pause-fold').disabled = false;
  const frame = (now: number) => {
    const t = Math.min(1, (now - started) / duration), eased = t * t * (3 - 2 * t);
    foldFraction = start + (target - start) * eased; updatePose(true);
    if (t < 1) foldFrame = requestAnimationFrame(frame); else stopFolding();
  };
  foldFrame = requestAnimationFrame(frame);
}
el('fold-body').addEventListener('click', () => animateFold(1));
el('unfold-body').addEventListener('click', () => animateFold(0));
el('pause-fold').addEventListener('click', stopFolding);
const onMotionChange = () => { if (motion.matches) stopFolding(); };
motion.addEventListener('change', onMotionChange);
import.meta.hot?.dispose(() => motion.removeEventListener('change', onMotionChange));
el('show-envelope').addEventListener('change', draw);
el('reset-body').addEventListener('click', () => { parameters = { ...defaultBody }; draw(); });
root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.addEventListener('click', () => {
  const preset = button.dataset.preset;
  parameters = { ...parameters, ...(preset === 'tower' ? { sides: 10, diameter: 200, height: 260, taper: 85 } : preset === 'angular' ? { sides: 4, diameter: 200, height: 180, taper: 85 } : { sides: 8, diameter: 180, height: 180, taper: 90 }) }; draw();
}));
el('random-body').addEventListener('click', () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const minHeight = Math.min(300, Math.max(parameters.skeletonHeight + parameters.clearance, 150));
    const candidate = { ...parameters, sides: 4 + Math.floor(Math.random() * 9), diameter: 170 + Math.floor(Math.random() * 91), height: minHeight + Math.floor(Math.random() * (301 - minHeight)), taper: 65 + Math.floor(Math.random() * 36) };
    const m = makeBody(candidate, exposure); if (m.fits && m.valid) { parameters = m.p; draw(); return; }
  }
  el('fit-status').textContent = 'No random shape passed fit and exposure checks. Adjust dimensions or sensor positions. Your exposure toggles remain enforced.';
});
function setView(net: boolean) {
  if (net) stopFolding();
  canvas.hidden = net; el('flat-preview').hidden = !net;
  el('view-solid').setAttribute('aria-pressed', String(!net)); el('view-net').setAttribute('aria-pressed', String(net));
  root.querySelectorAll<HTMLButtonElement>('.view-actions button').forEach(button => button.disabled = net || !camera);
  el('show-envelope').closest('label')!.hidden = net;
  if (!net) engine?.resize();
  updatePose();
}
el('view-solid').addEventListener('click', () => setView(false)); el('view-net').addEventListener('click', () => setView(true));
el('orbit-left').addEventListener('click', () => { if (camera) camera.alpha -= .25; });
el('orbit-right').addEventListener('click', () => { if (camera) camera.alpha += .25; });
el('zoom-in').addEventListener('click', () => { if (camera) camera.radius = Math.max(180, camera.radius * .85); });
el('zoom-out').addEventListener('click', () => { if (camera) camera.radius = Math.min(10000, camera.radius / .85); });
el('reset-view').addEventListener('click', () => { if (camera) { camera.alpha = .9; camera.beta = 1.12; updatePose(true); } });
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el('download-cut').addEventListener('click', () => { const model = makeBody(parameters, exposure); if (model.valid && model.fits) download('robot-body-cut.svg', bodySvg(model), 'image/svg+xml'); });
el('download-guide').addEventListener('click', () => { const model = makeBody(parameters, exposure); if (model.valid && model.fits) download('robot-body-folding-guide.svg', bodySvg(model, true), 'image/svg+xml'); });
el('download-design').addEventListener('click', () => download('robot-body-design.json', JSON.stringify({ version: 2, units: 'mm', family: 'regular-polygon-frustum-open-sleeve', parameters, exposure, hardwareProfile: 'Maqueen V3 photo-estimated; +Y up, +Z front', checks: { geometry: activeModel.valid, envelope: activeModel.fits, exposure: activeModel.exposure.valid }, assembly: el('making').innerText }, null, 2), 'application/json'));
draw(); setView(false);
