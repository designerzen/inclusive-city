import { reducedMotionPreference } from './accessibilityPreferences';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { createRobot } from '../robot/createRobot';
import { JourneyDance } from '../robot/journeyDance';
import type { FinishedJourney } from '../art/finishedJourney';
import { createStudioInstruments } from './createStudioInstruments';

export function createExhibitionPerformer(canvas: HTMLCanvasElement, journey: FinishedJourney) {
  const engine = new Engine(canvas, true, { alpha: true, premultipliedAlpha: false });
  engine.setHardwareScalingLevel(1 / Math.min(2, window.devicePixelRatio || 1));
  const scene = new Scene(engine); scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new UniversalCamera('exhibition-camera', new Vector3(0, 4.1, -12), scene);
  camera.setTarget(new Vector3(0, 1.9, 0)); camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  const light = new HemisphericLight('exhibition-light', new Vector3(-1, 2, -3), scene);
  light.intensity = 1.35; light.groundColor = Color3.FromHexString('#7a826a');
  const bot = createRobot(scene);
  bot.setAppearance(journey.robot.appearance); bot.setProfile(journey.robot.profile);
  bot.robot.metadata = { ...bot.robot.metadata, name: journey.name, id: journey.robotId };
  const instruments = createStudioInstruments(scene, journey.robot.appearance.height); instruments.setScore(journey.score);
  instruments.root.scaling.set(journey.robot.appearance.width, 1, 1);
  bot.characterAnimation.react('celebrate'); bot.animateTravel(0, .1, true);
  const rig = scene.getTransformNodeByName('character-rig')!;
  const head = scene.getTransformNodeByName('head-rig')!;
  const antenna = scene.getTransformNodeByName('antenna-rig')!;
  const arms = [-1, 1].map(side => scene.getTransformNodeByName(`shoulder-${side}`)!);
  const wheels = [-1, 1].flatMap(side => [-1, 1].map(end => scene.getMeshByName(`wheel-${side}-${end}`)!));
  const choreography = new JourneyDance(journey.score, journey.bpm, journey.artist.musician === 'waltz' ? 3 : 4);
  const motion = reducedMotionPreference();
  let clock: (() => number) | null = null, active = false, dirty = true;
  const resize = () => {
    engine.resize();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const height = Math.max(2.1, (2.05 * journey.robot.appearance.width) / aspect, 2.05 * journey.robot.appearance.height);
    camera.orthoTop = height; camera.orthoBottom = -height; camera.orthoLeft = -height * aspect; camera.orthoRight = height * aspect;
    dirty = true;
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const onMotion = () => { dirty = true; }; motion.addEventListener('change', onMotion);
  const render = () => {
    if (!active || document.hidden || (!dirty && (!clock || motion.matches))) return;
    const pose = choreography.pianoPose(clock?.() ?? 0, !!clock, motion.matches);
    instruments.update(clock?.() ?? 0, !!clock, motion.matches);
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
    enter() { active = true; resize(); render(); },
    play(value: () => number) { clock = value; dirty = true; render(); },
    stop() { clock = null; dirty = true; render(); },
    dispose() { active = false; observer.disconnect(); motion.removeEventListener('change', onMotion); scene.dispose(); engine.dispose(); },
  };
}
