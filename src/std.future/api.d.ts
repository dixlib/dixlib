declare module "std.future" {
  export default Future
  /**
   * The future service provides operations for events that reveal an asynchronous signal.
   */
  interface Future {
    /**
     * Is it an event that can reveal a signal?
     *
     * @param it Thing to test
     * @returns True when it is an event, otherwise false
     */
    isEvent<T>(it: unknown): it is Future.Event<T>
    /**
     * Obtain signal result, or fail trying.
     *
     * @param signal Yielded signal
     * @returns Successful result
     * @throws When signal contains an error
     */
    when<T>(signal: Future.Signal<T>): T
    /**
     * Create an event for a signal.
     *
     * @param begin Begin waiting for the signal
     * @param end End waiting period
     * @returns An event
     */
    once<T>(begin: Future.Begin<T>, end?: Future.End<T>): Future.Event<T>
    /**
     * Create an event that immediately signals a result or error.
     *
     * @param signal Signal to spark
     * @returns An event
     */
    spark<T>(signal: Future.Signal<T>): Future.Event<T>
    /**
     * Create an event that signals the expiration of a period.
     *
     * @param ms Timeout period in milliseconds
     * @returns An event
     */
    timeout(ms: number): Future.Event<void>
    /**
     * Create an event that signals the settlement of a promise.
     *
     * @param promise Promise whose settlement is signalled
     * @returns An event
     */
    pledge<T>(promise: Promise<T>): Future.Event<T>
    /**
     * Create an event that synchronously propagates a converted signal from another event.
     *
     * @param event An event
     * @param trap Convert captured signal when it is revealed
     * @returns An event
     */
    capture<C, T>(event: Future.Event<C>, trap: Future.Trap<C, T>): Future.Event<T>
    /**
     * Create an event that signals the successful results of a list of events.
     *
     * If there is no list, this event signals an empty array as the result.
     * If some event in the list signals an error, this event will propagate the error.
     *
     * @param events Zero or more events
     * @returns An event
     */
    all<T>(events: Iterable<Future.Event<T>>): Future.Event<T[]>
    /**
     * Create an event that signals the first successful result from a list of events.
     *
     * If there is no list, this event signals an AggregateError.
     * This event also signals an AggregateError if all events ultimately signal an error.
     *
     * @param events Zero or more events
     * @returns An event
     */
    any<T>(events: Iterable<Future.Event<T>>): Future.Event<T>
    /**
     * Create an event that propagates the first signal from a list of events.
     *
     * If there is no list, this event signals an AggregateError.
     *
     * @param events Zero or more events
     * @returns An event
     */
    race<T>(events: Iterable<Future.Event<T>>): Future.Event<T>
    /**
     * Create an event that propagates the signals of a list of events.
     *
     * If there is no list, this event signals an empty array as the result.
     *
     * @param events Zero or more events
     * @returns An event
     */
    settle<T>(events: Iterable<Future.Event<T>>): Future.Event<Future.Signal<T>[]>
    /**
     * Schedule effect for somebody that is committed to wait for an event.
     *
     * This operation is intended for task schedulers, like the theater.
     *
     * @param event Event reveals signal
     * @param effect Process signal effect from event, either immediately or asynchronously
     * @returns A rollback function or nothing when the effect was immediate
     */
    commit<T>(event: Future.Event<T>, effect: Future.Reveal<T>): Future.Rollback | undefined
    /**
     * Create an exchange that buffers produced items, until the items are consumed.
     *
     * A zero capacity exchange provides rendezvous synchronisation between a producer and a consumer.
     * A rendezvous exchange blocks a producer, until a consumer arrives.
     * But it also blocks a consumer, until a producer arrives.
     *
     * @param capacity Maximum number of buffered items defaults to Infinity
     * @returns A new exchange
     */
    createExchange<T>(capacity?: number): Future.Exchange<T>
  }
  namespace Future {
    /**
     * An event reveals a one-time signal that somebody might be waiting for.
     *
     * Events are synchronisation primitives.
     * Other concepts are built on top of events.
     */
    interface Event<T> {
      /**
       * Nobody is waiting for an unused event.
       */
      readonly isUnused: boolean
      /**
       * Somebody is commited to wait for a pending event.
       */
      readonly isPending: boolean
      /**
       * A used event has been revealed or cancelled.
       */
      readonly isUsed: boolean
    }
    /**
     * A signal contains a result on success or an error on failure.
     */
    type Signal<T> =
      | {
          /**
           * The successful result if the error is undefined.
           */
          readonly result?: T
        }
      | {
          /**
           * The error describes a failure.
           */
          readonly error: Error
        }
    /**
     * Reveal the successful result of event or its error upon failure.
     */
    type Reveal<T> = (signal: Signal<T>) => void
    /**
     * Synchronous trap of a captured signal.
     */
    type Trap<C, T> = (signal: Signal<C>) => Signal<T>
    /**
     * Begin the waiting period of a pending event.
     */
    type Begin<T> = (reveal: Reveal<T>, event: Event<T>) => void
    /**
     * End the waiting period of a pending event.
     *
     * If the event is not revealing, it must have been cancelled.
     */
    type End<T> = (revealing: boolean, event: Event<T>) => void
    /**
     * A rollback cancels a commitment.
     *
     * A rollback will do nothing after the commitment has had its effect.
     */
    type Rollback = () => void
    /**
     * An exchange holds a limited number of items.
     *
     * Producers add items to the back of the exchange; consumers remove items from the front.
     * Producers block when the exchange is full; consumers block when it is empty.
     * Underflow occurs when one or more consumers are blocked on an empty exchange.
     * Overflow occurs when one or more producers are blocked on a full exchange.
     *
     * The consumption and production events of an exchange should not be combined in the same event.
     */
    interface Exchange<T> {
      /**
       * The capacity is the maximum amount of buffered items in this exchange.
       */
      readonly capacity: number
      /**
       * An empty exchange does not hold any items.
       */
      readonly isEmpty: boolean
      /**
       * A full exchange holds the maximum amount of items.
       */
      readonly isFull: boolean
      /**
       * An empty exchange is underflowing when it is blocking one or more consumers.
       */
      readonly isUnderflowing: boolean
      /**
       * A full exchange is overflowing when it is blocking one or more producers.
       */
      readonly isOverflowing: boolean
      /**
       * Produce item at the back.
       *
       * @param item Item to add
       * @returns An event that signals when the item has been added to the exchange
       */
      produce(item: T): Future.Event<void>
      /**
       * Produce item synchronously.
       *
       * @param item Item to add
       * @returns True if item was successfully added, otherwise false
       */
      tryProduce(item: T): boolean
      /**
       * Consume item from the front.
       *
       * @returns An event that signals the consumed item
       */
      consume(): Future.Event<T>
      /**
       * Consume item synchronously.
       *
       * @returns Either singleton array with consumed item or an empty array
       */
      tryConsume(): T[]
    }
  }
}
