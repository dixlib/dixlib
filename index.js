import bootSystem from "./build/boot.js"
import * as standardBindings from "./build/bindings.js"

export default async function startSystem(bundleStack) {
  return bootSystem([standardBindings, ...await detectPlatform(), ...bundleStack])
}

// ----------------------------------------------------------------------------------------------------------------- //
async function detectPlatform() {
  // dynamically import system bindings for other platforms than a web worker 
  return typeof process !== 'undefined' ? [await import("./platform/nodejs/build/bindings.js")] :
    // stick to standard bindings
    []
}
