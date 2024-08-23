declare module 'std.fx' {
  export default Fx
  /**
   * The fx service provides common operations with side effects.
   */
  interface Fx {
    /**
     * Turn it into an error.
     * If it is not already an error, the error contains a stack trace to its creation.
     * @param it Either the reason for the error or the error itself
     * @returns An error
     */
    erroneous(it: unknown): Error
    /**
     * Create mixin function that efficiently adds mixin M to a superclass.
     * Note that mixin functions cannot deal with generics!
     * @param template Template function unconditionally subclasses a given superclass
     * @returns Mixin function
     */
    mixin<M extends {}, S extends {} = {}>(template: Fx.Template<M, S>): Fx.Mixin<M, S>
    /**
     * Create a facade that hides opaque implementations behind immutable handles.
     * @param name Descriptive name
     * @param proto Prototype of handles defaults to null
     * @returns Facade that converts between handles and implementations
     */
    facade<H extends {}, I extends {}>(name: string, proto?: object): Fx.Facade<H, I>
  }
  namespace Fx {
    /**
     * A constructor function creates new instances.
     */
    interface Constructor<T extends {}, P extends unknown[] = unknown[]> {
      new(...p: P): T
    }
    /**
     * A template function adds mixin M to a superclass.
     */
    interface Template<M extends {}, S extends {} = {}, P extends unknown[] = any[]> {
      <C extends Constructor<S, P>>(Super: C): C & Constructor<M, P>
    }
    /**
     * A mixin function efficiently adds mixin M to a superclass.
     * Mixin functions memoize additions to superclasses.
     * Applying mixin M to the same superclass always results in the same subclass.
     */
    interface Mixin<M extends {}, S extends {} = {}> extends Template<M, S> {
      /**
       * Test whether it implements mixin M.
       * @param it Thing to test
       * @returns True if it implements mixin M, otherwise false
       */
      isImplementedBy(it: unknown): it is M
    }
    /**
     * A facade converts between immutable handles and opaque implementations.
     */
    interface Facade<H extends {}, I extends {}> {
      /**
       * Test whether it is a handle of this facade.
       * @param it Thing to test
       * @returns True if it is a handle, otherwise false
       */
      isHandling(it: unknown): it is H
      /**
       * Create a handle for an implementation.
       * @param impl Implementation to hide
       * @returns A handle
       */
      handle<X extends H = H>(impl: I): X
      /**
      * Expose implementation behind a handle.
      * @param handle Handle to expose
      * @returns An implementation
      */
      expose(handle: H): I
      /**
       * Reset implementation behind given handle.
       * @param handle Handle to reset
       * @param impl An implementation 
       */
      reset(handle: H, impl: I): void
    }
  }
}
