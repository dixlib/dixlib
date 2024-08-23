// --- TypeScript ---
import type Kernel from 'std.kernel'
export interface Startup<Init> {
  readonly path: string
  readonly initial: Init
  readonly parentPort: MessagePort
}
// --- JavaScript ---
export function isUnparented() {
  // an unparented worker is not a dedicated worker on the web
  // it is either a shared worker or a browser window (service workers are excluded)
  return typeof DedicatedWorkerGlobalScope !== "function"
}

export function queueMacrotask(macrotask: () => void): void {
  // schedule macrotask handler
  const id = uniqueMacrotask++
  macrotasks[id] = macrotask
  port2.postMessage(id)
}

export async function startWorker<Init>(
  path: URL,
  initial: Init,
  transfer: Kernel.Transferable[] = []
): Promise<Kernel.Worker> {
  // create dedicated worker
  const worker = new Worker(workerScript, { type: "module" })
  function terminate() { worker.terminate() }
  try {
    const { port1: parentPort, port2: childPort } = new MessageChannel()
    const startup: Startup<Init> = { path: path.href, initial, parentPort }
    // try to transfer parent port and to clone initial startup info to worker
    worker.postMessage(startup, [parentPort, ...transfer])
    await new Promise<void>((resolve, reject) => {
      function onceError() {
        reject(new Error(`error in "${workerScript}" while loading main "${path}"`))
        worker.removeEventListener("message", onceMessage)
        clearTimeout(timer)
      }
      function onceMessage() {
        resolve()
        worker.removeEventListener("error", onceError)
        clearTimeout(timer)
      }
      worker.addEventListener("error", onceError, { once: true })
      worker.addEventListener("message", onceMessage, { once: true })
      // five seconds should be enough to start a worker...
      const timer = setTimeout(() => {
        reject(new Error(`timeout on main confirmation from "${path}"`))
        worker.removeEventListener("error", onceError)
        worker.removeEventListener("message", onceMessage)
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
// use message channel to schedule macrotasks
let uniqueMacrotask = 1
const macrotasks: { [id: number]: () => void } = Object.create(null)
const { port1, port2 } = new MessageChannel()
port1.addEventListener("message", event => {
    const id = event.data, macrotask = macrotasks[id]
    delete macrotasks[id]
    macrotask()
})
port1.start()
