import defaultConfig from "../../rollup.config.js"

export default {
   ...defaultConfig,
   external: ["node:buffer", "node:worker_threads", "node:process"],
}
