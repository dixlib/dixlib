/// <reference path="./std.data/api.d.ts" />
/// <reference path="./std.data.definition/api.d.ts" />
/// <reference path="./std.data.meta/api.d.ts" />
/// <reference path="./std.data.portability/api.d.ts" />
/// <reference path="./std.fn/api.d.ts" />
/// <reference path="./std.fx/api.d.ts" />
/// <reference path="./std.kernel/api.d.ts" />
/// <reference path="./std.loader/api.d.ts" />
/// <reference path="./std.news/api.d.ts" />
/// <reference path="./std.syntax/api.d.ts" />
/// <reference path="./std.system/api.d.ts" />
/// <reference path="./std.theater/api.d.ts" />
/// <reference path="./std.theater.agency/api.d.ts" />
/// <reference path="./std.theater.concurrency/api.d.ts" />
/// <reference path="./std.theater.future/api.d.ts" />
declare module "dixlib" {
  import type Agency from "std.theater.agency"
  import type Concurrency from "std.theater.concurrency"
  import type Data from "std.data"
  import type Definition from "std.data.definition"
  import type Fn from "std.fn"
  import type Future from "std.theater.future"
  import type Fx from "std.fx"
  import type Kernel from "std.kernel"
  import type Loader from "std.loader"
  import type Meta from "std.data.meta"
  import type News from "std.news"
  import type Portability from "std.data.portability"
  import type Syntax from "std.syntax"
  import type System from "std.system"
  import type Theater from "std.theater"
  /**
   * Map service name to service interface at compile time.
   *
   * This interface is intended to be augmented in bundles that define services.
   */
  export interface Service {
    readonly "std.data": Data
    readonly "std.data.definition": Definition
    readonly "std.data.meta": Meta
    readonly "std.data.portability": Portability
    readonly "std.fn": Fn
    readonly "std.fx": Fx
    readonly "std.kernel": Kernel
    readonly "std.loader": Loader
    readonly "std.news": News
    readonly "std.syntax": Syntax
    readonly "std.system": System
    readonly "std.theater": Theater
    readonly "std.theater.agency": Agency
    readonly "std.theater.concurrency": Concurrency
    readonly "std.theater.future": Future
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
