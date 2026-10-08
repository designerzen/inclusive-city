import type { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Theme } from '../app/theme';

/** An illustrated current, drawn in world metres so resizing never stretches the ripples. */
export function createRiver(scene: Scene, x: number) {
  const material = new ShaderMaterial('river-water', scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      uniform mat4 world;
      uniform mat4 worldViewProjection;
      varying vec3 waterPosition;
      void main() {
        waterPosition = (world * vec4(position, 1.0)).xyz;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `,
    fragmentSource: `
      precision highp float;
      varying vec3 waterPosition;
      uniform float riverX;
      uniform float flowTime;
      uniform vec3 deepColour;
      uniform vec3 shallowColour;
      uniform vec3 foamColour;
      void main() {
        float x = waterPosition.x - riverX;
        float z = waterPosition.z;
        float edge = abs(x) / 3.5;
        float drift = z - flowTime * 0.85;
        float wash = 0.5 + 0.5 * sin(x * 2.8 + sin(drift * 0.7) * 0.5);
        vec3 colour = mix(deepColour, shallowColour,
          0.12 + 0.5 * pow(edge, 2.0) + 0.12 * wash);

        // Broken, gently winding ribbons travel along the river rather than flashing.
        float lane = floor((x + 3.5) / 1.15);
        float centre = -2.925 + lane * 1.15;
        float bend = 0.14 * sin(drift * 1.3 + lane * 2.1);
        float ribbon = 1.0 - smoothstep(0.025, 0.075, abs(x - centre - bend));
        float segment = fract(drift / 4.6 + lane * 0.37);
        float broken = smoothstep(0.08, 0.2, segment) * (1.0 - smoothstep(0.55, 0.78, segment));
        float current = ribbon * broken * (1.0 - smoothstep(0.82, 0.97, edge));

        // Short crosswise crescent ripples give the surface a recognisable water motif.
        float ripplePhase = fract(drift / 3.1 + lane * 0.63);
        float localX = x - centre;
        float arc = abs(ripplePhase * 3.1 - 1.5 - localX * localX * 0.65);
        float ripple = (1.0 - smoothstep(0.025, 0.065, arc))
          * (1.0 - smoothstep(0.22, 0.43, abs(localX)));
        float bank = smoothstep(3.27, 3.4, abs(x))
          * (1.0 - smoothstep(3.43, 3.5, abs(x)));
        float bankFoam = bank * (0.35 + 0.15 * sin(z * 3.0 - flowTime));
        colour = mix(colour, foamColour, current * 0.5 + ripple * 0.65 + bankFoam);
        gl_FragColor = vec4(colour, 1.0);
      }
    `,
  }, {
    attributes: ['position'],
    uniforms: ['world', 'worldViewProjection', 'riverX', 'flowTime', 'deepColour', 'shallowColour', 'foamColour'],
  });
  material.setFloat('riverX', x);
  material.setFloat('flowTime', 0);
  const mesh = MeshBuilder.CreateBox('river', { width: 7, height: 0.05, depth: 1 }, scene);
  mesh.position.set(x, -0.025, 0);
  mesh.material = material;
  mesh.isPickable = false;
  let time = 0;
  function setTheme(theme: Theme) {
    const dark = theme === 'dark';
    material.setColor3('deepColour', Color3.FromHexString(dark ? '#123d4c' : '#28788e'));
    material.setColor3('shallowColour', Color3.FromHexString(dark ? '#327b87' : '#63aeb7'));
    material.setColor3('foamColour', Color3.FromHexString(dark ? '#9ad6d6' : '#d1eeeb'));
  }
  setTheme('dark');
  return {
    mesh, setTheme,
    update(seconds: number, reducedMotion: boolean) {
      if (reducedMotion) return;
      time += Math.max(0, Math.min(seconds, 0.1));
      material.setFloat('flowTime', time);
    },
  };
}
