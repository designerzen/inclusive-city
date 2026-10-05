import { reducedMotionPreference } from './accessibilityPreferences';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import type { createRobot } from '../robot/createRobot';
import type { JourneyDance } from '../robot/journeyDance';
import type { FinishedJourney } from '../art/finishedJourney';
import type { createStudioInstruments } from './createStudioInstruments';

/** Borrow the city's renderer, robot and instruments; restore them on leaving. */
export function createExhibitionPerformer(canvas: HTMLCanvasElement, journey: FinishedJourney,
  scene: Scene, camera: UniversalCamera, bot: ReturnType<typeof createRobot>,
  instruments: ReturnType<typeof createStudioInstruments>, choreography: JourneyDance,
  restoreCamera: () => void) {
  const engine = scene.getEngine();
  const label = canvas.getAttribute('aria-label');
  const robotMeshes = bot.robot.getChildMeshes();
  const groups = robotMeshes.map(mesh => mesh.renderingGroupId);
  const parent = canvas.parentElement!, sibling = canvas.nextSibling;
  const background = scene.clearColor;
  const physicsEnabled = scene.physicsEnabled;
  const position = bot.robot.position.clone(), rotation = bot.robot.rotation.clone(), scale = bot.robot.scaling.clone();
  const instrumentScale = instruments.root.scaling.clone(), instrumentsEnabled = instruments.root.isEnabled();
  const instrumentPosition = instruments.root.position.clone(), instrumentRotation = instruments.root.rotation.clone();
  const meshes = scene.meshes.filter(mesh => !mesh.isDescendantOf(bot.robot) && !mesh.isDescendantOf(instruments.root));
  const visibility = meshes.map(mesh => mesh.isVisible);
  let borrowed = false;
  const rig = scene.getTransformNodeByName('character-rig')!;
  const head = scene.getTransformNodeByName('head-rig')!;
  const antenna = scene.getTransformNodeByName('antenna-rig')!;
  const arms = [-1, 1].map(side => scene.getTransformNodeByName(`shoulder-${side}`)!);
  const wheels = [-1, 1].flatMap(side => [-1, 1].map(end => scene.getMeshByName(`wheel-${side}-${end}`)!));
  const motion = reducedMotionPreference();
  let clock: (() => number) | null = null, active = false, dirty = true;
  const resize = () => {
    engine.resize();
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.position.set(0, 4.1, -12); camera.setTarget(new Vector3(0, 1.9, 0));
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const height = Math.max(2.1, (2.05 * journey.robot.appearance.width) / aspect, 2.05 * journey.robot.appearance.height);
    camera.orthoTop = height; camera.orthoBottom = -height; camera.orthoLeft = -height * aspect; camera.orthoRight = height * aspect;
    dirty = true;
  };
  const observer = new ResizeObserver(() => { if (active) resize(); }); observer.observe(canvas);
  const onMotion = () => { dirty = true; }; motion.addEventListener('change', onMotion);
  const render = () => {
    if (!active || document.hidden || (!dirty && (!clock || motion.matches))) return;
    const elapsed = clock?.() ?? 0;
    const pose = choreography.pianoPose(elapsed, !!clock, motion.matches);
    instruments.update(elapsed, !!clock, motion.matches);
    bot.robot.position.x = pose.x; bot.robot.rotation.y = pose.yaw;
    wheels.forEach(wheel => { wheel.rotation.x = -pose.x / .35; });
    rig.position.y = pose.lift; rig.rotation.set(0, 0, pose.sway);
    rig.scaling.set(1 / Math.sqrt(pose.stretch), pose.stretch, 1 / Math.sqrt(pose.stretch));
    head.rotation.set(pose.headNod, pose.headYaw, pose.headTilt);
    arms[0]!.rotation.set(pose.armSwing, 0, pose.leftArm); arms[1]!.rotation.set(pose.armSwing - .04 * pose.energy, 0, pose.rightArm);
    antenna.rotation.z = pose.antenna;
    scene.render(); dirty = false;
  };
  engine.runRenderLoop(render);
  return {
    enter(host: HTMLElement) {
      borrowed = true; host.append(canvas); canvas.classList.add('exhibition-robot-canvas');
      meshes.forEach(mesh => { mesh.isVisible = false; });
      robotMeshes.forEach(mesh => { mesh.renderingGroupId = 0; });
      canvas.setAttribute('aria-label', `${journey.name} plays its saved song on a keyboard beside a standing microphone.`);
      scene.clearColor = new Color4(0, 0, 0, 0); scene.physicsEnabled = false;
      bot.robot.position.setAll(0); bot.robot.rotation.setAll(0); bot.robot.scaling.setAll(1);
      instruments.root.scaling.set(journey.robot.appearance.width, 1, 1);
      instruments.root.position.setAll(0); instruments.root.rotation.setAll(0); instruments.root.setEnabled(true);
      active = true; resize(); render();
    },
    play(value: () => number) { clock = value; dirty = true; render(); },
    stop() { clock = null; dirty = true; render(); },
    dispose() {
      active = false; engine.stopRenderLoop(render); observer.disconnect(); motion.removeEventListener('change', onMotion);
      if (!borrowed) return;
      meshes.forEach((mesh, i) => { mesh.isVisible = visibility[i]!; });
      robotMeshes.forEach((mesh, i) => { mesh.renderingGroupId = groups[i]!; });
      if (label === null) canvas.removeAttribute('aria-label'); else canvas.setAttribute('aria-label', label);
      scene.clearColor = background; scene.physicsEnabled = physicsEnabled;
      bot.robot.position.copyFrom(position); bot.robot.rotation.copyFrom(rotation); bot.robot.scaling.copyFrom(scale);
      instruments.root.scaling.copyFrom(instrumentScale); instruments.root.setEnabled(instrumentsEnabled);
      instruments.root.position.copyFrom(instrumentPosition); instruments.root.rotation.copyFrom(instrumentRotation);
      parent.insertBefore(canvas, sibling); canvas.classList.remove('exhibition-robot-canvas');
      engine.resize(); restoreCamera();
    },
  };
}
