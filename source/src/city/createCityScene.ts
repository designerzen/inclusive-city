import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import '@babylonjs/core/Rendering/edgesRenderer';
import { createRobot } from '../robot/createRobot';
import { createPointerAttention } from '../robot/pointerAttention';
import type { ArtBot } from '../robot/botHistory';
import { CityJourney } from '../simulation/cityJourney';
import { buildings, cityBarriers, cityPickups, cityPowerups, cityRoute } from './cityLayout';
import type { BarrierId, PowerupId } from './cityLayout';
import { createCityCamera } from './cityCamera';
import type { CityView } from './cityCamera';
import type { Theme } from '../app/theme';

export function createCityScene(engine: Engine, bot: ArtBot, onSelect: (id: BarrierId) => void, onExplore: (id: PowerupId) => void = () => {}) {
  const scene = new Scene(engine);
  let theme: Theme = 'dark';
  const themeMaterials: { material: StandardMaterial; dark: string }[] = [];
  const outlines: { mesh: ReturnType<typeof MeshBuilder.CreateBox>; dark: string }[] = [];
  const labels: { texture: DynamicTexture; text: string }[] = [];
  scene.clearColor = Color4.FromHexString('#060d18ff');
  const light = new HemisphericLight('city-light', new Vector3(-1, 3, -2), scene);
  light.intensity = 1.35;
  function material(name: string, hex: string, unlit = false) {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    mat.specularColor = Color3.Black();
    if (unlit) { mat.disableLighting = true; mat.emissiveColor = mat.diffuseColor; }
    themeMaterials.push({ material: mat, dark: hex });
    return mat;
  }
  const groundMat = material('city-ground', '#0b1523');
  const roadMat = material('streets', '#111e2e');
  const sidewalkMat = material('sidewalks', '#243448');
  const curbMat = material('curbs', '#657483');
  const waterMat = material('river', '#123950', true);
  const bridgeMat = material('bridge-deck', '#304b5e');
  const white = material('route-white', '#ffffff', true);
  const amber = material('barrier-amber', '#ffbf69', true);
  const green = material('access-green', '#81e6be', true);
  const wire = material('building-wireframe', '#315568', true);
  wire.wireframe = true;

  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat = sidewalkMat) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.isPickable = false;
    return mesh;
  }
  function outline(mesh: ReturnType<typeof box>, colour = '#7aa8bb') {
    mesh.enableEdgesRendering();
    mesh.edgesWidth = 1.8;
    mesh.edgesColor = Color4.FromHexString(`${colour}ff`);
    outlines.push({ mesh, dark: colour });
  }
  box('ground', 0, -0.18, 0, 56, 0.2, 44, groundMat);
  box('river', 3.5, -0.045, 0, 5, 0.05, 44, waterMat);
  for (const x of [0.8, 6.2]) {
    box(`river-bank-north-${x}`, x, 0.04, 9.8, 0.2, 0.18, 24.4, curbMat);
    box(`river-bank-south-${x}`, x, 0.04, -13.8, 0.2, 0.18, 16.4, curbMat);
  }
  // Two neighbourhoods, with roads and raised sidewalks on both sides.
  for (const z of [-12, 10]) for (const [x, width] of [[-13.5, 27], [17, 20]]) {
    box(`street-${x}-${z}`, x, -0.015, z, width, 0.04, 3.6, roadMat);
    for (const side of [-1, 1]) {
      box(`sidewalk-${x}-${z}-${side}`, x, 0.06, z + side * 2.6, width, 0.12, 1.6);
      for (let i = 0; i < Math.floor(width / 3); i++) {
        const centre = x - width / 2 + i * 3 + 1.5;
        if (z === -12 && Math.abs(centre + 10) < 3) continue;
        box(`curb-${x}-${z}-${side}-${i}`, centre, 0.12, z + side * 1.88, 2.7, 0.24, 0.12, curbMat);
      }
    }
  }
  for (const x of [-23, 18]) {
    box(`avenue-${x}`, x, -0.02, 0, 3, 0.03, 36, roadMat);
    for (const side of [-1, 1]) box(`avenue-sidewalk-${x}-${side}`, x + side * 2.2, 0.06, 0, 1.4, 0.12, 36);
  }
  for (const building of buildings) {
    const base = 'base' in building ? building.base : 0;
    const mesh = box(`building-${building.name}`, building.x, base + building.h / 2, building.z, building.w, building.h, building.d, wire);
    outline(mesh);
    for (let floor = 1; floor < building.h; floor += 1.2) {
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => new Vector3(building.x + x! * building.w / 2, base + floor, building.z + z! * building.d / 2));
      const ring = MeshBuilder.CreateLines(`floor-${building.name}-${floor}`, { points: corners }, scene);
      ring.color = Color3.FromHexString('#35586c');
      ring.isPickable = false;
    }
  }
  // The path geometry and agent interpolation share this exact route data.
  for (let edge = 0; edge < cityRoute.length - 1; edge++) {
    if (edge === 4 || edge === 6 || edge === 8 || edge === 10) continue;
    const a = cityRoute[edge]!, b = cityRoute[edge + 1]!;
    const dx = b.x - a.x, dz = b.z - a.z;
    box(`route-sidewalk-${edge}`, (a.x + b.x) / 2, a.y - 0.07, (a.z + b.z) / 2, Math.abs(dx) || 3.2, 0.12, Math.abs(dz) || 3.2);
  }
  // Keep the crossing flush with the road rather than a raised path through it.
  const crossingSurface = scene.getMeshByName('route-sidewalk-2')!;
  crossingSurface.material = roadMat;
  for (let i = 0; i < 7; i++) box(`crossing-stripe-${i}`, -10, 0.13, -13.5 + i * 0.5, 2.5, 0.015, 0.22, curbMat);
  const curb = box('raised-curb', -11.5, 0.24, -15, 0.2, 0.48, 3.2, amber);
  const signal = box('crossing-signal', -12, 0.4, -13.8, 0.25, 0.8, 0.25, amber);
  const narrowFloor = box('narrow-sidewalk', -7, 0.075, -4, 6, 0.13, 1.2);
  const boundaries = [-1, 1].map(side => box(`sidewalk-boundary-${side}`, -7, 0.42, -4 + side * 0.68, 5, 0.65, 0.15, curbMat));
  const bridge = box('drawbridge', 3.5, 1.1, -4, 7.2, 0.16, 3.2, bridgeMat);
  bridge.rotation.z = 0.28;
  outline(bridge);
  const steps = Array.from({ length: 8 }, (_, i) => box(`stair-${i}`, 10, 0.14 + (i + 1) * 0.05, -3.5 + i, 3.2, (i + 1) * 0.1, 1, curbMat));
  const ramp = box('accessible-ramp', 10, 0.47, 0, 3.2, 0.14, Math.hypot(8, 0.8));
  ramp.rotation.x = -Math.atan2(0.8, 8);
  ramp.setEnabled(false);
  const shaft = box('elevator-shaft', 15, 1.75, 4, 3, 3.5, 3, wire);
  outline(shaft, '#a6b7c4');
  const cab = box('elevator-cab', 15, 0.86, 4, 2.8, 0.16, 2.8, bridgeMat);
  const guidance = box('route-beacon', -11.8, 0.4, -6, 0.25, 0.8, 0.25, amber);
  const botMesh = createRobot(scene);
  const pointerAttention = createPointerAttention(scene, engine, botMesh.robot);
  botMesh.setAppearance(bot.appearance);
  botMesh.setProfile(bot.profile);
  botMesh.robot.scaling.setAll(0.55);
  botMesh.robot.metadata = { ...botMesh.robot.metadata, name: bot.name, id: bot.id, record: bot.record };
  const carrier = box('accessible-carrier', 0, 0.18, 0, 4, 0.16, 3.4, bridgeMat);
  carrier.parent = botMesh.robot;
  outline(carrier, '#81e6be');
  carrier.setEnabled(false);
  const journey = new CityJourney(bot, true);
  scene.metadata = { journey };
  const pickupMeshes = cityPickups.map(pickup => {
    const p = cityRoute[pickup.node]!;
    const mesh = MeshBuilder.CreatePolyhedron(`pickup-${pickup.id}`, { type: 1, size: 0.3 }, scene);
    mesh.position.set(p.x, p.y + 0.65, p.z);
    mesh.material = green;
    mesh.isPickable = false;
    mesh.metadata = { ...pickup };
    return mesh;
  });
  const powerupMeshes = cityPowerups.map(pickup => {
    const p = pickup.path.at(-1)!;
    const mat = material(`powerup-material-${pickup.id}`, pickup.colour, true);
    const meshes = [];
    const halo = MeshBuilder.CreateTorus(`powerup-${pickup.id}`, { diameter: 1.9, thickness: 0.12, tessellation: 24 }, scene);
    halo.position.set(p.x, p.y + 0.12, p.z); meshes.push(halo);
    if (pickup.kind === 'music' || pickup.kind === 'harmony') {
      for (const offset of [-0.35, 0.35]) {
        const head = MeshBuilder.CreateSphere(`note-${pickup.id}-${offset}`, { diameter: 0.45, segments: 8 }, scene);
        head.position.set(p.x + offset, p.y + 0.35, p.z); meshes.push(head);
        meshes.push(box(`stem-${pickup.id}-${offset}`, p.x + offset + 0.18, p.y + 0.85, p.z, 0.1, 1, 0.1, mat));
      }
      meshes.push(box(`beam-${pickup.id}`, p.x + 0.18, p.y + 1.3, p.z, 0.8, 0.12, 0.1, mat));
    } else {
      const gem = MeshBuilder.CreatePolyhedron(`prism-${pickup.id}`, { type: 1, size: 0.65 }, scene);
      gem.position.set(p.x, p.y + 0.8, p.z); meshes.push(gem);
    }
    for (const mesh of meshes) { mesh.material = mat; mesh.metadata = { powerup: pickup.id }; mesh.isPickable = true; }
    const route = [cityRoute[pickup.node]!, ...pickup.path];
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i]!, b = route[i + 1]!;
      box(`exploration-path-${pickup.id}-${i}`, (a.x + b.x) / 2, a.y - 0.07, (a.z + b.z) / 2, Math.abs(b.x - a.x) || 2, 0.12, Math.abs(b.z - a.z) || 2);
    }
    const trail = MeshBuilder.CreateTube(`powerup-route-${pickup.id}`, { path: route.map(point => new Vector3(point.x, point.y + 0.07, point.z)), radius: 0.035, tessellation: 6 }, scene);
    trail.material = mat; trail.isPickable = false;
    return { id: pickup.id, meshes, halo, trail };
  });
  const path = MeshBuilder.CreateTube('white-route', { path: cityRoute.map(p => new Vector3(p.x, p.y + 0.06, p.z)), radius: 0.07, tessellation: 8 }, scene);
  path.material = white;
  path.isPickable = false;
  // Keep the guidance line visible across raised obstacles, then draw the bot above it.
  path.renderingGroupId = 1;
  botMesh.robot.getChildMeshes().forEach(mesh => { mesh.renderingGroupId = 2; });
  const markers = new Map<BarrierId, ReturnType<typeof box>>();
  for (const barrier of cityBarriers) {
    const p = cityRoute[barrier.edge]!;
    const marker = MeshBuilder.CreateTorus(`access-${barrier.id}`, { diameter: 1.5, thickness: 0.14, tessellation: 32 }, scene);
    marker.position.set(p.x, p.y + 0.1, p.z);
    marker.material = curbMat;
    marker.metadata = { barrier: barrier.id };
    marker.isPickable = true;
    markers.set(barrier.id, marker);
  }
  const destination = MeshBuilder.CreateTorus('gallery-destination', { diameter: 2, thickness: 0.18, tessellation: 32 }, scene);
  destination.position.set(24, 2.8, 0);
  destination.material = green;
  destination.isPickable = false;
  const runwayMat = material('catwalk-deck', '#24324e');
  const runway = box('catwalk', 22, 2.59, 0, 8, 0.2, 3.2, runwayMat);
  outline(runway, '#b6a1ec');
  for (const z of [-1.5, 1.5]) box(`catwalk-light-${z}`, 22, 2.71, z, 8, 0.035, 0.06, green);
  for (const x of [18.5, 25.5]) {
    box(`catwalk-post-${x}`, x, 4.3, -1.7, 0.12, 3.4, 0.12, wire);
    const spotlight = MeshBuilder.CreateSphere(`catwalk-spotlight-${x}`, { diameter: 0.35, segments: 8 }, scene);
    spotlight.position.set(x, 6, -1.7); spotlight.material = white; spotlight.isPickable = false;
  }

  function label(text: string, x: number, z: number, width = 4) {
    const texture = new DynamicTexture(`label-${text}`, { width: 512, height: 128 }, scene, false);
    texture.hasAlpha = true;
    texture.drawText(text, null, 82, 'bold 48px sans-serif', '#99b5c4', 'transparent', true);
    labels.push({ texture, text });
    const mat = material(`label-material-${text}`, '#ffffff', true);
    mat.diffuseTexture = texture;
    mat.useAlphaFromDiffuseTexture = true;
    mat.backFaceCulling = false;
    const plane = MeshBuilder.CreatePlane(`label-${text}`, { width, height: width / 4 }, scene);
    plane.rotation.x = Math.PI / 2;
    plane.position.set(x, 0.17, z);
    plane.material = mat;
    plane.isPickable = false;
  }
  label('WORKSHOP', -21, -21.3, 5);
  label('RIVER', 3.5, 13, 3);
  label('BRIDGE', 3.5, -7);
  label('STAIRS', 12.7, 0, 3);
  label('ELEVATOR', 15, 7, 4);
  label('GALLERY', 21, 11, 4);
  label('CATWALK', 22, -2.5, 4);
  let presentationTime = 0;
  let selectedFeature: BarrierId | null = null;
  function highlightFeature(id: BarrierId | null) {
    selectedFeature = id;
    for (const [featureId, marker] of markers) {
      marker.material = featureId === selectedFeature ? green : journey.blocked?.id === featureId ? white : curbMat;
      marker.scaling.setAll(featureId === selectedFeature ? 1.25 : 1);
    }
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  for (const [id, meshes] of [
    ['curb', [curb]], ['crossing', [signal, crossingSurface]], ['guidance', [guidance]],
    ['sidewalk', [narrowFloor, ...boundaries]], ['bridge', [bridge]],
    ['stairs', [...steps, ramp]], ['elevator', [shaft, cab]], ['transport', [carrier]],
  ] as const) for (const mesh of meshes) { mesh.metadata = { barrier: id }; mesh.isPickable = true; }
  function selectAt(x: number, y: number) {
    const pick = scene.pick(x, y, mesh => !!mesh.metadata?.barrier || !!mesh.metadata?.powerup);
    if (pick?.pickedMesh?.metadata?.powerup) { onExplore(pick.pickedMesh.metadata.powerup); return; }
    if (pick?.pickedMesh?.metadata?.barrier) { onSelect(pick.pickedMesh.metadata.barrier); return; }
    // A screen-space target stays easy to tap even when the map is zoomed out.
    const viewport = scene.activeCamera!.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    let closest: BarrierId | null = null, distance = 28;
    for (const [id, marker] of markers) {
      const point = Vector3.Project(marker.position, Matrix.Identity(), scene.getTransformMatrix(), viewport);
      if (point.z < 0 || point.z > 1) continue;
      const d = Math.hypot(point.x * engine.getHardwareScalingLevel() - x, point.y * engine.getHardwareScalingLevel() - y);
      if (d < distance) { closest = id; distance = d; }
    }
    if (closest) onSelect(closest);
  }

  const cameraControls = createCityCamera(engine, scene, () => ({
    position: botMesh.robot.position,
    heading: botMesh.robot.rotation.y,
    eyeHeight: (1.05 + 2.3 * bot.appearance.height) * 0.55,
  }));
  function setView(view: CityView) {
    botMesh.robot.getChildMeshes().forEach(mesh => { mesh.isVisible = view !== 'robot-eye'; });
    cameraControls.setView(view);
  }
  function fit() { setView('overhead'); cameraControls.fit(); }
  let presentationBoard: ReturnType<typeof MeshBuilder.CreatePlane> | null = null;
  let presentationTexture: DynamicTexture | null = null;
  function present(artwork: HTMLCanvasElement) {
    if (!presentationBoard) {
      presentationTexture = new DynamicTexture('catwalk-artwork', { width: 1024, height: 512 }, scene, false);
      const mat = material('catwalk-artwork-material', '#ffffff', true);
      mat.diffuseTexture = presentationTexture;
      mat.emissiveTexture = presentationTexture;
      mat.backFaceCulling = false;
      presentationBoard = MeshBuilder.CreatePlane('catwalk-artwork-display', { width: 6.4, height: 3.2 }, scene);
      presentationBoard.position.set(22, 4.4, 1.8);
      presentationBoard.material = mat; presentationBoard.isPickable = false;
    }
    presentationTexture!.getContext().drawImage(artwork, 0, 0, 1024, 512);
    presentationTexture!.update();
    presentationBoard.setEnabled(true);
    setView('angled'); cameraControls.focus(22, 0, 0.3);
  }
  let animationCursor = 0;
  let animationRun = journey.machine.run.id;
  function update(seconds: number) {
    const previousX = botMesh.robot.position.x, previousZ = botMesh.robot.position.z;
    const previousHeading = botMesh.robot.rotation.y;
    journey.update(seconds);
    if (animationRun !== journey.machine.run.id) {
      botMesh.characterAnimation.reset();
      animationRun = journey.machine.run.id;
    }
    const animationEvents = journey.machine.record.events.slice(animationCursor);
    animationCursor = journey.machine.record.events.length;
    for (const event of animationEvents) {
      if (event.runId !== animationRun) continue;
      switch (event.type) {
        case 'journey_started': if (journey.state !== 'ready') botMesh.characterAnimation.react('launch'); break;
        case 'state_changed': if (event.data.from === 'ready' && event.data.to === 'following') botMesh.characterAnimation.react('launch'); break;
        case 'blocked': botMesh.characterAnimation.mood = 'sad'; botMesh.characterAnimation.react('surprise'); break;
        case 'intervention': botMesh.characterAnimation.mood = 'happy'; botMesh.characterAnimation.react('relief'); break;
        case 'pickup': botMesh.characterAnimation.mood = 'happy'; botMesh.characterAnimation.react('pickup'); break;
        case 'arrived': botMesh.characterAnimation.mood = 'celebrating'; botMesh.characterAnimation.react('celebrate'); break;
      }
    }
    pickupMeshes.forEach(mesh => mesh.setEnabled(!journey.machine.run.pickups.some(pickup => pickup.id === mesh.metadata.id)));
    powerupMeshes.forEach(pickup => {
      const collected = journey.machine.run.pickups.some(item => item.id === pickup.id);
      pickup.meshes.forEach(mesh => mesh.setEnabled(!collected));
      pickup.trail.setEnabled(!collected);
      pickup.halo.scaling.setAll(journey.plannedPowerups.has(pickup.id) ? 1.2 : 1);
    });
    const p = journey.position;
    botMesh.robot.position.set(p.x, p.y - 0.25 * 0.55, p.z);
    const heading = journey.heading;
    if (heading !== null) botMesh.robot.rotation.y = heading;
    if (journey.complete) {
      if (!reducedMotion.matches) presentationTime += seconds;
      botMesh.robot.position.x = 22 + Math.sin(presentationTime * 0.35) * 2;
      botMesh.robot.rotation.y = Math.sin(presentationTime * 0.35) * 0.5;
    } else presentationTime = 0;
    const travel = seconds > 0 ? Math.hypot(botMesh.robot.position.x - previousX, botMesh.robot.position.z - previousZ) : 0;
    const headingDelta = Math.atan2(Math.sin(botMesh.robot.rotation.y - previousHeading), Math.cos(botMesh.robot.rotation.y - previousHeading));
    if (seconds > 0 && travel > 0 && Math.abs(headingDelta) > .25) botMesh.characterAnimation.react('turn', headingDelta);
    botMesh.setAttention(pointerAttention.update(seconds));
    botMesh.animateTravel(travel, seconds, reducedMotion.matches, journey.paused);
    if (!journey.complete) presentationBoard?.setEnabled(false);
    highlightFeature(selectedFeature);
    if (journey.edge === 10) cab.position.y = p.y - 0.08;
    else if (journey.edge > 10) cab.position.y = 2.66;
    else cab.position.y = 0.86;
    cameraControls.update();
  }
  function syncCity() {
    const state = journey.city.snapshot();
    curb.scaling.y = state.curb ? 0.08 : 1; curb.position.y = state.curb ? 0.02 : 0.24; curb.material = state.curb ? green : amber;
    signal.material = state.crossing > 1.5 ? green : amber;
    guidance.material = state.guidance ? green : amber;
    guidance.scaling.x = state.guidance ? 2 : 1;
    narrowFloor.scaling.z = state.sidewalk / 1.2;
    boundaries.forEach((wall, i) => { wall.position.z = -4 + (i ? 1 : -1) * (state.sidewalk / 2 + 0.08); });
    bridge.rotation.z = state.bridge ? 0 : 0.28; bridge.position.y = state.bridge ? 0.06 : 1.1;
    steps.forEach(step => step.setEnabled(!state.stairs)); ramp.setEnabled(state.stairs);
    shaft.edgesColor = Color4.FromHexString(theme === 'light'
      ? state.elevator ? '#147850ff' : '#536a7aff'
      : state.elevator ? '#81e6beff' : '#a6b7c4ff');
    carrier.setEnabled(state.transport);
    update(0);
  }
  function intervene(id: BarrierId) { const changed = journey.intervene(id); if (changed) syncCity(); return changed; }
  function setTheme(value: Theme) {
    theme = value;
    const lightColours: Record<string, string> = {
      'city-ground': '#e8ede5', streets: '#bcc9ce', sidewalks: '#f7f5ec', curbs: '#657987',
      river: '#80bfd1', 'bridge-deck': '#a4b8c1', 'route-white': '#253d55',
      'barrier-amber': '#a55a0c', 'access-green': '#147850', 'building-wireframe': '#63818d',
      'catwalk-deck': '#c3b9da',
    };
    scene.clearColor = Color4.FromHexString(value === 'light' ? '#e8ede5ff' : '#060d18ff');
    for (const { material: mat, dark } of themeMaterials) {
      mat.diffuseColor = Color3.FromHexString(value === 'light' ? lightColours[mat.name] ?? dark : dark);
      if (value === 'light' && mat.name.startsWith('powerup-material-')) mat.diffuseColor = mat.diffuseColor.scale(.6);
      if (mat.disableLighting) mat.emissiveColor = mat.diffuseColor;
    }
    for (const { mesh, dark } of outlines) {
      const light = dark === '#81e6be' ? '#147850' : dark === '#b6a1ec' ? '#7151a2' : '#536a7a';
      mesh.edgesColor = Color4.FromHexString(`${value === 'light' ? light : dark}ff`);
    }
    for (const mesh of scene.meshes) if (mesh.name.startsWith('floor-')) {
      (mesh as ReturnType<typeof MeshBuilder.CreateLines>).color = Color3.FromHexString(value === 'light' ? '#668591' : '#35586c');
    }
    for (const { texture, text } of labels) {
      texture.getContext().clearRect(0, 0, 512, 128);
      texture.drawText(text, null, 82, 'bold 48px sans-serif', value === 'light' ? '#294958' : '#99b5c4', 'transparent', true);
    }
    syncCity();
  }
  syncCity();
  update(0);
  return { scene, journey, resize: cameraControls.update, update, intervene, setView, setTheme,
    setZoom: cameraControls.setZoom, pan: cameraControls.pan, canPan: cameraControls.canPan,
    get view() { return cameraControls.view; }, fit, present, syncCity, selectAt, highlightFeature };
}
