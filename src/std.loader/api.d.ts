interface ServiceAspects {
  /**
   * If true, an extern module provides the bundled service implementation.
   */
  readonly implementation?: boolean
}
declare module 'std.loader' {
  export default Loader
  /**
   * The loader implements a promise-based API to manage services.
   */
  interface Loader {
    /**
    * Promise to provide an implementation of a service.
    * @param name Service name
    * @returns A promise that resolves with the service provider
    */
    provide<S>(name: string): Promise<S>
    /**
     * Query bound services.
     * @param options Optional query options
     * @returns An iterable iterator over bound services
     */
    query(options?: Loader.QueryOptions): IterableIterator<Loader.QueryResult>
  }
  namespace Loader {
    /**
     * Bundle bindings specify which services are bound to aspects in a bundle.
     */
    interface Bindings {
      /**
       * Unique location of these bindings.
       */
      readonly id: string
      /**
       * Bound service aspects.
       */
      readonly service: ServiceMap
    }
    /**
     * An extern module exports a default function, the contractor, which promises to fulfill the given contract.
     */
    type Contractor<S> = (contract: Contract<S>) => Promise<S>
    /**
     * A query result specifies all services which are bound at some service aspect and bundle id.
     */
    interface QueryResult {
      /**
       * Bound service aspect.
       */
      readonly aspect: ServiceAspect
      /**
       * Id of bundle bindings.
       */
      readonly bundle: string
      /**
       * Number of services bound to aspect.
       */
      readonly size: number
      /**
       * Iterable iterator over names of bound services.
       */
      readonly serviceNames: IterableIterator<string>
      /**
       * Test whether some service is bound.
       * @param serviceName Name of service to test
       * @returns True if service is bound, otherwise false
       */
      hasBindingFor(serviceName: string): boolean
    }
    /**
     * Options to filter and order qeury results.
     */
    interface QueryOptions {
      /**
       * Horizontal query orders by bundle bindings id and aspect, and vertical query reverses this order.
       */
      orientation?: "horizontal" | "vertical"
      /**
       * Optionally filter by bound aspect.
       */
      aspects?: QueryFilter<ServiceAspect>
      /**
       * Optionally filter by id of bundle bindings.
       */
      bundles?: QueryFilter<string>
    }
    /**
     * A query filter matches candidates with array elements or with a predicate.
     */
    type QueryFilter<T> = T[] | ((candidate: T) => boolean)
  }
}
