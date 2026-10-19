import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { createRobot } from '../src/robot/createRobot';
import { defaultAppearance, robotAccessories } from '../src/robot/appearance';
import { robotScreenBounds } from '../src/robot/robotScreenBounds';

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test(`tooltip anchor clears scaled, rotated robots and accessories at ${width} × ${height}`, () => {
    const engine = new NullEngine({ renderWidth: width, renderHeight: height, textureSize: 512,
      deterministicLockstep: false, lockstepMaxSteps: 4 }), scene = new Scene(engine);
    try {
      const camera = new FreeCamera('camera', new Vector3(0, 5, -18), scene);
      camera.setTarget(new Vector3(0, 3, 0));
      const bot = createRobot(scene);
      bot.setAppearance({ ...defaultAppearance(), accessories: robotAccessories.map(item => item.id) });
      const robot = scene.getTransformNodeByName('artbot')!;
      robot.scaling.setAll(1.6);
      robot.rotation.z = .25;
      bot.animateTravel(.2, .1);
      scene.render();
      const viewport = new Viewport(0, 0, width, height);
      const transform = scene.getTransformMatrix();
      const bounds = robotScreenBounds(robot, transform, viewport)!;
      assert.ok(bounds);
      const oldAnchor = Vector3.Project(Vector3.TransformCoordinates(new Vector3(0, 4.2, 0), robot.getWorldMatrix()), Matrix.Identity(), transform, viewport);
      assert.ok(bounds.top < oldAnchor.y, 'fixed anchor would overlap this robot');
      for (const mesh of robot.getChildMeshes()) {
        if (!mesh.isEnabled() || !mesh.isVisible || mesh.visibility <= 0) continue;
        const positions = mesh.getVerticesData('position') ?? [];
        for (let i = 0; i < positions.length; i += 3) {
          const point = Vector3.Project(new Vector3(positions[i], positions[i + 1], positions[i + 2]), mesh.getWorldMatrix(), transform, viewport);
          assert.ok(point.y >= bounds.top - .001, `${mesh.name} stays below the tooltip anchor`);
        }
      }
      const hidden = MeshBuilder.CreateBox('hidden-high-part', { size: 1 }, scene);
      hidden.parent = robot;
      hidden.position.y = 8;
      hidden.isVisible = false;
      assert.deepEqual(robotScreenBounds(robot, transform, viewport), bounds);
      hidden.isVisible = true;
      assert.ok(robotScreenBounds(robot, transform, viewport)!.top < bounds.top);
    } finally { scene.dispose(); engine.dispose(); }
  });
}
