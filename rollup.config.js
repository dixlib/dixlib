import { glob } from "glob"
import { extname, relative } from "node:path"
import terser from "@rollup/plugin-terser"
import typescript from "@rollup/plugin-typescript"

export default {
  input: await entryPoints([
    "src/boot.ts",
    "src/bindings.ts",
    "src/*/extern.ts",
    "src/*/intern.ts",
    "src/*/worker.ts",
    "src/*/main.ts",
  ]),
  output: {
    sourcemap: true,
    format: "es",
    dir: "build",
  },
  plugins: [
    typescript(),
    terser()
  ],
}

async function entryPoints(patterns) {
  return Object.fromEntries(
    (await Promise.all(patterns.map(pattern => glob(pattern)))).flat().map(path => [
      // key strips src/ and file extension from file path
      relative("src", path.substring(0, path.length - extname(path).length)),
      // value is file path to entry point
      path,
    ])
  )
}
