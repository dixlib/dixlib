declare module 'std.fn' {
  export default Fn
  /**
   * The operations of the fn service are mostly harmless JavaScript functions.
   */
  interface Fn {
    /**
     * Always return bound receiver.
     * The unbound service operation returns undefined.
     * @returns Bound receiver
     */
    returnThis<This>(this: This): This
    /**
     * Return it back to caller.
     * @param it Thing to return
     * @returns The input thing (it)
     */
    returnIt<T>(it: T): T
    /**
     * Return all input parameters.
     * @param p Zero or more parameters
     * @returns Array with parameters
     */
    returnAll<P extends unknown[]>(...p: P): P
    /** 
     * Always return nothing.
     */
    returnNothing(): void
    /**
     * Always return false.
     * @returns False
     */
    returnFalse(): false
    /**
     * Always return true.
     * @returns True
     */
    returnTrue(): true
  }
}
