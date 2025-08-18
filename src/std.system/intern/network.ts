import type Agency from "std.agency"
import type Future from "std.future"
import type Kernel from "std.kernel"
import type System from "std.system"
import type Theater from "std.theater"
import { concurrency, future, kernel, news, theater } from "../extern.js"
import { id } from "./hierarchy.js"

export function Nearby<A extends Theater.Actor>(): Theater.RoleClass<A, [number, string]> {
  return NearbyRole as unknown as Theater.RoleClass<A, [number, string]>
}

export function NearbyServer<A extends Agency.Agent>(): Theater.RoleClass<Agency.Server<A>, [number, string]> {
  return NearbyServerRole as unknown as Theater.RoleClass<Agency.Server<A>, [number, string]>
}

export function associatePort(
  candidateId: number,
  port: Kernel.MessagePort,
  // caller supplies root context because root.js depends on this module
  rootContext: System.Context<System.Root>
): void {
  if (portals[candidateId]) {
    throw new Error(`cannot associate system ${candidateId} twice in top network`)
  }
  if (candidateId === id()) {
    throw new Error(`cannot associate system ${candidateId} with itself in top network`)
  }
  const portal = new Portal(port, candidateId, rootContext)
  portals[candidateId] = portal
  if (associating[candidateId]) {
    // resolve promise to reveal the expected association
    const { resolve } = associating[candidateId]
    resolve(portal)
    delete associating[candidateId]
  }
}

export function connectSystems(left: number, right: number): void {
  if (left === right) {
    throw new Error(`invalid connection ${left} <-> ${right}`)
  }
  const leftPortal = portals[left]
  const rightPortal = portals[right]
  if (!leftPortal || !rightPortal) {
    throw new Error(`missing ${leftPortal ? "" : "L"}${rightPortal ? "" : "R"} in connection ${left} <-> ${right}`)
  }
  // send association message to both sides of the connection
  const { port1, port2 } = new MessageChannel()
  const rightAssociation: Association = { id: right, port: port1 }
  leftPortal.port.postMessage(rightAssociation, [port1])
  const leftAssociation: Association = { id: left, port: port2 }
  rightPortal.port.postMessage(leftAssociation, [port2])
}

export function allocateNextId(): Future.Cue<number> {
  if (kernel.isUnsupervised()) {
    // top system keeps track of next system id
    return future.spark({ prompt: nextId++ })
  } else {
    // other systems send an allocation message to the top system
    const allocation: Allocation = {}
    portals[0].port.postMessage(allocation)
    // consume id from allocation exchange after reservation message has arrived
    return allocationExchange.consume()
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
// (empty) allocation message allocates unique system id for new subsystem
//biome-ignore lint/suspicious/noEmptyInterface: message without properties
interface Allocation {}
// reservation message conveys allocated id of new subsystem
interface Reservation {
  readonly allocated: number
}
// association message binds a system (id) to a port in the top network
interface Association {
  readonly id: number
  readonly port: Kernel.MessagePort
}
// connection message is sent to top system to connect sender to target system in top network
interface Connection {
  readonly target: number
}
// a oneway message for component at path
interface OneWay {
  readonly path: string
  readonly selector: string
  readonly parameters: unknown[]
}
interface Request {
  readonly sequence: number
  readonly path: string
  readonly selector: string
  readonly parameters: unknown[]
}
interface Response {
  readonly sequence: number
  readonly signal: Future.Signal<unknown>
}
// all network messages
type Message = Allocation | Reservation | Association | Connection | OneWay | Request | Response
// the next id is only valid in the top system
let nextId = 1
// rendezvous allocation exchange is only valid in a subsystem
const allocationExchange = concurrency.createExchange<number>(0)
// keep track of expected associations with other systems in top network
const associating: { [id: number]: PromiseWithResolvers<Portal> } = Object.create(null)
// all network portals from this system to other systems in top network
const portals: { [id: number]: Portal } = Object.create(null)
class Portal {
  readonly #port: Kernel.MessagePort
  readonly #pending: { [sequence: number]: Future.Reveal<unknown> | undefined }
  #sequence: number
  // constructor portal from message port to other system
  constructor(port: Kernel.MessagePort, otherId: number, rootContext: System.Context<System.Root>) {
    this.#port = port
    this.#pending = Object.create(null)
    this.#sequence = 0
    port.addEventListener("message", event => {
      const message: Message = event.data
      if ("id" in message) {
        // process association message
        associatePort(message.id, message.port, rootContext)
      } else if ("target" in message) {
        // process connection message
        const left = otherId
        const right = message.target
        if (!kernel.isUnsupervised()) {
          // only top system should receive connection messages
          throw new Error(`inappropriate connection ${left} <-> ${right} at ${id()}`)
        }
        connectSystems(left, right)
      } else if ("allocated" in message) {
        // process reservation message
        const { allocated } = message
        if (kernel.isUnsupervised()) {
          // only subsystems should receive reservation messages
          throw new Error(`inappropriate reservation of ${allocated} from ${otherId}`)
        }
        // underflow should occur when this system has an outstanding allocation message
        if (!allocationExchange.isUnderflowing) {
          throw new Error(`illegal state for reservation of ${allocated} from ${otherId} at ${id()}`)
        }
        // produce the allocated id for the oldest consumer
        allocationExchange.tryProduce(allocated)
      } else if ("path" in message && "sequence" in message) {
        // process request message
        const { path, selector, parameters } = message
        const component = rootContext.resolve(path)
        if (!component) {
          news.error('cannot forward request "%s"/%d to missing component "%s"', selector, parameters.length, path)
        } else {
          Promise.try(() =>
            //@ts-expect-error: assume the selector is valid (resulting in inert letter or inert action if it's not)
            component[selector](...parameters)
          ).then(prompt => {
            const response: Response = { sequence: message.sequence, signal: { prompt } }
            port.postMessage(response)
          })
        }
      } else if ("path" in message) {
        // process oneway message for system component
        const { path, selector, parameters } = message
        const component = rootContext.resolve(path)
        if (!component) {
          news.error('cannot forward oneway "%s"/%d to missing component "%s"', selector, parameters.length, path)
        } else {
          // forward message to actor or agent
          //@ts-expect-error: assume the selector is valid (resulting in inert letter or inert action if it's not)
          component[selector](...parameters)
        }
      } else if ("sequence" in message) {
        // process response message
        const { sequence, signal } = message
        const reveal = this.#pending[sequence]
        if (reveal) {
          delete this.#pending[sequence]
          reveal(signal)
        } else {
          news.warn("missing request for action response %d", sequence)
        }
      } else {
        // process allocation message
        if (!kernel.isUnsupervised()) {
          // only top system should receive allocation messages
          throw new Error(`inappropriate allocation from ${otherId} at ${id()}`)
        }
        // synchronous allocation of next id
        const reservation: Reservation = { allocated: nextId++ }
        port.postMessage(reservation)
      }
    })
    port.start()
  }
  get port() {
    return this.#port
  }
  requestAction(path: string, selector: string, parameters: unknown[]): Future.Cue<unknown> {
    return future.once(reveal => {
      // reserve unique sequence number for request
      const sequence = this.#sequence++
      // install pending revelation for correspodning response message
      this.#pending[sequence] = reveal
      // send request to other side
      const request: Request = { sequence, path, selector, parameters }
      this.#port.postMessage(request)
    })
  }
}
function startPortal(target: number): Promise<Portal> {
  if (associating[target]) {
    // avoid duplicating expected associations; reuse existing promise
    return associating[target].promise
  } else {
    // send connection message to top system (resulting in association between this and target system)
    const connection: Connection = { target }
    portals[0].port.postMessage(connection)
    // create new promise and install expected association
    const combo = Promise.withResolvers<Portal>()
    associating[target] = combo
    return combo.promise
  }
}
abstract class NearbyBase extends theater.Role<Theater.Actor>()(Object) {
  // system id
  readonly #id: number
  // path to system component (actor or agent)
  readonly #path: string
  constructor(id: number, path: string) {
    super()
    this.#id = id
    this.#path = path
  }
  get id(): number {
    return this.#id
  }
  get path() {
    return this.#path
  }
}
class NearbyRole extends NearbyBase implements Theater.Script<Theater.Actor> {
  protected *improviseScene(selector: string | symbol, parameters: unknown[]): Theater.Scene {
    if (typeof selector === "symbol") {
      throw new Error(`unsupported symbolic selector for nearby actor "${String(selector)}"`)
    }
    const portal = portals[this.id] ?? future.when<Portal>(yield future.pledge(startPortal(this.id)))
    const oneway: OneWay = { path: this.path, selector, parameters }
    portal.port.postMessage(oneway)
  }
}
class NearbyServerRole extends NearbyBase implements Theater.Script<Agency.Server<Agency.Agent>> {
  @theater.Play *serveAction(
    client: Agency.Client<Agency.Agent>,
    correlation: number,
    selector: string,
    parameters: unknown[]
  ) {
    const portal = portals[this.id] ?? future.when<Portal>(yield future.pledge(startPortal(this.id)))
    client.answerAction(correlation, yield portal.requestAction(this.path, selector, parameters))
  }
}
