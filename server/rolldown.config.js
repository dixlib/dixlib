import defaultConfig from "../rolldown.config.js"

/***
 * @type {import("rolldown").RolldownOptions}
 */
export default {
  ...defaultConfig,
  external: ["node:buffer", "node:worker_threads", "node:process"],
}
