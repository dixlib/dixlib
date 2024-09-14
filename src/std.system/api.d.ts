declare module 'std.system' {
  import type Fx from 'std.fx'
  import type Loader from 'std.loader'
  import type News from 'std.news'
  import type Theater from 'std.theater'
  export default System
  /**
   * The system service organizes components.
   * All components are actors, but some components are containers that group other components.
   * Systems are themselves organized in a parent/child hierarchy, with a single top system.
   * The others are direct or indirect subsystems of this top system. 
   */
  interface System {
    /**
     * Mixin function creates classes whose instances are actor roles for system containers.
     * @returns Mixin function for container role classes
     */
    ContainerRole<C extends System.Container, S extends {} = {}>(): Fx.Mixin<System.ContainerRole<C>, S>
    /**
     * Obtain role class for new subsystems.
     * A subsidiary is an actor in the parent system that 'encapsulates' the child system.
     * Upon creation, the subsidiary expects the bindings of the new system.
     * @returns A role class for a subsidiary
     */
    Subsidiary(): Theater.RoleClass<System.Subsidiary, [bundleStack: Loader.Bindings[]]>
    /**
     * Obtain role class for nearby actors.
     * A nearby actor lives in this system, but it references an actor in some other system.
     * Upon creation, the nearby role expects the id of the other system and the path to the component.
     * @returns A role class for a nearby actor
     */
    Nearby<A extends Theater.Actor>(): Theater.RoleClass<A, [id: number, path: string]>
    /**
     * Obtain the ancestry chain.
     * The chain identifies this system, the parent system, the grandparent system, ..., up to the top system.
     * @returns An array with numbers
     */
    ancestry(): [number, ...number[]]
    /**
     * Obtain unique id of this system.
     * The top system identifies itself as zero. All other systems are subsystems of this top system.
     * @return A number
     */
    id(): number
    /**
     * Obtain the system root context.
     * @returns The root context
     */
    root(): System.Context<System.Root>
    /**
     * Obtain the service loader of this system.
     * @returns Service loader
     */
    loader(): Loader
  }
  namespace System {
    /**
     * A context offers synchronous, readonly access to the components of a container.
     */
    interface Context<C extends Container> {
      /**
       * The container whose components are exposed by this context.
       */
      readonly container: C
      /**
       * Iterate over keys of contained components.
       */
      readonly listing: IterableIterator<string>
      /**
       * Find component in this context.
       * @param key Key of component to find
       * @returns A component or undefined
       */
      lookup<A extends Theater.Actor = Theater.Actor>(key: string): A | undefined
      /**
       * Find context in this context.
       * @param key Key of context to find
       * @returns A context or undefined
       */
      lookupContext<D extends Container = Container>(key: string): Context<D> | undefined
      /**
       * Resolve path to component, relative from this context.
       * @param path Path to component
       * @returns The resolved component or undefined
       */
      resolve<A extends Theater.Actor = Theater.Actor>(path: string): A | undefined
      /**
       * Resolve path to context, relative from this context.
       * @param path Path to context
       * @returns The resolved context or undefined
       */
      resolveContext<D extends Container = Container>(path: string): Context<D> | undefined
    }
    /**
     * A container is a component that groups other components.
     * The container manages a hierarchical namespace.
     */
    interface Container extends Theater.Actor {
      /**
       * Obtain a readonly view on the hierarchy of components.
       * @returns Eventually a context
       */
      view(): Theater.Job<Context<this>>
      /**
       * Assign a component in this container.
       * @param key Unique key of component in container
       * @param component The component to assign
       * @returns Eventually nothing
       */
      assign<A extends Theater.Actor>(key: string, component: A): Theater.Job<void>
      /**
       * Mount a container in this container.
       * @param key Unique key of container to mount
       * @param container Container to mount
       * @returns Eventually a context of the mounted container
       */
      mount<C extends Container>(key: string, container: C): Theater.Job<Context<C>>
    }
    /**
     * A container role encapsulates the transient state of a container.
     */
    abstract class ContainerRole<C extends Container> extends Theater.Role<C> implements Theater.Script<Container> {
      /**
       * Synchronous assignment.
       * @param key Unique key of component
       * @param component Component actor
       */
      protected assignComponent<A extends Theater.Actor>(key: string, component: A): void
      /**
       * Synchronous mount.
       * @param key Unique key of container
       * @param context Context of container
       */
      protected mountContext<C extends System.Container>(key: string, context: System.Context<C>): void
      public view(): Theater.Scene<Context<C>>
      public assign<A extends Theater.Actor>(key: string, component: A): Theater.Scene<void>
      public mount<C extends Container>(key: string, container: C): Theater.Scene<Context<C>>
    }
    /**
     * The root container provides asynchronous system operations.
     */
    interface Root extends Container {
      /**
       * Retrieve the ancestry chain.
       * @returns Eventually an array with numbers that identify this system and its ancestor systems
       */
      ancestry(): Theater.Job<[number, ...number[]]>
      /**
       * Retrieve unique system id.
       * @returns Eventually a number that identifies this system
       */
      id(): Theater.Job<number>
      launch(): Theater.Job<void>
    }
    /**
     * A subsidiary encapsulates a child subsystem inside the parent system.
     */
    interface Subsidiary extends Theater.Actor {
      /**
       * Get unique id of this subsystem.
       * @returns Eventually a number that identifies this subsystem
       */
      id(): Theater.Job<number>
    }
    /**
     * The system logger enriches news messages with an origin.
     */
    interface LogMessage<P extends unknown[]> extends News.Message<P> {
      /**
       * Ancestry chain of system from where log message originates.
       */
      readonly origin: number[]
    }
    /**
     * A logger reports log messages.
     * Every system has a logger component at path "logger".
     */
    interface Logger extends Theater.Actor {
      /**
       * Report message.
       * @param message The message to report
       */
      report<P extends unknown[]>(message: LogMessage<P>): Theater.Job<void>
    }
  }
}
