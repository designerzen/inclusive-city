import { reducedMotionPreference } from '../app/accessibilityPreferences';
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
import type { ArtBot } from '../robot/botHistory';
import type { Theme } from '../app/theme';
import { createBuildingRoof } from './buildingRoof';
import { createCityCamera } from './cityCamera';
import { PlannedJourney } from '../simulation/plannedJourney';
import type { ProceduralCity } from './proceduralCity';
import { JourneyDance } from '../robot/journeyDance';
import type { FinishedJourney } from '../art/finishedJourney';

export function createCityScene(engine: Engine, bot: ArtBot, world: ProceduralCity) {
  const scene = new Scene(engine);
  const journey = new PlannedJourney(bot, world);
  scene.metadata = { journey, world };
  const light = new HemisphericLight('city-light', new Vector3(-1, 3, -2), scene); light.intensity = 1.2;
  let theme: Theme = 'dark';
  const palette: { mat: StandardMaterial; dark: string; light: string }[] = [];
  function material(name: string, dark: string, light: string, unlit = false) {
    const mat = new StandardMaterial(name, scene); mat.diffuseColor = Color3.FromHexString(dark); mat.specularColor = Color3.Black();
    if (unlit) { mat.disableLighting = true; mat.emissiveColor = mat.diffuseColor; }
    palette.push({ mat, dark, light }); return mat;
  }
  const ground = material('ground', '#171717', '#ededed');
  const pavement = material('streets', '#565656', '#bbbbbb');
  const water = material('river', '#303030', '#999999', true);
  const walls = material('building-walls', '#646464', '#bababa');
  const roofs = material('building-roofs', '#b0b0b0', '#8a8a8a');
  const details = material('details', '#d6d6d6', '#444444', true);
  const ink = material('route-line', '#ffffff', '#181818', true);
  const muted = material('junctions', '#a0a0a0', '#555555', true);
  const obstruction = material('obstacles', '#dddddd', '#303030', true);
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); mesh.position.set(x, y, z); mesh.material = mat; mesh.isPickable = false; return mesh;
  }
  box('ground', 0, -.12, 0, 56, .15, 44, ground);
  box('river', world.riverX, -.025, 0, 7, .05, 44, water);
  const streetModels = world.streets.map(street => {
    const a = world.nodes.find(n => n.id === street.a)!, b = world.nodes.find(n => n.id === street.b)!;
    const dx = Math.abs(b.x - a.x), dz = Math.abs(b.z - a.z), x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    const width = street.kind === 'width' ? street.width : 2.6;
    const surface = box(street.id, x, .025, z, dx || width, .1, dz || width, pavement);
    surface.metadata = { street: street.id }; surface.isPickable = true;
    const parts: ReturnType<typeof box>[] = [];
    if (street.kind !== 'clear' && street.kind !== 'width') {
      const mark = box(`issue-${street.id}`, x, .34, z, dx ? .28 : 2.6, .55, dx ? 2.6 : .28, obstruction);
      mark.metadata = { street: street.id }; mark.isPickable = true; parts.push(mark);
      if (street.kind === 'stairs') for (let i = -1; i <= 1; i++) { const step = box(`step-${street.id}-${i}`, x + (dx ? i * .45 : 0), .16 + (i + 1) * .07, z + (dz ? i * .45 : 0), dx ? .4 : 2.6, .12 + (i + 1) * .14, dx ? 2.6 : .4, obstruction); step.metadata = { street: street.id }; step.isPickable = true; parts.push(step); }
    }
    const bridge = street.kind === 'bridge' ? box(`bridge-deck-${street.id}`, x, .65, z, dx, .16, 2.6, walls) : null;
    if (bridge) { bridge.metadata = { street: street.id }; bridge.isPickable = true; }
    return { street, surface, parts, bridge, dx, dz };
  });
  const labelMaterials: { mat: StandardMaterial; texture: DynamicTexture; text: string }[] = [];
  function label(text: string, x: number, y: number, z: number, width = 3) {
    const texture = new DynamicTexture(`label-${text}`, { width: 512, height: 128 }, scene, false); texture.hasAlpha = true;
    const mat = new StandardMaterial(`label-material-${text}`, scene); mat.diffuseTexture = texture; mat.emissiveTexture = texture; mat.disableLighting = true; mat.backFaceCulling = false; mat.useAlphaFromDiffuseTexture = true;
    const plane = MeshBuilder.CreatePlane(`label-${text}`, { width, height: width / 4 }, scene); plane.rotation.x = Math.PI / 2; plane.position.set(x, y, z); plane.material = mat; plane.isPickable = false;
    labelMaterials.push({ mat, texture, text });
  }
  for (const b of world.buildings) {
    const body = box(`building-${b.name}`, b.x, b.h / 2, b.z, b.w, b.h, b.d, walls);
    body.enableEdgesRendering(); body.edgesColor = new Color4(.4, .4, .4, 1);
    box(`eaves-${b.name}`, b.x, b.h + .05, b.z, b.w + .4, .12, b.d + .4, details);
    const rise = Math.min(1.4, b.w * .3);
    const roof = createBuildingRoof(`roof-${b.name}`, b.w + .4, b.d + .4, rise, scene); roof.position.set(b.x, b.h + .12, b.z); roof.material = roofs; roof.isPickable = false;
    for (let y = .8; y < b.h - .3; y += 1) for (const offset of [-.9, .9]) box(`window-${b.name}-${y}-${offset}`, b.x + offset, y, b.z - b.d / 2 - .015, .45, .5, .04, details);
  }
  const nodeModels = world.nodes.map(node => {
    const ring = MeshBuilder.CreateTorus(`node-${node.id}`, { diameter: node.discovery || node.id === world.start || node.id === world.destination ? 1.65 : 1, thickness: .13, tessellation: 20 }, scene);
    ring.position.set(node.x, .17, node.z); ring.material = muted; ring.metadata = { node: node.id }; ring.isPickable = true;
    const glyph = node.id === world.start ? 'WORKSHOP' : node.id === world.destination ? 'DUET STUDIO' : node.discovery ? `${node.discovery === 'music' || node.discovery === 'harmony' ? '♫' : '◇'} ${node.label.toUpperCase()}` : node.label;
    label(glyph, node.x, .2, node.z - 1.4, node.discovery || node.id === world.start || node.id === world.destination ? 4 : 1.5);
    return { node, ring };
  });
  const robot = createRobot(scene); robot.setAppearance(bot.appearance); robot.setProfile(bot.profile); robot.robot.scaling.setAll(.5);
  robot.robot.getChildMeshes().forEach(m => { m.renderingGroupId = 2; m.isPickable = false; });
  const camera = createCityCamera(engine, scene, () => ({ position: new Vector3(journey.position.x, journey.position.y - .125, journey.position.z), heading: journey.heading, eyeHeight: (1.05 + 2.25 * bot.appearance.height) * .5 }));
  let dance: JourneyDance | null = null, musicClock: (() => number) | null = null;
  const rig = scene.getTransformNodeByName('character-rig')!;
  const head = scene.getTransformNodeByName('head-rig')!;
  const arms = [-1, 1].map(side => scene.getTransformNodeByName(`shoulder-${side}`)!);
  const antenna = scene.getTransformNodeByName('antenna-rig')!;
  let arrived = false;
  let line: ReturnType<typeof MeshBuilder.CreateTube> | null = null;
  let routeKey = '', revisionKey = '';
  function sync() {
    const key = journey.route.join('|');
    if (key !== routeKey) {
      routeKey = key; line?.dispose(); line = null;
      if (journey.route.length > 1) { line = MeshBuilder.CreateTube('drawn-route', { path: journey.route.map(id => { const n = world.nodes.find(n => n.id === id)!; return new Vector3(n.x, .19, n.z); }), radius: .12, tessellation: 8 }, scene); line.material = ink; line.isPickable = false; line.renderingGroupId = 1; }
      const next = journey.nextStops.map(n => n.id);
      nodeModels.forEach(({ node, ring }) => { ring.material = next.includes(node.id) || node.id === journey.route.at(-1) ? ink : muted; ring.scaling.setAll(next.includes(node.id) ? 1.25 : 1); });
    }
    const edits = [...journey.repaired].join('|');
    if (revisionKey !== edits) {
      revisionKey = edits;
      streetModels.forEach(({ street, surface, parts, bridge, dx }) => {
        const repaired = journey.repaired.has(street.id);
        parts.forEach(m => m.setEnabled(!repaired));
        if (bridge) { bridge.rotation.z = repaired ? 0 : .22; bridge.position.y = repaired ? .06 : .65; }
        if (street.kind === 'width') surface.scaling[dx ? 'z' : 'x'] = repaired ? 3.8 / street.width : 1;
        if (street.kind === 'guidance' || street.kind === 'crossing') surface.material = repaired ? details : pavement;
      });
    }
  }
  function update(seconds: number) {
    const before = journey.position, heading = journey.heading;
    journey.update(seconds); sync(); const p = journey.position;
    if (journey.complete && !arrived) { arrived = true; camera.beginArrival(); }
    if (!journey.complete && arrived) { arrived = false; musicClock = null; dance = null; robot.setSpeaking(false); camera.fit(); }
    robot.robot.position.set(p.x, p.y - .125, p.z); robot.robot.rotation.y = journey.heading;
    const moved = Math.hypot(p.x - before.x, p.z - before.z);
    const delta = Math.atan2(Math.sin(journey.heading - heading), Math.cos(journey.heading - heading));
    robot.animateTravel(moved, seconds, reducedMotionPreference().matches, journey.paused || journey.ready || !!journey.blocked, delta);
    if (journey.complete && dance && musicClock) {
      const elapsed = musicClock(), motion = reducedMotionPreference().matches;
      const pose = dance.studioPose(elapsed, true, motion);
      robot.robot.position.x += pose.x * .5;
      robot.robot.rotation.y = journey.heading + pose.yaw;
      rig.position.y = pose.lift; rig.rotation.set(0, 0, pose.sway);
      rig.scaling.set(1 / Math.sqrt(pose.stretch), pose.stretch, 1 / Math.sqrt(pose.stretch));
      head.rotation.x += pose.headNod; head.rotation.y = pose.headYaw;
      arms[0]!.rotation.set(pose.armSwing, 0, pose.leftArm); arms[1]!.rotation.set(-pose.armSwing, 0, pose.rightArm);
      antenna.rotation.z = pose.antenna;
      camera.setPerformanceTime(motion ? 4 : elapsed);
    }
    robot.characterAnimation.mood = journey.complete ? 'happy' : journey.blocked ? 'sad' : 'curious'; camera.update(seconds, reducedMotionPreference().matches);
  }
  function projectNode(id: string) {
    const node = world.nodes.find(n => n.id === id)!;
    const p = Vector3.Project(new Vector3(node.x, .17, node.z), Matrix.Identity(), scene.getTransformMatrix(), scene.activeCamera!.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    return { x: p.x * engine.getHardwareScalingLevel(), y: p.y * engine.getHardwareScalingLevel(), z: p.z };
  }
  function nodeAt(x: number, y: number) {
    let best: string | null = null, distance = 24;
    for (const node of world.nodes) { const p = projectNode(node.id); const d = Math.hypot(p.x - x, p.y - y); if (p.z >= 0 && p.z <= 1 && d < distance) { best = node.id; distance = d; } }
    return best;
  }
  function streetAt(x: number, y: number) { return scene.pick(x, y, m => !!m.metadata?.street)?.pickedMesh?.metadata.street as string | undefined; }
  let highlighted: typeof scene.meshes = [];
  function highlight(id: string | null) {
    highlighted.forEach(m => { m.renderOverlay = false; m.visibility = 1; });
    highlighted = id ? scene.meshes.filter(m => m.metadata?.street === id) : [];
    highlighted.forEach(m => { m.renderOverlay = true; m.overlayColor = theme === 'dark' ? Color3.White() : Color3.Black(); m.overlayAlpha = .4; m.visibility = .7; });
  }
  function setTheme(value: Theme) {
    theme = value; scene.clearColor = Color4.FromHexString(value === 'dark' ? '#171717ff' : '#edededff');
    palette.forEach(({ mat, dark, light }) => { mat.diffuseColor = Color3.FromHexString(value === 'dark' ? dark : light); if (mat.disableLighting) mat.emissiveColor = mat.diffuseColor; });
    labelMaterials.forEach(({ texture, text }) => { const ctx = texture.getContext() as CanvasRenderingContext2D; ctx.clearRect(0, 0, 512, 128); ctx.fillStyle = value === 'dark' ? '#171717' : '#eeeeee'; ctx.fillRect(0, 0, 512, 128); ctx.font = 'bold 45px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = value === 'dark' ? '#eeeeee' : '#222222'; ctx.fillText(text, 256, 64); texture.update(); });
  }
  revisionKey = 'initial'; sync(); setTheme('dark'); update(0);
  return { scene, journey, update, sync, setTheme, nodeAt, streetAt, projectNode, highlight,
    resize: () => camera.update(), setZoom: camera.setZoom, pan: camera.pan, fit: camera.fit,
    setSinging(value: boolean) { robot.setSpeaking(value); },
    danceToMusic(value: FinishedJourney, clock: () => number) { dance = new JourneyDance(value.score, value.bpm, value.artist.musician === 'waltz' ? 3 : 4); musicClock = clock; },
    stopDancing() { musicClock = null; },
    get arrivalComplete() { return camera.arrivalComplete; },
    setView: camera.setView,
    get view() { return camera.view; } };
}
