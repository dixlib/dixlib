// --- TypeScript ---
import type Kernel from 'std.kernel'
import type { Startup } from "./intern.ts"
// --- JavaScript ---
// ----------------------------------------------------------------------------------------------------------------- //
const { path, initial, parentPort } = await new Promise<Startup<unknown>>((resolve, reject) => {
  // install handler to receive startup info once
  function onceMessage(event: MessageEvent) {
    resolve(event.data)
    clearTimeout(timer)
  }
  addEventListener("message", onceMessage, { once: true })
  const timer = setTimeout(() => {
    reject(new Error(`timeout on startup info for "${path}"`))
    removeEventListener("message", onceMessage)
  }, 5e3)
})
const { default: main }: { readonly default: Kernel.MainEntry<typeof initial> } = await import(path)
// run main to control this child worker
postMessage(void 0)
main({ initial, parentPort, exit: close })
