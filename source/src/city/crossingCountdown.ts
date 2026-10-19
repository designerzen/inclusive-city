import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { crossingCountdown, type crossingSignal } from './trafficSignals';

/** Screen-space labels follow the signal heads without intercepting city controls. */
export function createCrossingCountdown(scene: Scene, head: AbstractMesh,
  signal: () => ReturnType<typeof crossingSignal>, greenSeconds: () => number) {
  const canvas = scene.getEngine().getRenderingCanvas();
  if (!canvas || typeof document === 'undefined') return;
  const label = document.createElement('div');
  label.className = 'crossing-countdown';
  label.hidden = true;
  // A timer can be read on demand without announcing every frame/second.
  label.setAttribute('role', 'timer');
  label.setAttribute('aria-live', 'off');
  const text = document.createElement('span');
  const track = document.createElement('span');
  track.className = 'crossing-countdown-track';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  track.append(fill); label.append(text, track); document.body.append(label);
  const engine = scene.getEngine();
  const observer = scene.onAfterRenderObservable.add(() => {
    label.hidden = true;
    if (document.hidden || !scene.activeCamera || !head.isEnabled() || !head.isVisible) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const point = Vector3.Project(head.getAbsolutePosition().add(new Vector3(0, .65, 0)),
      Matrix.IdentityReadOnly, scene.getTransformMatrix(),
      scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    if (point.z < 0 || point.z > 1) return;
    const x = bounds.left + point.x * bounds.width / engine.getRenderWidth();
    const y = bounds.top + point.y * bounds.height / engine.getRenderHeight();
    const state = signal(), countdown = crossingCountdown(state, greenSeconds());
    if (text.textContent !== countdown.text) {
      text.textContent = countdown.text;
      label.setAttribute('aria-label', `${countdown.description}: ${Math.ceil(state.green ? state.remaining : state.untilGreen)} seconds`);
    }
    label.dataset.phase = state.green ? 'cross' : 'wait';
    fill.style.transform = `scaleX(${countdown.progress})`;
    label.hidden = false;
    const half = label.offsetWidth / 2, height = label.offsetHeight;
    if (x < bounds.left || x > bounds.right
      || y - height - 8 < Math.max(8, bounds.top) || y > bounds.bottom) { label.hidden = true; return; }
    label.style.left = `${Math.max(Math.max(8, bounds.left) + half,
      Math.min(Math.min(window.innerWidth - 8, bounds.right) - half, x))}px`;
    label.style.top = `${y - height - 8}px`;
  });
  scene.onDisposeObservable.add(() => {
    scene.onAfterRenderObservable.remove(observer);
    label.remove();
  });
}
