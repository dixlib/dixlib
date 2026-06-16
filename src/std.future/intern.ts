import type Future from "std.future"
import type Fx from "std.fx"
import { fx } from "./extern.js"

export function isEvent<T>(it: unknown): it is Future.Event<T> {
  return facade.isHandling(it)
}

export function when<T>(signal: Future.Signal<T>): T {
  if ("error" in signal) {
    throw signal.error
  } else {
    return signal.result as T
  }
}

export function once<T>(begin: Future.Begin<T>, end?: Future.End<T>): Future.Event<T> {
  return new LeafEvent(begin, end).opaque
}

export function spark<T>(signal: Future.Signal<T>): Future.Event<T> {
  return once(reveal => reveal(signal))
}

export function timeout(ms: number): Future.Event<void> {
  let timer: number
  const begin =
    ms <= 0
      ? immediatelyReveal
      : function begin(reveal: Future.Reveal<void>) {
          timer = setTimeout(reveal, ms, {})
        }
  const end =
    ms <= 0
      ? void 0
      : function end(revealing: boolean) {
          if (!revealing) {
            clearTimeout(timer)
          }
        }
  return once(begin, end)
}

export function pledge<T>(promise: Promise<T>): Future.Event<T> {
  return once(reveal => {
    promise.then(
      result => reveal({ result }),
      reason => reveal({ error: fx.erroneous(reason) })
    )
  })
}

export function capture<C, T>(event: Future.Event<C>, trap: Future.Trap<C, T>): Future.Event<T> {
  return new CaptureEvent(facade.expose(event), trap as Future.Trap<unknown, unknown>).opaque
}

export function all(events: Iterable<Future.Event<unknown>>): Future.Event<unknown[]> {
  const group = [...events]
  switch (group.length) {
    case 0:
      return spark({ result: group })
    case 1:
      return capture(group[0], singletonResultTrap)
    default:
      return new AllEvent(group).opaque
  }
}

export function any(events: Iterable<Future.Event<unknown>>): Future.Event<unknown> {
  const group = [...events]
  switch (group.length) {
    case 0:
      return spark({
        error: new AggregateError(group, "at least one event is required for any result"),
      })
    case 1:
      return group[0]
    default:
      return new AnyEvent(group).opaque
  }
}

export function race(events: Iterable<Future.Event<unknown>>): Future.Event<unknown> {
  const group = [...events]
  switch (group.length) {
    case 0:
      return spark({
        error: new AggregateError(group, "at least one event is required for a race"),
      })
    case 1:
      return group[0]
    default:
      return new RaceEvent(group).opaque
  }
}

export function settle(events: Iterable<Future.Event<unknown>>): Future.Event<Future.Signal<unknown>[]> {
  const group = [...events]
  switch (group.length) {
    case 0:
      return spark({ result: group })
    case 1:
      return capture(group[0], singletonSignalTrap)
    default:
      return new SettleEvent(group).opaque
  }
}

export function commit<T>(event: Future.Event<T>, effect: Future.Reveal<T>): Future.Rollback | undefined {
  const commitEvent = new CommitEvent(facade.expose(event), effect as Future.Reveal<unknown>)
  const { opaque } = commitEvent
  function rollback() {
    if (opaque.isPending) {
      commitEvent.unblock(false, commitEvent)
    }
  }
  try {
    // iterate over unused leaf events and pending parent events
    for (const [leafEvent, parentEvent] of commitEvent.flatten(commitEvent)) {
      try {
        // start waiting period of leaf event (thus becoming pending)
        leafEvent.block(parentEvent)
      } catch (leafProblem) {
        // leaf event reveals an error, because it cannot block
        leafEvent.reveal({ error: fx.erroneous(leafProblem) })
      }
      if (opaque.isUsed) {
        // the effect is immediate
        return
      }
    }
  } catch (flattenProblem) {
    // cancel everything that was done so far
    rollback()
    // signal an error, because the event hierarchy cannot be flattened
    effect({ error: fx.erroneous(flattenProblem) })
    return
  }
  // if control gets here, the commit event is still pending (and all leaves are pending)
  return rollback
}

export function createExchange<T>(capacity = Infinity): Future.Exchange<T> {
  return new Exchange<T>(capacity)
}

// ----------------------------------------------------------------------------------------------------------------- //
const facade: Fx.Facade<Future.Event<unknown>, EventObj> = fx.createFacade<Future.Event<unknown>, EventObj>(
  "std.future/Event",
  Object.create(Object.prototype, {
    isUnused: {
      get() {
        return facade.expose(this).parent === void 0
      },
    },
    isPending: {
      get() {
        return !!facade.expose(this).parent
      },
    },
    isUsed: {
      get() {
        return facade.expose(this).parent === false
      },
    },
  })
)
function immediatelyReveal(reveal: Future.Reveal<void>) {
  reveal({})
}
function singletonResultTrap(signal: Future.Signal<unknown>) {
  return "error" in signal ? { error: signal.error } : { result: [signal.result] }
}
function singletonSignalTrap(signal: Future.Signal<unknown>) {
  return { result: [signal] }
}
abstract class EventObj {
  // opaque handle of this event object
  readonly #opaque: Future.Event<unknown>
  #parentEvent?: ParentEvent | false
  constructor() {
    this.#opaque = facade.handle(this)
    this.#parentEvent = void 0
  }
  get parent() {
    return this.#parentEvent
  }
  get opaque() {
    return this.#opaque
  }
  abstract flatten(parent: ParentEvent): Generator<[LeafEvent, ParentEvent]>
  block(parent: ParentEvent) {
    if (this.#parentEvent !== void 0) {
      throw new Error("cannot block if event is already pending or used")
    }
    this.#parentEvent = parent
  }
  unblock(_revealing: boolean, parent: ParentEvent) {
    if (parent !== this.#parentEvent) {
      throw new Error("cannot unblock with invalid parent")
    }
    this.#parentEvent = false
  }
  reveal(signal: Future.Signal<unknown>) {
    const { parent } = this
    if (parent === void 0) {
      throw new Error("cannot reveal if event is unused")
    } else if (parent) {
      // reveal if event is still pending
      this.unblock(true, parent)
      parent.propagate(this, signal)
    } // else silently ignore revelation of this used event
  }
}
class LeafEvent extends EventObj {
  #begin?: Future.Begin<unknown>
  #end?: Future.End<unknown>
  constructor(begin: Future.Begin<unknown>, end?: Future.End<unknown>) {
    super()
    this.#begin = begin
    this.#end = end
  }
  *flatten(parent: ParentEvent): Generator<[LeafEvent, ParentEvent]> {
    yield [this, parent]
  }
  block(parent: ParentEvent): void {
    super.block(parent)
    const begin = this.#begin as Future.Begin<unknown>
    const { reveal, opaque } = this
    this.#begin = void 0
    begin(reveal.bind(this), opaque)
  }
  unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    const end = this.#end
    if (end) {
      this.#end = void 0
      end(revealing, this.opaque)
    }
  }
}
abstract class ParentEvent extends EventObj {
  protected abstract makeOffspring(): IteratorObject<EventObj>
  *flatten(grandparent: ParentEvent) {
    this.block(grandparent)
    for (const child of this.makeOffspring()) {
      yield* child.flatten(this)
    }
  }
  abstract propagate(child: EventObj, signal: Future.Signal<unknown>): void
}
abstract class FosterEvent extends ParentEvent {
  #child?: EventObj
  protected *makeOffspring(): Generator<EventObj> {
    yield this.#child as EventObj
  }
  protected abstract foster(signal: Future.Signal<unknown>): void
  constructor(child: EventObj) {
    super()
    this.#child = child
  }
  propagate(child: EventObj, signal: Future.Signal<unknown>) {
    if (child !== this.#child) {
      throw new Error("cannot propagate signal from invalid child")
    }
    this.#child = void 0
    // delegate further processing of signal to subclass, after child has been verified
    this.foster(signal)
  }
  unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    const child = this.#child as EventObj
    this.#child = void 0
    if (!revealing) {
      // if child is undefined, it has already propagated a signal in the past
      child.unblock(false, this)
    }
  }
}
class CaptureEvent extends FosterEvent {
  #trap?: Future.Trap<unknown, unknown>
  protected foster(signal: Future.Signal<unknown>) {
    const trap = this.#trap as Future.Trap<unknown, unknown>
    this.reveal(trap(signal))
  }
  constructor(child: EventObj, trap: Future.Trap<unknown, unknown>) {
    super(child)
    this.#trap = trap
  }
  unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    this.#trap = void 0
  }
}
class CommitEvent extends FosterEvent {
  #effect?: Future.Reveal<unknown>
  protected foster(signal: Future.Signal<unknown>) {
    const effect = this.#effect as Future.Reveal<unknown>
    // the pending commit event was its own parent
    this.unblock(true, this)
    effect(signal)
  }
  constructor(child: EventObj, effect: Future.Reveal<unknown>) {
    super(child)
    this.#effect = effect
  }
  unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    this.#effect = void 0
  }
}
abstract class FamilyEvent extends ParentEvent {
  #children?: Set<EventObj>
  protected makeOffspring(): IteratorObject<EventObj> {
    return (this.#children as Set<EventObj>).values()
  }
  protected get children() {
    return this.#children
  }
  protected get size() {
    //biome-ignore lint/style/noNonNullAssertion: assume children are defined
    return this.#children!.size
  }
  protected abstract propagateFrom(child: EventObj, signal: Future.Signal<unknown>): void
  constructor(events: Future.Event<unknown>[]) {
    super()
    if (events.length < 2) {
      throw new Error("at least two events are required for an event family")
    }
    // convert array of events to set of event objects
    this.#children = new Set(events.map(facade.expose))
  }
  propagate(child: EventObj, signal: Future.Signal<unknown>) {
    if (!child || !this.#children?.has(child)) {
      throw new Error("cannot propagate signal from an invalid family member")
    }
    this.propagateFrom(child, signal)
  }
  unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    const children = this.#children as Set<EventObj>
    this.#children = void 0
    for (const child of children) {
      if (child.opaque.isPending) {
        child.unblock(false, this)
      }
    }
  }
}
class AllEvent extends FamilyEvent {
  #eventResults?: Map<EventObj, unknown>
  protected propagateFrom(child: EventObj, signal: Future.Signal<unknown>) {
    if ("error" in signal) {
      this.reveal(signal)
    } else {
      this.#eventResults ??= new Map()
      const eventResults = this.#eventResults
      eventResults.set(child, signal.result)
      if (eventResults.size === this.size) {
        //biome-ignore lint/style/noNonNullAssertion: size of children is nonzero
        const results = [...this.children!.values().map(eventObj => eventResults.get(eventObj)!)]
        this.reveal({ result: results })
      }
    }
  }
  constructor(events: Future.Event<unknown>[]) {
    super(events)
    this.#eventResults = void 0
  }
  unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    this.#eventResults = void 0
  }
}
class AnyEvent extends FamilyEvent {
  #eventErrors?: Map<EventObj, Error>
  protected propagateFrom(child: EventObj, signal: Future.Signal<unknown>) {
    if ("error" in signal) {
      this.#eventErrors ??= new Map()
      const eventErrors = this.#eventErrors
      eventErrors.set(child, signal.error)
      if (eventErrors.size === this.size) {
        //biome-ignore lint/style/noNonNullAssertion: size of children is nonzero
        const errors = [...this.children!.values().map(eventObj => eventErrors.get(eventObj)!)]
        this.reveal({
          error: new AggregateError(errors, `burnout after ${this.size} attempts for any signal`),
        })
      }
    } else {
      this.reveal(signal)
    }
  }
  constructor(events: Future.Event<unknown>[]) {
    super(events)
    this.#eventErrors = void 0
  }
  unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    this.#eventErrors = void 0
  }
}
class RaceEvent extends FamilyEvent {
  protected propagateFrom(_childEvent: EventObj, signal: Future.Signal<unknown>) {
    this.reveal(signal)
  }
}
class SettleEvent extends FamilyEvent {
  #signals?: Map<EventObj, Future.Signal<unknown>>
  protected propagateFrom(child: EventObj, signal: Future.Signal<unknown>) {
    this.#signals ??= new Map()
    const signals = this.#signals
    signals.set(child, signal)
    if (signals.size === this.size) {
      //biome-ignore lint/style/noNonNullAssertion: size of children is nonzero
      const results = [...this.children!.values().map(eventObj => signals.get(eventObj)!)]
      this.reveal({ result: results })
    }
  }
  constructor(events: Future.Event<unknown>[]) {
    super(events)
    this.#signals = void 0
  }
  unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    this.#signals = void 0
  }
}
class Exchange<T> implements Future.Exchange<T> {
  readonly #capacity: number
  // all buffered items, potentially with duplicates (Set is not appropriate)
  readonly #items: T[]
  // underflow revelations are consumers blocked on an empty exchange
  readonly #underflow: Set<Future.Reveal<T>>
  // overflow revelations are producers blocked on a full exchange
  readonly #overflow: Set<Future.Reveal<void>>
  constructor(capacity: number) {
    this.#capacity = capacity
    this.#items = []
    this.#underflow = new Set()
    this.#overflow = new Set()
  }
  get capacity() {
    return this.#capacity
  }
  get isEmpty() {
    return this.#items.length === 0
  }
  get isFull() {
    return this.#items.length === this.#capacity
  }
  get isUnderflowing() {
    return this.#underflow.size > 0
  }
  get isOverflowing() {
    return this.#overflow.size > 0
  }
  produce(item: T): Future.Event<void> {
    let postponedRevelation: Future.Reveal<void> | undefined
    const begin: Future.Begin<void> = reveal => {
      if (this.#underflow.size > 0) {
        // reveal item to longest waiting consumer
        const [oldest] = this.#underflow
        this.#underflow.delete(oldest)
        oldest({ result: item })
        // confirm successful production
        reveal({})
      } else if (this.#items.length < this.#capacity) {
        // buffer item for future consumer
        this.#items.push(item)
        // confirm successful production
        reveal({})
      } else {
        // add postponed overflow revelation
        postponedRevelation = reveal
        this.#overflow.add(postponedRevelation)
      }
    }
    const end: Future.End<void> = revealing => {
      if (postponedRevelation) {
        if (revealing) {
          // 'spill' item to buffer after postponed overflow has been revealed
          this.#items.push(item)
        } else if (!this.#overflow.delete(postponedRevelation)) {
          throw new Error(`cancellation should delete postponed overflow revelation`)
        }
      }
    }
    return once(begin, end)
  }
  tryProduce(item: T): boolean {
    if (this.#underflow.size > 0) {
      // reveal item to longest waiting consumer
      const [oldest] = this.#underflow
      this.#underflow.delete(oldest)
      oldest({ result: item })
      return true
    } else if (this.#items.length < this.#capacity) {
      // buffer item for future consumer
      this.#items.push(item)
      return true
    }
    return false
  }
  consume(): Future.Event<T> {
    let postponedRevelation: Future.Reveal<T> | undefined
    const begin: Future.Begin<T> = reveal => {
      if (this.#overflow.size > 0) {
        // unblock oldest waiting producer, forcing it to spill the item to the buffer
        const [oldest] = this.#overflow
        this.#overflow.delete(oldest)
        oldest({})
      }
      if (this.#items.length > 0) {
        // remove and reveal first item from buffer
        reveal({ result: this.#items.shift() })
      } else {
        // add postponed underflow revelation if exchange is empty
        postponedRevelation = reveal
        this.#underflow.add(postponedRevelation)
      }
    }
    const end: Future.End<T> = revealing => {
      if (!revealing && postponedRevelation && !this.#underflow.delete(postponedRevelation)) {
        throw new Error(`cancellation should delete postponed underflow revelation`)
      }
    }
    return once(begin, end)
  }
  tryConsume(): T[] {
    const result = []
    if (this.#overflow.size > 0) {
      // unblock oldest waiting producer, forcing it to spill the item to the buffer
      const [oldest] = this.#overflow
      oldest({})
      this.#overflow.delete(oldest)
    }
    if (this.#items.length > 0) {
      // consume first item from exchange
      result.push(this.#items.shift() as T)
    }
    return result
  }
}
