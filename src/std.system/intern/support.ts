import type System from "std.system"
import type Theater from "std.theater"
import { fn, future, kernel, news, quality, loader as systemLoader, theater } from "../extern.js"
import { ContainerRole } from "./container.js"
import { ancestry, version } from "./info.js"
import { ConsoleLoggerRole, NewsReaderRole } from "./logger.js"
import { ask, QuestionerRole } from "./questioner.js"
import { root } from "./root.js"
import { Nearby } from "./topnet.js"

export function loader() {
  return systemLoader
}

// ----------------------------------------------------------------------------------------------------------------- //
// support actor sets up the initial system
interface Support extends Theater.Actor {
  completeInitialization(confirm: () => void): Theater.OneWay
}
const guardLogger = theater.createDefaultGuard("forgive", "unexpected incident with logger: %O", "debug")
class SupportRole extends theater.Role<Support>()(Object) implements Theater.Script<Support> {
  #createSupersidiary() {
    if (kernel.isSupervised()) {
      const [id, parentId] = ancestry()
      return this.castChild({
        Role: Nearby<System.Subsidiary>(),
        parameters: [parentId, `subsidiary/${id}`],
        guard: theater.createDefaultGuard("forgive", "unexpected incident with system super actor: %O"),
      })
    }
  }
  #createComponents() {
    return {
      logger: kernel.isSupervised()
        ? // forward log messages to logger of top system if this is not the top system
          this.castChild({
            Role: Nearby<System.Logger>(),
            parameters: [0, "logger"],
            guard: guardLogger,
          })
        : // top system logs message to JavaScript console
          this.castChild<System.Logger, []>({ Role: ConsoleLoggerRole, parameters: [], guard: guardLogger }),
      // quality component for running service tests
      quality: this.castChild({
        Role: quality.TestRunner(),
        parameters: [],
        guard: theater.createDefaultGuard("forgive", "unexpected incident with test runner: %O"),
      }),
      // questioner for asking asynchronous questions
      questioner: this.castChild({
        Role: QuestionerRole,
        parameters: [],
        guard: theater.createDefaultGuard("forgive", "unexpected incident with questioner: %O", "debug"),
      }),
      // either subsidiary in parent system or undefined in top system
      supersidiary: this.#createSupersidiary(),
    }
  }
  #createContainers() {
    return {
      // senders are actors in this system that expect a message from an actor in a nearyby system
      sender: this.castChild({
        Role: ContainerRole()(Object),
        parameters: [],
        guard: theater.createDefaultGuard("forgive", "unexpected incident with sender container: %O", "debug"),
      }),
      // subsidiaries are actors in this system that represent a subsystems
      subsidiary: this.castChild({
        Role: ContainerRole()(Object),
        parameters: [],
        guard: theater.createDefaultGuard("forgive", "unexpected incident with subsidiary container: %O", "debug"),
      }),
    }
  }
  protected *initializeRole(confirm: () => void) {
    yield* super.initializeRole()
    const rootRef = root().subject
    for (const [key, actorRef] of fn.iterateEntries(this.#createComponents())) {
      if (actorRef) {
        rootRef().assign(key, actorRef as Theater.ActorRef)
      }
    }
    // make sure pending assignment messages are processed (assumes atomic processing!)
    future.when<void>(yield theater.idle())
    confirm()
  }
  @theater.Play *completeInitialization(confirm: () => void): Theater.Scene {
    const rootRef = root().subject
    const promises: Promise<void>[] = []
    fn.iterateEntries(this.#createContainers()).forEach(([key, containerRef]) => {
      // collect promises to mount all contexts
      const promise = ask<System.Container, System.ContainerContext>(containerRef, container => container.view())
      promises.push(promise.then(context => rootRef().mount(key, context)))
    })
    // wait for all mount messages with (asynchronous) contexts to be sent to root context
    future.when<unknown>(yield future.pledge(Promise.all(promises)))
    // start child actor to consume and to report the news
    this.castChild({ Role: NewsReaderRole, parameters: [], guard: guardLogger })
    // make sure pending mount messages are processed
    future.when<void>(yield theater.idle())
    confirm()
  }
}
async function createSupport(): Promise<Theater.ActorRef<Support>> {
  const { promise, resolve } = Promise.withResolvers<void>()
  const actorRef = theater.startActor(SupportRole, resolve)
  // wait for components to be assigned
  await promise
  return actorRef
}
async function bootSupport() {
  const supportRef = await createSupport()
  const { promise, resolve } = Promise.withResolvers<void>()
  // continue setup e.g., install containers
  supportRef().completeInitialization(resolve)
  return promise
}
await bootSupport()
// report start of a new system or subsystem
news.info("starting system v%s", version())
// inform the subsidiary in parent system that the subsystem has started; noop in top system
root().lookup<System.Subsidiary>("supersidiary")?.().setupSubsystem()
