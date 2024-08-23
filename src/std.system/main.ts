// --- TypeScript ---
import type StartSystem from "dixlib"
import type Kernel from 'std.kernel'
import type Loader from 'std.loader'
// Initial info passed from parent to child system
export interface Initial {
  // ancestry chain: from id, parent id, grandparent id, great-grandparent id, ..., to 0 (the top id)
  readonly ancestry: [number, ...number[]]
  // module specifier of "dixlib" module
  readonly dixlib: string
  // bundle stack with bindings for child system
  readonly bundleStack: Loader.Bindings[]
}
// --- JavaScript ---
// main entry point of a new child subsystem
export default function main({ initial, parentPort: superPort, exit: shutdown }: Kernel.Main<Initial>) {
  parentPort = superPort
  exit = shutdown
  ancestry = initial.ancestry
  startSubsystem(initial.dixlib, initial.bundleStack)
}

// export info that was passed to main entry
export let parentPort: MessagePort, exit: () => void, ancestry: [number, ...number[]]

// ----------------------------------------------------------------------------------------------------------------- //
async function startSubsystem(dixlib: string, bundleStack: Loader.Bindings[]) {
  // import "dixlib" with specifier from parent system
  const { default: startSystem }: { readonly default: typeof StartSystem } = await import(dixlib)
  // start child system with given bundle stack
  return startSystem(bundleStack)
}
