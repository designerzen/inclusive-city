import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { RoutePoint } from './cityLayout';

/** A visual finish marker. Its pole and cloth must not become journey obstacles. */
export function createGoalFlag(scene: Scene, goal: RoutePoint, poleMaterial: StandardMaterial, black: StandardMaterial, white: StandardMaterial) {
  const pole = MeshBuilder.CreateBox('goal-flagpole', { width: .15, height: 6.9, depth: .15 }, scene);
  pole.position.set(goal.x + 1.2, 3.45, goal.z); pole.material = poleMaterial; pole.isPickable = false;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const square = MeshBuilder.CreateBox(`goal-flag-${row}-${col}`, { width: .5, height: .5, depth: .08 }, scene);
    square.position.set(goal.x + 1.5 + col * .5, 6.6 - row * .5, goal.z);
    square.material = (row + col) % 2 ? black : white; square.isPickable = false;
  }
}
