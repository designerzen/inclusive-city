import type { Engine } from '@babylonjs/core/Engines/engine';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

export type CityView = 'overhead' | 'angled' | 'follow' | 'robot-eye';

export function createCityCamera(engine: Engine, scene: Scene, robotPose: () => { position: Vector3; heading: number; eyeHeight: number }) {
  const camera = new UniversalCamera('city-camera', new Vector3(0, 55, -0.01), scene);
  camera.minZ = 0.05;
  camera.maxZ = 200;
  scene.activeCamera = camera;
  let view: CityView = 'overhead';
  let zoom = 1;
  const target = Vector3.Zero();
  const canPan = () => view === 'overhead' || view === 'angled';

  function update() {
    const aspect = Math.max(0.1, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
    const halfHeight = Math.max(24, 29 / aspect) * zoom;
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
  function setView(value: CityView) { view = value; zoom = 1; update(); }
  function setZoom(factor: number) { zoom = Math.max(0.3, Math.min(1.5, zoom * factor)); update(); }
  function pan(x: number, z: number) {
    if (!canPan()) return;
    target.x = Math.max(-25, Math.min(25, target.x + x));
    target.z = Math.max(-20, Math.min(20, target.z + z));
    update();
  }
  function fit() { target.setAll(0); setView('overhead'); }
  function focus(x: number, z: number, scale = 0.3) { target.set(x, 0, z); zoom = scale; update(); }
  update();
  return { camera, update, setView, setZoom, pan, fit, focus, canPan, get view() { return view; } };
}
