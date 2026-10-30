import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Rendering/edgesRenderer';
import { bodyRanges, bodySvg, defaultBody, makeBody, normaliseBody } from './robot/bodyNet';
import earcut from 'earcut';
import { newShellId, shellIdPattern, shellPayload, shellQr, shellQrSvg, qrReaderSpecification } from './robot/shellIdentity';
import { bodyShellLabel } from './robot/bodyShellLabel';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Polygon } from 'polygon-clipping';
import { defaultExposure, exposureLabels, exposureRanges, normaliseExposure } from './robot/bodyExposure';
import type { ExposureKey } from './robot/bodyExposure';
import { appendageLayouts, decorationRanges, normaliseDecoration, ornamentPoint, ornamentStyles, surpriseDecoration, windowStyles } from './robot/bodyDecoration';
import type { DecorationSettings } from './robot/bodyDecoration';
import type { BodyParameters, Point3 } from './robot/bodyNet';
import type { BodyModel, Point } from './robot/bodyNet';
import { bodyFoldingPose } from './robot/bodyFolding';
import { roofStyles, roofInstructions } from './robot/bodyRoof';
import { bodySections, bodyRims } from './robot/bodyProfiles';
import { arrangeBodyDesigner, designerFreeSpace } from './bodyDesignerLayout';
import { applyAccessibility, savedAccessibility, reducedMotionPreference } from './app/accessibilityPreferences';
import './bodyDesigner.css';
import './accessibility.css';
import './readingPreferences.css';

applyAccessibility(savedAccessibility());
const labels: Record<keyof BodyParameters, [string, string]> = {
  sides: ['Panels around body', 'panels'], diameter: ['Base across flats', 'mm'], height: ['Body height', 'mm'], taper: ['Top size', '% of base'], tabs: ['Seam tabs', 'tabs'],
  thickness: ['Card thickness', 'mm'], clearance: ['Skeleton clearance', 'mm'], skeletonWidth: ['Skeleton width', 'mm'], skeletonDepth: ['Skeleton depth', 'mm'], skeletonHeight: ['Skeleton height', 'mm'],
  section: ['Cross-section', ''], aspect: ['Width / depth', '%'], lean: ['Body lean', 'mm'], rim: ['Roofline', ''], ridge: ['Roofline depth', '%'],
  bendRadius: ['Inside bend radius', 'mm'], neutralAxis: ['Neutral-axis calibration', '%'], slotClearance: ['Slot fit clearance', 'mm'],
};
let parameters = { ...defaultBody };
let exposure = normaliseExposure(defaultExposure);
let decoration = normaliseDecoration(undefined);
let shellId = newShellId();
try {
  const linked = new URL(location.href).searchParams.get('shell');
  const saved = linked ?? localStorage.getItem('robot-body-shell-id');
  if (saved && shellIdPattern.test(saved)) shellId = saved;
} catch { /* An unsaved shell still has a session identity. */ }
try { const saved = localStorage.getItem('robot-body-v1'); if (saved) parameters = normaliseBody(JSON.parse(saved)); } catch { /* Defaults also work without storage. */ }
try { const saved = localStorage.getItem('robot-body-exposure-v1'); if (saved) exposure = normaliseExposure(JSON.parse(saved)); } catch { /* Keep the estimated profile. */ }
try { const saved = localStorage.getItem('robot-body-decoration-v1'); if (saved) decoration = normaliseDecoration(JSON.parse(saved)); } catch { /* Plain rim is available without storage. */ }
const root = document.querySelector<HTMLDivElement>('#body-app')!;
const controls = (keys: (keyof BodyParameters)[]) => keys.map(key => {
  const [min, max, step] = bodyRanges[key];
  return `<label class="parameter" for="${key}"><span>${labels[key][0]} <output id="${key}-value" for="${key}"></output></span><input id="${key}" name="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${parameters[key]}"/></label>`;
}).join('');
root.innerHTML = `
  <header class="body-header"><a href="${import.meta.env.BASE_URL}" class="back-link">← Back to the city</a><span>INCLUSIVE CITY / MAKE IT PHYSICAL</span><a href="#making">Folding guide ↗</a></header>
  <main class="body-main"><div class="body-intro"><div><p class="eyebrow">PAPER ENGINEERING LAB · 01</p><h1>A body of your own.</h1><p>One sheet. A few folds. A new shape for your robot.</p></div><span class="sheet-badge">1 sheet<br/><small>fold & tuck</small></span></div>
  <div class="body-workspace"><aside class="body-panel"><div class="panel-heading"><h2>Shape the card</h2><span>01 — DESIGN</span></div>
    <div class="preset-row" aria-label="Body starting shapes"><button class="secondary" data-preset="gentle">Gentle</button><button class="secondary" data-preset="tower">Tower</button><button class="secondary" data-preset="angular">Angular</button></div>
    <section class="material-options" aria-labelledby="material-title"><h2 id="material-title">Card & bend tolerances</h2>${controls(['thickness'])}<p class="parameter-help">Thickness changes the net, bend zones, seam relief, tabs, slots and internal clearance.</p><details><summary>Calibrate your card</summary>${controls(['bendRadius','neutralAxis','slotClearance'])}<p class="parameter-help">Measure thickness with calipers. Use a crease coupon to tune the inside radius and neutral-axis position (K). Score method, grain and spring-back vary between cards. Laser kerf is set in your cutter software.</p></details><p class="parameter-help">Structural checks require continuous bridges and hinges at least 8 mm wide (more for thick card), and limit unsupported spans using card thickness. These conservative rules need a paper prototype; card grade, grain and scoring affect strength.</p><p id="structure-status" class="parameter-help" role="status"></p><p id="material-status" class="parameter-help" role="status"></p></section>
    <div class="preset-row" aria-label="Sculpted body starting points"><button class="secondary" data-sculpt="manta">Manta</button><button class="secondary" data-sculpt="sentinel">Sentinel</button><button class="secondary" data-sculpt="shard">Shard</button></div>
    <label class="body-select" for="body-section">Cross-section<select id="body-section">${bodySections.map((label, i) => `<option value="${i}">${label}</option>`).join('')}</select></label>
    <label class="body-select" for="body-rim">Roofline<select id="body-rim">${bodyRims.map((label, i) => `<option value="${i}">${label}</option>`).join('')}</select></label>
    ${controls(['sides', 'diameter', 'height', 'taper', 'tabs'])}
    ${controls(['aspect', 'lean', 'ridge'])}
    <p class="parameter-help">Change the cross-section, lean and roofline for a different silhouette. Top size above 100% flares outward. Each wall stays flat card, with real folds between walls.</p>
    <button id="random-body" class="secondary random-action">✦ Surprise me</button>
    <p class="parameter-help">A new body, appendages and windows each time. Choose what the surprise can include.</p>
    <button id="surprise-appendages" class="secondary exposure-toggle" aria-pressed="true">Appendages in surprises: on</button>
    <button id="surprise-windows" class="secondary exposure-toggle" aria-pressed="true">Windows in surprises: on</button>
    <section class="roof-options" aria-labelledby="roof-title"><h2 id="roof-title">Roofs & lids</h2><label class="body-select" for="roof-style">Top closure<select id="roof-style">${Object.entries(roofStyles).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label class="parameter" for="roof-rise"><span>Pointed roof height <output id="roof-rise-value"></output></span><input id="roof-rise" type="range" min="15" max="100" step="1" value="${decoration.roofRise}"/></label><p class="parameter-help">Roofs replace rim appendages. Use a regular, level rim; tuck lids need an even panel count. Sensor openings still take priority and may leave gaps.</p><button class="secondary" id="roof-body">Use a roof-ready body</button><p id="roof-status" class="parameter-help" role="status"></p></section>
    <section class="decoration-options" aria-labelledby="decoration-title"><h2 id="decoration-title">Fold & decorate</h2><p class="parameter-help">Add jointed wings, articulated horns, lightning blades, ears or ruffles. Mix them, change their placement, or choose no appendages. Decorative windows are optional too. Everything stays on one sheet.</p><div class="detail-presets" aria-label="Decorative starting points"><button class="secondary" data-detail-preset="crown">Crown</button><button class="secondary" data-detail-preset="lantern">Lantern</button><button class="secondary" data-detail-preset="ruffle">Ruffle</button></div>
    <label for="ornament-style">Folded appendages</label><select id="ornament-style">${Object.entries(ornamentStyles).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select>
    <label for="appendage-layout">Appendage placement</label><select id="appendage-layout">${Object.entries(appendageLayouts).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select>
    <label for="window-style">Ornamental windows</label><select id="window-style">${Object.entries(windowStyles).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select>
    ${(Object.entries(decorationRanges) as [keyof typeof decorationRanges, readonly [number, number, number]][]).map(([key,[min,max,step]]) => `<label class="parameter" for="detail-${key}"><span>${({height:'Appendage paper length',angle:'Appendage fold angle',windowSize:'Window diameter',rows:'Window rows',variation:'Appendage variation',offset:'Placement offset',span:'Appendage width',windowAngle:'Window angle'})[key]} <output id="detail-${key}-value"></output></span><input id="detail-${key}" type="range" data-detail-setting="${key}" min="${min}" max="${max}" step="${step}" value="${decoration[key]}"/></label>`).join('')}
    <button class="secondary" id="random-details">↻ Randomise details</button><p id="decoration-status" class="parameter-help" role="status" aria-live="polite"></p><p class="parameter-help">Blue creases add the rim folds. Accordion folds alternate outward / reverse / outward. Sensor openings take priority over ornaments.</p></section>
    <section class="shell-identity-options" aria-labelledby="shell-identity-title"><h2 id="shell-identity-title">Shell identity & QR reader</h2><label class="body-select" for="shell-id">Shell ID<input id="shell-id" type="text" readonly /></label><div id="shell-qr" aria-label="Printable shell identity"></div><button id="new-shell-id" class="secondary" type="button">New shell identity</button><button id="download-shell-qr" class="secondary" type="button">Download QR label · 36 mm</button><p id="shell-qr-status" class="parameter-help" role="status"></p><p class="parameter-help">Attach the black-on-white QR sticker on the marked panel. Keep its white border clear; never cut or crease the code. The forward-facing reader needs its own aperture. Reader size and viewing angle are provisional: measure your chosen module. Live scanning requires a camera/QR module and firmware; the preview does not perform scans.</p></section>
    <section class="exposure-options" aria-labelledby="exposure-title"><h2 id="exposure-title">Keep hardware exposed</h2><p class="parameter-help">Pressed toggles enforce real openings in every preview and cutting net, including random shapes. Front = +Z. Positions are photo-estimated for Maqueen V3; check alignment on your robot.</p>
    ${Object.entries(exposureLabels).map(([key, label]) => `<button type="button" class="secondary exposure-toggle" id="expose-${key}" data-exposure="${key}" aria-pressed="${exposure.enabled[key as ExposureKey]}"><span>${label}</span><span class="exposure-state" id="expose-${key}-state"></span></button>`).join('')}
    <p class="parameter-help">Motion and compass sensors need no optical opening. These toggles do not certify magnetic, temperature or acoustic performance. The LED toggle also protects the micro:bit's light-sensing area.</p>
    <details><summary>Adjust estimated positions</summary>${(Object.entries(exposureRanges) as [keyof typeof exposureRanges, readonly [number, number, number]][]).map(([key, [min, max, step]]) => `<label class="parameter" for="exposure-${key}"><span>${({margin:'Opening margin',frontOffset:'Front sensor position',matrixHeight:'LED matrix centre height',laserHeight:'Laser centre height',laserTilt:'Laser tilt',qrReaderHeight:'QR reader centre height'})[key]} <output id="exposure-${key}-value"></output></span><input type="range" id="exposure-${key}" data-exposure-setting="${key}" min="${min}" max="${max}" step="${step}" value="${exposure[key]}"/></label>`).join('')}<p class="parameter-help">Heights are above the shell's open bottom / ground plane. Front position is forward of its centre. Laser protection includes its 60° × 60° view; the light/IR angles are conservative design assumptions.</p></details><p id="exposure-status" class="parameter-help" role="status" aria-live="polite"></p></section>
    <details><summary>Fit to your skeleton</summary><p class="parameter-help">Measure the whole moving envelope, including wires and moving parts. The amber box is your measurement, not a supplied robot model.</p>${controls(['skeletonWidth', 'skeletonDepth', 'skeletonHeight', 'clearance'])}</details>
    <button id="reset-body" class="tertiary quiet-action">Reset all dimensions</button>
  </aside>
  <section class="body-preview" aria-label="Body model and cutting net"><div class="preview-toolbar"><div class="view-switch" role="group" aria-label="Preview view"><button class="tertiary" id="view-solid" aria-pressed="true">3D body</button><button class="tertiary" id="view-net" aria-pressed="false">Flat net</button></div><span class="live-label">● LIVE GEOMETRY</span></div>
    <div class="body-stage"><canvas id="body-canvas" tabindex="0" aria-label="Three-dimensional folded card sleeve. Drag to rotate the body, scroll or pinch to zoom, or use the view buttons."></canvas><div id="flat-preview" hidden></div><p id="renderer-error" hidden>3D rendering is unavailable. The flat net and downloads still work.</p><span class="stage-label">FOLDED CARD / OPEN BOTTOM</span><div class="view-actions"><button class="tertiary" id="orbit-left" aria-label="Rotate body left">↶</button><button class="tertiary" id="orbit-right" aria-label="Rotate body right">↷</button><button class="tertiary" id="zoom-in" aria-label="Zoom in">+</button><button class="tertiary" id="zoom-out" aria-label="Zoom out">−</button><button class="tertiary" id="reset-view">Reset view</button></div></div>
    <div class="fold-controls"><label class="parameter" for="fold-progress"><span>Unfolded → folded <output id="fold-value" for="fold-progress">100%</output></span><input id="fold-progress" type="range" min="0" max="100" step="1" value="100" aria-describedby="fold-help"/></label><div class="fold-actions"><button class="secondary" id="unfold-body">Unfold</button><button class="secondary" id="pause-fold" disabled>Pause</button><button class="primary" id="fold-body">Fold</button></div><p id="fold-help">Scrub through the folds, or choose Unfold / Fold to animate. Seam tab insertion is illustrated, not simulated.</p></div>
    <div class="preview-caption"><label class="envelope-toggle"><input id="show-envelope" type="checkbox" checked/> Show skeleton envelope</label><span id="geometry-summary"></span></div>
    <div class="fabrication-status" id="fit-status" role="status" aria-live="polite"></div>
    <div class="body-export"><div><p class="eyebrow">02 — TAKE IT OFF SCREEN</p><h2>Cut. Crease. Connect.</h2><p id="sheet-size"></p></div><div class="download-actions"><button id="download-cut" class="primary primary-action">↓ Cutting SVG · 1:1</button><button class="secondary" id="download-guide">↓ Folding guide SVG</button><button class="secondary" id="download-design">↓ Design + instructions</button></div></div>
    <p class="export-note">SVG layers: red CUT, blue SCORE. Assign score lines to a light crease operation in your cutter software. Print at 100%; never “fit to page”. Fabrication exports pause when geometry or fit checks fail.</p>
  </section></div>
  <section class="making-guide" id="making"><p class="eyebrow">03 — FROM A SHEET TO A SHELL</p><h2>Make a small paper test first.</h2><div class="guide-steps"><article><b>01 / CUT</b><h3>Keep it connected</h3><p>Cut the red outline, slots and exposure openings. Keep every tab attached. Blue lines are creases, never through-cuts. The design needs one sheet at least as large as the displayed stock size.</p></article><article><b>02 / FOLD</b><h3>Wrap the panels</h3><p>Numbered faces run around the body. Lightly crease the blue centre lines, then form the shaded bend zones around the calibrated radius, folding the card into its sleeve. Keep the bottom open. Close the top using the selected roof instructions below. The final panel meets the first at the rear seam.</p></article><article><b>03 / LOCK</b><h3>Tuck the seam tabs</h3><p>Pre-form the rounded tab roots and stepped offsets along the blue guides to clear the back of face 1. Feed each tongue through its matching slot, then form the rounded return to hold the seam. Do not force a sharp crease into a bend zone. Open the seam again to remove the shell.</p></article></div><p id="roof-assembly" class="prototype-note"></p><p class="prototype-note">The net includes thickness-dependent bend allowances, seam relief and tab/slot clearances. The preview shows finite-radius folds and card thickness. Calibrate the inside bend radius and neutral-axis setting with a crease coupon in your actual card; grain, crushing, spring-back and laser kerf still affect the finished fit. Exposure openings enforce the estimated profile, not a measured robot. Confirm their alignment and sensor operation on your prototype. Ventilation, mounting and wheel paths still need physical checks.</p></section>
  </main><footer class="body-footer">A little geometry. A lot of possibility.<span>ONE CONNECTED NET / MILLIMETRES</span></footer>`;
const disposeLayout = arrangeBodyDesigner(root);
import.meta.hot?.dispose(disposeLayout);
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('body-canvas');
let engine: Engine | undefined, scene: Scene | undefined, camera: ArcRotateCamera | undefined;
let bodyTurntable: TransformNode | undefined, bodyContent: TransformNode | undefined;
function rotateBody(horizontal: number, vertical = 0) {
  if (!bodyTurntable || !camera) return;
  const yaw = Quaternion.RotationAxis(Vector3.Up(), horizontal);
  const pitch = Quaternion.RotationAxis(camera.getDirection(Vector3.Right()), vertical);
  bodyTurntable.rotationQuaternion = yaw.multiply(pitch).multiply(bodyTurntable.rotationQuaternion!).normalize();
}
let meshes: Mesh[] = [];
let foldFraction = 1, foldFrame: number | undefined;
let activeModel: BodyModel;
let bindings: { mesh: Mesh; face: number; vertices: Point[]; line: boolean; label?: boolean; renderIndices?: number[]; ornament?: number; bodyBend?: number; ornamentBand?: boolean }[] = [];
function cardVolume(points: Point3[], thickness: number, neutral: number, flat: Point[]): Point3[] {
  let normal=[0,0,0];
  for(let i=2;i<points.length && Math.hypot(...normal)<1e-8;i++) {
    const a=points[i-1].map((v,j)=>v-points[0][j]),b=points[i].map((v,j)=>v-points[0][j]);
    normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const sign=(flat[i-1][0]-flat[0][0])*(flat[i][1]-flat[0][1])-(flat[i-1][1]-flat[0][1])*(flat[i][0]-flat[0][0]);
    if(sign<0)normal=normal.map(v=>-v);
  }
  const length=Math.hypot(...normal)||1;normal=normal.map(v=>v/length);
  return [1-neutral,-neutral].flatMap(offset=>points.map(p=>p.map((v,i)=>v+normal[i]*thickness*offset) as Point3));
}
const motion = reducedMotionPreference();
function stopFolding() {
  if (foldFrame !== undefined) cancelAnimationFrame(foldFrame);
  foldFrame = undefined; el<HTMLButtonElement>('pause-fold').disabled = true;
}
function updatePose(frameCamera = false) {
  el<HTMLInputElement>('fold-progress').value = String(Math.round(foldFraction * 100));
  el('fold-value').textContent = `${Math.round(foldFraction * 100)}%`;
  el<HTMLInputElement>('fold-progress').setAttribute('aria-valuetext', foldFraction === 0 ? 'Fully unfolded' : foldFraction === 1 ? 'Fully folded' : `${Math.round(foldFraction * 100)}% folded`);
  root.querySelector('.stage-label')!.textContent = canvas.hidden ? 'CUTTING NET / ONE SHEET' : foldFraction === 1 ? 'FOLDED CARD / OPEN BOTTOM' : foldFraction === 0 ? 'UNFOLDED CARD / ONE SHEET' : 'FOLDING CARD / RIGID PANELS';
  if (!activeModel || !scene) return;
  const pose = bodyFoldingPose(activeModel, foldFraction), all: Point3[] = [];
  for (const binding of bindings) {
    const vertices = binding.vertices.map(p => binding.bodyBend !== undefined ? pose.bendPoint(binding.bodyBend,p) : binding.ornament === undefined ? pose.point(binding.face, p) : ornamentPoint(activeModel, activeModel.decoration.ornaments[binding.ornament], p, foldFraction, pose,binding.ornamentBand)); all.push(...vertices);
    const volume = binding.label ? cardVolume(vertices, activeModel.p.thickness + .2, activeModel.p.neutralAxis/100, binding.vertices).slice(0, vertices.length) : binding.line ? vertices : cardVolume(vertices,activeModel.p.thickness,activeModel.p.neutralAxis/100,binding.vertices);
    const positions = (binding.renderIndices ? binding.renderIndices.map(index => volume[index]) : volume).flat(); binding.mesh.updateVerticesData('position', positions, true);
    if (!binding.line) { const normals: number[] = []; VertexData.ComputeNormals(positions, binding.mesh.getIndices()!, normals); binding.mesh.updateVerticesData('normal', normals); }
  }
  if (frameCamera && camera && all.length) {
    const min = [0, 1, 2].map(i => Math.min(...all.map(v => v[i]))), max = [0, 1, 2].map(i => Math.max(...all.map(v => v[i])));
    camera.setTarget(new Vector3(...min.map((v, i) => (v + max[i]) / 2)));
    // Rotate the whole assembly about its centre, independently of the lights.
    bodyTurntable?.position.copyFrom(camera.target);
    bodyContent?.position.copyFrom(camera.target.negate());
    const radius = Math.hypot(...min.map((v, i) => max[i] - v)) / 2;
    const free=designerFreeSpace(root);
    camera.viewport=new Viewport(free.left/innerWidth,1-(free.top+free.height)/innerHeight,free.width/innerWidth,free.height/innerHeight);
    const aspect = free.width / Math.max(1, free.height);
    const halfFov = Math.min(camera.fov / 2, Math.atan(Math.tan(camera.fov / 2) * aspect));
    camera.radius = Math.max(180, radius / Math.sin(halfFov) * 1.3);
  }
}
const reframeWorkspace=()=>{if(!canvas.hidden)updatePose(true);};
root.addEventListener('designer-layout-change',reframeWorkspace);
import.meta.hot?.dispose(()=>root.removeEventListener('designer-layout-change',reframeWorkspace));
try {
  engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
  scene = new Scene(engine); scene.clearColor = new Color4(.925, .931, .906, 1);
  camera = new ArcRotateCamera('body-camera', .9, 1.12, 570, new Vector3(0, 90, 0), scene);
  camera.attachControl(canvas, true); camera.lowerRadiusLimit = 180; camera.upperRadiusLimit = 10000; camera.wheelPrecision = .5; camera.minZ = 1;
  camera.inputs.removeByType('ArcRotateCameraPointersInput');
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  bodyTurntable = new TransformNode('body-turntable', scene);
  bodyTurntable.rotationQuaternion = Quaternion.Identity();
  bodyContent = new TransformNode('body-content', scene); bodyContent.parent = bodyTurntable;
  const pointers = new Map<number, { x: number; y: number }>();
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId); canvas.focus(); event.preventDefault();
  };
  const pointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId); if (!previous || !camera) return;
    const next = { x: event.clientX, y: event.clientY };
    if (pointers.size === 1) rotateBody((next.x - previous.x) * .008, (next.y - previous.y) * .008);
    else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y), after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0 && after > 0) camera.radius = Math.max(180, Math.min(10000, camera.radius * before / after));
    }
    pointers.set(event.pointerId, next); event.preventDefault();
  };
  const pointerEnd = (event: PointerEvent) => { pointers.delete(event.pointerId); };
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, pointerEnd as EventListener);
  import.meta.hot?.dispose(() => {
    canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.removeEventListener(name, pointerEnd as EventListener);
    pointers.clear();
  });
  const light = new HemisphericLight('paper-light', new Vector3(-.4, 1, -.7), scene); light.intensity = 1.2;
  const observer = new ResizeObserver(() => { engine?.resize(); if (!canvas.hidden) updatePose(true); }); observer.observe(canvas);
  engine.runRenderLoop(() => scene?.render());
  import.meta.hot?.dispose(() => { stopFolding(); observer.disconnect(); scene?.dispose(); engine?.dispose(); });
} catch (error) { console.error('Body preview:', error); el('renderer-error').hidden = false; }
const paper = scene ? new StandardMaterial('white-card', scene) : undefined;
if (paper) { paper.diffuseColor = Color3.FromHexString('#ffffff'); paper.specularColor = Color3.Black(); paper.backFaceCulling = false; }
const amber = scene ? new StandardMaterial('skeleton-envelope', scene) : undefined;
if (amber) { amber.diffuseColor = Color3.FromHexString('#d69d36'); amber.alpha = .24; }
const boardMaterial = scene ? new StandardMaterial('hardware-board', scene) : undefined;
if (boardMaterial) boardMaterial.diffuseColor = Color3.FromHexString('#283c38');
const readerLensMaterial = scene ? new StandardMaterial('qr-reader-optics', scene) : undefined;
if (readerLensMaterial) readerLensMaterial.diffuseColor = Color3.FromHexString('#102b39');
const indicatorMaterial = scene ? new StandardMaterial('hardware-indicator', scene) : undefined;
if (indicatorMaterial) { indicatorMaterial.diffuseColor = Color3.FromHexString('#ffd36a'); indicatorMaterial.emissiveColor = Color3.FromHexString('#b7762c'); }
function draw() {
  const model = makeBody(parameters, exposure, decoration);
  stopFolding(); activeModel = model;
  for (const key of Object.keys(labels) as (keyof BodyParameters)[]) {
    if (key === 'section' || key === 'rim') continue;
    el<HTMLInputElement>(key).value = String(parameters[key]); el(`${key}-value`).textContent = `${parameters[key]} ${labels[key][1]}`;
  }
  const label = bodyShellLabel(model, shellId);
  el('flat-preview').innerHTML = bodySvg(model, true, shellId);
  el<HTMLInputElement>('shell-id').value = shellId;
  el('shell-qr').innerHTML = shellQrSvg(shellId);
  el('shell-qr-status').textContent = !model.geometryValid ? 'Resolve the shell geometry before placing the QR sticker.' : label ? `QR sticker on panel ${label.face + 1}. Payload: ${shellPayload(shellId)}. Reader aperture ${exposure.enabled.qrReader ? 'protected' : 'off'}.` : 'No clear 46 × 46 mm panel area for the QR sticker. Enlarge the body or reduce openings; cutting exports are blocked.';
  try { localStorage.setItem('robot-body-shell-id', shellId); } catch { /* Session-only identity. */ }
  el<HTMLSelectElement>('roof-style').value = decoration.roof;
  el<HTMLInputElement>('roof-rise').value = String(decoration.roofRise);
  el<HTMLInputElement>('roof-rise').disabled = decoration.roof !== 'pyramid';
  el('roof-rise-value').textContent = `${decoration.roofRise} mm`;
  el('roof-status').textContent = model.decoration.roofReason || roofInstructions[decoration.roof] + (decoration.roof !== 'open' && model.exposure.omittedOrnaments ? ` ${model.exposure.omittedOrnaments} roof sections omitted to keep hardware exposed; the top will have gaps.` : '');
  el('roof-assembly').textContent = roofInstructions[decoration.roof];
  el<HTMLSelectElement>('ornament-style').disabled = decoration.roof !== 'open';
  el<HTMLSelectElement>('ornament-style').value = decoration.ornament;
  el<HTMLSelectElement>('body-section').value = String(parameters.section);
  el<HTMLSelectElement>('body-rim').value = String(parameters.rim);
  el<HTMLSelectElement>('window-style').value = decoration.windows;
  el<HTMLSelectElement>('appendage-layout').value = decoration.layout;
  el<HTMLSelectElement>('appendage-layout').disabled = decoration.roof !== 'open' || decoration.ornament === 'plain';
  for (const key of Object.keys(decorationRanges) as (keyof typeof decorationRanges)[]) {
    el<HTMLInputElement>(`detail-${key}`).value = String(decoration[key]);
    el(`detail-${key}-value`).textContent = `${decoration[key]}${key === 'angle' || key === 'windowAngle' ? '°' : key === 'variation' || key === 'span' ? '%' : key === 'rows' || key === 'offset' ? '' : ' mm'}`;
    el<HTMLInputElement>(`detail-${key}`).disabled = key === 'windowSize' || key === 'rows' || key === 'windowAngle' ? decoration.windows === 'none' : decoration.roof !== 'open' || decoration.ornament === 'plain';
  }
  el('decoration-status').textContent = `${decoration.ornament === 'plain' ? 'No appendages' : `${new Set(model.decoration.ornaments.map(o => o.group)).size - model.exposure.omittedOrnaments} appendages fitted`}. ${model.decoration.windows.length} ornamental windows. ${model.exposure.omittedOrnaments ? `${model.exposure.omittedOrnaments} appendages omitted to preserve sensor openings and hinges. ` : ''}${model.decoration.omittedWindows ? `${model.decoration.omittedWindows} windows omitted on narrow panels.` : ''}`;
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
  el('material-status').textContent = `${parameters.thickness.toFixed(1)} mm card · slots ${(model.slots[0][1][0]-model.slots[0][0][0]).toFixed(2)} mm wide · seam relief ${model.material.seamGap.toFixed(2)} mm · body bend allowance ${model.material.bends.reduce((sum,bend)=>sum+bend.width,0).toFixed(2)} mm in total. Tab reach ${model.tabDimensions.reach.toFixed(2)} mm.`;
  el('structure-status').textContent = model.structure.checked ? model.structure.valid ? `Structure rules pass: minimum web ${model.structure.minimumWeb.toFixed(1)} mm; unsupported span limit ${model.structure.maximumFreeSpan.toFixed(0)} mm. Prototype in your actual card.` : model.structure.issues.join(' ') : 'Resolve geometry and openings before structural checks can run.';
  const status = el('fit-status'); status.classList.toggle('has-warning', !model.valid || !model.fits || !label);
  status.textContent = model.decoration.roofReason ? model.decoration.roofReason : !model.exposure.valid ? model.exposure.reason + ' Cutting export blocked; exposure toggles remain enforced.' : model.structure.checked && !model.structure.valid ? model.structure.reason + ' Cutting exports are blocked.' : !model.valid ? 'Adjust the shape: the flat outline overlaps, a slot leaves its panel, or seam spacing is too small.' : !label ? 'The shell needs a clear 46 × 46 mm panel area for its QR sticker. Enlarge the body or reduce decorative windows.' : !model.fits ? `Fit needs adjustment. Smallest opening: ${model.innerDiameter.toFixed(1)} mm across flats; required: ${model.requiredDiameter.toFixed(1)} mm. Lowest rim: ${model.minimumHeight.toFixed(1)} mm; needs ${parameters.skeletonHeight + parameters.clearance} mm.` : `✓ Single connected net · ${model.exposure.zones.length} exposure constraints · structure rules pass · conservative skeleton fit passes · inside opening ${model.innerDiameter.toFixed(1)} mm`;
  for (const id of ['download-cut', 'download-guide']) el<HTMLButtonElement>(id).disabled = !model.valid || !model.fits || !label;
  try { localStorage.setItem('robot-body-v1', JSON.stringify(parameters)); } catch { /* Session-only state is fine. */ }
  try { localStorage.setItem('robot-body-exposure-v1', JSON.stringify(exposure)); } catch { /* Session-only state is fine. */ }
  try { localStorage.setItem('robot-body-decoration-v1', JSON.stringify(decoration)); } catch { /* Session-only state is fine. */ }
  if (!scene) return;
  meshes.forEach(mesh => mesh.dispose()); meshes = []; bindings = [];
  const pose = bodyFoldingPose(model, foldFraction);
  const pointFor = (face: number, p: Point, ornament?: number, bodyBend?: number, ornamentBand?: boolean) => bodyBend!==undefined?pose.bendPoint(bodyBend,p):ornament === undefined ? pose.point(face, p) : ornamentPoint(model, model.decoration.ornaments[ornament], p, foldFraction, pose,ornamentBand);
  const lineFrom = (name: string, face: number, flat: Point[], ornament?: number, bodyBend?: number, ornamentBand?: boolean) => {
    const vertices = [...flat, flat[0]];
    const line = MeshBuilder.CreateLines(name, { points: vertices.map(p => new Vector3(...pointFor(face, p, ornament,bodyBend,ornamentBand))), updatable: true }, scene);
    line.color = Color3.FromHexString('#737373'); meshes.push(line); bindings.push({ mesh: line, face, vertices, line: true, ornament,bodyBend,ornamentBand });
  };
  const meshFrom = (name: string, face: number, polygon: Polygon, ornament?: number, bodyBend?: number, ornamentBand?: boolean) => {
    const rings = polygon.map(ring => ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring);
    const flat = rings.flat(), holes: number[] = []; let count = rings[0].length;
    for (const ring of rings.slice(1)) { holes.push(count); count += ring.length; }
    const vertices = flat.map(p => pointFor(face, p, ornament,bodyBend,ornamentBand));
    const mesh = new Mesh(name, scene), data = new VertexData(); data.positions = cardVolume(vertices,model.p.thickness,model.p.neutralAxis/100,flat).flat();
    const triangles = earcut(flat.flat(), holes, 2); data.indices = [];
    for (let i = 0; i < triangles.length; i += 3) {
      const [a, b, c] = triangles.slice(i, i + 3).map(index => flat[index]);
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-5) data.indices.push(...triangles.slice(i, i + 3));
    }
    const front=[...data.indices], vertexCount=flat.length;
    for(let i=0;i<front.length;i+=3)data.indices.push(front[i+2]+vertexCount,front[i+1]+vertexCount,front[i]+vertexCount);
    let offset=0;
    for(const ring of rings){for(let i=0;i<ring.length;i++){const a=offset+i,b=offset+(i+1)%ring.length;data.indices.push(a,b,b+vertexCount,a,b+vertexCount,a+vertexCount);}offset+=ring.length;}
    // Keep triangle vertices independent: averaging normals across the broad card
    // faces and their thin cut edges makes flat panels look warped and glossy.
    // Retain the source mapping so folding updates preserve these hard edges.
    const renderIndices = [...data.indices], volumePositions = data.positions;
    data.positions = renderIndices.flatMap(index => volumePositions.slice(index * 3, index * 3 + 3));
    data.indices = renderIndices.map((_, index) => index);
    const normals: number[] = []; VertexData.ComputeNormals(data.positions, data.indices, normals); data.normals = normals; data.applyToMesh(mesh, true); mesh.material = paper!; meshes.push(mesh);
    bindings.push({ mesh, face, vertices: flat, line: false, renderIndices, ornament,bodyBend,ornamentBand });
    if(bodyBend===undefined && !ornamentBand)rings.forEach((ring, i) => lineFrom(`${name}-edge-${i}`, face, ring, ornament));
  };
  model.exposure.panelPolygons.forEach((polygons, face) => polygons.forEach((polygon, i) => meshFrom(`panel-${face + 1}-${i}`, face, polygon)));
  model.exposure.tabs.forEach((polygons, tab) => polygons.forEach((polygon, i) => meshFrom(`tab-${tab + 1}-${i}`, model.p.sides, polygon)));
  model.exposure.ornaments.forEach((polygons, facet) => polygons.forEach((polygon, i) => meshFrom(`ornament-${facet}-${i}`, model.decoration.ornaments[facet].face, polygon, facet)));
  model.exposure.bands.forEach((band,index)=>band.polygons.forEach((polygon,i)=>meshFrom(`bend-${index}-${i}`,band.body??model.decoration.ornaments[band.ornament!].face,polygon,band.ornament,band.body,band.ornament!==undefined)));
  if (label) {
    const qr = shellQr(shellId), pixels = (qr.count + 8) * 8;
    const texture = new DynamicTexture('shell-label-print', { width: pixels, height: pixels }, scene, false);
    texture.updateSamplingMode(DynamicTexture.NEAREST_SAMPLINGMODE);
    const context = texture.getContext(); context.fillStyle = '#fff'; context.fillRect(0, 0, pixels, pixels); context.fillStyle = '#000';
    qr.cells.forEach((row, y) => row.forEach((dark, x) => { if (dark) context.fillRect((x + 4) * 8, (y + 4) * 8, 8, 8); })); texture.update(false);
    const ink = new StandardMaterial('shell-label-ink', scene); ink.diffuseTexture = texture; ink.emissiveTexture = texture; ink.disableLighting = true; ink.backFaceCulling = false;
    const mesh = new Mesh('shell-identity-qr', scene), data = new VertexData();
    data.positions = label.flat.flatMap(p => [...pose.point(label.face, p)]); data.indices = [0, 1, 2, 0, 2, 3]; data.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    data.normals = Array(12).fill(0); data.applyToMesh(mesh, true); mesh.material = ink; meshes.push(mesh);
    mesh.onDisposeObservable.add(() => { texture.dispose(); ink.dispose(); });
    bindings.push({ mesh, face: label.face, vertices: label.flat, line: false, label: true });
  }
  if (el<HTMLInputElement>('show-envelope').checked) {
    const box = MeshBuilder.CreateBox('measured-envelope', { width: parameters.skeletonWidth, depth: parameters.skeletonDepth, height: parameters.skeletonHeight }, scene);
    box.position.y = parameters.skeletonHeight / 2; box.material = amber!; box.enableEdgesRendering(); box.edgesColor = new Color4(.7, .42, .08, .8); meshes.push(box);
    const board = MeshBuilder.CreateBox('estimated-microbit', { width: 51.6, height: 42, depth: 2 }, scene);
    board.position.set(0, exposure.matrixHeight + 2, exposure.frontOffset - 2); board.material = boardMaterial!; meshes.push(board);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
      const led = MeshBuilder.CreateBox(`matrix-${row}-${col}`, { size: 2 }, scene);
      led.position.set((col - 2) * 4.5, exposure.matrixHeight + (row - 2) * 4.5, exposure.frontOffset); led.material = indicatorMaterial!; meshes.push(led);
    }
    const qrReader = MeshBuilder.CreateBox('proposed-qr-reader', { width: 20, height: 20, depth: 12 }, scene);
    qrReader.position.set(0, exposure.qrReaderHeight ?? 110, exposure.frontOffset - 6); qrReader.material = boardMaterial!; qrReader.metadata = qrReaderSpecification; meshes.push(qrReader);
    const lens = MeshBuilder.CreateBox('qr-reader-optical-face', { width: 12, height: 12, depth: .5 }, scene);
    lens.position.set(0, exposure.qrReaderHeight ?? 110, exposure.frontOffset + .3); lens.material = readerLensMaterial!; meshes.push(lens);
    model.exposure.zones.filter(zone => zone.key !== 'matrix').forEach(zone => {
      const marker = MeshBuilder.CreateSphere(`estimated-${zone.key}`, { diameter: 5, segments: 8 }, scene);
      marker.position.set(...zone.origin); marker.material = indicatorMaterial!; meshes.push(marker);
    });
  }
  meshes.forEach(mesh => { mesh.parent = bodyContent!; });
  updatePose(true);
}
root.querySelectorAll<HTMLInputElement>('input[type="range"][name]').forEach(input => input.addEventListener('input', () => { parameters = normaliseBody({ ...parameters, [input.name]: input.valueAsNumber }); draw(); }));
root.querySelectorAll<HTMLButtonElement>('[data-exposure]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.exposure as ExposureKey; exposure.enabled[key] = !exposure.enabled[key]; draw(); }));
root.querySelectorAll<HTMLInputElement>('[data-exposure-setting]').forEach(input => input.addEventListener('input', () => { exposure = normaliseExposure({ ...exposure, [input.dataset.exposureSetting!]: input.valueAsNumber }); draw(); }));
el('roof-style').addEventListener('change', () => { decoration = normaliseDecoration({ ...decoration, roof: el<HTMLSelectElement>('roof-style').value }); draw(); });
el('roof-rise').addEventListener('input', () => { decoration = normaliseDecoration({ ...decoration, roofRise: el<HTMLInputElement>('roof-rise').valueAsNumber }); draw(); });
el('roof-body').addEventListener('click', () => { parameters = normaliseBody({ ...parameters, sides: parameters.sides % 2 ? parameters.sides + 1 : parameters.sides, section: 0, aspect: 100, lean: 0, rim: 0, ridge: 0, taper: 100, height: Math.max(parameters.height, 240) }); draw(); });
el('ornament-style').addEventListener('change', () => { decoration = normaliseDecoration({ ...decoration, ornament: el<HTMLSelectElement>('ornament-style').value }); draw(); });
el('window-style').addEventListener('change', () => { decoration = normaliseDecoration({ ...decoration, windows: el<HTMLSelectElement>('window-style').value }); draw(); });
el('appendage-layout').addEventListener('change', () => { decoration = normaliseDecoration({ ...decoration, layout: el<HTMLSelectElement>('appendage-layout').value }); draw(); });
for (const key of ['section', 'rim'] as const) el(`body-${key}`).addEventListener('change', () => { parameters = normaliseBody({ ...parameters, [key]: Number(el<HTMLSelectElement>(`body-${key}`).value) }); draw(); });
for (const kind of ['appendages', 'windows']) {
  const button = el(`surprise-${kind}`);
  const set = (enabled: boolean) => { button.setAttribute('aria-pressed', String(enabled)); button.textContent = `${kind === 'appendages' ? 'Appendages' : 'Windows'} in surprises: ${enabled ? 'on' : 'off'}`; };
  try { set(localStorage.getItem(`robot-body-surprise-${kind}`) !== 'false'); } catch { /* Both are optional without storage. */ }
  button.addEventListener('click', () => { const enabled = button.getAttribute('aria-pressed') !== 'true'; set(enabled); try { localStorage.setItem(`robot-body-surprise-${kind}`, String(enabled)); } catch { /* Keep session preference. */ } });
}
const nextDetails = () => {
  const candidate = surpriseDecoration(decoration, el('surprise-appendages').getAttribute('aria-pressed') === 'true', el('surprise-windows').getAttribute('aria-pressed') === 'true');
  // Sample shorter ornaments first; the complete post-cut structural checks
  // still decide whether a candidate can be accepted.
  return normaliseDecoration({ ...candidate, height: Math.min(candidate.height, Math.max(12, Math.floor(parameters.thickness * 90))) });
};
const detailsVisible = (model: BodyModel) => (model.decoration.settings.ornament === 'plain' || model.exposure.ornaments.some(p => p.length > 0)) && (model.decoration.settings.windows === 'none' || model.decoration.windows.length > 0);
root.querySelectorAll<HTMLInputElement>('[data-detail-setting]').forEach(input => input.addEventListener('input', () => { decoration = normaliseDecoration({ ...decoration, [input.dataset.detailSetting!]: input.valueAsNumber }); draw(); }));
root.querySelectorAll<HTMLButtonElement>('[data-detail-preset]').forEach(button => button.addEventListener('click', () => {
  const preset = button.dataset.detailPreset;
  decoration = normaliseDecoration(preset === 'crown' ? { ornament: 'crown', height: 36, angle: 25, windows: 'diamond', windowSize: 14, rows: 2 } : preset === 'lantern' ? { ornament: 'petals', height: 24, angle: 60, windows: 'hexagon', windowSize: 18, rows: 3 } : { ornament: 'accordion', height: 36, angle: 55, windows: 'porthole', windowSize: 14, rows: 2 }); draw();
}));
el('random-details').addEventListener('click', () => {
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = nextDetails(), model = makeBody(parameters, exposure, candidate);
    if (model.valid && bodyShellLabel(model, shellId) && detailsVisible(model) && JSON.stringify(candidate) !== JSON.stringify(decoration)) { decoration = candidate; draw(); return; }
  }
  el('decoration-status').textContent = 'No new detail pattern passed the geometry and structural checks. Try a taller or wider body; sensor protections stay on.';
});
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
  parameters = { ...parameters, section: 0, aspect: 100, lean: 0, rim: 0, ridge: 0, ...(preset === 'tower' ? { sides: 10, diameter: 200, height: 260, taper: 85 } : preset === 'angular' ? { sides: 4, diameter: 200, height: 180, taper: 85 } : { sides: 8, diameter: 180, height: 180, taper: 90 }) }; draw();
}));
root.querySelectorAll<HTMLButtonElement>('[data-sculpt]').forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.sculpt;
  parameters = normaliseBody({ ...parameters, diameter: 240, height: 280, ridge: 25, ...(kind === 'manta' ? { section: 2, sides: 6, taper: 120, aspect: 165, lean: 0, rim: 1 } : kind === 'sentinel' ? { section: 1, sides: 8, taper: 90, aspect: 80, lean: -12, rim: 2 } : { section: 3, sides: 5, taper: 85, aspect: 110, lean: 0, rim: 1 }) });
  decoration = normaliseDecoration({ ...decoration, ornament: kind === 'manta' ? 'wing' : kind === 'sentinel' ? 'horn' : 'bolt', height: 100, span: 75, layout: 'pair', offset: 1, variation: 0, angle: kind === 'manta' ? 80 : 45, windows: kind === 'manta' ? 'slash' : kind === 'sentinel' ? 'chevron' : 'visor', windowSize: 45, rows: 2, windowAngle: kind === 'manta' ? 30 : 0 }); draw();
}));
el('random-body').addEventListener('click', () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const minHeight = Math.min(300, Math.max(parameters.skeletonHeight + parameters.clearance, 150));
    const sides = [4,5,6,7,8,9,10,11,12].filter(n => n !== parameters.sides);
    const sections = [0,1,2,3].filter(n => n !== parameters.section);
    const candidate = { ...parameters, section: sections[Math.floor(Math.random() * sections.length)], aspect: 65 + Math.floor(Math.random() * 111), lean: Math.floor(Math.random() * 41) - 20, rim: 1 + Math.floor(Math.random() * 3), ridge: Math.floor(Math.random() * Math.max(1, Math.min(36, (300 - minHeight) / 3))), sides: sides[Math.floor(Math.random() * sides.length)], diameter: 200 + Math.floor(Math.random() * 61), height: minHeight + Math.floor(Math.random() * (301 - minHeight)), taper: 75 + Math.floor(Math.random() * 61) };
    const details = nextDetails(), m = makeBody(candidate, exposure, details);
    if (m.fits && m.valid && bodyShellLabel(m, shellId) && detailsVisible(m)) { parameters = m.p; decoration = details; draw(); return; }
  }
  el('fit-status').textContent = 'No random shape passed fit, exposure and structural checks. Adjust dimensions or sensor positions. Your exposure toggles remain enforced.';
});
function setView(net: boolean) {
  if (net) stopFolding();
  canvas.hidden = net; el('flat-preview').hidden = !net;
  el('view-solid').setAttribute('aria-pressed', String(!net)); el('view-net').setAttribute('aria-pressed', String(net));
  root.querySelectorAll<HTMLButtonElement>('.view-actions button').forEach(button => button.disabled = net || !camera);
  el('show-envelope').closest('label')!.hidden = net;
  if (!net) engine?.resize();
  updatePose(!net);
}
el('view-solid').addEventListener('click', () => setView(false)); el('view-net').addEventListener('click', () => setView(true));
el('orbit-left').addEventListener('click', () => rotateBody(-.25));
el('orbit-right').addEventListener('click', () => rotateBody(.25));
el('zoom-in').addEventListener('click', () => { if (camera) camera.radius = Math.max(180, camera.radius * .85); });
el('zoom-out').addEventListener('click', () => { if (camera) camera.radius = Math.min(10000, camera.radius / .85); });
el('reset-view').addEventListener('click', () => { if (bodyTurntable) bodyTurntable.rotationQuaternion = Quaternion.Identity(); updatePose(true); });
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el('download-cut').addEventListener('click', () => { const model = makeBody(parameters, exposure, decoration); if (model.valid && model.fits && bodyShellLabel(model, shellId)) download('robot-body-cut.svg', bodySvg(model), 'image/svg+xml'); });
el('download-guide').addEventListener('click', () => { const model = makeBody(parameters, exposure, decoration); if (model.valid && model.fits && bodyShellLabel(model, shellId)) download('robot-body-folding-guide.svg', bodySvg(model, true, shellId), 'image/svg+xml'); });
el('download-design').addEventListener('click', () => download('robot-body-design.json', JSON.stringify({ version: 8, shell: { id: shellId, qrPayload: shellPayload(shellId), reader: qrReaderSpecification, label: bodyShellLabel(activeModel, shellId) }, units: 'mm', family: 'developable-profiled-sleeve', parameters, exposure, decoration, material: { model: 'calibrated-neutral-axis-finite-bends', thickness: parameters.thickness, insideRadius: parameters.bendRadius, neutralAxisFraction: parameters.neutralAxis/100, slotClearance: parameters.slotClearance, wallAllowances: activeModel.material.allowances, wallSetbacks: activeModel.material.setbacks, seamRelief: activeModel.material.seamGap, tabs: activeModel.tabDimensions, slots: activeModel.slots, calibrationRequired: true }, hardwareProfile: 'Maqueen V3 photo-estimated; +Y up, +Z front', checks: { geometry: activeModel.valid, envelope: activeModel.fits, exposure: activeModel.exposure.valid, structure: activeModel.structure }, assembly: el('making').innerText, roofAssembly: roofInstructions[decoration.roof], ornamentalAssembly: 'After wrapping the body, fold each retained rim motif outward at its root to the selected angle. Accordion: three equal segments; subsequent creases alternate reverse by twice the root angle. Wings reverse at the outer joint by 0.65 times the root angle; horns bend at each outer joint by 0.4 times the root angle. Use the folding slider as a pose reference. Remove window waste; keep motif roots attached.' }, null, 2), 'application/json'));
el('new-shell-id').addEventListener('click', () => { shellId = newShellId(); const url = new URL(location.href); url.searchParams.delete('shell'); history.replaceState(null, '', url); draw(); });
el('download-shell-qr').addEventListener('click', () => download(`shell-${shellId}-qr.svg`, shellQrSvg(shellId), 'image/svg+xml'));
draw(); setView(false);
