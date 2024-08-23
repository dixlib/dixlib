declare module 'std.future' {
  export default Future
  /**
   * The future service provides operations for hints that can reveal an asynchronous signal.
   */
  interface Future {
    /**
     * Is it a cue that can reveal a one-time signal? 
     * @param it Thing to test
     * @returns True when it is a cue, otherwise false
     */
    isCue<T>(it: unknown): it is Future.Cue<T>
    /**
     * Is it a teleprompter that can reveal signals? 
     * @param it Thing to test
     * @returns True when it is a teleprompter, otherwise false
     */
    isTeleprompter<T>(it: unknown): it is Future.Teleprompter<T>
    /**
     * Is it a hint that can reveal a signal? 
     * @param it Thing to test
     * @returns True when it is a hint, otherwise false
     */
    isHint<T>(it: unknown): it is Future.Hint<T>
    /**
     * Create a cue for a onetime signal.
     * @param begin Begin waiting for the signal
     * @param end End waiting period
     * @returns A cue
     */
    once<T>(begin: Future.Begin<T>, end?: Future.End<T>): Future.Cue<T>
    /**
     * Create cues over and over again.
     * @param begin Begin waiting for a new signal
     * @param end End waiting period
     * @returns A teleprompter
     */
    often<T>(begin: Future.Begin<T>, end?: Future.End<T>): Future.Teleprompter<T>
    /**
     * Create a cue that immediately signals a prompt or blooper.
     * @param signal Signal to spark
     * @returns A cue
     */
    spark<T>(signal: Future.Signal<T>): Future.Cue<T>
    /**
     * Create a cue that signals the expiration of a period.
     * @param ms Timeout period in milliseconds
     * @returns A cue
     */
    timeout(ms: number): Future.Cue<void>
    /**
     * Create a cue that synchronously propagates a converted signal from a hint.
     * @param hint A hint
     * @param trap Convert captured signal when it is revealed
     * @returns A cue
     */
    capture<C, T>(hint: Future.Hint<C>, trap: Future.Trap<C, T>): Future.Cue<T>
    /**
     * Create a cue that signals the successful prompts of all hints.
     * If there are no hints, this cue signals a prompt with an empty array.
     * If some hint signals a blooper, this cue will propagate the blooper.
     * @param hints Zero or more hints
     * @returns A cue
     */
    all<T>(hints: Iterable<Future.Hint<T>>): Future.Cue<T[]>
    /**
     * Create a cue that signals the first successful prompt from some hint.
     * If there are no hints, this cue signals an AggregateError blooper. 
     * This cue also signals an AggregateError blooper if all hints signal a blooper.
     * @param hints Zero or more hints
     * @returns A cue
     */
    any<T>(hints: Iterable<Future.Hint<T>>): Future.Cue<T>
    /**
     * Create a cue that propagates the first signal from some hint.
     * If there are no hints, this cue will never signal.
     * @param hints Zero or more hints
     * @returns A cue
     */
    race<T>(hints: Iterable<Future.Hint<T>>): Future.Cue<T>
    /**
     * Create a cue that propagates the signals of all hints.
     * @param hints Zero or more hints
     * @returns A cue
     */
    settle<T>(hints: Iterable<Future.Hint<T>>): Future.Cue<Future.Signal<T>[]>
    /**
     * Schedule effect for somebody that is committed to wait for a hint.
     * @param hint Hint reveals signal
     * @param effect Process signal effects from hint, either immediately or asynchronously
     * @returns A rollback function or nothing when the effect was immediate
     */
    commit<T>(hint: Future.Hint<T>, effect: Future.Reveal<T>): Future.Rollback | undefined
    /**
     * Create an exchange that buffers produced items, until the items are consumed.
     * A zero capacity exchange provides rendezvous synchronization between a producer and a consumer.
     * @param capacity Maximum number of buffered items defaults to Infinity
     * @returns A new exchange
     */
    exchange<T>(capacity?: number): Future.Exchange<T>
  }
  namespace Future {
    /**
     * A cue reveals a one-time signal that somebody might be waiting for.
     * Cues are synchronization primitives. Other concepts are built on top of cues. 
     */
    interface Cue<T> {
      /**
       * Nobody is waiting for an unused cue.
       */
      readonly isUnused: boolean
      /**
       * Somebody is waiting for a pending cue.
       */
      readonly isPending: boolean
      /**
       * A used cue has been revealed or cancelled.
       */
      readonly isUsed: boolean
    }
    /**
     * A teleprompter produces theater cues on demand.
     */
    interface Teleprompter<T> {
      /**
       * Obtain cue from this teleprompter.
       * @returns An unused theater cue
       */
      autocue(): Cue<T>
    }
    /**
     * A hint turns into a pending cue when somebody starts waiting for its signal.
     */
    type Hint<T> = Cue<T> | Teleprompter<T> | Promise<T>
    /**
     * A signal reveals a prompt on success or a blooper on failure.
     */
    interface Signal<T> {
      /**
       * The successful prompt if the blooper is undefined.
       */
      readonly prompt?: T
      /**
       * The optional blooper describes a failure.
       */
      readonly blooper?: Error
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
     * If the cue is not revealing, it must have been cancelled.
     */
    type End<T> = (revealing: boolean, cue: Cue<T>) => void
    /**
     * A rollback cancels a commitment.
     * A rollback will do nothing after the commitment has had its effect.
     */
    type Rollback = () => void
    /**
     * An exchange holds a limited number of items.
     * Publishers add items to the back of the exchange; consumers removes items from the front.
     * Publishers block when the exchange is full; consumers block when it is empty.
     * Underflow occurs when one or more consumers are blocked on an empty exchange.
     * Overflow occurs when one or more producers are blocked on a full exchange.
     */
    interface Exchange<T> {
      /**
       * The capacity is the maximum amount of buffered items in this exchange.
       * A zero capacity exchange is known as rendezvous synchronization.
       * A rendezvous exchange blocks a producer, until a consumer arrives.
       * A rendezvouz exchange blocks a consumer, until a producer arrives. 
       */
      readonly capacity: number
      /**
       * An empty buffer does not hold any items.
       */
      readonly isEmpty: boolean
      /**
       * A full buffer holds the maximum amount of items.
       */
      readonly isFull: boolean
      /**
       * An empty buffer is underflowing when it is blocking one or more consumers.
       */
      readonly isUnderflowing: boolean
      /**
       * A full buffer is overflowing when it is blocking one or more producers.
       */
      readonly isOverflowing: boolean
      /**
       * Produce item at the back.
       * @param item Item to add
       * @returns A cue that signals when the item has been added to the buffer
       */
      produce(item: T): Cue<void>
      /**
       * Consume item from the front.
       * @returns A cue that signals the consumed item
       */
      consume(): Cue<T>
    }
  }
}
