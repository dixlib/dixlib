declare module "dixlib" {
  interface ServiceAspects {
    /**
     * If true, a config module defines service options.
     */
    readonly configuration?: boolean
  }
}
declare module "std.config" {
  import type Dixlib from "dixlib"
  import type Data from "std.data"
  /**
   * The config service consolidates stacked service configurations.
   */
  export default Config
  interface Config {
    /**
     * Select configuration value of a service.
     *
     * This merges multiple configurations in the bundle stack.
     * A bundle can refine a service configuration from lower down in the stack.
     *
     * @param serviceName Name of service to configure
     * @returns Configuration value
     */
    select<Options extends Data.Value>(serviceName: Dixlib.ServiceName): Promise<Options>
  }
  namespace Config {
    /**
     * Exports of a config module.
     */
    interface ConfigModule {
      /**
       * Combination of service name and type expression, separated by a slash e.g., std.net/Net.Options.
       *
       * The service name identifies the service that defines the necessary types.
       * The type expression evaluates to the type of configuration options.
       *
       * Bundles that refine a service configuration cannot redefine the configuration type.
       */
      readonly datatype?: string
      /**
       * JSON representation of configuration options.
       */
      readonly options: Data.JSON
    }
  }
}
