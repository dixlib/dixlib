import type Agency from "std.agency"
import type News from "std.news"
import type System from "std.system"
import type Theater from "std.theater"
import { version as publishedVersion } from "../../../package.json" with { type: "json" }
import { agency, future, kernel, news, loader as systemLoader, theater } from "../extern.js"
import { ContainerRole } from "./container.js"
import { ancestry, id } from "./hierarchy.js"
import { Nearby } from "./network.js"

export function version(): string {
  return publishedVersion
}
export function root(): System.Context<System.Root> {
  return rootContext
}

export function loader() {
  return systemLoader
}

// ----------------------------------------------------------------------------------------------------------------- //
function* guard(incident: Theater.Incident<Theater.Actor>): Theater.Scene<Theater.Verdict> {
  news.debug("unexpected incident with logger: %o", incident)
  // ignore logger related errors
  return "forgive"
}
class Logger extends theater.Role<System.Logger>()(Object) implements Theater.Script<System.Logger> {
  @theater.Play *report<P extends unknown[]>(message: System.LogMessage<P>) {
    const format = `[${message.origin.join(".")}@${Math.round(message.timestamp)}ms] ${message.format}`
    console[message.severity](format, ...message.parameters)
  }
}
class NewsReader extends theater.Role()(Object) {
  protected *initializeRole(logger: System.Logger): Theater.Scene {
    const origin = ancestry()
    // perpetual news consumption
    for (;;) {
      const message = future.when<News.Message<unknown[]>>(yield news.consume())
      logger.report({ ...message, origin })
    }
  }
}
class RootRole extends ContainerRole<System.Root>()(Object) implements Agency.Servant<System.Root> {
  protected *initializeRole() {
    yield* super.initializeRole()
    const logger = kernel.isUnsupervised()
      ? // top system logs message to JavaScript console
        this.startChild<System.Logger, []>({ Role: Logger, parameters: [], guard })
      : // forward log messages to logger of top system if this is not the top system
        this.startChild<System.Logger, [number, string]>({ Role: Nearby(), parameters: [0, "log"], guard })
    // start child actor to consume and to report the news
    this.startChild({ Role: NewsReader, parameters: [logger], guard })
    this.assignComponent("log", logger)
  }
  @agency.Serve *ancestry(): Theater.Scene<[number, ...number[]]> {
    return ancestry()
  }
  @agency.Serve *id(): Theater.Scene<number> {
    return id()
  }
}
async function bootRoot(): Promise<System.Context<System.Root>> {
  // root server is toplevel actor
  const rootServer = theater.startActor<Agency.Server<System.Root>, []>(RootRole)
  const tempClient = theater.startActor(agency.Client<System.Root>(), rootServer)
  // create agent to view the root context
  const context = await agency.createAgent<System.Root>(tempClient).view()
  tempClient.terminate()
  return context
}
const rootContext: System.Context<System.Root> = await bootRoot()
// report start of a new system or subsystem
news.info("starting system v%s", version())
