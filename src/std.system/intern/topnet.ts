import type Future from "std.future"
import type Kernel from "std.kernel"
import type System from "std.system"
import type Theater from "std.theater"
import { future, kernel, news, theater } from "../extern.js"
import { id } from "./info.js"
import { root } from "./root.js"

export function Nearby<A extends Theater.Actor>(): Theater.RoleClass<A, [number, string]> {
  return NearbyRole as unknown as Theater.RoleClass<A, [number, string]>
}

export function associatePort(otherId: number, port: Kernel.MessagePort): void {
  if (ports[otherId]) {
    throw new Error(`cannot associate system ${otherId} twice in top network`)
  }
  if (otherId === internalId) {
    throw new Error(`cannot associate system ${otherId} with itself in top network`)
  }
  port.addEventListener("message", event => {
    const message: Message = event.data
    if ("id" in message) {
      // process association message
      associatePort(message.id, message.port)
    } else if ("target" in message) {
      // process connection message
      const leftId = otherId
      const rightId = message.target
      if (kernel.isSupervised()) {
        // only top system should receive connection messages
        throw new Error(`inappropriate connection ${leftId} <-> ${rightId} at ${internalId}`)
      }
      connectSystems(leftId, rightId)
    } else if ("allocated" in message) {
      // process reservation message
      const { allocated } = message
      if (!kernel.isSupervised()) {
        // only subsystems should receive reservation messages
        throw new Error(`inappropriate reservation of ${allocated} from ${otherId}`)
      }
      // underflow should occur when this system has an outstanding allocation message
      if (!allocationExchange.isUnderflowing) {
        throw new Error(`illegal state for reservation of ${allocated} from ${otherId} at ${internalId}`)
      }
      // produce the allocated id for the oldest consumer
      allocationExchange.tryProduce(allocated)
    } else if ("path" in message) {
      // process oneway message for system component
      const { path, selector, parameters, context } = message
      const component = root().resolve(path)
      if (!component) {
        news.error('cannot forward oneway "%s"/%d to missing component "%s"', selector, parameters.length, path)
      } else {
        // forward message to component actor, preserving context
        const messageContext = preserveMessageContext(context)
        //@ts-expect-error: assume the selector is valid (resulting in inert letter if it's not)
        component(messageContext)[selector](...parameters)
      }
    } else {
      // process allocation message
      if (kernel.isSupervised()) {
        // only top system should receive allocation messages
        throw new Error(`inappropriate allocation from ${otherId} at ${internalId}`)
      }
      // synchronous allocation of next id
      const reservation: Reservation = { allocated: nextId++ }
      port.postMessage(reservation)
    }
  })
  ports[otherId] = port
  port.start()
  if (associating[otherId]) {
    // resolve promise to reveal the expected association
    const { resolve } = associating[otherId]
    delete associating[otherId]
    resolve(port)
  }
}

export function connectSystems(leftId: number, rightId: number): void {
  if (leftId === rightId) {
    throw new Error(`invalid connection ${leftId} <-> ${rightId}`)
  }
  const leftPort = ports[leftId]
  const rightPort = ports[rightId]
  if (!leftPort || !rightPort) {
    throw new Error(`missing ${leftPort ? "" : "L"}${rightPort ? "" : "R"} in connection ${leftId} <-> ${rightId}`)
  }
  // send association message to both sides of the connection
  const { port1, port2 } = new MessageChannel()
  const rightAssociation: Association = { id: rightId, port: port1 }
  leftPort.postMessage(rightAssociation, [port1])
  const leftAssociation: Association = { id: leftId, port: port2 }
  rightPort.postMessage(leftAssociation, [port2])
}

export function allocateNextId(): Future.Event<number> {
  if (kernel.isSupervised()) {
    // subsystems send an allocation message to the top system
    const allocation: Allocation = {}
    ports[0].postMessage(allocation)
    // consume id from allocation exchange after reservation message has arrived
    return allocationExchange.consume()
  } else {
    // top system keeps track of next system id
    return future.spark({ result: nextId++ })
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
  readonly context?: NearbyContext
}
// optional context of oneway message
interface NearbyContext {
  readonly sender?: {
    readonly id: number
    readonly path: string
  }
  readonly correlation: number
}
// all network messages
type Message = Allocation | Reservation | Association | Connection | OneWay
// the next id is only valid in the top system
let nextId = 1
// rendezvous allocation exchange is only valid in a subsystem
const allocationExchange = future.createExchange<number>(0)
// keep track of expected associations with other systems in top network
const associating: { [id: number]: PromiseWithResolvers<Kernel.MessagePort> } = Object.create(null)
// all network portals from this system to other systems in top network
const ports: { [id: number]: Kernel.MessagePort } = Object.create(null)
function openPort(target: number): Promise<Kernel.MessagePort> {
  if (associating[target]) {
    // avoid duplicating expected associations; reuse existing promise
    return associating[target].promise
  } else {
    // send connection message to top system (resulting in association between this and target system)
    const connection: Connection = { target }
    ports[0].postMessage(connection)
    // create new promise and install expected association
    const combo = Promise.withResolvers<Kernel.MessagePort>()
    associating[target] = combo
    return combo.promise
  }
}
const externalSenderCache: { [id: number]: { [path: string]: Theater.ActorRef } } = Object.create(null)
function preserveMessageContext(context?: NearbyContext): Theater.MessageContext | undefined {
  if (!context) {
    // no context
    return
  }
  const { sender, correlation } = context
  if (!sender) {
    // only a correlation
    return { correlation }
  }
  const { id, path } = sender
  externalSenderCache[id] ??= Object.create(null)
  externalSenderCache[id][path] ??= theater.startActor(NearbyRole, id, path)
  // cached sender from other system and correlation
  return { sender: externalSenderCache[id][path], correlation }
}
let internalSenders = 0
const internalId = id()
const internalSenderCache = new Map<Theater.ActorRef, number>()
class NearbyRole extends theater.Role<Theater.Actor>()(Object) implements Theater.Script<Theater.Actor> {
  // system id
  readonly #id: number
  // path to system component
  readonly #path: string
  #preserveNearbyContext(senderRef?: Theater.ActorRef, correlation?: number): NearbyContext | undefined {
    if (senderRef === void 0 && correlation === void 0) {
      // nothing to preserve
      return
    }
    if (!senderRef || theater.isGhostRef(senderRef)) {
      // possibly preserve numeric correlation
      return correlation !== void 0 ? { correlation } : void 0
    }
    if (internalSenderCache.has(senderRef)) {
      // reuse component path of internal sender
      return {
        sender: { id: internalId, path: `sender/${internalSenderCache.get(senderRef)}` },
        correlation: correlation ?? -1,
      }
    }
    const nextSenderId = ++internalSenders
    internalSenderCache.set(senderRef, nextSenderId)
    const senderContext = root().lookupContext("sender") as System.ContainerContext<System.Container>
    senderContext.subject().assign(String(nextSenderId), senderRef)
    return { sender: { id: internalId, path: `sender/${nextSenderId}` }, correlation: correlation ?? -1 }
  }
  protected *improviseScene(selector: string | symbol, parameters: unknown[]): Theater.Scene {
    if (typeof selector === "symbol") {
      throw new Error(`unsupported symbolic selector for nearby actor "${String(selector)}"`)
    }
    const port = ports[this.#id] ?? future.when<Kernel.MessagePort>(yield future.pledge(openPort(this.#id)))
    // preserve context in oneway message if necessary
    const { sender, correlation, transfer } = this.messageContext()
    const context = this.#preserveNearbyContext(sender, correlation)
    const oneway: OneWay = { path: this.#path, selector, parameters, context }
    // possibly transfer ownership
    port.postMessage(oneway, transfer ?? [])
  }
  constructor(id: number, path: string) {
    super()
    this.#id = id
    this.#path = path
  }
}
