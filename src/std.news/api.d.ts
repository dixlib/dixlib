declare module 'std.news' {
  import Future from 'std.future'
  export default News
  /**
   * The news service provides reporting operations and consumption of reported information.
   * A synchronous reporting operation might fail silently.
   */
  interface News {
    /**
     * Report information at "debug" severity level.
     * This is usually only relevant for developers.
     * @param format Message format
     * @param p Message parameters
     */
    debug<P extends unknown[]>(format: string, ...p: P): void
    /**
     * Report information at "info" severity level.
     * This is usually only relevant for developers or power users.
     * @param format Message format
     * @param p Message parameters
     */
    info<P extends unknown[]>(format: string, ...p: P): void
    /**
     * Report information at "log" severity level.
     * This is usually not relevant for endusers.
     * @param format Message format
     * @param p Message parameters
     */
    log<P extends unknown[]>(format: string, ...p: P): void
    /**
     * Report information at "warn" severity level.
     * This is potentially relevant for endusers when the system behaves strangely.
     * @param format Message format
     * @param p Message parameters
     */
    warn<P extends unknown[]>(format: string, ...p: P): void
    /**
     * Report information at "error" severity level.
     * This is relevant when the system misbehaves.
     * @param format Message format
     * @param p Message parameters
     */
    error<P extends unknown[]>(format: string, ...p: P): void
    /**
     * Consume next reported news message.
     * By default, news messages are consumed by the system logger.
     * Regular application code should probably not consume messages.
     * It should only report messages with the debug, info, log, warn and error operations.
     * @returns A cue that signals a message
     */
    consume<P extends unknown[]>(): Future.Cue<News.Message<P>>
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
       * Severity level.
       */
      readonly severity: Severity
      /**
       * Message format (same as `console.log` format in JavaScript).
       */
      readonly format: string
      /**
       * Message parameters.
       */
      readonly parameters: P
      /**
       * Performance timestamp when message was created.
       */
      readonly timestamp: number
    }
  }
}