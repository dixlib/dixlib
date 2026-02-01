declare module "std.theater.future" {
  export default Future
  /**
   * The theater future service provides operations for cues that reveal an asynchronous signal.
   */
  interface Future {
    /**
     * Is it a cue that can reveal a signal?
     *
     * @param it Thing to test
     * @returns True when it is A cue, otherwise false
     */
    isCue<T>(it: unknown): it is Future.Cue<T>
    /**
     * Obtain signal prompt, or fail trying.
     *
     * @param signal Yielded signal
     * @returns Successful prompt
     * @throws When signal contains a blooper
     */
    when<T>(signal: Future.Signal<T>): T
    /**
     * Create a cue for a signal.
     *
     * @param begin Begin waiting for the signal
     * @param end End waiting period
     * @returns A cue
     */
    once<T>(begin: Future.Begin<T>, end?: Future.End<T>): Future.Cue<T>
    /**
     * Create a cue that immediately signals a prompt or blooper.
     *
     * @param signal Signal to spark
     * @returns A cue
     */
    spark<T>(signal: Future.Signal<T>): Future.Cue<T>
    /**
     * Create a cue that signals the expiration of a period.
     *
     * @param ms Timeout period in milliseconds
     * @returns A cue
     */
    timeout(ms: number): Future.Cue<void>
    /**
     * Create a cue that signals the settlement of a promise.
     *
     * @param promise Promise whose settlement is signalled
     * @returns A cue
     */
    pledge<T>(promise: Promise<T>): Future.Cue<T>
    /**
     * Create a cue that synchronously propagates a converted signal from a cue.
     *
     * @param cue A cue
     * @param trap Convert captured signal when it is revealed
     * @returns A cue
     */
    capture<C, T>(cue: Future.Cue<C>, trap: Future.Trap<C, T>): Future.Cue<T>
    /**
     * Create a cue that signals the successful prompts of a list of cues.
     *
     * If there is no list, this cue signals a prompt with an empty array.
     * If some cue in the list signals a blooper, this cue will propagate the blooper.
     *
     * @param cues Zero or more cues
     * @returns A cue
     */
    all<T>(cues: Iterable<Future.Cue<T>>): Future.Cue<T[]>
    /**
     * Create a cue that signals the first successful prompt from a list of cues.
     *
     * If there is no list, this cue signals an AggregateError blooper.
     * This cue also signals an AggregateError blooper if all cues ultimately signal a blooper.
     *
     * @param cues Zero or more cues
     * @returns A cue
     */
    any<T>(cues: Iterable<Future.Cue<T>>): Future.Cue<T>
    /**
     * Create a cue that propagates the first signal from a list of cues.
     *
     * If there is no list, this cue signals an AggregateError blooper.
     *
     * @param cues Zero or more cues
     * @returns A cue
     */
    race<T>(cues: Iterable<Future.Cue<T>>): Future.Cue<T>
    /**
     * Create a cue that propagates the signals of a list of cues.
     *
     * If there is no list, this cue signals a prompt with an empty array.
     *
     * @param cues Zero or more cues
     * @returns A cue
     */
    settle<T>(cues: Iterable<Future.Cue<T>>): Future.Cue<Future.Signal<T>[]>
    /**
     * Schedule effect for somebody that is committed to wait for a cue.
     *
     * This operation is intended for task schedulers, like the theater.
     *
     * @param cue Cue reveals signal
     * @param effect Process signal effect from cue, either immediately or asynchronously
     * @returns A rollback function or nothing when the effect was immediate
     */
    commit<T>(cue: Future.Cue<T>, effect: Future.Reveal<T>): Future.Rollback | undefined
  }
  namespace Future {
    /**
     * A cue reveals a one-time signal that some actor might be waiting for.
     *
     * Cues are synchronisation primitives.
     * Other concepts are built on top of cues.
     */
    interface Cue<T> {
      /**
       * Nobody is waiting for an unused cue.
       */
      readonly isUnused: boolean
      /**
       * Some actor is waiting for a pending cue.
       */
      readonly isPending: boolean
      /**
       * A used cue has been revealed or cancelled.
       */
      readonly isUsed: boolean
    }
    /**
     * A signal contains a prompt on success or a blooper on failure.
     */
    type Signal<T> =
      | {
          /**
           * The successful prompt if the blooper is undefined.
           */
          readonly prompt?: T
        }
      | {
          /**
           * The blooper describes a failure.
           */
          readonly blooper: Error
        }
    /**
     * Reveal the successful prompt of cue or its blooper upon failure.
     */
    type Reveal<T> = (signal: Signal<T>) => void
    /**
     * Synchronous trap of a captured signal.
     */
    type Trap<C, T> = (signal: Signal<C>) => Signal<T>
    /**
     * Begin the waiting period of a pending cue.
     */
    type Begin<T> = (reveal: Reveal<T>, cue: Cue<T>) => void
    /**
     * End the waiting period of a pending cue.
     *
     * If the cue is not revealing, it must have been cancelled.
     */
    type End<T> = (revealing: boolean, cue: Cue<T>) => void
    /**
     * A rollback cancels a commitment.
     *
     * A rollback will do nothing after the commitment has had its effect.
     */
    type Rollback = () => void
  }
}
