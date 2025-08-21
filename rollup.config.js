import { glob } from "node:fs/promises"
import { extname, relative } from "node:path"
import json from "@rollup/plugin-json"
import terser from "@rollup/plugin-terser"
import typescript from "@rollup/plugin-typescript"

/***
 * @type {import("rollup").RollupOptions}
 */
export default {
  input: await entryPoints([
    "src/boot.ts",
    "src/bindings.ts",
    "src/*/extern.ts",
    "src/*/intern.ts",
    "src/*/worker.ts",
    "src/*/main.ts",
    "src/*/datatype.ts",
  ]),
  output: { sourcemap: true, format: "es", dir: "build" },
  plugins: [typescript(), terser({ mangle: false }), json()],
}

async function entryPoints(patterns) {
  const result = {}
  for await (const path of glob(patterns)) {
    // key strips src/ and file extension from file path; value is file path to entry point
    result[relative("src", path.substring(0, path.length - extname(path).length))] = path
  }
  return result
}
