import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Viewport } from '@babylonjs/core/Maths/math.viewport';

/** Project every visible part, including accessories and animated/scaled rigs. */
export function robotScreenBounds(robot: TransformNode, transform: Matrix, viewport: Viewport) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const mesh of robot.getChildMeshes()) {
    if (!mesh.isEnabled() || !mesh.isVisible || mesh.visibility <= 0 || !mesh.getTotalVertices()) continue;
    mesh.computeWorldMatrix(true);
    for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
      const point = Vector3.Project(corner, Matrix.IdentityReadOnly, transform, viewport);
      // A part crossing the camera plane cannot have a safe screen-space label.
      if (point.z < 0 || point.z > 1) return null;
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
      top = Math.min(top, point.y);
      bottom = Math.max(bottom, point.y);
    }
  }
  return Number.isFinite(top) ? { left, right, top, bottom } : null;
}
