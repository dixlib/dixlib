// --- TypeScript ---
import type Kernel from 'std.kernel'
import type { MessagePort } from "node:worker_threads"
export interface Startup<Init> {
  readonly path: string
  readonly initial: Init
  readonly parentPort: MessagePort
}
// --- JavaScript ---
import { Worker, isMainThread } from "node:worker_threads"

export function isUnparented() {
  return isMainThread
}

// use setImmediate for macrotasks
export const queueMacrotask = setImmediate

export async function startWorker<Init>(
  path: URL,
  initial: Init,
  transfer: Kernel.Transferable[] = []
): Promise<Kernel.Worker> {
  // create worker with startup info and transfer parent port
  const { port1: parentPort, port2: childPort } = new MessageChannel()
  const workerData: Startup<Init> = { path: path.href, initial, parentPort }
  const worker = new Worker(workerScript, { workerData, transferList: [parentPort, ...transfer] })
  function terminate() { worker.terminate() }
  try {
    await new Promise<void>((resolve, reject) => {
      function onceError(error: Error) {
        reject(error)
        worker.off("message", onceMessage)
        clearTimeout(timer)
      }
      function onceMessage() {
        resolve()
        worker.off("error", onceError)
        clearTimeout(timer)
      }
      worker.once("error", onceError)
      worker.once("message", onceMessage)
      const timer = setTimeout(() => {
        reject(new Error(`timeout on main confirmation from "${path}"`))
        worker.off("error", onceError)
        worker.off("message", onceMessage)
      }, 5e3)
    })
    return Object.freeze({ childPort, terminate })
  } catch (problem) {
    // terminate on failure
    terminate()
    throw new Error("worker termination", { cause: problem })
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
const workerScript = new URL("./worker.js", import.meta.url)
