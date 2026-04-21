import type System from "std.system"
import type Theater from "std.theater"
import { theater } from "../extern.js"
import { ContainerRole } from "./container.js"

export function root(): System.ContainerContext<System.Container> {
  return rootContext
}

// ----------------------------------------------------------------------------------------------------------------- //
class RootRole extends ContainerRole<System.Container>()(Object) implements Theater.Script<System.Container> {
  protected *initializeRole(resolve: (root: System.ContainerContext<System.Container>) => void) {
    yield* super.initializeRole()
    // resolve promise with context of root container
    resolve(this.containerContext)
  }
}
function startRootContext() {
  const { promise, resolve } = Promise.withResolvers<System.ContainerContext<System.Container>>()
  // start root container with promise resolution
  theater.startActor(RootRole, resolve)
  // return promise to expose context
  return promise
}
const rootContext = await startRootContext()
