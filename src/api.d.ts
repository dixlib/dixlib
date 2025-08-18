/// <reference path="./std.agency/api.d.ts" />
/// <reference path="./std.concurrency/api.d.ts" />
/// <reference path="./std.data/api.d.ts" />
/// <reference path="./std.fn/api.d.ts" />
/// <reference path="./std.future/api.d.ts" />
/// <reference path="./std.fx/api.d.ts" />
/// <reference path="./std.kernel/api.d.ts" />
/// <reference path="./std.loader/api.d.ts" />
/// <reference path="./std.news/api.d.ts" />
/// <reference path="./std.syntax/api.d.ts" />
/// <reference path="./std.system/api.d.ts" />
/// <reference path="./std.theater/api.d.ts" />
declare module "dixlib" {
  import type Agency from "std.agency"
  import type Concurrency from "std.concurrency"
  import type Data from "std.data"
  import type Fn from "std.fn"
  import type Future from "std.future"
  import type Fx from "std.fx"
  import type Kernel from "std.kernel"
  import type Loader from "std.loader"
  import type News from "std.news"
  import type Syntax from "std.syntax"
  import type System from "std.system"
  import type Theater from "std.theater"
  /**
   * Map service name to service interface at compile time.
   *
   * This interface is intended to be augmented in bundles that define services.
   */
  export interface Service {
    readonly "std.agency": Agency
    readonly "std.concurrency": Concurrency
    readonly "std.data": Data
    readonly "std.fn": Fn
    readonly "std.future": Future
    readonly "std.fx": Fx
    readonly "std.kernel": Kernel
    readonly "std.loader": Loader
    readonly "std.news": News
    readonly "std.syntax": Syntax
    readonly "std.system": System
    readonly "std.theater": Theater
  }
  /**
   * A service name at compile time is restricted to known services.
   */
  export type ServiceName = keyof Service
  /**
   * A service contract is passed to a contractor.
   */
  export interface Contract<Name extends ServiceName> {
    /**
     * Name of service that contractor should provide.
     */
    readonly name: Name
    /**
     * Use service providers.
     * @param names Service names
     * @returns A promise of an array with the requested providers
     */
    use<P extends Service[ServiceName][]>(...names: ServiceName[]): Promise<P>
    /**
     * If the contract is a refinement, wait for former contractor to create a provider.
     * A bundle can refine (or redefine) a service provider from another bundle, lower in the bundle stack.
     */
    former?(): Promise<Service[Name]>
  }
  /**
   * Cross-cutting service aspects.
   *
   * This interface is intended to be augmented in services that add a service aspect.
   */
  export interface ServiceAspects {
    /**
     * If true, a transient api module provides the bundled service interface and namespace.
     */
    readonly specification?: boolean
  }
  /**
   * Service bindings map a service name to bound service aspects.
   */
  export type ServiceBindings = {
    readonly [Name in ServiceName]?: ServiceAspects
  }
  /**
   * A service aspect at compile time is restricted to known aspects.
   */
  export type ServiceAspect = keyof ServiceAspects
  /**
   * Start a new system.
   * @param bundleStack Bindings of bundle stack
   * @returns A promise of the system provider
   */
  export function startSystem(bundleStack: Loader.Bindings[]): Promise<System>
  /**
   * Default export starts systems and subsystems.
   */
  export type Default = { readonly default: typeof startSystem }
}
