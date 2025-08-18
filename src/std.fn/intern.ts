export function isGeneratorFunction(it: unknown): it is GeneratorFunction {
  //biome-ignore lint/suspicious/noPrototypeBuiltins: test prototype of generator functions
  return generatorFunctionPrototype.isPrototypeOf(it as object)
}

export function* iterateKeys<T>(it: T): IterableIterator<keyof T> {
  for (const key in it) {
    yield key
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

// ----------------------------------------------------------------------------------------------------------------- //
const generatorFunctionPrototype = Reflect.getPrototypeOf(function* () {}) as object
