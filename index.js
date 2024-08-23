import bootSystem from "./build/boot.js"
import * as standardBindings from "./build/bindings.js"
import * as nodejsBindings from "./platform/nodejs/build/bindings.js"

export default function startSystem(bundleStack) {
  return bootSystem([standardBindings, ...detectPlatform(), ...bundleStack])
}

// ----------------------------------------------------------------------------------------------------------------- //
function detectPlatform() {
  if (typeof process !== 'undefined') {
    return [nodejsBindings]
  } else {
    return []
  }
}
