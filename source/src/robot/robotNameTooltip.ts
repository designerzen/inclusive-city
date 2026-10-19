import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { robotScreenBounds } from './robotScreenBounds';

const canvasLabels = new WeakMap<HTMLCanvasElement, Set<{ scene: Scene; label: HTMLDivElement }>>();
const canvasHover = new WeakMap<HTMLCanvasElement, { scene: Scene; frame: number; mesh: AbstractMesh | null }>();

/** Name labels stay horizontal; autonomous robots only show theirs on hover. */
export function robotNameTooltip(scene: Scene, robot: TransformNode) {
  const engine = scene.getEngine(), canvas = engine.getRenderingCanvas();
  if (!canvas) return { setName(_name: string) {} };
  const tooltip = document.createElement('div');
  tooltip.className = 'robot-name-tooltip';
  tooltip.hidden = true;
  document.body.append(tooltip);
  let name = '';
  let labels = canvasLabels.get(canvas);
  if (!labels) { labels = new Set(); canvasLabels.set(canvas, labels); }
  const entry = { scene, label: tooltip };
  labels.add(entry);
  const hide = () => { tooltip.hidden = true; };
  let pointer: { x: number; y: number } | null = null;
  const onPointerMove = (event: PointerEvent) => {
    pointer = event.pointerType === 'touch' || event.buttons ? null : { x: event.clientX, y: event.clientY };
    canvasHover.delete(canvas);
  };
  const onPointerLeave = () => { pointer = null; canvasHover.delete(canvas); if (robot.metadata?.autonomous) hide(); };
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerLeave);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointercancel', onPointerLeave);
  const onVisibility = () => { if (document.hidden) hide(); };
  document.addEventListener('visibilitychange', onVisibility);
  const observer = scene.onAfterRenderObservable.add(() => {
    // The canvas is shared: labels from a previous screen must leave with it.
    for (const other of labels) if (other.scene !== scene) other.label.hidden = true;
    hide();
    if (document.hidden || robot.metadata?.hideNameTooltip || !robot.isEnabled() || !scene.activeCamera) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    if (robot.metadata?.autonomous) {
      if (!pointer) return;
      let hover = canvasHover.get(canvas);
      if (!hover || hover.scene !== scene || hover.frame !== scene.getFrameId()) {
        // Include non-interactive city robots without making them clickable.
        const mesh = scene.pick(pointer.x - bounds.left, pointer.y - bounds.top,
          mesh => mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && (mesh.isPickable || !!mesh.metadata?.autonomousBot))?.pickedMesh ?? null;
        hover = { scene, frame: scene.getFrameId(), mesh };
        canvasHover.set(canvas, hover);
      }
      if (!hover.mesh?.isDescendantOf(robot)) return;
    }
    const viewport = scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const projected = robotScreenBounds(robot, scene.getTransformMatrix(), viewport);
    if (!projected) return;
    const x = bounds.left + (projected.left + projected.right) / 2 * bounds.width / engine.getRenderWidth();
    const y = bounds.top + projected.top * bounds.height / engine.getRenderHeight();
    if (x < bounds.left || x > bounds.right || y > bounds.bottom || y < bounds.top) return;
    tooltip.hidden = false;
    const hint = robot.metadata?.shapeHover;
    const text = hint ? `Click to change ${hint} shape` : name;
    if (tooltip.textContent !== text) tooltip.textContent = text;
    tooltip.style.left = `${Math.max(tooltip.offsetWidth / 2 + 8, Math.min(window.innerWidth - tooltip.offsetWidth / 2 - 8, x))}px`;
    const top = y - tooltip.offsetHeight - 12;
    // Never clamp downward over the robot when there is no room above it.
    if (top < Math.max(8, bounds.top + 8)) { hide(); return; }
    tooltip.style.top = `${top}px`;
  });
  scene.onDisposeObservable.add(() => {
    scene.onAfterRenderObservable.remove(observer);
    labels.delete(entry); tooltip.remove();
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerLeave);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointercancel', onPointerLeave);
  });
  return { setName(value: string) { name = value; tooltip.textContent = name; } };
}
