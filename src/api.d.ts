/// <reference path="./std.data/api.d.ts" />
/// <reference path="./std.fn/api.d.ts" />
/// <reference path="./std.future/api.d.ts" />
/// <reference path="./std.fx/api.d.ts" />
/// <reference path="./std.kernel/api.d.ts" />
/// <reference path="./std.loader/api.d.ts" />
/// <reference path="./std.loop/api.d.ts" />
/// <reference path="./std.news/api.d.ts" />
/// <reference path="./std.syntax/api.d.ts" />
/// <reference path="./std.system/api.d.ts" />
/// <reference path="./std.theater/api.d.ts" />
declare module "dixlib" {
  import type Loader from 'std.loader'
  import type System from 'std.system'
  /**
   * Start a new system.
   * @param bundleStack Bindings of bundle stack
   * @returns A promise of the system provider
   */
  export default function startSystem(bundleStack: Loader.Bindings[]): Promise<System>
}
interface ImportMeta {
  /**
   * Module location e.g., a file URL or http/https URL.
   */
  url: string
}
/**
 * A service contract is passed to a contractor.
 */
interface Contract<S> {
  /**
   * Name of service that contractor should provide.
   */
  readonly name: string
  /**
   * Use service providers.
   * @param names Service names
   * @returns A promise of an array with the requested providers
   */
  use<P extends unknown[]>(...names: string[]): Promise<P>
  /**
   * If the contract is a refinement, wait for former contractor to create a provider.
   */
  former?(): Promise<S>
}
/**
 * Cross-cutting service aspects.
 * This interface is intended to be augmented in services that add a service aspect.
 */
interface ServiceAspects {
  /**
   * If true, a transient api module defines the bundled service interface and namespace.
   */
  readonly specification?: boolean
}
/**
 * Map service names to bundled service aspects.
 */
type ServiceMap = { [name: string]: ServiceAspects }
/**
 * Names of all available service aspects.
 */
type ServiceAspect = keyof ServiceAspects
