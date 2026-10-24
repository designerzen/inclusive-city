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
import type { ExhibitionDuet } from '../robot/exhibitionDuet';

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
  const frontWheel = scene.getMeshByName('front-wheel')!;
  const motion = reducedMotionPreference();
  let clock: (() => number) | null = null, active = false, dirty = true;
  let duet: ExhibitionDuet | null = null;
  const stageMeshes = [...robotMeshes, ...instruments.root.getChildMeshes()];
  let frame: { left: number; right: number; bottom: number; top: number } | null = null;
  const fitStage = () => {
    const view = camera.getViewMatrix(true);
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
    for (const mesh of stageMeshes) {
      if (!mesh.isEnabled() || !mesh.isVisible) continue;
      mesh.computeWorldMatrix(true);
      for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
        const point = Vector3.TransformCoordinates(corner, view);
        left = Math.min(left, point.x); right = Math.max(right, point.x);
        bottom = Math.min(bottom, point.y); top = Math.max(top, point.y);
      }
    }
    if (!Number.isFinite(left)) return;
    // Include accessories and instruments, with breathing room around every edge.
    // Only expand during playback so head and arm movements cannot cause zoom jitter.
    const padding = .3;
    frame = {
      left: Math.min(frame?.left ?? Infinity, left - padding),
      right: Math.max(frame?.right ?? -Infinity, right + padding),
      bottom: Math.min(frame?.bottom ?? Infinity, bottom - padding),
      top: Math.max(frame?.top ?? -Infinity, top + padding),
    };
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const halfHeight = Math.max((frame.top - frame.bottom) / 2, (frame.right - frame.left) / (2 * aspect));
    const x = (frame.left + frame.right) / 2, y = (frame.bottom + frame.top) / 2;
    camera.orthoTop = y + halfHeight; camera.orthoBottom = y - halfHeight;
    camera.orthoLeft = x - halfHeight * aspect; camera.orthoRight = x + halfHeight * aspect;
  };
  const resize = () => {
    engine.resize();
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.upVector.copyFromFloats(0, 1, 0);
    camera.position.set(0, 4.1, -12); camera.setTarget(new Vector3(0, 1.9, 0));
    frame = null;
    fitStage();
    dirty = true;
  };
  const observer = new ResizeObserver(() => { if (active) resize(); }); observer.observe(canvas);
  const onMotion = () => { dirty = true; }; motion.addEventListener('change', onMotion);
  const render = () => {
    if (!active || document.hidden || (!dirty && (!clock || motion.matches))) return;
    const elapsed = clock?.() ?? 0;
    const frame = duet?.frame(elapsed, !!clock, motion.matches);
    const pose = frame?.pose ?? choreography.pianoPose(elapsed, !!clock, motion.matches);
    instruments.update(elapsed, !!clock, motion.matches, frame);
    bot.robot.position.x = pose.x; bot.robot.rotation.y = pose.yaw;
    wheels.forEach(wheel => { wheel.rotation.x = -pose.x / .35; });
    frontWheel.rotation.x = -pose.x / .13;
    rig.position.y = pose.lift; rig.rotation.set(0, 0, pose.sway);
    rig.scaling.set(1 / Math.sqrt(pose.stretch), pose.stretch, 1 / Math.sqrt(pose.stretch));
    head.rotation.set(pose.headNod, pose.headYaw, pose.headTilt);
    arms[0]!.rotation.set(frame?.leftSwing ?? pose.armSwing, 0, pose.leftArm);
    arms[1]!.rotation.set(frame?.rightSwing ?? pose.armSwing - .04 * pose.energy, 0, pose.rightArm);
    antenna.rotation.z = pose.antenna;
    fitStage();
    scene.render(); dirty = false;
  };
  engine.runRenderLoop(render);
  return {
    setDuet(value: ExhibitionDuet) { duet = value; dirty = true; },
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
