/// <reference path="src/api.d.ts"/>
import * as standardBindings from "./build/bindings.js"
import bootSystem from "./build/boot.js"

/**
 * Start a new system in this JavaScript runtime environment.
 * 
 * @param {import("std.loader").default.Bindings[]} bundleStack Service bindings for the new system
 * @returns {Promise<import("std.system").default>} A promise to provide the `std.system` service
 */
export default async function startSystem(bundleStack) {
  // start with standard bindings for web workers
  const bundles = [standardBindings]
  if (typeof process !== "undefined") {
    // redefine std.kernel provider for NodeJs, Deno or Bun
    bundles.push(await import("./nodejs-kernel/build/bindings.js"))
  }
  // add non-standard bindings
  bundles.push(...bundleStack)
  return bootSystem(bundles)
}
