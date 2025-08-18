import { exit } from "node:process"
import { parentPort as confirmationPort, workerData } from "node:worker_threads"
import type Kernel from "std.kernel"
import type { Startup } from "./intern.ts"

// ----------------------------------------------------------------------------------------------------------------- //
const { path, initial, parentPort }: Startup<unknown> = workerData
const { default: main }: { readonly default: Kernel.MainEntry<typeof initial> } = await import(path)
// run main to control this child worker
//biome-ignore lint/style/noNonNullAssertion: this is a child worker with a confirmation port to its parent
confirmationPort!.postMessage(void 0)
main({ initial, parentPort, exit })
