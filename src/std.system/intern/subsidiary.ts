// --- TypeScript ---
import type Kernel from 'std.kernel'
import type Loader from 'std.loader'
import type System from 'std.system'
import type Theater from 'std.theater'
import type { Initial } from "../main.ts"
// --- JavaScript ---
import { kernel, theater } from "../extern.js"
import { allocateNextId, ancestry, associatePort, connectSystems } from "./network.js"

export function Subsidiary(): Theater.RoleClass<System.Subsidiary, [Loader.Bindings[]]> {
  return SubsidiaryRole
}

// ----------------------------------------------------------------------------------------------------------------- //
// reuse super ancestry of new subsidiaries
const superAncestry = ancestry()
// import.meta.url is where extern.js/intern.js of service provider is located! (this file is merged with rollup)
const mainURL = new URL("./main.js", import.meta.url), dixlib = new URL("../../index.js", import.meta.url).href
class SubsidiaryRole extends theater.Role<System.Subsidiary>()(Object) implements Theater.Script<System.Subsidiary> {
  #id: number
  #worker: Kernel.Worker | undefined
  protected *initializeRole(bundleStack: Loader.Bindings[]): Theater.Scene<void> {
    yield* super.initializeRole()
    // allocate next available system id from top system (or from the local system if this is the top system)
    this.#id = yield* theater.when(allocateNextId())
    const init: Initial = { ancestry: [this.#id, ...superAncestry], dixlib, bundleStack }
    // pass initial info to new worker
    this.#worker = yield* theater.when(kernel.startWorker(mainURL, init))
    // associate child system in network of this system
    associatePort(this.#id, this.#worker.childPort)
    if (!kernel.isUnparented()) {
      // connect child network to top system, ensuring all subsystems are connected to the top network
      connectSystems(this.#id, 0)
    }
  }
  protected *disposeRole(): Theater.Scene<void> {
    // terminate worker when actor is killed or recast 
    this.#worker?.terminate()
  }
  constructor() {
    super()
    this.#id = -1
    this.#worker = void 0
  }
  @theater.Play public *id(): Theater.Scene<number> { return this.#id }
}
