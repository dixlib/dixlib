declare module "std.concurrency" {
  import type Future from "std.future"
  export default Concurrency
  /**
   * The concurrency service solves typical synchronisation problems, like producer/consumer and mutual exclusion.
   */
  interface Concurrency {
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
    createExchange<T>(capacity?: number): Concurrency.Exchange<T>
  }
  namespace Concurrency {
    /**
     * An exchange holds a limited number of items.
     *
     * Producers add items to the back of the exchange; consumers remove items from the front.
     * Producers block when the exchange is full; consumers block when it is empty.
     * Underflow occurs when one or more consumers are blocked on an empty exchange.
     * Overflow occurs when one or more producers are blocked on a full exchange.
     *
     * The consumption and production cues of an exchange should not be combined in the same cue.
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
       * @returns A cue that signals when the item has been added to the exchange
       */
      produce(item: T): Future.Cue<void>
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
       * @returns A cue that signals the consumed item
       */
      consume(): Future.Cue<T>
      /**
       * Consume item synchronously.
       *
       * @returns Either singleton array with consumed item or an empty array
       */
      tryConsume(): T[]
    }
  }
}
