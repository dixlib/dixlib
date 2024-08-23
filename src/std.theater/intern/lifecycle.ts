// --- TypeScript ---
import type Future from 'std.future'
// --- JavaScript ---
import { future } from "../extern.js"
// ----------------------------------------------------------------------------------------------------------------- //
// unique symbols for hidden fields of doubly-linked destiny object
const exclusiveCurrent = Symbol("current exclusive status")
const exclusivePrevious = Symbol("previous in exclusive status")
const exclusiveNext = Symbol("next in  exclusive status")

// ----------------------------------------------------------------------------------------------------------------- //
// a destiny object is exclusively contained in one status
export class ExclusiveStatus<T extends Destiny> implements Iterable<T> {
  // descriptive name
  readonly #name: string
  // revision number is increased when status changes
  #revision: number
  // number of destiny objects
  #size: number
  // first doubly-linked destiny object
  #head?: T
  // unlink member from this status
  #deleteMember(member: T) {
    ++this.#revision
    if (--this.#size === 0) {
      this.#head = void 0
    } else {
      const next = member[exclusiveNext]!
      const previous = member[exclusivePrevious]!
      next[exclusivePrevious] = previous
      previous[exclusiveNext] = next
      if (this.#head === member) {
        // replace old head by next member, if any
        this.#head = next
      }
    }
  }
  constructor(name: string) {
    this.#name = name
    this.#revision = this.#size = 0
    this.#head = void 0
  }
  *[Symbol.iterator]() {
    const head = this.#head
    if (head) {
      const revision = this.#revision
      let member = head
      do {
        yield member
        // status should not change while being iterated
        if (revision !== this.#revision) {
          throw new Error("concurrent status modification while iterating")
        }
        member = member[exclusiveNext]!
      } while (member !== head)
    }
  }
  public get name() {
    return this.#name
  }
  public get size() {
    return this.#size
  }
  public get first() {
    return this.#head
  }
  public add(member: T) {
    const old = member[exclusiveCurrent]
    if (old !== this) {
      // remove from old status
      if (old) {
        old.#deleteMember(member)
      }
      ++this.#revision
      ++this.#size
      member[exclusiveCurrent] = this
      const head = this.#head
      if (head) {
        member[exclusiveNext] = head
        const previous = member[exclusivePrevious] = head[exclusivePrevious]!
        previous[exclusiveNext] = head[exclusivePrevious] = member
      } else {
        // become first member of this status
        this.#head = member[exclusivePrevious] = member[exclusiveNext] = member
      }
    }
  }
  public delete(member: T) {
    // nothing happens if member is not contained in this status
    if (member[exclusiveCurrent] === this) {
      this.#deleteMember(member)
      member[exclusiveCurrent] = member[exclusivePrevious] = member[exclusiveNext] = void 0
    }
  }
  public clear() {
    const head = this.#head
    if (head) {
      ++this.#revision
      this.#size = 0
      this.#head = void 0
      let member = head
      do {
        const next = member[exclusiveNext]!
        member[exclusiveCurrent] = member[exclusivePrevious] = member[exclusiveNext] = void 0
        member = next
      } while (member !== head)
    }
  }
}

export class Destiny {
  [exclusiveCurrent]?: ExclusiveStatus<this>
  [exclusivePrevious]?: this
  [exclusiveNext]?: this
  #fate?: Future.Signal<unknown>
  #teleprompter?: Future.Teleprompter<unknown>
  #pending?: Map<Future.Cue<unknown>, Future.Reveal<unknown>>
  protected finish(signal: Future.Signal<unknown>) {
    if (this.#fate) {
      throw new Error("cannot finish twice")
    }
    // fate of this destiny object is now sealed
    this[exclusiveCurrent]?.delete(this)
    this.#fate = signal
    const pending = this.#pending
    if (pending) {
      this.#pending = void 0
      for (const reveal of pending.values()) {
        // reveal fate of pending completion cues
        reveal(signal)
      }
    }
  }
  protected begin(reveal: Future.Reveal<unknown>, unique: Future.Cue<unknown>) {
    if (this.#fate) {
      // immediate revelation when fate has already been sealed
      reveal(this.#fate)
    } else {
      // add pending completion cue
      const pending = this.#pending ??= new Map<Future.Cue<unknown>, Future.Reveal<unknown>>()
      pending.set(unique, reveal)
    }
  }
  protected end(revealing: boolean, unique: Future.Cue<unknown>) {
    if (!revealing) {
      // check consistency of pending completion cues
      const pending = this.#pending, deleted = pending && pending.delete(unique)
      if (!deleted) {
        throw new Error("cancelled completion should be deleted")
      }
    }
  }
  constructor() {
    this[exclusiveCurrent] = this[exclusivePrevious] = this[exclusiveNext] =
      this.#fate = this.#teleprompter = this.#pending = void 0
  }
  public get status() {
    return this[exclusiveCurrent]
  }
  public get fate() {
    return this.#fate
  }
  // teleprompter creates completion cues
  public get completion() {
    return this.#teleprompter ??= future.often(this.begin.bind(this), this.end.bind(this))
  }
}
