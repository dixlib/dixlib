import type Agency from "std.agency"
import type Future from "std.future"
import type Fx from "std.fx"
import type Theater from "std.theater"
import { fn, fx, news, theater } from "./extern.js"

//biome-ignore lint/complexity/noBannedTypes: {} is appropriate supertype
export function ServerRole<A extends Agency.Agent, S extends {} = {}>(): Fx.Mixin<Agency.ServerRole<A>, S> {
  return AnyServerRoleMixin as Fx.Mixin<Agency.ServerRole<A>, S>
}

export function Serve(prototype: object, key: PropertyKey, descriptor: PropertyDescriptor) {
  const { name } = prototype.constructor
  if (!key) {
    throw new Error(`empty action key in class ${name}`)
  }
  key = String(key)
  const method = descriptor.value
  if (!fn.isGeneratorFunction(method)) {
    throw new Error(`invalid action method "${key}" in class ${name}`)
  }
  const defined = Reflect.defineProperty(method, actionMarker, { value: actionMarker })
  if (!defined) {
    throw new Error(`cannot define action method "${key}" in class ${name}`)
  }
  return descriptor
}

export function Client<A extends Agency.Agent>(): Theater.RoleClass<Agency.Client<A>, [Agency.Server<A>]> {
  return ClientRole<A>
}

export function isAgent<A extends Agency.Agent>(it: unknown): it is A {
  return facade.isHandling(it)
}

export function createAgent<A extends Agency.Agent>(client: Agency.Client<A>): A {
  return facade.handle(client)
}

// ----------------------------------------------------------------------------------------------------------------- //
const facade = fx.createFacade<Agency.Agent, Agency.Client<Agency.Agent>>(
  "std.system/Agent",
  new Proxy(Object.create(null), {
    get(_: never, selector: string | symbol) {
      doActionCache[selector] ??= function doAction(this: Agency.Agent, ...parameters: unknown[]) {
        // convert signal revelation to promise
        const { promise, resolve, reject } = Promise.withResolvers()
        const client = facade.expose(this)
        if (theater.isGhost(client)) {
          // no point in asking a ghost actor
          reject(new Error("retired agent cannot perform action"))
        } else {
          const reveal: Future.Reveal<unknown> = signal =>
            "blooper" in signal ? reject(signal.blooper) : resolve(signal.prompt)
          // ask the client actor to reveal a signal upon completion
          //@ts-expect-error: assume the selector is valid for this unknown agent
          client.askAction(reveal, selector, parameters)
        }
        // the caller uses a more convenient promise to await the result
        return promise
      }
      return doActionCache[selector]
    },
  })
)
const doActionCache = Object.create(null)
const actionMarker = Symbol("action method marker")
class ClientRole<A extends Agency.Agent>
  extends theater.Role<Agency.Client<Agency.Agent>>()(Object)
  implements Theater.Script<Agency.Client<A>>
{
  readonly #server: Agency.Server<A>
  readonly #pending: { [correlation: number]: Future.Reveal<unknown> }
  #sequence: number
  protected *initializeRole(server: Agency.Server<A>): Theater.Scene {
    // send obituary when server terminates
    this.monitorHealth(server)
  }
  protected *observeTermination(actor: Theater.Actor): Theater.Scene {
    if (actor === this.#server) {
      // client also terminates when server terminates
      this.exitSelf()
    } else {
      news.error("unexpected obituary")
    }
  }
  constructor(server: Agency.Server<A>) {
    super()
    this.#server = server
    this.#pending = Object.create(null)
    this.#sequence = 0
  }
  @theater.Play *askAction<K extends keyof A>(
    reveal: Future.Reveal<Awaited<ReturnType<Agency.Agentic<A>[K]>>>,
    selector: K,
    parameters: Parameters<Agency.Agentic<A>[K]>
  ) {
    const sequence = this.#sequence++
    this.#pending[sequence] = reveal as Future.Reveal<unknown>
    // forward message to server with this client as sender
    this.#server.serveAction(this.self, sequence, selector, parameters)
  }
  @theater.Play *answerAction<K extends keyof A>(
    correlation: number,
    signal: Future.Signal<Awaited<ReturnType<Agency.Agentic<A>[K]>>>
  ) {
    const reveal = this.#pending[correlation]
    if (reveal) {
      delete this.#pending[correlation]
      reveal(signal)
    } else {
      news.warn("uncorrelated answer %d: dropping signal %o", correlation, signal)
    }
  }
}
type AnyServerRole = Agency.ServerRole<Agency.Agent>
const AnyServerRoleMixin = fx.mixin<AnyServerRole>(Super => {
  class ServerRole<A extends Agency.Agent>
    extends theater.Role<Agency.Server<Agency.Agent>>()(Super)
    implements Theater.Script<Agency.Server<Agency.Agent>>
  {
    @theater.Play *serveAction<K extends keyof A>(
      client: Agency.Client<A>,
      correlation: number,
      selector: K,
      parameters: Parameters<Agency.Agentic<A>[K]>
    ): Theater.Scene {
      // assume this servant role implements the agent actions
      const servant = this as Agency.Servant<A>
      const method = servant[selector]
      if (typeof method === "function" && actionMarker in method) {
        // perform action and wait for result; server faces consequences of any incident that might occur
        const result = yield* method.apply(servant, parameters)
        client.answerAction(correlation, { prompt: result as Awaited<ReturnType<Agency.Agentic<A>[K]>> })
      } else {
        news.error('inert action: "%s"/%d', String(selector), parameters.length)
      }
    }
  }
  return ServerRole as typeof Super & Fx.Constructor<AnyServerRole>
})
