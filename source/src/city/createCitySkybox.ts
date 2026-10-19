import type { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Theme } from '../app/theme';

/** A camera-centred skybox: a still, illustrated sky behind the distant buildings. */
export function createCitySkybox(scene: Scene) {
  const material = new ShaderMaterial('city-skybox', scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      uniform mat4 worldViewProjection;
      varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        gl_Position = worldViewProjection * vec4(position, 1.0);
        // Keep the sky at the far plane in both orthographic and perspective views.
        gl_Position.z = gl_Position.w * 0.999999;
      }
    `,
    fragmentSource: `
      precision highp float;
      varying vec3 skyDirection;
      uniform vec3 zenithColour;
      uniform vec3 horizonColour;
      uniform vec3 lowerColour;
      uniform vec3 cloudColour;
      void main() {
        vec3 direction = normalize(skyDirection);
        float height = max(0.0, direction.y);
        vec3 colour = mix(horizonColour, zenithColour, pow(height, 0.65));
        colour = mix(colour, lowerColour, smoothstep(0.0, 0.3, -direction.y));
        // Broad, fixed cloud ribbons wrap seamlessly around all four sides.
        float ribbon = sin(direction.x * 10.0 + direction.z * 5.0
          + sin(direction.z * 9.0) * 0.7 + direction.y * 28.0);
        float clouds = smoothstep(0.4, 0.95, ribbon)
          * smoothstep(0.05, 0.2, height) * (1.0 - smoothstep(0.45, 0.8, height));
        colour = mix(colour, cloudColour, clouds * 0.16);
        gl_FragColor = vec4(colour, 1.0);
      }
    `,
  }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'zenithColour', 'horizonColour', 'lowerColour', 'cloudColour'],
  });
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  const mesh = MeshBuilder.CreateBox('city-skybox', { size: 1000 }, scene);
  mesh.infiniteDistance = true;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.isPickable = false;
  mesh.material = material;

  function setTheme(theme: Theme) {
    const dark = theme === 'dark';
    material.setColor3('zenithColour', Color3.FromHexString(dark ? '#101c30' : '#86b5d0'));
    material.setColor3('horizonColour', Color3.FromHexString(dark ? '#495460' : '#e5ece9'));
    material.setColor3('lowerColour', Color3.FromHexString(dark ? '#171717' : '#ededed'));
    material.setColor3('cloudColour', Color3.FromHexString(dark ? '#8595ac' : '#ffffff'));
  }
  setTheme('dark');
  return { mesh, material, setTheme };
}
