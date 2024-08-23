// --- TypeScript ---
import type { Agent } from "./agent.ts"
import type { Gig } from "./gig.ts"
// immediate interrupts are handled synchronously
// fast interrupts are handled in a microtask
// normal interrupts are handled in a macrotask
type Priority = "immediate" | "fast" | "normal"
// --- JavaScript ---
import { kernel, loop } from "../extern.js"
import { ExclusiveStatus } from "./lifecycle.js"

export function isShowing() {
  return !!handling
}

export function negotiate(agent: Agent) {
  if (agent.fate) {
    throw new Error("negotiated actor must be alive")
  }
  if (agent.isSuspended) {
    suspended.add(agent)
  } else if (agent.workload.size > 0) {
    ready.add(agent)
    if (!handling && !willEntertain) {
      // give stage to ready agent in microtask (i.e. in current cycle of the event loop)
      willEntertain = true
      cause("fast", entertainment())
    }
  } else if (agent.agenda.size > 0) {
    waiting.add(agent)
  } else {
    idle.add(agent)
  }
}

export function showing() {
  const { first } = active
  if (!first) {
    throw new Error("nothing is currently showing")
  }
  return first
}

// open curtain to perform synchronous suprise act on stage
export function performSolo(gig: Gig) {
  cause("immediate", loop.over([gig]))
}

// ----------------------------------------------------------------------------------------------------------------- //
// one active gig on stage when curtain is open
const active = new ExclusiveStatus<Gig>("active")
// one busy agent on stage when curtain is open
const busy = new ExclusiveStatus<Agent>("busy")
// suspended agents cannot work on stage
const suspended = new ExclusiveStatus<Agent>("suspended")
// ready agents want to work on stage
const ready = new ExclusiveStatus<Agent>("ready")
// waiting agents have nothing to do, but they anticipate to work in the future
const waiting = new ExclusiveStatus<Agent>("waiting")
// idle agents have nothing to do and they also have nothing planned
const idle = new ExclusiveStatus<Agent>("idle")
// interrupt occurence that's being handled
let handling: Interrupt | undefined = void 0
// true if future entertainment is pending
let willEntertain = false
// handle interrupt occurence
function handleInterrupt(interrupt: Interrupt, playlist: IterableIterator<Gig>) {
  if (handling) {
    throw new Error("cannot nest interrupt occurences")
  }
  handling = interrupt
  try {
    // open curtain and process playlist
    for (const gig of playlist) {
      if (active.size || busy.size) {
        throw new Error("stage must be empty when taking stage")
      }
      active.add(gig)
      busy.add(gig.agent)
      gig.takeStage()
      // break when budget has been exhausted
      if (interrupt.budget === 0) {
        if (active.size || busy.size) {
          throw new Error("stage must be empty when leaving stage")
        }
        break
      }
    }
  } finally {
    active.clear()
    busy.clear()
    handling = void 0
  }
  // this code will only execute on a clean exit
  if (ready.size > 0 && !willEntertain) {
    // give stage to ready agent in macrotask (i.e. in a future cycle of the event loop)
    willEntertain = true
    cause("normal", entertainment())
  }
}
// budgets (in ms) for an interrupt occurence with a certain priority
const immediateBudget = 4, fastBudget = 6, normalBudget = 10
// cause an interrupt and handle it accordingly
function cause(priority: Priority, playlist: IterableIterator<Gig>) {
  const start = performance.now()
  switch (priority) {
    case "immediate":
      // execute synchronous handler
      return handleInterrupt(new Interrupt("immediate", start, start, immediateBudget), playlist)
    case "fast":
      const microtask = () =>
        handleInterrupt(new Interrupt("fast", start, performance.now(), fastBudget), playlist)
      // schedule microtask handler
      return queueMicrotask(microtask)
    default:
      const macrotask = () =>
        handleInterrupt(new Interrupt("normal", start, performance.now(), normalBudget), playlist)
      // schedule macrotask handler
      return kernel.queueMacrotask(macrotask)
  }
}
// show regular entertainment on stage, i.e. with gigs from ready agents
function* entertainment() {
  willEntertain = false
  for (let agent: Agent | undefined; (agent = ready.first);) {
    const { first } = agent.workload
    if (!first) {
      throw new Error("ready actor with empty workload")
    }
    yield first
  }
}
// interrupt occurence with fixed time budget
class Interrupt {
  #priority: Priority
  #start: number
  #entry: number
  #budget: number
  constructor(priority: Priority, start: number, entry: number, budget: number) {
    this.#priority = priority
    this.#start = start
    this.#entry = entry
    this.#budget = budget
  }
  public get priority() { return this.#priority }
  public get start() { return this.#start }
  public get latency() { return this.#entry - this.#start }
  public get budget() { return Math.max(0, this.#entry + this.#budget - performance.now()) }
  public get excess() { return Math.max(0, performance.now() - this.#budget - this.#entry) }
}
