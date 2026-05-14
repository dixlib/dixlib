declare module "std.system" {
  import type Dixlib from "dixlib"
  import type Fx from "std.fx"
  import type Loader from "std.loader"
  import type News from "std.news"
  import type Quality from "std.quality"
  import type Theater from "std.theater"
  export default System
  interface System {
    /**
     * Mixin function creates classes for roles of container servants.
     *
     * @returns Mixin function for container role classes
     */
    ContainerRole<Home extends System.Container, S extends {} = object>(): Fx.Mixin<System.ContainerRole<Home>, S>
    /**
     * Obtain role class for new subsystems.
     *
     * A subsidiary is an actor in the parent system that 'encapsulates' the subsystem.
     * Upon creation, the subsidiary expects the bindings of the new system.
     *
     * The subsystem is terminated when the subsidiary terminates.
     *
     * @returns A role class for a subsidiary actor
     */
    Subsidiary(): Theater.RoleClass<System.Subsidiary, [bundleStack: Loader.Bindings[]]>
    /**
     * Obtain role class for nearby actors in the top network.
     *
     * A nearby actor lives in this system, but it references a component actor in another system in the top network.
     * Upon creation, the nearby role expects the id of the other system and the path to the component.
     *
     * @returns A role class for a nearby actor
     */
    Nearby<A extends Theater.Actor>(): Theater.RoleClass<A, [id: number, path: string]>
    /**
     * Obtain system version.
     *
     * @returns Version string
     */
    version(): string
    /**
     * Obtain unique id of this system.
     *
     * The top system identifies itself as zero.
     * All other systems are direct or indirect subsystems, derived from this top system.
     *
     * @returns A number
     */
    id(): number
    /**
     * Obtain the ancestry chain.
     *
     * The chain identifies this system, the parent system, the grandparent system, ..., up to the top system.
     *
     * @returns An array with numbers that identify systems
     */
    ancestry(): System.Ancestry
    /**
     * Obtain the service loader of this system.
     *
     * This is a convencience operation when a new system requires service providers at start-up.
     *
     * @returns Service loader
     */
    loader(): Loader
    /**
     * Obtain the root context.
     *
     * This is the starting point to synchronously find components in this system.
     *
     * @returns A context on the root container
     */
    root(): System.ContainerContext<System.Container>
    /**
     * Send a message to an actor that returns a result.
     *
     * @param actorRef Actor reference
     * @param question Closure that sends the message whose result is returned
     * @returns A promise of the returned result
     */
    ask<A extends Theater.Actor, Result>(
      actorRef: Theater.ActorRef<A>,
      question: (actor: A) => Theater.OneWay
    ): Promise<Result>
    /**
     * Run a system test.
     *
     * If the service name is not given, all services are tested.
     * If the bundle id is not given, all bundles with test modules are examined.
     *
     * @param name Optional name of service to test
     * @param bundle Optional id of bundle that contains the test module(s) to use
     * @returns A promise of a test report
     */
    test(name?: Dixlib.ServiceName, bundle?: string): Promise<Quality.TestReport>
  }
  namespace System {
    /**
     * An ancestry identifies the nonempty path from a system, to parent systems, all the way up to the top system.
     */
    type Ancestry = [number, ...number[]]
    /**
     * A logger reports log messages.
     *
     * Every system has a logger component at path "logger".
     */
    interface Logger extends Theater.Actor {
      /**
       * Report message.
       *
       * @param message The message to report
       */
      report<P extends unknown[]>(message: LogMessage<P>): Theater.OneWay
    }
    /**
     * The system logger enriches news messages with an origin.
     */
    interface LogMessage<P extends unknown[]> extends News.Message<P> {
      /**
       * Ancestry chain of system from where log message originates.
       */
      readonly origin: Ancestry
    }
    /**
     * A questioner bridges the gap between actors and callbacks.
     *
     * Every system has a questioner component at path "questioner".
     *
     * The {@link System.ask} operation uses this questioner.
     */
    interface Questioner extends Theater.Sender {
      /**
       * Ask questions with asynchronous answers.
       *
       * @param actorRef Actor reference
       * @param question Message to send
       * @param cb Callback on result of message
       */
      ask<A extends Theater.Actor, Result>(
        actorRef: Theater.ActorRef<A>,
        question: (actor: A) => Theater.OneWay,
        cb: (result: Result) => void
      ): Theater.OneWay
    }
    /**
     * A subsidiary actor represents a subsystem.
     */
    interface Subsidiary extends Theater.Actor {
      /**
       * Unique id of subsidiary system.
       *
       * The id (number) is returned to the sender.
       */
      id(): Theater.OneWay
    }
    /**
     * A container is a component that holds zero or more component actors.
     */
    interface Container extends Theater.Actor {
      /**
       * Get a readonly context on this container subject.
       *
       * The context {@link ContainerContext} is returned to the (local) sender.
       */
      view(): Theater.OneWay
      /**
       * Assign a component actor in this container.
       *
       * @param key Unique key of component in container
       * @param component The component actor to assign
       */
      assign<A extends Theater.Actor>(key: string, component: Theater.ActorRef<A>): Theater.OneWay
      /**
       * Mount a container in this container.
       *
       * @param key Unique key of container to mount
       * @param context Context of container to mount
       */
      mount<Home extends Container>(key: string, context: ContainerContext<Home>): Theater.OneWay
    }
    /**
     * A context offers synchronous, readonly access to the component actors of a container subject.
     */
    interface ContainerContext<Subject extends Container = Container> {
      /**
       * The container subject whose component actors are exposed by this context.
       */
      readonly subject: Theater.ActorRef<Subject>
      /**
       * Obtains keys of contained components.
       */
      readonly listing: string[]
      /**
       * Find a component actor in this context.
       *
       * @param key Key of component to find
       * @returns A component
       */
      lookup<A extends Theater.Actor>(key: string): Theater.ActorRef<A> | undefined
      /**
       * Find a context in this context.
       *
       * @param key Key of context to find
       * @returns A context
       */
      lookupContext<Home extends Container>(key: string): ContainerContext<Home> | undefined
      /**
       * Resolve path to component actor, relative from this context.
       *
       * @param path Path to component
       * @returns The resolved component actor or undefined
       */
      resolve<A extends Theater.Actor>(path: string): Theater.ActorRef<A> | undefined
      /**
       * Resolve path to context, relative from this context.
       *
       * @param path Path to context
       * @returns The resolved context or undefined
       */
      resolveContext<Home extends Container>(path: string): ContainerContext<Home> | undefined
    }
    /**
     * A container role encapsulates the transient state of a container actor.
     */
    abstract class ContainerRole<Home extends Container>
      extends Theater.Role<Container>
      implements Theater.Script<Container>
    {
      /**
       * Obtain the readonly context of the container.
       */
      protected readonly containerContext: ContainerContext<Home>
      /**
       * Synchronous assignment.
       *
       * @param key Unique key of component
       * @param component Component actor
       */
      protected assignComponent<A extends Theater.Actor>(key: string, component: Theater.ActorRef<A>): void
      /**
       * Synchronous mount.
       *
       * @param key Unique key of container
       * @param context Context of container
       */
      protected mountContext<SubContainer extends Container>(key: string, context: ContainerContext<SubContainer>): void
      // play scenes of container actor
      view(): Theater.Scene
      assign<A extends Theater.Actor>(key: string, component: Theater.ActorRef<A>): Theater.Scene
      mount<SubContainer extends Container>(key: string, context: System.ContainerContext<SubContainer>): Theater.Scene
    }
  }
}
