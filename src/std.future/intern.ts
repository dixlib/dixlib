import type Future from "std.future"
import type Fx from "std.fx"
import { fx } from "./extern.js"

export function isCue<T>(it: unknown): it is Future.Cue<T> {
  return facade.isHandling(it)
}

export function when<T>(signal: Future.Signal<T>): T {
  if ("blooper" in signal) {
    throw signal.blooper
  } else {
    return signal.prompt as T
  }
}

export function once<T>(begin: Future.Begin<T>, end?: Future.End<T>): Future.Cue<T> {
  return new LeafCue(begin, end).opaque
}

export function spark<T>(signal: Future.Signal<T>): Future.Cue<T> {
  return once(reveal => reveal(signal))
}

export function timeout(ms: number): Future.Cue<void> {
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

export function pledge<T>(promise: Promise<T>): Future.Cue<T> {
  return once(reveal => {
    promise.then(
      prompt => reveal({ prompt }),
      problem => reveal({ blooper: fx.erroneous(problem) })
    )
  })
}

export function capture<C, T>(cue: Future.Cue<C>, trap: Future.Trap<C, T>): Future.Cue<T> {
  return new CaptureCue(facade.expose(cue), trap as Future.Trap<unknown, unknown>).opaque
}

export function all(cues: Iterable<Future.Cue<unknown>>): Future.Cue<unknown[]> {
  const group = [...cues]
  switch (group.length) {
    case 0:
      return spark({ prompt: group })
    case 1:
      return capture(group[0], singletonPromptTrap)
    default:
      return new AllCue(group).opaque
  }
}

export function any(cues: Iterable<Future.Cue<unknown>>): Future.Cue<unknown> {
  const group = [...cues]
  switch (group.length) {
    case 0:
      return spark({
        blooper: new AggregateError(group, "at least one cue is required for any prompt"),
      })
    case 1:
      return group[0]
    default:
      return new AnyCue(group).opaque
  }
}

export function race(cues: Iterable<Future.Cue<unknown>>): Future.Cue<unknown> {
  const group = [...cues]
  switch (group.length) {
    case 0:
      return spark({
        blooper: new AggregateError(group, "at least one cue is required for a race"),
      })
    case 1:
      return group[0]
    default:
      return new RaceCue(group).opaque
  }
}

export function settle(cues: Iterable<Future.Cue<unknown>>): Future.Cue<Future.Signal<unknown>[]> {
  const group = [...cues]
  switch (group.length) {
    case 0:
      return spark({ prompt: group })
    case 1:
      return capture(group[0], singletonSignalTrap)
    default:
      return new SettleCue(group).opaque
  }
}

export function commit<T>(cue: Future.Cue<T>, effect: Future.Reveal<T>): Future.Rollback | undefined {
  const commitCue = new CommitCue(facade.expose(cue), effect as Future.Reveal<unknown>)
  const { opaque } = commitCue
  function rollback() {
    if (opaque.isPending) {
      commitCue.unblock(false, commitCue)
    }
  }
  try {
    // iterate over unused leaf cues and pending parent cues
    for (const [leafCue, parentCue] of commitCue.flatten(commitCue)) {
      try {
        // start waiting period of leaf cue (thus becoming pending)
        leafCue.block(parentCue)
      } catch (leafProblem) {
        // leaf cue reveals a blooper, because it cannot block
        leafCue.reveal({ blooper: fx.erroneous(leafProblem) })
      }
      if (opaque.isUsed) {
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

// ----------------------------------------------------------------------------------------------------------------- //
const facade: Fx.Facade<Future.Cue<unknown>, CueObj> = fx.createFacade<Future.Cue<unknown>, CueObj>(
  "std.future/Cue",
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
function singletonPromptTrap(signal: Future.Signal<unknown>) {
  return "blooper" in signal ? { blooper: signal.blooper } : { prompt: [signal.prompt] }
}
function singletonSignalTrap(signal: Future.Signal<unknown>) {
  return { prompt: [signal] }
}
abstract class CueObj {
  // opaque handle of this cue object
  readonly #opaq: Future.Cue<unknown>
  #parentCue?: ParentCue | false
  constructor() {
    this.#opaq = facade.handle(this)
    this.#parentCue = void 0
  }
  get parent() {
    return this.#parentCue
  }
  get opaque() {
    return this.#opaq
  }
  abstract flatten(parent: ParentCue): IterableIterator<[LeafCue, ParentCue]>
  block(parent: ParentCue) {
    if (this.#parentCue !== void 0) {
      throw new Error("cannot block if cue is already pending or used")
    }
    this.#parentCue = parent
  }
  unblock(_revealing: boolean, parent: ParentCue) {
    if (parent !== this.#parentCue) {
      throw new Error("cannot unblock with invalid parent")
    }
    this.#parentCue = false
  }
  reveal(signal: Future.Signal<unknown>) {
    const { parent } = this
    if (parent === void 0) {
      throw new Error("cannot reveal if cue is unused")
    } else if (parent) {
      // reveal if cue is still pending
      this.unblock(true, parent)
      parent.propagate(this, signal)
    } // else silently ignore revelation of this used cue
  }
}
class LeafCue extends CueObj {
  #begin?: Future.Begin<unknown>
  #end?: Future.End<unknown>
  constructor(begin: Future.Begin<unknown>, end?: Future.End<unknown>) {
    super()
    this.#begin = begin
    this.#end = end
  }
  *flatten(parent: ParentCue): IterableIterator<[LeafCue, ParentCue]> {
    yield [this, parent]
  }
  block(parent: ParentCue): void {
    super.block(parent)
    const begin = this.#begin as Future.Begin<unknown>
    const { reveal, opaque } = this
    this.#begin = void 0
    begin(reveal.bind(this), opaque)
  }
  unblock(revealing: boolean, parent: ParentCue) {
    super.unblock(revealing, parent)
    const end = this.#end
    if (end) {
      this.#end = void 0
      end(revealing, this.opaque)
    }
  }
}
abstract class ParentCue extends CueObj {
  protected abstract makeOffspring(): IterableIterator<CueObj>
  *flatten(grandparent: ParentCue) {
    this.block(grandparent)
    for (const child of this.makeOffspring()) {
      yield* child.flatten(this)
    }
  }
  abstract propagate(child: CueObj, signal: Future.Signal<unknown>): void
}
abstract class FosterCue extends ParentCue {
  #child?: CueObj
  protected *makeOffspring() {
    yield this.#child as CueObj
  }
  protected abstract foster(signal: Future.Signal<unknown>): void
  constructor(child: CueObj) {
    super()
    this.#child = child
  }
  propagate(child: CueObj, signal: Future.Signal<unknown>) {
    if (child !== this.#child) {
      throw new Error("cannot propagate signal from invalid child")
    }
    this.#child = void 0
    // delegate further processing of signal to subclass, after child has been verified
    this.foster(signal)
  }
  unblock(revealing: boolean, parent: ParentCue) {
    super.unblock(revealing, parent)
    const child = this.#child as CueObj
    this.#child = void 0
    if (!revealing) {
      // if child is undefined, it has already propagated a signal in the past
      child.unblock(false, this)
    }
  }
}
class CaptureCue extends FosterCue {
  #trap?: Future.Trap<unknown, unknown>
  protected foster(signal: Future.Signal<unknown>) {
    const trap = this.#trap as Future.Trap<unknown, unknown>
    this.reveal(trap(signal))
  }
  constructor(child: CueObj, trap: Future.Trap<unknown, unknown>) {
    super(child)
    this.#trap = trap
  }
  unblock(revealing: boolean, parent: ParentCue) {
    super.unblock(revealing, parent)
    this.#trap = void 0
  }
}
class CommitCue extends FosterCue {
  #effect?: Future.Reveal<unknown>
  protected foster(signal: Future.Signal<unknown>) {
    const effect = this.#effect as Future.Reveal<unknown>
    // the pending commit cue was its own parent
    this.unblock(true, this)
    effect(signal)
  }
  constructor(child: CueObj, effect: Future.Reveal<unknown>) {
    super(child)
    this.#effect = effect
  }
  unblock(revealing: boolean, parent: ParentCue) {
    super.unblock(revealing, parent)
    this.#effect = void 0
  }
}
abstract class FamilyCue extends ParentCue {
  #children?: Set<CueObj>
  protected makeOffspring() {
    return (this.#children as Set<CueObj>).values()
  }
  protected get children() {
    return this.#children
  }
  protected get size() {
    //biome-ignore lint/style/noNonNullAssertion: assume children are defined
    return this.#children!.size
  }
  protected abstract propagateFrom(child: CueObj, signal: Future.Signal<unknown>): void
  constructor(cues: Future.Cue<unknown>[]) {
    super()
    if (cues.length < 2) {
      throw new Error("at least two cues are required for a cue family")
    }
    // convert array of cues to set of cue objects
    this.#children = new Set(cues.map(facade.expose))
  }
  propagate(child: CueObj, signal: Future.Signal<unknown>) {
    if (!child || !this.#children || !this.#children.has(child)) {
      throw new Error("cannot propagate signal from an invalid family member")
    }
    this.propagateFrom(child, signal)
  }
  unblock(revealing: boolean, parent: ParentCue) {
    super.unblock(revealing, parent)
    const children = this.#children as Set<CueObj>
    this.#children = void 0
    for (const child of children) {
      if (child.opaque.isPending) {
        child.unblock(false, this)
      }
    }
  }
}
class AllCue extends FamilyCue {
  #prompts?: Map<CueObj, unknown>
  protected propagateFrom(child: CueObj, signal: Future.Signal<unknown>) {
    if ("blooper" in signal) {
      this.reveal(signal)
    } else {
      this.#prompts ??= new Map()
      const prompts = this.#prompts
      prompts.set(child, signal.prompt)
      if (prompts.size === this.size) {
        //biome-ignore lint/style/noNonNullAssertion: size of children is nonzero
        const results = [...this.children!.values().map(cueObj => prompts.get(cueObj)!)]
        this.reveal({ prompt: results })
      }
    }
  }
  constructor(cues: Future.Cue<unknown>[]) {
    super(cues)
    this.#prompts = void 0
  }
  unblock(revealing: boolean, parent: ParentCue) {
    super.unblock(revealing, parent)
    this.#prompts = void 0
  }
}
class AnyCue extends FamilyCue {
  #bloopers?: Map<CueObj, Error>
  protected propagateFrom(child: CueObj, signal: Future.Signal<unknown>) {
    if ("blooper" in signal) {
      this.#bloopers ??= new Map()
      const bloopers = this.#bloopers
      bloopers.set(child, signal.blooper)
      if (bloopers.size === this.size) {
        //biome-ignore lint/style/noNonNullAssertion: size of children is nonzero
        const errors = [...this.children!.values().map(cueObj => bloopers.get(cueObj)!)]
        this.reveal({
          blooper: new AggregateError(errors, `burnout after ${this.size} attempts for any signal`),
        })
      }
    } else {
      this.reveal(signal)
    }
  }
  constructor(cues: Future.Cue<unknown>[]) {
    super(cues)
    this.#bloopers = void 0
  }
  unblock(revealing: boolean, parent: ParentCue) {
    super.unblock(revealing, parent)
    this.#bloopers = void 0
  }
}
class RaceCue extends FamilyCue {
  protected propagateFrom(_childCue: CueObj, signal: Future.Signal<unknown>) {
    this.reveal(signal)
  }
}
class SettleCue extends FamilyCue {
  #signals?: Map<CueObj, Future.Signal<unknown>>
  protected propagateFrom(child: CueObj, signal: Future.Signal<unknown>) {
    this.#signals ??= new Map()
    const signals = this.#signals
    signals.set(child, signal)
    if (signals.size === this.size) {
      //biome-ignore lint/style/noNonNullAssertion: size of children is nonzero
      const results = [...this.children!.values().map(cueObj => signals.get(cueObj)!)]
      this.reveal({ prompt: results })
    }
  }
  constructor(cues: Future.Cue<unknown>[]) {
    super(cues)
    this.#signals = void 0
  }
  unblock(revealing: boolean, parent: ParentCue) {
    super.unblock(revealing, parent)
    this.#signals = void 0
  }
}
