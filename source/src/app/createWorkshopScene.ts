import { reducedMotionPreference } from './accessibilityPreferences';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import type { Theme } from './theme';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createRobot } from '../robot/createRobot';
import type { RobotProfile } from '../robot/functions';
import type { RobotAppearance } from '../robot/appearance';
import type { EditorFeedback } from '../robot/editorFeedback';
import { createPointerAttention } from '../robot/pointerAttention';

export function createWorkshopScene(engine: Engine) {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString('#102a2bff');
  const camera = new UniversalCamera('workshop-camera', new Vector3(0, 2.4, -10), scene);
  camera.setTarget(new Vector3(0, 2.4, 0));
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 50;
  const light = new HemisphericLight('workshop-light', new Vector3(-1, 2, -2), scene);
  light.intensity = 1.2;
  light.groundColor = Color3.FromHexString('#34575b');
  const bot = createRobot(scene);
  const pointerAttention = createPointerAttention(scene, engine, bot.robot);
  const platform = MeshBuilder.CreateCylinder('platform', { diameter: 4, height: 0.25, tessellation: 64 }, scene);
  platform.position.y = 0.125;
  const platformMaterial = new StandardMaterial('platform', scene);
  platformMaterial.diffuseColor = Color3.FromHexString('#31585a');
  platform.material = platformMaterial;
  function setTheme(theme: Theme) {
    scene.clearColor = Color4.FromHexString(theme === 'light' ? '#e2eee9ff' : '#102a2bff');
    platformMaterial.diffuseColor = Color3.FromHexString(theme === 'light' ? '#9bbdb2' : '#31585a');
    light.groundColor = Color3.FromHexString(theme === 'light' ? '#b0c8c0' : '#34575b');
  }
  let rotating = true;
  let feedbackSeconds = 0;
  const reducedMotion = reducedMotionPreference();
  scene.onBeforeRenderObservable.add(() => {
    if (!document.hidden) {
      const seconds = Math.min(engine.getDeltaTime(), 50) / 1000;
      const attention = pointerAttention.update(seconds);
      bot.setAttention(attention);
      const notice = bot.robot.metadata?.enabledFunctions?.includes('vision') === false ? 0 : attention.amount;
      if (rotating && notice < .02 && !reducedMotion.matches) bot.robot.rotation.y += seconds * .35;
      else if (rotating && !reducedMotion.matches) {
        const turn = Math.atan2(Math.sin(-bot.robot.rotation.y), Math.cos(-bot.robot.rotation.y));
        bot.robot.rotation.y += turn * (1 - Math.exp(-seconds * 5));
      }
      if (rotating || feedbackSeconds > 0 || notice > .001 || reducedMotion.matches) bot.animateTravel(0, seconds, reducedMotion.matches);
      feedbackSeconds = Math.max(0, feedbackSeconds - seconds);
    }
  });
  function resize() {
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    let minY = 0;
    let maxY = 0;
    let radius = 2;
    for (const mesh of bot.robot.getChildMeshes()) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      minY = Math.min(minY, bounds.minimumWorld.y);
      maxY = Math.max(maxY, bounds.maximumWorld.y);
      for (const corner of bounds.vectorsWorld) radius = Math.max(radius, Math.hypot(corner.x, corner.z));
    }
    const centre = (minY + maxY) / 2;
    camera.position.y = centre;
    camera.setTarget(new Vector3(0, centre, 0));
    const halfHeight = Math.max((maxY - minY) / 2 + 0.45, (radius + 0.3) / Math.max(0.01, aspect));
    camera.orthoTop = halfHeight;
    camera.orthoBottom = -halfHeight;
    camera.orthoLeft = -halfHeight * aspect;
    camera.orthoRight = halfHeight * aspect;
    const canvas = engine.getRenderingCanvas();
    const editor = document.querySelector<HTMLElement>('#designer-screen');
    if (canvas && editor && !editor.hidden && editor.contains(canvas)) {
      const bounds = canvas.getBoundingClientRect();
      const hud = editor.querySelector<HTMLElement>('#ability-designer')!.getBoundingClientRect();
      const identity = editor.querySelector<HTMLElement>('.bot-identity')!.getBoundingClientRect();
      const actions = editor.querySelector<HTMLElement>('.designer-next')!.getBoundingClientRect();
      const mobile = bounds.width <= 700;
      const left = mobile ? 62 : 84;
      const right = mobile ? bounds.width - 62 : hud.left - bounds.left - 64;
      const top = identity.bottom - bounds.top + 12;
      const bottom = (mobile ? hud.top : actions.top) - bounds.top - 12;
      const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
      const scale = 2 * Math.max((maxY - minY) / 2 + .45, (radius + .3) / (width / height)) / height;
      const x = (left + right) / 2, y = (top + bottom) / 2;
      camera.orthoLeft = -x * scale;
      camera.orthoRight = (bounds.width - x) * scale;
      camera.orthoTop = y * scale;
      camera.orthoBottom = -(bounds.height - y) * scale;
    }
  }
  return {
    scene, resize, setTheme,
    setProfile(profile: RobotProfile) { bot.setProfile(profile); resize(); },
    feelSettings(change: EditorFeedback) { bot.characterAnimation.feel(change); feedbackSeconds = 2; bot.animateTravel(0, 1 / 60, reducedMotion.matches); },
    setAppearance(appearance: RobotAppearance) { bot.setAppearance(appearance); bot.characterAnimation.react('pickup'); resize(); },
    setRotating(value: boolean) { rotating = value; },
  };
}
