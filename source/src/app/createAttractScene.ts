import { reducedMotionPreference } from './accessibilityPreferences';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { createRobot } from '../robot/createRobot';
import { attractBpm } from '../audio/attractMusic';

export function createAttractScene(engine: Engine, canvas: HTMLCanvasElement, isPaused: () => boolean) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new UniversalCamera('attract-camera', new Vector3(0, 3.8, -12), scene);
  camera.setTarget(new Vector3(0, 2, 0));
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  const light = new HemisphericLight('dance-light', new Vector3(-1, 2, -3), scene);
  light.intensity = 1.5; light.groundColor = Color3.FromHexString('#645194');
  const rim = new PointLight('pink-rim', new Vector3(4, 4, 0), scene);
  rim.diffuse = Color3.FromHexString('#ff78c9'); rim.intensity = 1.4;
  const bot = createRobot(scene);
  bot.characterAnimation.react('pickup');
  const rig = scene.getTransformNodeByName('character-rig')!;
  const head = scene.getTransformNodeByName('head-rig')!;
  const arms = [-1, 1].map(side => scene.getTransformNodeByName(`shoulder-${side}`)!);
  const motion = reducedMotionPreference();
  let time = 0, active = true;
  const resize = () => {
    engine.resize();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const height = Math.max(2.65, 2.5 / aspect);
    camera.orthoTop = height; camera.orthoBottom = -height;
    camera.orthoLeft = -height * aspect; camera.orthoRight = height * aspect;
  };
  const observer = new ResizeObserver(() => { if (active) resize(); }); observer.observe(canvas); resize();
  const render = () => {
    if (!active || document.hidden) return;
    if (!isPaused() && !motion.matches) {
      const delta = Math.min(engine.getDeltaTime(), 50) / 1000;
      time += delta;
      const beat = time * attractBpm / 60 * Math.PI * 2;
      bot.animateTravel(.025 * delta, delta);
      bot.robot.rotation.y = -.28 + Math.sin(beat / 4) * .48;
      bot.robot.position.x = Math.sin(beat / 2) * .22;
      rig.position.y = .08 + (1 - Math.cos(beat * 2)) * .08;
      rig.rotation.z = Math.sin(beat) * .13;
      rig.scaling.y = 1 + Math.sin(beat * 2) * .045;
      head.rotation.z = Math.sin(beat / 2 + .5) * .17;
      head.rotation.y = Math.sin(beat / 4) * .25;
      arms.forEach((arm, index) => {
        const side = index ? 1 : -1;
        arm.rotation.z = side * (.95 + Math.sin(beat / 2 + index * Math.PI) * .7);
        arm.rotation.x = Math.cos(beat / 2 + index * Math.PI) * .5;
      });
    }
    scene.render();
  };
  engine.runRenderLoop(render);
  return {
    enter() { active = true; resize(); },
    leave() { active = false; },
    dispose() { active = false; engine.stopRenderLoop(render); observer.disconnect(); scene.dispose(); },
  };
}
