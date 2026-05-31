declare module "std.net" {
  export default Net
  /**
   * The standard net service provides operations for a distributed network of actors.
   *
   * The network is restricted to HTTPS.
   * Network actors expose a protocol with the messages that they understand.
   * The messages are (largely) composed of data values.
   * Some messages expect a sender to understand a protocol.
   */
  interface Net {
    join(): void
  }
  namespace Net {
    // address of network actor
    interface ReturnAddress {
      // URL without the https:// prefix; identifies a host if URL path is empty
      readonly global: string
      // if local is nonempty, the address selects an actor in a local network
      readonly local: string
    }
    interface Protocol {
      // selector + parameter types
    }
  }
}
