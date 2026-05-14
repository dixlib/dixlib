import type Data from "std.data"
import { data } from "./extern.js"

export { Class as Error }

export function fail(message: string): never {
  throw new AssertionError(message)
}

export function todo(): never {
  throw new AssertionError("Not yet implemented")
}

export { falsehood as false, truth as true }

export function equal(expected: unknown, actual: unknown, message?: string) {
  if (!Object.is(expected, actual)) {
    throw new AssertionError(message ?? `strictly expected ${expected}, but actually got ${actual}`)
  }
}

export function equalArray(expected: unknown[], actual: unknown[], message?: string) {
  if (!strictlyCompareArrays(expected, actual)) {
    throw new AssertionError(message ?? `strictly expected ${expected}, but actually got ${actual}`)
  }
}

export function equivalent(expected: Data.Value, actual: Data.Value, message?: string) {
  if (!data.equalValue(expected, actual)) {
    throw new AssertionError(message ?? `${expected} is not equivalent to ${actual}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
function Class() {
  return AssertionError
}
class AssertionError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    Reflect.setPrototypeOf(this, new.target.prototype)
  }
}
function truth(condition: boolean, message?: string) {
  if (!condition) {
    throw new AssertionError(message ?? "Condition is not true")
  }
}
function falsehood(condition: boolean, message?: string) {
  if (condition) {
    throw new AssertionError(message ?? "Condition is not false")
  }
}
function strictlyCompareArrays(expected: unknown[], actual: unknown[]): boolean {
  if (expected.length !== actual.length) {
    return false
  }
  for (let i = 0; i < expected.length; ++i) {
    if (!Object.is(expected[i], actual[i])) {
      return false
    }
  }
  return true
}
