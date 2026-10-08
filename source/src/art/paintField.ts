import { paintRandom } from './paintRandom';

/** Named seed streams, inspired by Highlight's hl-utils and advanced dice example.
 * Independent implementation: no browser globals, token API or external runtime.
 */
export function paintStream(seed: number, name: string) {
  let hash = seed >>> 0;
  for (const letter of name) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return paintRandom(hash);
}

/** Smooth, coordinate-addressed noise: sampling never advances a random stream. */
export function paintNoise(seed: number, x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const value = (a: number, b: number) => {
    let n = seed ^ Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
  };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(mix(value(ix, iy), value(ix + 1, iy), smooth(fx)),
    mix(value(ix, iy + 1), value(ix + 1, iy + 1), smooth(fx)), smooth(fy));
}
