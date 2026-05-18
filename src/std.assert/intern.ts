import type Data from "std.data"
import { data } from "./extern.js"

export { Class as Error }

export function fail(message: string): never {
  throw new AssertionError(message)
}

export function todo(): never {
  throw new AssertionError("not yet implemented")
}

export { falsehood as false, truth as true }

export function equal(expected: unknown, actual: unknown, message?: string) {
  if (!Object.is(expected, actual)) {
    throw new AssertionError(message ?? `strictly expected ${expected}, but actually got ${actual}`)
  }
}

export function deepEqual(expected: unknown[], actual: unknown[], message?: string) {
  if (!deeplyEqual(expected, actual)) {
    throw new AssertionError(message ?? `expected content ${expected}, but actually got content ${actual}`)
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
    throw new AssertionError(message ?? "condition is not true")
  }
}
function falsehood(condition: boolean, message?: string) {
  if (condition) {
    throw new AssertionError(message ?? "condition is not false")
  }
}
function deeplyEqual(expected: unknown, actual: unknown): boolean {
  if (typeof expected !== typeof actual) {
    // apples are not oranges
    return false
  }
  if (typeof expected !== "object" || expected === null) {
    // comparison of undefined values, booleans, numbers, strings, symbols, functions and null references
    return Object.is(expected, actual)
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) {
      // actual is not an array or it's an array of different length
      return false
    }
    for (let i = 0; i < expected.length; ++i) {
      // recursively compare elements in expected and actual array
      if (!deeplyEqual(expected[i], actual[i])) {
        return false
      }
    }
  } else if (actual === null) {
    // expected is not null
    return false
  } else {
    const expectedKeys = Reflect.ownKeys(expected)
    // at this point, typeof actual === "object" and actual !== null
    if (expectedKeys.length !== Reflect.ownKeys(actual as object).length) {
      // different number of own properties implies expected and actual object are not deeply equal
      return false
    }
    for (let i = 0; i < expectedKeys.length; ++i) {
      const expectedKey = expectedKeys[i]
      if (!Object.hasOwn(actual as object, expectedKey)) {
        // actual object is missing an own property
        return false
      }
      if (!deeplyEqual(Reflect.get(expected, expectedKey), Reflect.get(actual as object, expectedKey))) {
        // own property value is not deeply equal
        return false
      }
    }
    // at this point, expected and actual object have the same own property values
    // important to understand that enumerability and writability differences are ignored!
    const expectedPrototype = Reflect.getPrototypeOf(expected)
    const actualPrototype = Reflect.getPrototypeOf(actual as object)
    // the prototypes should be identical, unless one of them is Object.prototype and the other is null
    if (
      expectedPrototype !== actualPrototype &&
      (expectedPrototype !== Object.prototype || actualPrototype !== null) &&
      (expectedPrototype !== null || actualPrototype !== Object.prototype)
    ) {
      return false
    }
  }
  // expected and actual objects have equal content
  return true
}
