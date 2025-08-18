import type Agency from "std.agency"
import type Kernel from "std.kernel"
import type Loader from "std.loader"
import type System from "std.system"
import type Theater from "std.theater"
import { agency, future, kernel } from "../extern.js"
import { type Initial, parentPort } from "../main.js"
import { ancestry } from "./hierarchy.js"
import { allocateNextId, associatePort, connectSystems } from "./network.js"
import { root } from "./root.js"

export function Subsidiary(): Theater.RoleClass<Agency.Server<System.Subsidiary>, [Loader.Bindings[]]> {
  return SubsidiaryRole
}

// ----------------------------------------------------------------------------------------------------------------- //
// reuse super ancestry of new subsidiaries
const superAncestry = ancestry()
// import.meta.url is where extern.js/intern.js of service provider is located! (this file is merged with rollup)
const mainURL = new URL("./main.js", import.meta.url)
const dixlib = new URL("../../index.js", import.meta.url).href
class SubsidiaryRole
  extends agency.ServerRole<System.Subsidiary>()(Object)
  implements Agency.Servant<System.Subsidiary>
{
  #id: number
  #worker: Kernel.Worker | undefined
  protected *initializeRole(bundleStack: Loader.Bindings[]): Theater.Scene<void> {
    yield* super.initializeRole()
    // allocate next available system id from top system (or from the local system if this is the top system)
    this.#id = future.when(yield allocateNextId())
    const init: Initial = { ancestry: [this.#id, ...superAncestry], dixlib, bundleStack }
    // pass initial info to new worker
    this.#worker = future.when<Kernel.Worker>(yield future.pledge(kernel.startWorker(mainURL, init)))
    // associate child subsystem with this system
    associatePort(this.#id, this.#worker.childPort, root())
    if (!kernel.isUnsupervised()) {
      // connect child to top system, ensuring all subsystems are connected to the top system
      connectSystems(this.#id, 0)
    }
  }
  protected *disposeRole(): Theater.Scene<void> {
    // terminate worker on disposal
    this.#worker?.terminate()
  }
  constructor() {
    super()
    this.#id = -1
    this.#worker = void 0
  }
  @agency.Serve *id(): Theater.Scene<number> {
    return this.#id
  }
  @agency.Serve *shutdown(): Theater.Scene {
    this.exitSelf()
  }
}
// associate supervised subsystem with its parent port in the network
if (!kernel.isUnsupervised()) {
  associatePort(ancestry()[1], parentPort, root())
}
