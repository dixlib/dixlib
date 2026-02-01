declare module "std.system" {
  import type Agency from "std.theater.agency"
  import type Fx from "std.fx"
  import type Loader from "std.loader"
  import type News from "std.news"
  import type Theater from "std.theater"
  export default System
  /**
   * The system service organizes components.
   *
   * Components are either actors or agents.
   *
   * Systems are themselves organized in a parent/child hierarchy, with a single top system.
   * The others are direct or indirect subsystems of this top system.
   *
   * The top system, its direct and its indrect subsystems form a network.
   * Every system is able to open a communication portal to another system in this top network.
   */
  interface System {
    /**
     * Mixin function creates classes for roles of container servants.
     *
     * @returns Mixin function for container servant classes
     */
    ContainerRole<Home extends System.Container, S extends {} = object>(): Fx.Mixin<System.ContainerRole<Home>, S>
    /**
     * Obtain server role class for new subsystems.
     *
     * A subsidiary is an actor in the parent system that 'encapsulates' the subsystem.
     * Upon creation, the subsidiary expects the bindings of the new system.
     *
     * @returns A role class for a subsidiary server
     */
    Subsidiary(): Theater.RoleClass<Agency.Server<System.Subsidiary>, [bundleStack: Loader.Bindings[]]>
    /**
     * Obtain role class for nearby actors in the top network.
     *
     * A nearby actor lives in this system, but it references a component actor in some other system.
     * Upon creation, the nearby role expects the id of the other system and the path to the component.
     *
     * @returns A role class for a nearby actor
     */
    Nearby<A extends Theater.Actor>(): Theater.RoleClass<A, [id: number, path: string]>
    /**
     * Obtain role class for nearby server actors in the top network.
     *
     * A nearby actor lives in this system, but it references a component actor in some other system.
     * Upon creation, the nearby role expects the id of the other system and the path to the component.
     *
     * @returns A role class for a nearby server actor
     */
    NearbyServer<A extends Agency.Agent>(): Theater.RoleClass<Agency.Server<A>, [id: number, path: string]>
    /**
     * Obtain system version.
     *
     * @return Version string
     */
    version(): string
    /**
     * Obtain unique id of this system.
     *
     * The top system identifies itself as zero.
     * All other systems are direct or indirect subsystems, derived from this top system.
     *
     * @return A number
     */
    id(): number
    /**
     * Obtain the ancestry chain.
     *
     * The chain identifies this system, the parent system, the grandparent system, ..., up to the top system.
     *
     * @returns An array with numbers that identify systems
     */
    ancestry(): [number, ...number[]]
    /**
     * Obtain the root context.
     *
     * This is the starting point to synchronously find components in this system.
     *
     * @returns A context on the root container
     */
    root(): System.Context<System.Root>
    /**
     * Obtain the service loader of this system.
     *
     * This is a convencience operation when a new system requires service providers at start-up.
     *
     * @returns Service loader
     */
    loader(): Loader
  }
  namespace System {
    /**
     * A system component is either an actor or an agent.
     *
     * Actors support fire-and-forget semantics whereas agents support request-response semantics.
     */
    type Component = Theater.Actor | Agency.Agent
    /**
     * A container is an agent that holds zero or more components.
     */
    interface Container extends Agency.Agent {
      /**
       * Open a readonly context on this container subject.
       *
       * @returns A readonly context
       */
      view(): Promise<Context<this>>
      /**
       * Assign a component in this container.
       *
       * @param key Unique key of component in container
       * @param component The component to assign
       */
      assign<Item extends Component>(key: string, component: Item): Promise<void>
      /**
       * Mount a container in this container.
       *
       * @param key Unique key of container to mount
       * @param container Agent of container to mount
       * @returns Context of the mounted container
       */
      mount<Home extends Container>(key: string, container: Home): Promise<Context<Home>>
    }
    /**
     * A context offers synchronous, readonly access to the components of a container subject.
     */
    interface Context<Subject extends Container = Container> {
      /**
       * The container subject whose components are exposed by this context.
       */
      readonly subject: Subject
      /**
       * Iterate over keys of contained components.
       */
      readonly listing: IteratorObject<string>
      /**
       * Find component in this context.
       *
       * @param key Key of component to find
       * @returns A component or undefined
       */
      lookup<Item extends Component>(key: string): Item | undefined
      /**
       * Find context in this context.
       * @param key Key of context to find
       * @returns A context or undefined
       */
      lookupContext<Home extends Container>(key: string): Context<Home> | undefined
      /**
       * Resolve path to component, relative from this context.
       *
       * @param path Path to component
       * @returns The resolved component or undefined
       */
      resolve<Item extends Component>(path: string): Item | undefined
      /**
       * Resolve path to context, relative from this context.
       *
       * @param path Path to context
       * @returns The resolved context or undefined
       */
      resolveContext<Home extends Container>(path: string): Context<Home> | undefined
    }
    /**
     * A container role encapsulates the transient state of a container server.
     */
    abstract class ContainerRole<Home extends Container>
      extends Agency.ServerRole<Container>
      implements Agency.Servant<Container>
    {
      /**
       * Synchronous assignment.
       *
       * @param key Unique key of component
       * @param component Component actor
       */
      protected assignComponent<Item extends Component>(key: string, component: Item): void
      /**
       * Synchronous mount.
       *
       * @param key Unique key of container
       * @param context Context of container
       */
      protected mountContext<Sub extends Container>(key: string, context: Context<Sub>): void
      // implementations of container actions
      view(): Theater.Scene<Context<Home>>
      assign<A extends Component>(key: string, component: A): Theater.Scene<void>
      mount<Home extends Container>(key: string, container: Home): Theater.Scene<Context<Home>>
    }
    /**
     * The root container is the subject of the root context.
     */
    interface Root extends Container {
      /**
       * Unique system id.
       *
       * @return System identifier
       */
      id(): Promise<number>
      /**
       * Obtain ancestry chain.
       *
       * @returns One or more system identifiers
       */
      ancestry(): Promise<[number, ...number[]]>
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
     *
     * Every system has a logger component at path "log".
     */
    interface Logger extends Theater.Actor {
      /**
       * Report message.
       *
       * @param message The message to report
       */
      report<P extends unknown[]>(message: LogMessage<P>): void
    }
    /**
     * A subsidiary agent represents a subsystem.
     */
    interface Subsidiary extends Agency.Agent {
      /**
       * Unique id of subsidiary system.
       *
       * @return System identifier
       */
      id(): Promise<number>
      /**
       * Terminate subsystem.
       */
      shutdown(): Promise<void>
    }
  }
}
