// --- TypeScript ---
import type Future from 'std.future'
import type Kernel from 'std.kernel'
import type Loader from 'std.loader'
import type System from 'std.system'
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
  // unique sequence number of request/response pair (per portal)
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
  // same sequence number as corresponding request (over same portal)
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
import { parentPort, ancestry as inheritedAncestry } from "../main.js"
import { future, kernel, loader as theLoader, news, theater } from "../extern.js"
import { ContainerRole } from "./container.js"
import { LoggerRole } from "./logger.js"

export function ancestry() {
  return systemAncestry.slice() as [number, ...number[]]
}

export function id(): number {
  return systemAncestry[0]
}

export function root(): System.Context<System.Root> {
  return rootContext
}

export function loader(): Loader {
  return theLoader
}

export function Nearby<A extends Theater.Actor>(): Theater.RoleClass<A, [number, string]> {
  return NearbyRole as unknown as Theater.RoleClass<A, [number, string]>
}

export function associatePort(candidateId: number, port: Kernel.MessagePort) {
  if (portals[candidateId]) {
    throw new Error(`cannot associate system ${candidateId} twice on the network`)
  }
  if (candidateId === id()) {
    throw new Error(`cannot associate system ${candidateId} in its own network`)
  }
  const portal = portals[candidateId] = new Portal(port, candidateId)
  if (associating[candidateId]) {
    // resolve promise to reveal the expected association
    const [, resolve] = associating[candidateId]
    resolve(portal)
    delete associating[candidateId]
  }
}

export function connectSystems(left: number, right: number) {
  if (left === right) {
    throw new Error(`invalid connection ${left} <-> ${right}`)
  }
  const leftPortal = portals[left], rightPortal = portals[right]
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
  if (kernel.isUnparented()) {
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
// use inherited ancestry that parent passed on if this is not the top system in the network
const systemAncestry = kernel.isUnparented() ? [0] : inheritedAncestry
// role of a system actor
class RootRole extends ContainerRole<System.Root>()(Object) implements Theater.Script<System.Root> {
  protected *initializeRole(): Theater.Scene<void> {
    const logger = kernel.isUnparented() ?
      // top logger writes messages to console
      this.castChild<System.Logger, []>({ Role: LoggerRole, p: [], guard: () => "forgive" }) :
      // logger in subsystems forwards messages to top logger (system id = 0, path = "logger")
      this.castChild<System.Logger, [number, string]>({
        Role: NearbyRole as unknown as Theater.RoleClass<System.Logger, [number, string]>,
        p: [0, "logger"],
        guard: () => "forgive"
      })
    // every system has a logger component at path "logger"
    this.assignComponent("logger", logger)
    const background = this.playScene(function* () {
      // make sure the system consumes news items and reports them to the logger 
      for (; ;) {
        const message = yield* theater.when(news.consume())
        const origin = systemAncestry.slice(0, systemAncestry.length - (systemAncestry.length > 1 ? 1 : 0))
        yield* theater.when(logger.report({ ...message, origin }))
      }
    })
    background.run()
  }
  @theater.Play public *ancestry(): Theater.Scene<[number, ...number[]]> { return ancestry() }
  @theater.Play public *id(): Theater.Scene<number> { return id() }
  @theater.Play public *launch(): Theater.Scene<void> {
    console.log(performance.now())
    throw new Error("dammit")
  }
}
// the next id is only valid in the top system; the rendezvous allocation exchange is only valid in a subsystem
let nextId = 1, allocationExchange = future.exchange<number>(0)
// keep track of expected associations with other systems
const associating: { [id: number]: [Promise<Portal>, (portal: Portal) => void] | undefined } = Object.create(null)
// all network portals from this system to other systems
const portals: { [id: number]: Portal } = Object.create(null)
class Portal {
  readonly #port: Kernel.MessagePort
  // pending revelations for sent requests
  readonly #pending: { [sequence: number]: Future.Reveal<unknown> | undefined }
  // sequence for next request to send
  #nextSequence: number
  constructor(port: Kernel.MessagePort, otherId: number) {
    this.#port = port
    const pending: { [sequence: number]: Future.Reveal<unknown> | undefined } = this.#pending = Object.create(null)
    this.#nextSequence = 1
    const running: { [sequence: number]: Theater.Job<unknown> | undefined } = Object.create(null)
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
          // @ts-ignore: dynamically invoke actor method to create component job
          const job: Theater.Job<unknown> = component[message.selector](...message.parameters)
          // play scene on theater stage for component job
          running[sequence] = theater.run(function* () {
            // wait for component job to signal completion
            const signal = yield job
            // clean up after completion 
            delete running[sequence]
            // send response back
            const response: Response = { sequence, signal }
            port.postMessage(response)
          })
        }
      } else if ("signal" in message) {
        // process received response message
        const { sequence, signal } = message, reveal = pending[sequence]
        if (reveal) {
          reveal(signal)
        } else {
          news.warn("missing pending request for received response %d", sequence)
        }
      } else if ("unsequence" in message) {
        // process received cancellation message
        const { unsequence } = message, job = running[unsequence]
        if (job) {
          delete running[unsequence]
          job.quit()
        } else {
          news.warn("missing running job for cancellation %d", unsequence)
        }
      } else if ("allocated" in message) {
        // process received reservation message
        const { allocated } = message
        if (kernel.isUnparented()) {
          // only subsystems should receive reservation messages
          throw new Error(`inappropriate reservation of ${allocated} from ${otherId}`)
        }
        // underflow should occur when this system has an outstanding allocation message
        if (!allocationExchange.isUnderflowing) {
          throw new Error(`illegal state for reservation of ${allocated} from ${otherId} at ${id()}`)
        }
        // run a scene on theater stage to produce the allocated id and unblock the consumer
        theater.run(function* () { yield allocationExchange.produce(allocated) })
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
function startPortal(target: number): Promise<Portal> {
  if (associating[target]) {
    // avoid duplicating expected associations; reuse existing promise 
    const [promise] = associating[target]
    return promise
  } else {
    // create new promise and install expected association 
    const { promise, resolve } = Promise.withResolvers<Portal>()
    associating[target] = [promise, resolve]
    // send connection message to top system (resulting in association between this and target system)
    const connection: Connection = { target }
    portals[0].port.postMessage(connection)
    return promise
  }
}
class NearbyRole extends theater.Role<Theater.Actor>()(Object) implements Theater.Script<Theater.Actor> {
  readonly #id: number
  readonly #path: string
  protected *improviseScene<T, P extends unknown[]>(selector: string | symbol, p: P): Theater.Scene<T> {
    if (typeof selector === "symbol") {
      throw new Error(`unsupported symbolic selector for nearby actor "${String(selector)}"`)
    }
    const portal = portals[this.#id] ?? (yield* theater.when(startPortal(this.#id)))
    return yield* theater.when<T>(portal.send(this.#path, selector, p))
  }
  constructor(id: number, path: string) {
    super()
    this.#id = id
    this.#path = path
  }
}
const rootContext = await theater.cast<System.Root, []>({
  Role: RootRole, p: [],
  guard({ blooper, selector, parameters }: Theater.Incident<Theater.Actor>): Theater.Verdict {
    news.error(`system container problem "%s"/%d - %O`, String(selector), parameters.length, blooper)
    return "forgive"
  }
}).view()
if (!kernel.isUnparented()) {
  // grab parent id from ancestry chain and associate this child with its parent port in the network
  associatePort(ancestry()[1], parentPort)
}
