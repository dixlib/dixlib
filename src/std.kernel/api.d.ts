declare module 'std.kernel' {
  export default Kernel
  /**
   * The operations of the kernel service are nonstandard JavaScript primitives. 
   */
  interface Kernel {
    /**
     * Is the running JavaScript worker not controlled by a parent?
     * @returns True for a parentless JavaScript worker, otherwise false
     */
    isUnparented(): boolean
    /**
     * Schedule a macrotask in a future cycle of the event loop. 
     * @param macrotask Code to execute in macrotask
     */
    queueMacrotask(macrotask: () => void): void
    /**
     * Start a new isolated child worker.
     * @param path Path to main module
     * @param initial Initial data to clone and to pass over to the child
     * @param transfer Optional list of transferables
     * @returns A promise of the new child worker
     */
    startWorker<Init>(path: URL, initial: Init, transfer?: Kernel.Transferable[]): Promise<Kernel.Worker>
    /**
     * Decode binary data from a data URI.
     * A data URI encodes binary data using Base64 encoding.
     * @param encoded The text of a data URI with binary data
     * @returns A promise of the binary data
     */
    decodeBase64URI(encoded: string): Promise<Uint8Array>
    /**
     * Encode binary data in a data URI.
     * A data URI encodes binary data using Base64 encoding.
     * @param decoded Binary data
     * @param type Optional MIME type (defaults to application/octet-stream)
     * @returns A promise of the data URI text
     */
    encodeBase64URI(decoded: Uint8Array, type?: string): Promise<string>
  }
  namespace Kernel {
    /**
     * NodeJS type definitions (@types/node) are incompatible with webworker lib in TypeScript.
     */
    type MessagePort = typeof MessagePort["prototype"]
    /**
     * NodeJS type definitions (@types/node) are incompatible with webworker lib in TypeScript.
     */
    type Transferable = ArrayBuffer | MessagePort
    /**
     * A worker is a representative of a child environment inside the parent.
     */
    interface Worker {
      /**
       * Port to communicate with child.
       */
      readonly childPort: MessagePort
      /**
       * Terminate child environment.
       */
      terminate(): void
    }
    /**
     * The child environment itself that a parent has created.
     */
    interface Main<Init> {
      /**
       * Initial data from parent. 
       */
      readonly initial: Init
      /**
       * Port to communicate with parent.
       */
      readonly parentPort: MessagePort
      /**
       * Exit this child environment.
       */
      exit(): void
    }
    /**
     * Type of default export in a main module.
     */
    type MainEntry<Init> = (self: Main<Init>) => void
  }
}
