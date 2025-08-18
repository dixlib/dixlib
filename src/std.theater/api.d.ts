declare module "std.theater" {
  import type Future from "std.future"
  import type Fx from "std.fx"
  export default Theater
  /**
   * The theater service provides a JavaScript actor system.
   *
   * The theater takes a lot of inspiration from the actor paradigm.
   * However, it is also different in important ways.
   *
   * * An actor reference is not a portable address, but rather a JavaScript proxy for the 'real' actor object.
   * * Sending a message to an actor is achieved by invoking the corresponding method on the proxy.
   * * A separate role object encapsulates the transient state and behavior of an actor.
   *
   * Each actor in the theater is supervised by another actor.
   * The supervisor decides what the consequences of an actor mistake are.
   * This mechanism allows the theater to dynamically adapt to new situations e.g., loss of network connections.
   *
   * When an actor causes an incident, it first suspends itself and all its descendants.
   * It then sends a message to the supervisor to deal with the incident.
   */
  interface Theater {
    /**
     * Mandatory decorator for scene methods in role classes.
     *
     * @param prototype Class prototype
     * @param key Property key of scene method
     * @param descriptor Descriptor of scene method
     * @returns Descriptor of scene method
     */
    Play(prototype: object, key: PropertyKey, descriptor: PropertyDescriptor): PropertyDescriptor
    /**
     * Mixin function for classes whose instances are roles that actors play.
     *
     * @returns Mixin function for role classes of a particular actor
     */
    //biome-ignore lint/complexity/noBannedTypes: {} is appropriate supertype
    Role<A extends Theater.Actor, S extends {} = {}>(): Fx.Mixin<Theater.Role<A>, S>
    /**
     * Test whether it is an actor.
     *
     * @param it Thing to test
     * @returns True if it is an actor, otherwise false
     */
    isActor<A extends Theater.Actor>(it: unknown): it is A
    /**
     * Check whether an actor has been terminated, turning it into a ghost.
     * @param actor Actor to check
     */
    isGhost(actor: Theater.Actor): boolean
    /**
     * Start a new toplevel actor.
     *
     * A toplevel actor is under strict supervision.
     * An incident on stage results in capital punishment.
     *
     * @param TopRole Role class of new actor
     * @param parameters Construction parameters
     * @returns A new actor
     */
    startActor<A extends Theater.Actor, P extends unknown[]>(TopRole: Theater.RoleClass<A, P>, ...parameters: P): A
  }
  namespace Theater {
    /**
     * An actor is an opaque *reference* to an actor object.
     *
     * A method invocation sends a message with a selector and parameters to the referenced actor.
     */
    interface Actor {
      /**
       * Request termination of the actor.
       */
      terminate(): void
    }
    /**
     * A role encapsulates the transient state and behavior of an actor.
     *
     * The role object implements scene methods for the actor.
     */
    abstract class Role<A extends Actor> implements Script<Actor> {
      /**
       * Obtain the actor of this role.
       *
       * @throws When this role is not played by the busy actor on stage
       */
      protected readonly self: A
      /**
       * Exit from a scene to terminate the actor.
       *
       * Exiting throws an exception that instructs the theater to terminate the actor.
       */
      exitSelf(): never
      /**
       * Create and supervise a child actor.
       *
       * @param casting Casting of new actor
       * @returns A new actor
       * @throws When the busy actor on stage is not playing this role
       */
      protected startChild<C extends Actor, P extends unknown[]>(casting: Casting<C, P>): C
      /**
       * Unconditionally terminate a child actor.
       *
       * Only the supervisor is able to terminate an actor unconditionally.
       *
       * @param actor A child actor
       * @throws When the busy actor on stage is not playing this role
       * @throws When self is not supervising the child actor
       */
      protected terminateChild(actor: Actor): void
      /**
       * Monitor health of some actor.
       *
       * When the actor has terminated, an obituary message is sent to self.
       * If the actor is already terminated when monitoring starts, an obituary message to self is sent right away.
       *
       * When self terminates before the other actor, the obituary message is not sent.
       *
       * Health monitoring is idempotent.
       * Self receives one obituary message regardless how often the health of an actor is monitored.
       *
       * @param actor Some actor to monitor
       * @throws When the busy actor on stage is not playing this role
       */
      protected monitorHealth(actor: Actor): void
      /**
       * Perform the first scene on stage to initialize this role.
       *
       * By default, the initialization code does nothing (and is not even performed).
       *
       * Subclasses should define their own initialization code.
       * This method should not be called directly by user code.
       *
       * @param parameters Construction parameters
       * @returns Initialization scene
       */
      protected initializeRole(...parameters: unknown[]): Scene
      /**
       * Perform a scene to clean up the mess of this role.
       *
       * By default, the disposal code does nothing (and is not even performed).
       *
       * Subclasses should define their own disposal code.
       * This method should not be called directly by user code.
       *
       * Disposal code cannot use this.self, because the original actor has been detached from this role.
       * This also excludes other operations e.g., casting child actors while disposing.
       *
       * @param self Original actor
       * @returns Disposal scene
       */
      protected disposeRole(self: A): Scene
      /**
       * Improvise when the script of this role does not implement a corresponding scene method.
       *
       * This method should not be called directly by user code.
       *
       * @param selector Scene selector
       * @param parameters Scene parameters
       * @returns Improvisation scene
       */
      protected improviseScene<P extends unknown[]>(selector: string | symbol, parameters: P): Scene
      /**
       * Observe termination of some actor whose health was monitored by this actor.
       *
       * This method should not be called directly by user code.
       *
       * @param actor Deceased actor
       */
      protected observeTermination(actor: Actor): Scene
      // play default death scene
      terminate(): Scene
    }
    /**
     * Infer the signatures of scene methods that a role class must implement for an actor.
     */
    type Script<A extends Actor> = {
      readonly [K in keyof A]: A[K] extends (...parameters: infer P) => void ? (...parameters: P) => Scene : never
    }
    /**
     * A scene is a generator over cues.
     *
     * Scenes are similar to coroutines.
     * Actors play a scene on the stage to process a message.
     *
     * If a scene yields a cue, the scene waits for the cue to reveal a signal.
     * The yield expression evaluates to this signal when the scene continues.
     *
     * The scene ends when the code returns to the caller.
     */

    //biome-ignore lint/suspicious/noExplicitAny: yield any signal
    type Scene<T = void> = Generator<Future.Cue<unknown>, T, Future.Signal<any>>
    /**
     * A role class defines scene methods for actors.
     */
    type RoleClass<A extends Actor, P extends unknown[]> = Fx.Constructor<Role<A>, P>
    /**
     * An incident on stage.
     */
    interface Incident<A extends Actor> {
      /**
       * Offending actor that caused incident.
       */
      readonly offender: A
      /**
       * Stage error.
       */
      readonly blooper: Error
      /**
       * Scene selector that offender was executing.
       */
      readonly selector: string | symbol
      /**
       * Scene parameters.
       */
      readonly parameters: unknown[]
    }
    /**
     * A guard determines how an incident of a child actor is dealt with.
     *
     * The guard is specified upon child creation.
     * The guard runs in the context of the supervisor while the child has been suspended.
     */
    type Guard<A extends Actor> = (incident: Incident<A>) => Scene<Verdict>
    /**
     * A supervision verdict determines how an offending actor is affected when it fails on stage.
     *
     * Whatever the verdict is, the offending scene always ends.
     *
     * With the verdict "forgive", the actor is unaffected.
     * It continues to work on messages, if any.
     *
     * With the verdict "punish", the actor is terminated.
     * The actor becomes a ghost that cannot work on messages.
     */
    type Verdict = "forgive" | "punish"
    /**
     * A casting is used to create and supervise new actors.
     */
    interface Casting<A extends Actor, P extends unknown[]> {
      /**
       * Role class of new actor.
       */
      readonly Role: RoleClass<A, P>
      /**
       * Construction arguments of new actor.
       */
      readonly parameters: P
      /**
       * Guard for incidents of new actor.
       */
      readonly guard: Guard<A>
    }
  }
}
