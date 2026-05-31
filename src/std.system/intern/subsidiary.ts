import type Kernel from "std.kernel"
import type Loader from "std.loader"
import type System from "std.system"
import type Theater from "std.theater"
import { future, kernel, news, theater } from "../extern.js"
import { type Initial, inherited } from "../main.js"
import { ancestry } from "./info.js"
import { root } from "./root.js"
import { allocateNextId, associatePort, connectSystems } from "./topnet.js"

export function Subsidiary(): Theater.RoleClass<System.Subsidiary, [Loader.Bindings[]]> {
  return SubsidiaryRole
}

// ----------------------------------------------------------------------------------------------------------------- //
// import.meta.url is where extern.js/intern.js of service provider is located! (this file is merged with rolldown)
const mainURL = new URL("./main.js", import.meta.url)
const dixlib = new URL("../../index.js", import.meta.url).href
class SubsidiaryRole extends theater.Role<System.Subsidiary>()(Object) implements Theater.Script<System.Subsidiary> {
  #id: number
  #worker: Kernel.Worker | undefined
  #settingUp: boolean
  protected *initializeRole(bundleStack: Loader.Bindings[]): Theater.Scene<void> {
    yield* super.initializeRole()
    // allocate next available system id from top system (or from the local system if this is the top system)
    this.#id = future.when<number>(yield allocateNextId())
    const init: Initial = { ancestry: [this.#id, ...ancestry()], dixlib, bundleStack }
    // pass initial info to new worker
    this.#worker = future.when<Kernel.Worker>(yield future.pledge(kernel.startWorker(mainURL, init)))
    // associate child subsystem with this system
    associatePort(this.#id, this.#worker.childPort)
    if (kernel.isSupervised()) {
      // connect child to top system, ensuring all subsystems are connected to the top system
      connectSystems(this.#id, 0)
    }
    // keep track of all subsidiaries of this system
    const context = root().lookupContext("subsidiary") as System.ContainerContext
    context.subject().assign(String(this.#id), this.self)
  }
  protected *disposeRole(): Theater.Scene<void> {
    // terminate worker on disposal
    this.#worker?.terminate()
  }
  constructor() {
    super()
    this.#id = -1
    this.#worker = void 0
    this.#settingUp = false
  }
  @theater.Play *id(): Theater.Scene {
    this.return<number>(this.#id)
  }
  @theater.Play *setupSubsystem(): Theater.Scene {
    if (this.#settingUp) {
      throw new Error("cannot setup subsidiary twice")
    } else {
      this.#settingUp = true
      news.info("setting up subsystem %d", this.#id)
    }
  }
}
// associate supervised subsystem with its parent port in the top network
if (kernel.isSupervised()) {
  associatePort(ancestry()[1], inherited.parentPort)
}
