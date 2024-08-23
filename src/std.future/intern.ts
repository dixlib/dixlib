// --- TypeScript ---
import type Future from 'std.future'
import type Fx from 'std.fx'
// --- JavaScript ---
import { fn, fx, loop } from "./extern.js"

export function isCue<T>(it: unknown): it is Future.Cue<T> {
  return facade.isHandling(it)
}

export function isTeleprompter<T>(it: unknown): it is Future.Teleprompter<T> {
  return typeof it === "object" && !!it && "autocue" in it && typeof it.autocue === "function"
}

export function isHint<T>(it: unknown): it is Future.Hint<T> {
  return isCue(it) || isTeleprompter(it) || it instanceof Promise
}

export function once<T>(begin: Future.Begin<T>, end?: Future.End<T>): Future.Cue<T> {
  return new LeafEvent(begin, end).cue
}

export function often<T>(begin: Future.Begin<T>, end?: Future.End<T>): Future.Teleprompter<T> {
  return { autocue: () => once(begin, end) }
}

export function spark<T>(signal: Future.Signal<T>): Future.Cue<T> {
  return once(reveal => reveal(signal))
}

export function timeout(ms: number): Future.Cue<void> {
  let timer: number
  const begin = ms <= 0 ? awakeImmediately : function begin(reveal: Future.Reveal<void>) {
    timer = setTimeout(reveal, ms, {})
  }
  const end = ms <= 0 ? void 0 : function end(revealing: boolean) {
    if (!revealing) {
      clearTimeout(timer)
    }
  }
  return once(begin, end)
}

export function capture<C, T>(hint: Future.Hint<C>, trap: Future.Trap<C, T>): Future.Cue<T> {
  return new CaptureEvent(hint, trap as Future.Trap<unknown, unknown>).cue
}

export function all(hints: Iterable<Future.Hint<unknown>>): Future.Cue<unknown[]> {
  const childHints = [...hints]
  switch (childHints.length) {
    case 0: return spark({ prompt: childHints })
    case 1: return capture(childHints[0], singletonPromptTrap)
    default: return new AllEvent(childHints).cue
  }
}

export function any(hints: Iterable<Future.Hint<unknown>>): Future.Cue<unknown> {
  const childHints = [...hints]
  switch (childHints.length) {
    case 0: return spark({ blooper: new AggregateError(childHints, "at least one hint is required for any prompt") })
    case 1: return capture(childHints[0], fn.returnIt)
    default: return new AnyEvent(childHints).cue
  }
}

export function race(hints: Iterable<Future.Hint<unknown>>): Future.Cue<unknown> {
  const childHints = [...hints]
  switch (childHints.length) {
    case 0: return once(fn.returnNothing)
    case 1: return capture(childHints[0], fn.returnIt)
    default: return new RaceEvent(childHints).cue
  }
}

export function settle(hints: Iterable<Future.Hint<unknown>>): Future.Cue<Future.Signal<unknown>[]> {
  const childHints = [...hints]
  switch (childHints.length) {
    case 0: return spark({ prompt: childHints })
    case 1: return capture(childHints[0], singletonSignalTrap)
    default: return new SettleEvent(childHints).cue
  }
}

export function commit<T>(hint: Future.Hint<T>, effect: Future.Reveal<T>): Future.Rollback | undefined {
  const commitEvent = new CommitEvent(hint, effect as Future.Reveal<unknown>), commitCue = commitEvent.cue
  function rollback() {
    if (commitCue.isPending) {
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
        // leaf event reveals a blooper, because it cannot block 
        leafEvent.reveal({ blooper: fx.erroneous(leafProblem) })
      }
      if (commitCue.isUsed) {
        // the effect is immediate
        return
      }
    }
  } catch (flattenProblem) {
    // cancel everything that was done so far
    rollback()
    // signal a blooper, because the cue hierarchy cannot be flattened 
    effect({ blooper: fx.erroneous(flattenProblem) })
    return
  }
  // if control gets here, the commit cue is still pending (and all leaves are pending)
  return rollback
}

export function exchange<T>(capacity = Infinity): Future.Exchange<T> {
  return new Exchange<T>(capacity)
}

// ----------------------------------------------------------------------------------------------------------------- //
const facade: Fx.Facade<Future.Cue<unknown>, Event> =
  fx.facade<Future.Cue<unknown>, Event>("std.future:Cue", Object.create(Object.prototype, {
    isUnused: { get() { return facade.expose(this).parent === void 0 } },
    isPending: { get() { return !!facade.expose(this).parent } },
    isUsed: { get() { return facade.expose(this).parent === false } },
  }))
function awakeImmediately(reveal: Future.Reveal<void>) {
  reveal({})
}
function singletonPromptTrap(signal: Future.Signal<unknown>) {
  return signal.blooper ? { blooper: signal.blooper } : { prompt: [signal.prompt] }
}
function singletonSignalTrap(signal: Future.Signal<unknown>) {
  return { prompt: [signal] }
}
function eventual(hint: Future.Hint<unknown>): Event {
  let cue: Future.Cue<unknown>
  if (isCue(hint)) {
    cue = hint
  } else if (isTeleprompter(hint)) {
    cue = hint.autocue()
  } else if (hint instanceof Promise) {
    cue = once((reveal: Future.Reveal<unknown>, cue: Future.Cue<unknown>) => {
      function resolve(prompt: unknown) {
        if (cue.isPending) {
          reveal({ prompt })
        }
      }
      function reject(reason: unknown) {
        if (cue.isPending) {
          reveal({ blooper: fx.erroneous(reason) })
        }
      }
      hint.then(resolve, reject)
    })
  } else {
    throw new Error("hint must be a cue, teleprompter or promise")
  }
  return facade.expose(cue)
}
abstract class Event {
  #parentEvent?: ParentEvent | false
  constructor() {
    this.cue = facade.handle(this)
    this.#parentEvent = void 0
  }
  public get parent() {
    return this.#parentEvent
  }
  public readonly cue: Future.Cue<unknown>
  public abstract flatten(parent: ParentEvent): IterableIterator<[LeafEvent, ParentEvent]>
  public block(parent: ParentEvent) {
    if (this.#parentEvent !== void 0) {
      throw new Error("cannot block if cue is already pending or used")
    }
    this.#parentEvent = parent
  }
  public unblock(_revealing: boolean, parent: ParentEvent) {
    if (parent !== this.#parentEvent) {
      throw new Error("cannot unblock with invalid parent")
    }
    this.#parentEvent = false
  }
  public reveal(signal: Future.Signal<unknown>) {
    const parent = this.#parentEvent
    if (!parent) {
      throw new Error("cannot reveal if cue is not pending")
    }
    this.unblock(true, parent)
    parent.propagate(this, signal)
  }
}
class LeafEvent extends Event {
  #begin?: Future.Begin<unknown>
  #end?: Future.End<unknown>
  constructor(begin: Future.Begin<unknown>, end?: Future.End<unknown>) {
    super()
    this.#begin = begin
    this.#end = end
  }
  public *flatten(parent: ParentEvent): IterableIterator<[LeafEvent, ParentEvent]> {
    yield [this, parent]
  }
  public block(parent: ParentEvent): void {
    super.block(parent)
    const begin = this.#begin!, { reveal, cue } = this
    this.#begin = void 0
    begin(reveal.bind(this), cue)
  }
  public unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    const end = this.#end
    if (end) {
      this.#end = void 0
      end(revealing, this.cue)
    }
  }
}
abstract class ParentEvent extends Event {
  protected abstract makeOffspring(): IterableIterator<Event>
  public *flatten(grandparent: ParentEvent) {
    this.block(grandparent)
    for (const child of this.makeOffspring()) {
      yield* child.flatten(this)
    }
  }
  public abstract propagate(child: Event, signal: Future.Signal<unknown>): void
}
abstract class DecoratorEvent extends ParentEvent {
  #hint?: Future.Hint<unknown>
  #event?: Event
  protected *makeOffspring() {
    if (!this.#hint) {
      throw new Error("cannot make offspring twice")
    }
    const hint = this.#hint
    this.#hint = void 0
    yield this.#event = eventual(hint)
  }
  protected abstract decorate(signal: Future.Signal<unknown>): void
  constructor(hint: Future.Hint<unknown>) {
    super()
    this.#hint = hint
    this.#event = void 0
  }
  public propagate(child: Event, signal: Future.Signal<unknown>) {
    if (child !== this.#event) {
      throw new Error("cannot propagate signal from invalid child")
    }
    this.#event = void 0
    this.decorate(signal)
  }
  public unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    const child = this.#event!
    this.#event = void 0
    if (!revealing) {
      child.unblock(false, this)
    }
  }
}
class CaptureEvent extends DecoratorEvent {
  #trap?: Future.Trap<unknown, unknown>
  protected decorate(signal: Future.Signal<unknown>) {
    const trap = this.#trap!
    this.#trap = void 0
    this.reveal(trap(signal))
  }
  constructor(hint: Future.Hint<unknown>, trap: Future.Trap<unknown, unknown>) {
    super(hint)
    this.#trap = trap
  }
}
abstract class FamilyEvent extends ParentEvent {
  #hints?: Future.Hint<unknown>[]
  #events?: Set<Event>
  protected *makeOffspring() {
    if (!this.#hints) {
      throw new Error("cannot make offspring twice")
    }
    const hints = this.#hints
    this.#hints = void 0
    const events = this.#events = new Set()
    for (const hint of hints) {
      const event = eventual(hint)
      events.add(event)
      yield event
    }
  }
  protected get offspring() {
    return this.#events
  }
  protected get size() {
    return this.#events!.size
  }
  protected abstract revealFrom(child: Event, signal: Future.Signal<unknown>): void
  constructor(hints: Future.Hint<unknown>[]) {
    super()
    if (hints.length < 2) {
      throw new Error("at least two hints are required for a cue family")
    }
    this.#hints = hints
    this.#events = void 0
  }
  public propagate(child: Event, signal: Future.Signal<unknown>) {
    if (!child || !this.#events || !this.#events.has(child)) {
      throw new Error("cannot propagte signal from an invalid family member")
    }
    this.revealFrom(child, signal)
  }
  public unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    const events = this.#events!
    this.#events = void 0
    for (const child of events) {
      if (child.cue.isPending) {
        child.unblock(false, this)
      }
    }
  }
}
class AllEvent extends FamilyEvent {
  #prompts?: Map<Event, unknown>
  protected revealFrom(child: Event, signal: Future.Signal<unknown>) {
    if (signal.blooper) {
      this.reveal(signal)
    } else {
      const prompts = this.#prompts ??= new Map()
      prompts.set(child, signal.prompt)
      if (prompts.size === this.size) {
        this.reveal({ prompt: [...loop.map(this.offspring!.values(), event => prompts.get(event)!)] })
      }
    }
  }
  constructor(childHints: Future.Hint<unknown>[]) {
    super(childHints)
    this.#prompts = void 0
  }
  public unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    this.#prompts = void 0
  }
}
class AnyEvent extends FamilyEvent {
  #bloopers?: Map<Event, Error>
  protected revealFrom(child: Event, signal: Future.Signal<unknown>) {
    if (signal.blooper) {
      const bloopers = this.#bloopers ??= new Map()
      bloopers.set(child, signal.blooper)
      if (bloopers.size === this.size) {
        this.reveal({
          blooper: new AggregateError(
            [...loop.map(this.offspring!.values(), event => bloopers.get(event)!)],
            `burnout after ${this.size} attempts for any signal`
          )
        })
      }
    } else {
      this.reveal(signal)
    }
  }
  constructor(childHints: Future.Hint<unknown>[]) {
    super(childHints)
    this.#bloopers = void 0
  }
  public unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    this.#bloopers = void 0
  }
}
class RaceEvent extends FamilyEvent {
  protected revealFrom(_childEvent: Event, signal: Future.Signal<unknown>) {
    this.reveal(signal)
  }
}
class SettleEvent extends FamilyEvent {
  #signals?: Map<Event, Future.Signal<unknown>>
  protected revealFrom(child: Event, signal: Future.Signal<unknown>) {
    const signals = this.#signals ??= new Map()
    signals.set(child, signal)
    if (signals.size === this.size) {
      this.reveal({ prompt: [...loop.map(this.offspring!.values(), event => signals.get(event)!)] })
    }
  }
  constructor(childHints: Future.Hint<unknown>[]) {
    super(childHints)
    this.#signals = void 0
  }
  public unblock(revealing: boolean, parent: ParentEvent) {
    super.unblock(revealing, parent)
    this.#signals = void 0
  }
}
class CommitEvent extends DecoratorEvent {
  #finalEffect?: Future.Reveal<unknown>
  protected decorate(signal: Future.Signal<unknown>) {
    this.unblock(true, this)
    const effect = this.#finalEffect!
    this.#finalEffect = void 0
    effect(signal)
  }
  constructor(hint: Future.Hint<unknown>, effect: Future.Reveal<unknown>) {
    super(hint)
    this.#finalEffect = effect
  }
}
class Exchange<T> implements Future.Exchange<T> {
  readonly #capacity: number
  readonly #items: T[]
  // underflow revelations are consumers blocked on an empty exchange
  readonly #underflow: Future.Reveal<T>[]
  // overflow revelations are producers blocked on a full exchange
  readonly #overflow: Future.Reveal<void>[]
  constructor(capacity: number) {
    this.#capacity = capacity
    this.#items = []
    this.#underflow = []
    this.#overflow = []
  }
  public get capacity() { return this.#capacity }
  public get isEmpty() { return this.#items.length === 0 }
  public get isFull() { return this.#items.length === this.#capacity }
  public get isUnderflowing() { return this.#underflow.length > 0 }
  public get isOverflowing() { return this.#overflow.length > 0 }
  public produce(item: T): Future.Cue<void> {
    let overflowing = false
    const begin: Future.Begin<void> = reveal => {
      if (this.#underflow.length > 0) {
        // reveal item to longest waiting consumer
        this.#underflow.shift()!({ prompt: item })
        reveal({})
      } else if (this.#items.length < this.#capacity) {
        // buffer item for future consumer
        this.#items.push(item)
        reveal({})
      } else {
        // add pending overflow revelation
        overflowing = true
        this.#overflow.push(reveal)
      }
    }
    const end: Future.End<void> = revealing => {
      if (revealing && overflowing) {
        // buffer item after pending overflow has been revealed
        this.#items.push(item)
      }
    }
    return once(begin, end)
  }
  public consume(): Future.Cue<T> {
    return once(reveal => {
      if (this.#overflow.length > 0) {
        // unblock oldest waiting producer, forcing it to spill the item to the buffer 
        this.#overflow.shift()!({})
      }
      if (this.#items.length > 0) {
        // remove and reveal first item from exchange
        reveal({ prompt: this.#items.shift()! })
      } else {
        // add pending underflow revelation if exchange is empty
        this.#underflow.push(reveal)
      }
    })
  }
}
