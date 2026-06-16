declare module "dixlib" {
  interface ServiceAspects {
    /**
     * If true, an extern module provides the bundled service implementation.
     */
    readonly implementation?: boolean
  }
}
declare module "std.loader" {
  import type Dixlib from "dixlib"
  export default Loader
  /**
   * The loader implements a promise-based API to manage services.
   */
  interface Loader {
    /**
     * Promise to provide an implementation of a service.
     *
     * @param name Service name
     * @returns A promise that resolves with the service provider
     */
    provide<Name extends Dixlib.ServiceName>(name: Name): Promise<Dixlib.Service[Name]>
    /**
     * Convenience operation to provide multiple services.
     *
     * @param names Names of services to provide
     * @returns A promise of an array with corresponding service providers
     */
    use<Names extends Dixlib.ServiceName[]>(
      ...names: Names
    ): Promise<{ [Ix in keyof Names]: Dixlib.Service[Names[Ix]] }>
    /**
     * Query bound services.
     *
     * @param options Optional query options
     * @returns An iterable iterator over bound services
     */
    query(options?: Loader.QueryOptions): IteratorObject<Loader.QueryResult>
    /**
     * Is a service bound to some aspect in a bundle?
     *
     * @param name Name of service
     * @param aspect Service aspect
     * @param bundleId Id of bundle
     * @returns True if service is bound to aspect in the bundle, otherwise false
     */
    binds(name: Dixlib.ServiceName, aspect: Dixlib.ServiceAspect, bundleId: string): boolean
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
      readonly service: Dixlib.ServiceBindings
    }
    /**
     * An extern module exports a default function, the contractor, which promises to fulfill the given contract.
     */
    type Contractor<Name extends Dixlib.ServiceName> = (
      contract: Dixlib.Contract<Name>
    ) => Promise<Dixlib.Service[Name]>
    /**
     * A query result specifies all services which are bound at some service aspect and bundle id.
     */
    interface QueryResult {
      /**
       * Bound service aspect.
       */
      readonly aspect: Dixlib.ServiceAspect
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
      readonly serviceNames: IteratorObject<Dixlib.ServiceName>
      /**
       * Test whether some service is bound.
       *
       * @param serviceName Name of service to test
       * @returns True if service is bound, otherwise false
       */
      hasBindingFor(serviceName: Dixlib.ServiceName): boolean
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
      aspects?: QueryFilter<Dixlib.ServiceAspect>
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
