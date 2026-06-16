declare module "std.news" {
  import type Future from "std.future"
  export default News
  /**
   * The news service provides reporting operations and consumption of reported information.
   *
   * A news message is reported asynchronously i.e., a message is not immediately processed.
   */
  interface News {
    /**
     * Report information at "debug" severity level.
     *
     * This is usually only relevant for developers.
     *
     * @param format Message format
     * @param parameters Message parameters
     */
    debug<P extends unknown[]>(format: string, ...parameters: P): void
    /**
     * Report information at "info" severity level.
     *
     * This is usually only relevant for developers or power users.
     *
     * @param format Message format
     * @param parameters Message parameters
     */
    info<P extends unknown[]>(format: string, ...parameters: P): void
    /**
     * Report information at "log" severity level.
     *
     * This is usually not relevant for endusers.
     *
     * @param format Message format
     * @param parameters Message parameters
     */
    log<P extends unknown[]>(format: string, ...parameters: P): void
    /**
     * Report information at "warn" severity level.
     *
     * This is potentially relevant for endusers when the system behaves strangely.
     *
     * @param format Message format
     * @param parameters Message parameters
     */
    warn<P extends unknown[]>(format: string, ...parameters: P): void
    /**
     * Report information at "error" severity level.
     *
     * This is relevant when the system misbehaves.
     *
     * @param format Message format
     * @param parameters Message parameters
     */
    error<P extends unknown[]>(format: string, ...parameters: P): void
    /**
     * Consume next reported news message for further processing.
     *
     * By default, news messages are consumed by the system logger.
     * Regular application code should probably not consume news messages.
     * It should only report messages with the debug, info, log, warn and error operations.
     *
     * @returns An event that signals a message
     */
    consume<P extends unknown[]>(): Future.Event<News.Message<P>>
  }
  namespace News {
    /**
     * Severity levels of a message.
     */
    type Severity = "debug" | "info" | "log" | "warn" | "error"
    /**
     * A message with news information.
     */
    interface Message<P extends ReadonlyArray<unknown>> {
      /**
       * Severity level indicates how important this message is.
       */
      readonly severity: Severity
      /**
       * Message format creates message text.
       */
      readonly format: string
      /**
       * Message parameters are given as input to message format.
       */
      readonly parameters: P
      /**
       * Performance timestamp when message was created.
       */
      readonly timestamp: number
    }
  }
}
