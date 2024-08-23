// --- TypeScript ---
import type Kernel from 'std.kernel'
import type { Startup } from "./intern.ts"
// --- JavaScript ---
import { exit } from "node:process"
import { parentPort as confirmationPort, workerData } from "node:worker_threads"
// ----------------------------------------------------------------------------------------------------------------- //
const { path, initial, parentPort }: Startup<unknown> = workerData
const { default: main }: { readonly default: Kernel.MainEntry<typeof initial> } = await import(path)
// run main to control this child worker
confirmationPort!.postMessage(void 0)
main({ initial, parentPort, exit })
