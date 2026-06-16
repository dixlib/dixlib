declare module "std.net" {
  import type Data from "std.data"
  import type Theater from "std.theater"
  export default Net
  /**
   * The standard net service provides operations for a distributed network of actors.
   *
   * The network is restricted to HTTPS.
   * Network actors expose a protocol with the messages that they understand.
   */
  interface Net {
    // SystemRouter(): Theater.RoleClass<Net.SystemRouter, []>
    // Remote<A extends Net.Resource>(): Theater.RoleClass<A, [identity: string, protocol: Net.Protocol<A>]>
    // post(identity: string, message: Net.Message): Promise<Response>
  }
  namespace Net {
    /**
     * A network resource is a theater actor that can be reached over HTTPS.
     *
     * It is essentially an actor manifestation of a HTTP resource that lives at some path on some host.
     */
    interface Resource extends Theater.Actor {
      /**
       * Obtain the unique identity of this network resource.
       *
       * The identity string is returned to the sender.
       * The identity is a URL, without leading protocol (https:// implied) and parameters.
       * The URL path identifies an actor, or the host itself when the path is empty.
       */
      identity(): Theater.OneWay
      understands(protocol: Protocol): Theater.OneWay
    }
    interface SystemRouter extends Resource {
      // route contextual message to actor behind network router
      route(path: string, message: Message): Theater.OneWay
    }
    interface Host extends SystemRouter {
      // a guest wants to stay at the host: return ticket URL and challenge
      stay(): Theater.OneWay
      // renew lease of guest
      renew(ticket: string, challenge: string): Theater.OneWay
    }
    interface Guest extends SystemRouter {
      // obtain public certificate of guest
      authenticity(): Theater.OneWay
    }
    interface Entity extends Resource {
      // take a snapshot and return current state as a data value to sender
      // todo: credentials? authorization? permissions?
      save(expressionSource: Data.TypeExpression | string): Theater.OneWay
    }
    interface Message {
      readonly context: string // URLSearchParams: sender, correlation, protocol
      readonly selector: string
      readonly parameters: Data.JSON[]
    }
    interface Protocol<A extends Resource = Resource, Format extends Data.Format<unknown> = Data.Format<Data.JSON>> {
      readonly dataspace: Data.Space
      readonly format: Format
      readonly hashcode: ArrayBuffer
      readonly message: {
        readonly [Selector in keyof A]: Data.TypeExpression[]
      }
    }
  }
}
