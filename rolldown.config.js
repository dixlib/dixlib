import { glob } from "node:fs/promises"
import { extname, relative } from "node:path"

/***
 * @type {import("rolldown").RolldownOptions}
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
    "src/*/test.ts",
  ]),
  output: { sourcemap: true, format: "es", dir: "build", minify: true },
}

async function entryPoints(patterns) {
  const result = {}
  for await (const path of glob(patterns)) {
    // key strips src/ and file extension from file path; value is file path to entry point
    result[relative("src", path.substring(0, path.length - extname(path).length))] = path
  }
  return result
}
