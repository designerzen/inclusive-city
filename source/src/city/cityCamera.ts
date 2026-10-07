import type { Engine } from '@babylonjs/core/Engines/engine';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

export type CityView = 'overhead' | 'angled' | 'follow' | 'robot-eye';

export function createCityCamera(engine: Engine, scene: Scene, robotPose: () => { position: Vector3; heading: number; eyeHeight: number }, bounds = () => ({ width: 58, depth: 48 })) {
  const camera = new UniversalCamera('city-camera', new Vector3(0, 55, -0.01), scene);
  camera.minZ = 0.05;
  camera.maxZ = 200;
  scene.activeCamera = camera;
  let view: CityView = 'overhead';
  let zoom = 1;
  let arrival: { elapsed: number; position: Vector3; target: Vector3 } | null = null;
  let performanceTime = 0;
  const target = Vector3.Zero();
  const canPan = () => view === 'overhead' || view === 'angled';

  function update(seconds = 0, reducedMotion = false) {
    const aspect = Math.max(0.1, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
    if (arrival) {
      arrival.elapsed = reducedMotion ? 8 : Math.min(8, arrival.elapsed + Math.max(0, seconds));
      const pose = robotPose();
      const eyes = pose.position.add(new Vector3(0, pose.eyeHeight, 0));
      const wide = Math.min(1, performanceTime / 4);
      eyes.y -= pose.eyeHeight * .4 * wide;
      const smooth = (t: number) => t * t * (3 - 2 * t);
      const approach = smooth(Math.min(1, arrival.elapsed / 2));
      const descent = smooth(Math.max(0, Math.min(1, (arrival.elapsed - 4) / 4)));
      const angle = pose.heading + Math.PI * 2 * smooth(Math.min(1, arrival.elapsed / 6));
      const radius = 7 * (1 - descent) + (1.8 + 2.2 * wide) * descent;
      const orbit = eyes.add(new Vector3(-Math.sin(angle) * radius, 6 * (1 - descent) + .4 * wide, -Math.cos(angle) * radius));
      camera.mode = Camera.PERSPECTIVE_CAMERA;
      camera.fov = Math.max(.8, 2 * Math.atan(.7 / aspect));
      camera.position.copyFrom(Vector3.Lerp(arrival.position, orbit, approach));
      camera.setTarget(Vector3.Lerp(arrival.target, eyes, approach));
      return;
    }
    const extent = bounds();
    const halfHeight = Math.max(24, extent.depth / 2, Math.max(29, extent.width / 2) / aspect) * zoom;
    camera.orthoTop = halfHeight;
    camera.orthoBottom = -halfHeight;
    camera.orthoLeft = -halfHeight * aspect;
    camera.orthoRight = halfHeight * aspect;
    camera.mode = canPan() ? Camera.ORTHOGRAPHIC_CAMERA : Camera.PERSPECTIVE_CAMERA;
    camera.fov = view === 'robot-eye' ? Math.max(0.35, Math.min(1.3, 0.9 * zoom)) : 0.8;
    if (canPan()) {
      camera.position.set(target.x, 55, target.z - (view === 'angled' ? 55 : 0.01));
      camera.setTarget(target);
      return;
    }
    const pose = robotPose();
    // The robot's face points along local -Z.
    const forward = new Vector3(-Math.sin(pose.heading), 0, -Math.cos(pose.heading));
    const eyes = pose.position.add(new Vector3(0, pose.eyeHeight, 0));
    if (view === 'follow') {
      camera.position.copyFrom(eyes.subtract(forward.scale(8 * zoom)).add(new Vector3(0, 5 * zoom, 0)));
      camera.setTarget(eyes.add(forward.scale(2)));
    } else {
      camera.position.copyFrom(eyes);
      camera.setTarget(eyes.add(forward.scale(10)));
    }
  }
  function setView(value: CityView) { arrival = null; performanceTime = 0; view = value; zoom = 1; update(); }
  function setZoom(factor: number) { if (arrival) return; zoom = Math.max(0.3, Math.min(1.5, zoom * factor)); update(); }
  function pan(x: number, z: number) {
    if (arrival || !canPan()) return;
    target.x = Math.max(-25, Math.min(25, target.x + x));
    target.z = Math.max(-20, Math.min(20, target.z + z));
    update();
  }
  function fit() { target.setAll(0); setView('overhead'); }
  function focus(x: number, z: number, scale = 0.3) { target.set(x, 0, z); zoom = scale; update(); }
  update();
  return { camera, update, setView, setZoom, pan, fit, focus, canPan,
    beginArrival() { arrival = { elapsed: 0, position: camera.position.clone(), target: camera.getTarget().clone() }; },
    setPerformanceTime(seconds: number) { performanceTime = Math.max(0, seconds); },
    get arrivalComplete() { return !!arrival && arrival.elapsed >= 8; },
    get view() { return view; } };
}
