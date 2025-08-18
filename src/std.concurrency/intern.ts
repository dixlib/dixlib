import type Concurrency from "std.concurrency"
import type Future from "std.future"
import { future } from "./extern.js"

export function createExchange<T>(capacity = Infinity): Concurrency.Exchange<T> {
  return new Exchange<T>(capacity)
}

// ----------------------------------------------------------------------------------------------------------------- //
class Exchange<T> implements Concurrency.Exchange<T> {
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
  produce(item: T): Future.Cue<void> {
    let postponedRevelation: Future.Reveal<void> | undefined
    const begin: Future.Begin<void> = reveal => {
      if (this.#underflow.size > 0) {
        // reveal item to longest waiting consumer
        const [oldest] = this.#underflow
        this.#underflow.delete(oldest)
        oldest({ prompt: item })
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
    return future.once(begin, end)
  }
  tryProduce(item: T): boolean {
    if (this.#underflow.size > 0) {
      // reveal item to longest waiting consumer
      const [oldest] = this.#underflow
      this.#underflow.delete(oldest)
      oldest({ prompt: item })
      return true
    } else if (this.#items.length < this.#capacity) {
      // buffer item for future consumer
      this.#items.push(item)
      return true
    }
    return false
  }
  consume(): Future.Cue<T> {
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
        reveal({ prompt: this.#items.shift() })
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
    return future.once(begin, end)
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
