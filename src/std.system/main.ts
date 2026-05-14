import type { Default } from "dixlib"
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
  startSubsystem(initial).catch(reason => console.error("Subsystem failure: %O", reason))
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
  const { default: startSystem }: Default = await import(dixlib)
  // start child system with given bundle stack
  const subsystem = await startSystem(bundleStack)
  //TODO: Startup service
  subsystem.loader().provide
}
