import type { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import skylineTextureUrl from './assets/skyline.svg?url';
import type { Theme } from '../app/theme';

/** A camera-centred sky and panoramic skyline, without surrounding building geometry. */
export function createCitySkybox(scene: Scene) {
  const skylineTexture = new Texture(skylineTextureUrl, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
  skylineTexture.hasAlpha = true;
  skylineTexture.wrapU = Texture.WRAP_ADDRESSMODE;
  skylineTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
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
      uniform vec3 skylineNearColour;
      uniform vec3 skylineFarColour;
      uniform sampler2D skylineTexture;
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
        // Cylindrical mapping keeps the panorama continuous across the cube corners.
        float azimuth = atan(direction.x, direction.z) / 6.28318530718 + 0.5;
        float elevation = atan(direction.y, length(direction.xz));
        if (elevation < 0.24) {
          vec4 skyline = texture2D(skylineTexture,
            vec2(azimuth, clamp(1.0 - elevation / 0.24, 0.0, 1.0)));
          vec3 buildings = mix(skylineFarColour, skylineNearColour,
            clamp((skyline.r - 0.5) * 2.0, 0.0, 1.0));
          colour = mix(colour, buildings, skyline.a);
        }
        gl_FragColor = vec4(colour, 1.0);
      }
    `,
  }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'zenithColour', 'horizonColour', 'lowerColour', 'cloudColour', 'skylineNearColour', 'skylineFarColour'],
    samplers: ['skylineTexture'],
  });
  material.setTexture('skylineTexture', skylineTexture);
  scene.onDisposeObservable.addOnce(() => skylineTexture.dispose());
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
    material.setColor3('skylineNearColour', Color3.FromHexString(dark ? '#303a40' : '#a0b1ba'));
    material.setColor3('skylineFarColour', Color3.FromHexString(dark ? '#3c4752' : '#c0cdd2'));
  }
  setTheme('dark');
  return { mesh, material, setTheme };
}
