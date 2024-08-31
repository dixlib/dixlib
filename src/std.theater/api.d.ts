declare module 'std.theater' {
  import type Fx from 'std.fx'
  import type Future from 'std.future'
  export default Theater
  /**
   * The theater service provides a JavaScript actor system.
   * 
   * The theater takes a lot of inspiration from the actor paradigm. However, it is also different in many ways.
   * 
   * * An actor reference is not a portable address. It is a JavaScript reference to the actual actor object.
   * * Sending a message to an actor is achieved by invoking the corresponding method.
   * * The progress of an actor message is tracked with an actor job.
   * * Actor jobs convey the asynchronous result of an actor message.
   * * Actors are essentially active objects that execute methods in their own thread of execution.
   * 
   * Each actor in the theater is supervised by another actor.
   * The supervisor decides what the consequences of an actor mistake are.
   * This mechanism allows the theater to dynamically adapt to new situations e.g., loss of network connections.
   */
  interface Theater {
    /**
     * Mandatory decorator for scene methods in role classes.
     * @param prototype Class prototype
     * @param key Property key of scene method
     * @param descriptor Descriptor of scene method
     * @returns Descriptor of scene method
     */
    Play(prototype: object, key: PropertyKey, descriptor: PropertyDescriptor): PropertyDescriptor
    /**
     * Mixin function creates classes whose instances are roles that actors play.
     * @returns Mixin function for role classes of a particular actor
     */
    Role<A extends Theater.Actor, S extends {} = {}>(): Fx.Mixin<Theater.Role<A>, S>
    /**
     * Test whether the theater is showing an actor that is playing on stage.
     * @returns True if the theater is currently showing an actor on stage, otherwise false
     */
    isShowing(): boolean
    /**
     * Test whether it is an escalation exception, with a nested theater incident.
     * @param it Thing to test
     * @returns True if it is an escalation exception, otherwise false
     */
    isEscalation<A extends Theater.Actor>(it: unknown): it is Theater.Escalation<A>
    /**
     * Test whether it is an actor job.
     * @param it Thing to test
     * @returns True if it is an actor job, otherwise false
     */
    isJob<T>(it: unknown): it is Theater.Job<T>
    /**
     * Test whether a job is inert.
     * @param job Job to test
     * @returns True if job is inert, otherwise false
     */
    isInert(job: Theater.Job<unknown>): boolean
    /**
     * Test whether it is an actor.
     * @param it Thing to test
     * @returns True if it is an actor, otherwise false
     */
    isActor<A extends Theater.Actor>(it: unknown): it is A
    /**
     * Test whether an actor is employable. An employable actor can work on jobs.
     * @param actor Actor to test
     * @returns True if actor is employable, otherwise false
     */
    isEmployable(actor: Theater.Actor): boolean
    /**
     * Continue when hint signals a successful prompt.
     * @param hint The hint that signals prompt or blooper
     * @returns A scene that waits on hint and produces successful prompt
     * @throws Escalation when signal reveals a blooper
     */
    when<T>(hint: Future.Hint<T>): Theater.Scene<T>
    /**
     * Play an extra scene on stage.
     * @param scenic Scene code to execute
     * @param p Parameters to pass to scene code
     * @returns An inert job
     */
    play<T, P extends unknown[], This = unknown>(scenic: Theater.Scenic<T, P, This>, ...p: P): Theater.Job<T>
    /**
     * Run an extra scene on stage.
     * @param scenic Scene code to execute
     * @param p Parameters to pass to scene code
     * @returns A running job
     */
    run<T, P extends unknown[], This = unknown>(scenic: Theater.Scenic<T, P, This>, ...p: P): Theater.Job<T>
    /**
     * Open the theater stage for a surprise act.
     * @param job Inert job to perform on stage
     * @returns The final prompt
     * @throws When the theater is already showing an act
     * @throws When the job is not inert
     * @throws When the actor of the job is not employable
     * @throws When the job does not complete in one stage performance
     * @throws When the job completes with a blooper
     */
    surprise<T>(job: Theater.Job<T>): T
    /**
     * Cast a new toplevel actor.
     * @param casting Casting of new actor
     * @returns A new actor
     */
    cast<A extends Theater.Actor, P extends unknown[]>(casting: Theater.Casting<Theater.Actor, A, P>): A
    /**
     * Monitor actor and signal when it dies.
     * @param actor Actor to monitor
     * @returns A cue
     */
    mourn(actor: Theater.Actor): Future.Cue<void>
  }
  namespace Theater {
    /**
     * A job is a unit of work that employs an actor on the theater stage.
     */
    interface Job<T> extends Future.Teleprompter<T>, PromiseLike<T> {
      /**
       * Run this job if it was inert. Otherwise do nothing.
       */
      run(): void
      /**
       * Quit this job if it's not done. Otherwise do nothing.
       */
      quit(): void
    }
    /**
     * An actor plays scenes on the theater stage.
     */
    interface Actor {
      /**
       * Kill this actor to force the death scene.
       * @returns Eventually true if actor was killed, otherwise false
       */
      kill(): Job<boolean>
    }
    /**
     * A scene is a generator over hints. Scenes are similar to coroutines.
     * If a scene yields a hint, the scene waits for the hint to reveal a signal.
     * The yield expression evaluates to this signal when the scene continues.
     * The scene ends when it returns, possibly with a result.
     */
    type Scene<T> = Generator<Future.Hint<unknown>, T, Future.Signal<any>>
    /**
     * Scenic code runs on stage.
     */
    type Scenic<T, P extends unknown[], This = unknown> = (this: This, ...p: P) => Scene<T>
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
     * Escalation error wraps a theater incident.
     */
    interface Escalation<A extends Actor> extends Error {
      /**
       * Theater incident.
       */
      readonly incident: Incident<A>
    }
    /**
     * A guard determines how an incident of a child actor is dealt with.
     * The guard is specified upon child creation.
     * When the guard executes, the child actor is still on the stage!
     */
    interface Guard<A extends Actor, C extends Actor> {
      /**
       * Supervise incident.
       * @param incident Incident caused by spawned child actor
       * @param supervisor Actor of supervising role
       * @returns Supervision verdict
       */
      (incident: Incident<C>, supervisor: A): Verdict
    }
    /**
     * Supervision verdict. The verdict determines how the offending actor is affected when it fails on stage.
     * Whatever the verdict is, the offending job always fails with a blooper. 
     * With the verdict "forgive", the actor is unaffected. It continues to work on jobs, if any.
     * With the verdict "punish", the actor is killed. The actor becomes a ghost that cannot work on jobs.
     * With the verdict "escalate", the actor is killed and the failure bubbles up in the supervision hierarchy.
     * A recast verdict object installs a fresh role for the actor. The old role is disposed, including its jobs.
     */
    type Verdict = "forgive" | "punish" | "escalate" | { recast: Casting<Actor, Actor, unknown[]> }
    /**
     * A casting is used to create and supervise new actors.
     */
    type Casting<A extends Actor, C extends Actor, P extends unknown[]> = {
      /**
       * Role class of new actor.
       */
      Role: RoleClass<C, P>
      /**
       * Construction arguments of new actor.
       */
      p: P
      /**
       * Guard for incidents of new actor.
       */
      guard: Guard<A, C>
    }
    /**
     * Infer the signatures of scene methods that a role class must implement for an actor.
     */
    type Script<A extends Actor> = {
      readonly [K in keyof A]: A[K] extends (...p: infer P) => Job<infer T> ? (...p: P) => Scene<T> : never
    }
    /**
     * A role encapsulates the transient state of an actor.
     * The role object implements scene methods for the actor.
     */
    abstract class Role<A extends Actor> implements Script<Actor> {
      /**
       * Reference the actor of this role.
       * @throws When this role is not played by the busy actor on stage 
       */
      protected readonly self: A
      /**
       * Perform the first scene on stage to initialize this role.
       * By default, the initialization code does nothing (and is not even performed).
       * Subclasses should define their own initialization code.
       * This method should not be called directly by user code.
       * Actors postpone jobs until the initialization is complete. 
       * @param p Construction parameters
       * @returns Initialization scene
       */
      protected initializeRole(...p: unknown[]): Scene<void>
      /**
       * Perform a scene to clean up the mess of this role.
       * By default, the disposal code does nothing (and is not even performed).
       * Subclasses should define their own disposal code.
       * This method should not be called directly by user code.
       * Disposal code cannot reference self, because the actor has been detached from this role.
       * @returns Disposal scene
       */
      protected disposeRole(): Scene<void>
      /**
       * Improvise when the script of this role does not implement a corresponding scene method.
       * Default throws an error.
       * This method should not be called directly by user code.
       * @param selector Scene selector
       * @param p Scene parameters
       * @returns Improvisation scene
       * @throws When this role is not played by the busy actor on stage 
       */
      protected improviseScene<T, P extends unknown[]>(selector: string | symbol, p: P): Scene<T>
      /**
       * Create inert job for self to play on stage.
       * @param scenic Scenic code to perform on stage
       * @param p Parameters to pass
       * @returns An inert job
       * @throws When this role is not played by the busy actor on stage 
       */
      protected playScene<T, P extends unknown[]>(scenic: Scenic<T, P, this>, ...p: P): Job<T>
      /**
       * Create and supervise a child actor.
       * @param casting Casting of new child actor
       * @returns A new child actor
       * @throws When this role is not played by the busy actor on stage 
       */
      protected castChild<C extends Actor, P extends unknown[]>(casting: Casting<A, C, P>): C
      public kill(): Scene<boolean>
    }
    /**
     * A role class defines scene methods for actors.
     */
    type RoleClass<A extends Actor, P extends unknown[]> = Fx.Constructor<Role<A>, P>
  }
}
