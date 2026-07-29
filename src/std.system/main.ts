import type Dixlib from "dixlib"
import type Kernel from "std.kernel"
import type Loader from "std.loader"

// info passed from parent system to child subsystem
export interface Initial {
  // ancestry chain: from id, parent id, grandparent id, great-grandparent id, ..., to 0 (the top id)
  readonly ancestry: [number, ...number[]]
  // module specifier of "dixlib" module
  readonly dixlib: string
  // bundle stack with bindings for subsystem
  readonly bundleStack: Loader.Bindings[]
}

// main entry point of a new subsystem
export default function main({ initial, parentPort, exit }: Kernel.Main<Initial>) {
  const { ancestry } = initial
  inherited = { parentPort, ancestry, exit }
  startSubsystem(initial).catch(reason => {
    // report an error on the console, because logger may not be operational
    console.error("subsystem failure: %O", reason)
    // explicitly stop this worker (just in case obsolete event-handlers were installed)
    exit()
  })
}

// export info that was inherited from parent system
export let inherited: {
  readonly parentPort: MessagePort
  readonly ancestry: [number, ...number[]]
  readonly exit: () => void
}

// ----------------------------------------------------------------------------------------------------------------- //
async function startSubsystem({ dixlib, bundleStack }: Initial) {
  // import "dixlib" with specifier from parent system
  const { default: startSystem }: Dixlib.Export = await import(dixlib)
  // start child system with given bundle stack
  await startSystem(bundleStack)
}
