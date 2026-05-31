declare module "std.theater" {
  import type Fx from "std.fx"
  import type Kernel from "std.kernel"
  import type News from "std.news"
  import type Future from "std.theater.future"
  export default Theater
  /**
   * The theater service provides a JavaScript actor system.
   *
   * The theater takes a lot of inspiration from the actor paradigm.
   * However, it is also different in important ways.
   *
   * * An actor reference is not a portable address, but a JavaScript function that returns the 'real' actor.
   * * Sending a message to an actor is achieved by invoking the corresponding method on the actor.
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
    Role<A extends Theater.Actor, S extends {} = object>(): Fx.Mixin<Theater.Role<A>, S>
    /**
     * Test whether it is an actor reference.
     *
     * The validity of type hint A, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is an actor reference, otherwise false
     */
    isActorRef<A extends Theater.Actor>(it: unknown): it is Theater.ActorRef<A>
    /**
     * Check whether an actor has been terminated, turning it into a ghost.
     *
     * @param actorRef Reference to actor that should be checked check
     * @returns True if actor is a ghost, otherwise false
     */
    isGhostRef(actorRef: Theater.ActorRef): boolean
    /**
     * Start a new toplevel actor.
     *
     * A toplevel actor is under strict supervision.
     * An incident on stage results in capital punishment.
     *
     * @param TopRole Role class of new actor
     * @param parameters Construction parameters
     * @returns A reference to the new actor
     */
    startActor<A extends Theater.Actor, P extends unknown[]>(
      TopRole: Theater.RoleClass<A, P>,
      ...parameters: P
    ): Theater.ActorRef<A>
    /**
     * Create a default guard that always returns the same verdict.
     *
     * It reports a specific or default message at some severity level, or error level if severity is undefined.
     *
     * @param verdict Predetermined verdict
     * @param message Optional text for news message
     * @param severity Optional message severity
     * @returns A guard that reports news and returns the same verdict every time
     */
    createDefaultGuard<A extends Theater.Actor>(
      verdict: Theater.Verdict,
      message?: string,
      severity?: News.Severity
    ): Theater.Guard<A>
    /**
     * Obtain a cue that signals an idle theater.
     *
     * An idle theater does not have actors that are ready to process (or to continue processing) a message.
     *
     * @returna A theater cue
     */
    idle(): Future.Cue<void>
  }
  namespace Theater {
    /**
     * An opaque *reference* to an actor object must be dereferenced to send a message to the actor.
     *
     * After dereferencing, it is necessary to send exactly one message to the actor.
     */
    interface ActorRef<A extends Actor = Actor> {
      /**
       * Calling an actor reference dereferences it.
       *
       * @returns The actor to send one message to
       */
      (): A
      /**
       * Calling an actor reference dereferences it.
       *
       * @param context Context for message that must be sent to the actor
       * @returns The actor to send one message to
       */
      <ReplyTo extends Actor = Actor>(context: MessageContext<ReplyTo>): A
    }
    /**
     * All actors have one thing in common.
     * You can send a termination message in an attempt to stop the actor.
     */
    interface Actor {
      /**
       * Send a termination message.
       *
       * This does not necessarily terminate the actor, because an actor can choose to ignore this message.
       * The default actor response will terminate the actor.
       */
      terminate(): OneWay
    }
    /**
     * The synchronous result of sending an actor message is always undefined.
     *
     * Actor messages are one-way, also known as fire-and-forget.
     */
    type OneWay = undefined
    /**
     * A message context provides extra information about a message that has been sent to an actor.
     */
    interface MessageContext<ReplyTo extends Actor = Actor> {
      /**
       * The sender of the message to which the processing result, if any, should be returned.
       */
      readonly sender?: ActorRef<ReplyTo>
      /**
       * A unique correlation id for the sent message.
       *
       * When returning a result, the same correlation is also returned.
       */
      readonly correlation?: number
      /**
       * An array with objects whose ownership is transferred to the receiver of the message.
       */
      readonly transfer?: Kernel.Transferable[]
    }
    /**
     * A sender is an actor that expects a result back from a previously sent message.
     */
    interface Sender extends Theater.Actor {
      /**
       * Return the result of a previously sent message.
       *
       * If necessary, use the correlation from the message context to associate the result with a particular message.
       *
       * @param result The result
       */
      return<Result>(result: Result): Theater.OneWay
    }
    /**
     * A role class defines scene methods for actors.
     */
    type RoleClass<A extends Actor, P extends unknown[]> = Fx.Constructor<Role<A>, P>
    /**
     * Infer the signatures of scene methods that a role class must implement for an actor.
     */
    type Script<A extends Actor> = {
      readonly [K in keyof A]: A[K] extends (...parameters: infer P) => OneWay ? (...parameters: P) => Scene : never
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
     * A role encapsulates the transient state and behavior of an actor.
     *
     * The role object implements scene methods for the actor.
     */
    abstract class Role<A extends Actor> implements Script<Actor> {
      /**
       * Obtain a reference to the actor of this role.
       *
       * @throws When the busy actor on stage is not playing this role
       */
      protected readonly self: ActorRef<A>
      /**
       * Obtain context of message that is currently being processed by this role.
       *
       * @returns Message context
       * @throws When the busy actor on stage is not playing this role
       */
      protected messageContext<ReplyTo extends Actor = Actor>(): MessageContext<ReplyTo>
      /**
       * Reply to sender of message context, if any.
       *
       * The sender from the message context should be a {@link Sender}.
       * If the context does not define a sender, a news warning is issued.
       *
       * @throws When the busy actor on stage is not playing this role
       */
      protected return<Result>(result: Result): void
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
       * @param self Reference to original actor
       * @returns Disposal scene
       */
      protected disposeRole(self: ActorRef<A>): Scene
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
       * @param actorRef Reference to ghost actor
       * @returns Mourning scene
       */
      protected observeTermination(actorRef: ActorRef): Scene
      /**
       * Terminate the actor itself.
       *
       * @throws When the busy actor on stage is not playing this role
       */
      protected exitSelf(): never
      /**
       * Create and supervise a child actor.
       *
       * @param casting Casting of new actor
       * @returns Reference to a new actor
       * @throws When the busy actor on stage is not playing this role
       */
      protected castChild<C extends Actor, P extends unknown[]>(casting: Casting<C, P>): ActorRef<C>
      /**
       * Unconditionally terminate a child actor.
       *
       * Only the supervisor is able to terminate an actor unconditionally.
       *
       * @param actorRef Reference to a child actor
       * @throws When the busy actor on stage is not playing this role
       * @throws When self is not supervising the child actor
       */
      protected terminateChild(actorRef: ActorRef): void
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
       * @param actorRef Reference to some actor to monitor
       * @throws When the busy actor on stage is not playing this role
       */
      protected monitorHealth(actorRef: ActorRef): void
      // play default death scene
      terminate(): Scene
    }
    /**
     * An incident on stage.
     */
    interface Incident<A extends Actor> {
      /**
       * Offending actor that caused incident.
       */
      readonly offender: ActorRef<A>
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
