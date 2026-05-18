import type Quality from "std.quality"
import type System from "std.system"
import type Theater from "std.theater"
import { fn, future, kernel, news, quality, loader as systemLoader, theater } from "../extern.js"
import { ContainerRole } from "./container.js"
import { version } from "./info.js"
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
  completeRole(confirm: () => void): Theater.OneWay
}
const guardLogger = theater.createDefaultGuard("forgive", "unexpected incident with logger: %O", "debug")
const guardQuestioner = theater.createDefaultGuard("forgive", "unexpected incident with questioner: %O", "debug")
const guardSenders = theater.createDefaultGuard("forgive", "unexpected incident with sender container: %O", "debug")
const guardSubsidiaries = theater.createDefaultGuard(
  "forgive",
  "unexpected incident with subsidiary container: %O",
  "debug"
)
const guardTestRunners = theater.createDefaultGuard("forgive", "unexpected incident with test runner: %O")
class SupportRole extends theater.Role<Support>()(Object) implements Theater.Script<Support> {
  #createComponents() {
    return {
      logger: this.#createLogger(),
      quality: this.#createTestRunner(),
      questioner: this.#createQuestioner(),
    }
  }
  #createContainers() {
    return {
      sender: this.#createSenderContainer(),
      subsidiary: this.#createSubsidiaryContainer(),
    }
  }
  #createLogger(): Theater.ActorRef<System.Logger> {
    return kernel.isSupervised()
      ? // forward log messages to logger of top system if this is not the top system
        this.castChild<System.Logger, [number, string]>({
          Role: Nearby(),
          parameters: [0, "logger"],
          guard: guardLogger,
        })
      : // top system logs message to JavaScript console
        this.castChild<System.Logger, []>({ Role: ConsoleLoggerRole, parameters: [], guard: guardLogger })
  }
  #createNewsReader(): Theater.ActorRef {
    return this.castChild({ Role: NewsReaderRole, parameters: [], guard: guardLogger })
  }
  #createQuestioner(): Theater.ActorRef<System.Questioner> {
    return this.castChild<System.Questioner, []>({ Role: QuestionerRole, parameters: [], guard: guardQuestioner })
  }
  #createSenderContainer(): Theater.ActorRef<System.Container> {
    return this.castChild<System.Container, []>({ Role: ContainerRole()(Object), parameters: [], guard: guardSenders })
  }
  #createSubsidiaryContainer(): Theater.ActorRef<System.Container> {
    return this.castChild<System.Container, []>({
      Role: ContainerRole()(Object),
      parameters: [],
      guard: guardSubsidiaries,
    })
  }
  #createTestRunner(): Theater.ActorRef<Quality.TestRunner> {
    return this.castChild<Quality.TestRunner, []>({
      Role: quality.TestRunner(),
      parameters: [],
      guard: guardTestRunners,
    })
  }
  protected *initializeRole(confirm: () => void) {
    yield* super.initializeRole()
    const rootRef = root().subject
    for (const [key, actorRef] of fn.iterateEntries(this.#createComponents())) {
      rootRef().assign(key, actorRef as Theater.ActorRef)
    }
    confirm()
  }
  @theater.Play *completeRole(confirm: () => void): Theater.Scene {
    const rootRef = root().subject
    const promises: Promise<void>[] = []
    fn.iterateEntries(this.#createContainers()).forEach(([key, containerRef]) => {
      // collect promises to mount all contexts
      const promise = ask<System.Container, System.ContainerContext>(containerRef, container => container.view())
      promises.push(promise.then(context => rootRef().mount(key, context)))
    })
    // wait for mounts to complete
    future.when<unknown>(yield future.pledge(Promise.all(promises)))
    // start child actor to consume and to report the news
    this.#createNewsReader()
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
  supportRef().completeRole(resolve)
  return promise
}
await bootSupport()
// report start of a new system or subsystem
news.info("starting system v%s", version())
