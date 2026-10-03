import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';

// Serve the WASM through Vite in both development and production; no runtime CDN.
let havok: ReturnType<typeof HavokPhysics> | undefined;
export function loadCityPhysics() {
  return havok ??= HavokPhysics({ locateFile: () => havokWasmUrl }).catch(error => { havok = undefined; throw error; });
}
