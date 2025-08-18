declare module "std.fn" {
  export default Fn
  /**
   * The operations of the fn service are mostly harmless JavaScript functions.
   */
  interface Fn {
    /**
     * Test whether it is a generator function.
     *
     * @param it Thing to test
     * @returns True if it is a generator function, otherwise false
     */
    isGeneratorFunction(it: unknown): it is GeneratorFunction
    /**
     * Iterate over keys of enumerable properties.
     *
     * @param it Object with enumerable properties
     * @returns An iterable iterator over property keys
     */
    iterateKeys<T>(it: T): IterableIterator<keyof T>
    /**
     * Always return bound receiver.
     *
     * The unbound service operation returns undefined.
     *
     * @returns Bound receiver
     */
    returnThis<This>(this: This): This
    /**
     * Return it back to caller.
     *
     * @param it Thing to return
     * @returns The input thing (it)
     */
    returnIt<T>(it: T): T
    /**
     * Return all input parameters in a tuple.
     *
     * @param parameters Zero or more parameters
     * @returns Array with parameters
     */
    returnTuple<P extends unknown[]>(...parameters: P): P
    /**
     * Always return nothing.
     */
    returnNothing(): void
    /**
     * Always return false.
     *
     * @returns False
     */
    returnFalse(): false
    /**
     * Always return true.
     *
     * @returns True
     */
    returnTrue(): true
  }
}
