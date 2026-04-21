/// <reference path="src/api.d.ts"/>
import * as standardBindings from "./build/bindings.js"
import bootSystem from "./build/boot.js"
import * as nodejsBindings from "./nodejs-kernel/build/bindings.js"

/**
 * Start a new system in this JavaScript runtime environment.
 *
 * @param {import("std.loader").default.Bindings[]} bundleStack Service bindings for the new system
 * @returns {Promise<import("std.system").default>} A promise to provide the `std.system` service
 */
export default function startSystem(bundleStack) {
  // start with standard bindings
  const bundles = typeof process === "undefined" ? [standardBindings] : [standardBindings, nodejsBindings]
  // add non-standard bindings
  bundles.push(...bundleStack)
  return bootSystem(bundles)
}
