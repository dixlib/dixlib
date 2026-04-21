export function isGeneratorFunction(it: unknown): it is GeneratorFunction {
  //biome-ignore lint/suspicious/noPrototypeBuiltins: test prototype of generator functions
  return generatorFunctionPrototype.isPrototypeOf(it as object)
}

export function* iterateKeys<T>(it: T): Generator<keyof T> {
  for (const key in it) {
    yield key
  }
}

export function* iterateValues<T>(it: T): Generator<T[keyof T]> {
  for (const key in it) {
    yield it[key]
  }
}

export function* iterateEntries<T>(it: T): Generator<[keyof T, T[keyof T]]> {
  for (const key in it) {
    yield [key, it[key]]
  }
}

export function returnThis<This>(this: This): This {
  return this
}

export function returnIt<T>(it: T): T {
  return it
}

export function returnTuple<P extends unknown[]>(...parameters: P): P {
  return parameters
}

export function returnNothing(): void {
  return
}

export function returnFalse(): false {
  return false
}

export function returnTrue(): true {
  return true
}

export function isInt32(it: unknown): it is number {
  return ~~(it as number) === it
}

// ----------------------------------------------------------------------------------------------------------------- //
const generatorFunctionPrototype = Reflect.getPrototypeOf(function* () {}) as object
