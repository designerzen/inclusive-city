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
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { RobotShapePart } from '../robot/appearance';

export function createWorkshopScene(engine: Engine, changeShape?: (part: RobotShapePart) => void) {
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
  const canvas = engine.getRenderingCanvas();
  const head = scene.getTransformNodeByName('head-rig')!;
  const editing = () => {
    const editor = document.querySelector<HTMLElement>('#designer-screen');
    return !!changeShape && !!editor && !editor.hidden && !editor.closest('[inert]');
  };
  const partForMesh = (mesh: import('@babylonjs/core/Meshes/abstractMesh').AbstractMesh | null | undefined): RobotShapePart | null => {
    if (!mesh?.isDescendantOf(bot.robot)) return null;
    if (mesh.isDescendantOf(head)) return 'head';
    return ['body', 'art-bot-badge', 'tummy-spectrum-frame', 'chest-light'].includes(mesh.name) ? 'body' : null;
  };
  let hoverPointer: { x: number; y: number } | null = null;
  const trackHover = (event: PointerEvent) => {
    hoverPointer = event.pointerType === 'touch' ? null : { x: event.clientX, y: event.clientY };
  };
  const clearHover = () => {
    hoverPointer = null;
    bot.robot.metadata = { ...bot.robot.metadata, shapeHover: null };
    if (canvas) canvas.style.cursor = '';
  };
  scene.hoverCursor = 'default';
  scene.constantlyUpdateMeshUnderPointer = true;
  canvas?.addEventListener('pointerleave', clearHover);
  canvas?.addEventListener('pointermove', trackHover);
  window.addEventListener('blur', clearHover);
  window.addEventListener('resize', clearHover);
  // Keep direct shape editing available without the removed buttons.
  if (canvas) {
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-keyshortcuts', 'H B');
    canvas.setAttribute('aria-describedby', 'shape-keyboard-hint');
  }
  const onKey = (event: KeyboardEvent) => {
    if (!editing() || event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'h' && key !== 'b') return;
    event.preventDefault(); changeShape?.(key === 'h' ? 'head' : 'body');
  };
  canvas?.addEventListener('keydown', onKey);
  scene.onDisposeObservable.add(() => {
    canvas?.removeEventListener('pointerleave', clearHover); canvas?.removeEventListener('keydown', onKey);
    canvas?.removeEventListener('pointermove', trackHover);
    window.removeEventListener('blur', clearHover); window.removeEventListener('resize', clearHover);
  });
  scene.onPointerObservable.add(info => {
    if (!editing()) { clearHover(); return; }
    const part = partForMesh(info.pickInfo?.pickedMesh);
    if (info.type === PointerEventTypes.POINTERTAP && part) changeShape?.(part);
  });
  scene.onBeforeRenderObservable.add(() => {
    if (!document.hidden) {
      const seconds = Math.min(engine.getDeltaTime(), 50) / 1000;
      bot.updateShapeTransition(seconds, reducedMotion.matches);
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
    // Re-pick the current geometry each frame, so a click, rotation or layout
    // change cannot leave an old action hint visible after the pointer moves off.
    let hovered: RobotShapePart | null = null;
    if (editing() && hoverPointer && canvas && !document.hidden) {
      const bounds = canvas.getBoundingClientRect();
      const x = hoverPointer.x - bounds.left, y = hoverPointer.y - bounds.top;
      if (x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height) {
        const scale = engine.getHardwareScalingLevel();
        hovered = partForMesh(scene.pick(x * engine.getRenderWidth() * scale / bounds.width,
          y * engine.getRenderHeight() * scale / bounds.height)?.pickedMesh);
      }
    }
    bot.robot.metadata = { ...bot.robot.metadata, shapeHover: hovered };
    if (canvas && editing()) canvas.style.cursor = hovered ? 'pointer' : '';
  });
  function resize() {
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const compactScale = scene.getTransformNodeByName('model-rig')!.scaling.x;
    const framingScale = 1.3 / compactScale;
    let minY = 0;
    let maxY = 0;
    let radius = 2;
    for (const mesh of bot.robot.getChildMeshes()) {
      if (!mesh.isEnabled()) continue;
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      // Reserve room for the largest model so shrinking never zooms the pedestal.
      minY = Math.min(minY, .25 + (bounds.minimumWorld.y - .25) * framingScale);
      maxY = Math.max(maxY, .25 + (bounds.maximumWorld.y - .25) * framingScale);
      for (const corner of bounds.vectorsWorld) radius = Math.max(radius, Math.hypot(corner.x, corner.z) * framingScale);
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
      const introduction = editor.querySelector<HTMLElement>('.designer-introduction')!.getBoundingClientRect();
      const mobile = bounds.width <= 700;
      const left = mobile ? 62 : 84;
      const right = mobile ? bounds.width - 62 : hud.left - bounds.left - 64;
      const top = introduction.bottom - bounds.top + 12;
      const bottom = Math.min(identity.top, mobile ? hud.top : actions.top) - bounds.top - 12;
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
    scene, resize, setTheme, setName: bot.setName, setShellId: bot.setShellId,
    setProfile(profile: RobotProfile) { bot.setProfile(profile); resize(); },
    feelSettings(change: EditorFeedback) { bot.characterAnimation.feel(change); feedbackSeconds = 2; bot.animateTravel(0, 1 / 60, reducedMotion.matches); },
    setAppearance(appearance: RobotAppearance, animate = false) { bot.setAppearance(appearance, animate && !reducedMotion.matches); if (!animate) bot.characterAnimation.react('pickup'); resize(); },
    setRotating(value: boolean) { rotating = value; },
  };
}
