import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';

const canvasLabels = new WeakMap<HTMLCanvasElement, Set<{ scene: Scene; label: HTMLDivElement }>>();

/** Persistent name labels stay horizontal above their robot as it turns. */
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
  const onVisibility = () => { if (document.hidden) hide(); };
  document.addEventListener('visibilitychange', onVisibility);
  const observer = scene.onAfterRenderObservable.add(() => {
    // The canvas is shared: labels from a previous screen must leave with it.
    for (const other of labels) if (other.scene !== scene) other.label.hidden = true;
    hide();
    if (document.hidden || !robot.isEnabled() || !scene.activeCamera) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const viewport = scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    robot.computeWorldMatrix(true);
    const point = Vector3.Project(Vector3.TransformCoordinates(new Vector3(0, 4.2, 0), robot.getWorldMatrix()), Matrix.Identity(), scene.getTransformMatrix(), viewport);
    if (point.z < 0 || point.z > 1) return;
    const x = bounds.left + point.x * bounds.width / engine.getRenderWidth();
    const y = bounds.top + point.y * bounds.height / engine.getRenderHeight();
    if (x < bounds.left || x > bounds.right || y > bounds.bottom || y < bounds.top) return;
    tooltip.hidden = false;
    const hint = robot.metadata?.shapeHover;
    const text = hint ? `Click to change ${hint} shape` : name;
    if (tooltip.textContent !== text) tooltip.textContent = text;
    tooltip.style.left = `${Math.max(tooltip.offsetWidth / 2 + 8, Math.min(window.innerWidth - tooltip.offsetWidth / 2 - 8, x))}px`;
    tooltip.style.top = `${Math.max(8, y - tooltip.offsetHeight - 12)}px`;
  });
  scene.onDisposeObservable.add(() => {
    scene.onAfterRenderObservable.remove(observer);
    labels.delete(entry); tooltip.remove();
    document.removeEventListener('visibilitychange', onVisibility);
  });
  return { setName(value: string) { name = value; tooltip.textContent = name; } };
}
