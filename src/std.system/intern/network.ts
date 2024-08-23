// --- TypeScript ---
import type Future from 'std.future'
import type Kernel from 'std.kernel'
import type Theater from 'std.theater'
// association message binds a system (id) to a port in the network
interface Association {
  readonly id: number
  readonly port: Kernel.MessagePort
}
// connection message is sent to top system to connect sender to target system
interface Connection {
  readonly target: number
}
// request message is a component method invocation
interface Request {
  // unique sequence number of request/response pair (per channel)
  readonly sequence: number
  // path to component actor that performs the method
  readonly path: string
  // selector of component method
  readonly selector: string
  // method parameters
  readonly parameters: unknown[]
}
// response message is result of a request
interface Response {
  // same sequence number as corresponding request (over same channel)
  readonly sequence: number
  // signal with prompt or blooper of component method invocation
  readonly signal: Future.Signal<unknown>
}
// cancellation message quits request processing
interface Cancellation {
  readonly unsequence: number
}
// (empty) allocation message allocates unique system id for new subsystem 
interface Allocation { }
// reservation message conveys allocated id of new subsystem
interface Reservation {
  readonly allocated: number
}
// all network messages
type Message = Association | Connection | Request | Response | Cancellation | Allocation | Reservation
// --- JavaScript ---
import { parentPort } from "../main.js"
import { future, kernel, theater } from "../extern.js"
import { ancestry, id, root } from "./singleton.js"

export function Nearby<A extends Theater.Actor>(): Theater.RoleClass<A, [number, string]> {
  return NearbyRole as unknown as Theater.RoleClass<A, [number, string]>
}

export function associatePort(candidateId: number, port: Kernel.MessagePort) {
  if (channels[candidateId]) {
    throw new Error(`cannot associate system ${candidateId} twice on the network`)
  }
  if (candidateId === id()) {
    throw new Error(`cannot associate system ${candidateId} in its own network`)
  }
  const channel = channels[candidateId] = new Channel(port, candidateId)
  if (associating[candidateId]) {
    // resolve promise to reveal the expected association
    const [, resolve] = associating[candidateId]
    resolve(channel)
    delete associating[candidateId]
  }
}

export function connectSystems(left: number, right: number) {
  if (left === right) {
    throw new Error(`invalid connection ${left} <-> ${right}`)
  }
  const leftChannel = channels[left], rightChannel = channels[right]
  if (!leftChannel || !rightChannel) {
    throw new Error(`missing ${leftChannel ? "" : "L"}${rightChannel ? "" : "R"} in connection ${left} <-> ${right}`)
  }
  // send association message to both sides of the connection
  const { port1, port2 } = new MessageChannel()
  const rightAssociation: Association = { id: right, port: port1 }
  leftChannel.port.postMessage(rightAssociation, [port1])
  const leftAssociation: Association = { id: left, port: port2 }
  rightChannel.port.postMessage(leftAssociation, [port2])
}

export function allocateId(): Future.Cue<number> {
  if (kernel.isUnparented()) {
    // top system keeps track of next system id
    return future.spark({ prompt: nextId++ })
  } else {
    // other systems send an allocation message to the top system
    const allocation: Allocation = {}
    channels[0].port.postMessage(allocation)
    // consume allocated id from allocation exchange after reservation message has arrived
    return allocationExchange.consume()
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
// the next id is only valid in the top system; the rendezvous allocation exchange is only valid in a subsystem
let nextId = 1, allocationExchange = future.exchange<number>(0)
// keep track of expected associations with other systems
const associating: { [id: number]: [Promise<Channel>, (channel: Channel) => void] | undefined } = Object.create(null)
// all network channels from this system to other systems
const channels: { [id: number]: Channel } = Object.create(null)
class Channel {
  readonly #port: Kernel.MessagePort
  // pending revelations for sent requests
  readonly #pending: { [sequence: number]: Future.Reveal<unknown> | undefined }
  // sequence for next request to send
  #nextSequence: number
  constructor(port: Kernel.MessagePort, otherId: number) {
    this.#port = port
    const pending = this.#pending = Object.create(null)
    this.#nextSequence = 1
    const running  = Object.create(null)
    port.addEventListener("message", event => {
      const message: Message = event.data
      if ("id" in message) {
        // process received association message
        associatePort(message.id, message.port)
      } else if ("target" in message) {
        // process received connection message
        const left = otherId, right = message.target
        if (!kernel.isUnparented()) {
          // only top system should receive connection messages
          throw new Error(`inappropriate connection ${left} <-> ${right} at ${id()}`)
        }
        connectSystems(left, right)
      } else if ("path" in message) {
        // process received request message
        const { path, sequence } = message, component = root().resolve(path)
        if (!component) {
          // send immediate response that component was not found
          const response: Response = { sequence, signal: { blooper: new Error(`invalid component path "${path}"`) } }
          port.postMessage(response)
        } else {
          //@ts-ignore: dynamically invoke actor method to create component job
          const job: Theater.Job<unknown> = component[message.selector](...message.parameters)
          // play scene on theater stage for component job
          running[sequence] = theater.play(function* () {
            // wait for component job to signal completion
            const signal = yield job
            // clean up after completion 
            delete running[sequence]
            // send response back
            const response: Response = { sequence, signal }
            port.postMessage(response)
          })
          running[sequence].run()
        }
      } else if ("signal" in message) {
        // process received response message
        const { sequence, signal } = message, reveal = pending[sequence]
        if (reveal) {
          reveal(signal)
        } else {
          //TODO report warning?
        }
      } else if ("unsequence" in message) {
        // process received cancellation message
        const { unsequence } = message
        running[unsequence]?.quit()
        delete running[unsequence]
      } else if ("allocated" in message) {
        // process received reservation message
        const { allocated } = message
        if (kernel.isUnparented()) {
          // only subsystems should receive reservation messages
          throw new Error(`inappropriate reservation of ${allocated} from ${otherId}`)
        }
        // underflow should occur when this system has an outstanding allocation message
        if (!allocationExchange.isUnderflowing) {
          throw new Error(`illegal state for reservation of ${allocateId} from ${otherId} at ${id()}`)
        }
        // play scene on theater stage to produce the allocated id and unblock the consumer
        theater.play(function* () { yield allocationExchange.produce(allocated) }).run()
      } else {
        // process received allocation message
        if (!kernel.isUnparented()) {
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
  public get port() { return this.#port }
  public send(path: string, selector: string, parameters: unknown[]): Future.Cue<unknown> {
    let pendingSequence: number
    const begin: Future.Begin<unknown> = reveal => {
      // allocate sequence number for next request
      const sequence = this.#nextSequence++
      // install pending revelation for next request
      this.#pending[pendingSequence = sequence] = reveal
      // send next request to other side
      const request: Request = { sequence, path, selector, parameters }
      this.#port.postMessage(request)
    }
    const end: Future.End<unknown> = revealing => {
      if (!revealing) {
        // send cancellation message to other side
        const cancellation: Cancellation = { unsequence: pendingSequence }
        this.#port.postMessage(cancellation)
      }
      delete this.#pending[pendingSequence]
    }
    return future.once(begin, end)
  }
}
function startChannel(target: number): Promise<Channel> {
  if (associating[target]) {
    // avoid duplicating expected associations; reuse existing promise 
    const [promise] = associating[target]
    return promise
  } else {
    // create new promise and install expected association 
    const { promise, resolve } = Promise.withResolvers<Channel>()
    associating[target] = [promise, resolve]
    // send connection message to top system (resulting in association between this and target system)
    const connection: Connection = { target }
    channels[0].port.postMessage(connection)
    return promise
  }
}
class NearbyRole extends theater.Role<Theater.Actor>()(Object) implements Theater.Script<Theater.Actor> {
  readonly #id: number
  readonly #path: string
  protected *improviseScene<T, P extends unknown[]>(selector: string | symbol, ...p: P): Theater.Scene<T> {
    if (typeof selector === "symbol") {
      throw new Error(`unsupported symbolic selector for nearby actor "${String(selector)}"`)
    }
    const channel = channels[this.#id] ?? (yield* theater.when(startChannel(this.#id)))
    return yield* theater.when<T>(channel.send(this.#path, selector, p))
  }
  constructor(id: number, path: string) {
    super()
    this.#id = id
    this.#path = path
  }
}
if (!kernel.isUnparented()) {
  // grab parent id from ancestry chain and associate this child with its parent port in the network
  associatePort(ancestry()[1], parentPort)
}
