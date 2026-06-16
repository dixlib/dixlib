import type { Service } from "dixlib"

// std.fn service is tiny, and it makes little sense to isolate the provider in an intern module
export default (): Promise<Service["std.fn"]> => Promise.resolve(provider)

// ----------------------------------------------------------------------------------------------------------------- //
const provider: Service["std.fn"] = {
  isGeneratorFunction(it: unknown): it is GeneratorFunction {
    //biome-ignore lint/suspicious/noPrototypeBuiltins: test prototype of generator functions
    return generatorFunctionPrototype.isPrototypeOf(it as object)
  },
  isInt32(it: unknown): it is number {
    return ~~(it as number) === it
  },
  *iterateKeys<T>(it: T): Generator<keyof T> {
    for (const key in it) {
      yield key
    }
  },
  *iterateValues<T>(it: T): Generator<T[keyof T]> {
    for (const key in it) {
      yield it[key]
    }
  },
  *iterateEntries<T>(it: T): Generator<[keyof T, T[keyof T]]> {
    for (const key in it) {
      yield [key, it[key]]
    }
  },
  returnThis<This>(this: This): This {
    return this
  },
  returnIt<T>(it: T): T {
    return it
  },
  returnTuple<P extends unknown[]>(...parameters: P): P {
    return parameters
  },
  returnNothing(): void {
    return
  },
  returnFalse(): false {
    return false
  },
  returnTrue(): true {
    return true
  },
}
const generatorFunctionPrototype = Reflect.getPrototypeOf(function* () {}) as object
