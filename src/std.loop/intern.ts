// TypeScript
import type Loop from 'std.loop'
// --- JavaScript ---
import { fn } from  "./extern.js"

export function isIterable<T>(it: unknown): it is Iterable<T> {
  return typeof it === "object" && !!it && Symbol.iterator in it && typeof it[Symbol.iterator] === "function"
}

export function isIterator<T>(it: unknown): it is Iterator<T> {
  return typeof it === "object" && !!it && "next" in it && typeof it.next === "function"
}

export function isIterableIterator<T>(it: unknown): it is IterableIterator<T> {
    return isIterable(it) && isIterator(it)
}

export function over<T>(elements?: Iterator<T> | Iterable<T>): IterableIterator<T> {
  return (!elements ? emptyIterableIterator :
    isIterable(elements) ? isIterator(elements) ? elements :
      over(elements[Symbol.iterator]()) : Object.freeze({ 
        [Symbol.iterator]: fn.returnThis, 
        next: () => elements.next() 
    })
  ) as IterableIterator<T>
}

export function* keys(o: object): IterableIterator<string> {
  for (const name in o) {
    yield name
  }
}

export function* entries(o: { [key: string]: unknown }): IterableIterator<[string, unknown]> {
  for (const name in o) {
    yield [name, o[name]]
  }
}

export function* values(o: { [key: string]: unknown }): IterableIterator<unknown> {
  for (const name in o) {
    yield o[name]
  }
}

export function* count(from: number, to: number, step = 1): IterableIterator<number> {
  if (step >= 0) {
    for (let i = from; i <= to; i += step) {
      yield i
    }
  } else {
    for (let i = from; i >= to; i += step) {
      yield i
    }
  }
}

export function* filter<T, This>(iter: Iterator<T>, test: Loop.Test<T, This>, rcvr?: This): IterableIterator<T> {
  for (let result: IteratorResult<T>; !(result = iter.next()).done;) {
    if (test.call(rcvr!, result.value)) {
      yield result.value
    }
  }
}

export function* map<T, U, This>(iter: Iterator<T>, conv: Loop.Convert<T, U, This>, rcvr?: This): IterableIterator<U> {
  for (let result: IteratorResult<T>; !(result = iter.next()).done;) {
    yield conv.call(rcvr!, result.value)
  }
}

export function* zip<T, U>(leftIter: Iterator<T>, rightIter: Iterator<U>): IterableIterator<[T, U]> {
  let leftResult = leftIter.next(), rightResult = rightIter.next()
  while (!leftResult.done && !rightResult.done) {
    yield [leftResult.value, rightResult.value]
    leftResult = leftIter.next()
    rightResult = rightIter.next()
  }
}

export function reduce<T, U, This>(iter: Iterator<T>, fold: Loop.Fold<T, U, This>, accu: U, rcvr?: This): U {
  for (let result: IteratorResult<T>; !(result = iter.next()).done;) {
    accu = fold.call(rcvr!, accu, result.value)
  }
  return accu
}

export function take<T>(iter: Iterator<T>, n: number, accu: T[] = []): T[] {
  for (let result: IteratorResult<T>, i = accu.length = 0; i < n && !(result = iter.next()).done; ++i) {
    accu[i] = result.value
  }
  return accu
}

export function drop<T>(iter: Iterator<T>, n: number): void {
    for (let i = 0; i < n && !iter.next().done; ++i) { }
}

// ----------------------------------------------------------------------------------------------------------------- //
const emptyIterableIterator: IterableIterator<unknown> = Object.freeze({
  [Symbol.iterator]: fn.returnThis,
  next: fn.returnThis.bind(Object.freeze({ done: true })),
})
