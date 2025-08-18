declare module "std.agency" {
  import type Future from "std.future"
  import type Fx from "std.fx"
  import type Theater from "std.theater"
  export default Agency
  /**
   * The agency service offers operations to use agents.
   *
   * Agents are active objects ([Wikipedia](https://en.wikipedia.org/wiki/Active_object)).
   *
   * An agent is implemented with a client/server actor pair.
   * The client actor asks the server to perform some asynchronous action.
   * The server actor answers the client when the action is done.
   */
  interface Agency {
    /**
     * Mixin function creates classes whose instances are roles for server actors.

    * @returns Mixin function for server role classes
     */
    //biome-ignore lint/complexity/noBannedTypes: {} is proper super type
    ServerRole<A extends Agency.Agent, S extends {} = {}>(): Fx.Mixin<Agency.ServerRole<A>, S>
    /**
     * Mandatory decorator for action methods in server classes.
     *
     * @param prototype Class prototype
     * @param key Property key of action method
     * @param descriptor Descriptor of action method
     * @returns Descriptor of action method
     */
    Serve(prototype: object, key: PropertyKey, descriptor: PropertyDescriptor): PropertyDescriptor
    /**
     * Obtain role class for client actors that communicate with server actors.
     *
     * Clients actors are wrapped in agents for a more convenient interface.
     *
     * @returns A role class for clients
     */
    Client<A extends Agency.Agent>(): Theater.RoleClass<Agency.Client<A>, [Agency.Server<A>]>
    /**
     * Test whether it is an agent.
     *
     * @param it Thing to test
     * @returns True if it is an agent, otherwise false
     */
    isAgent<A extends Agency.Agent>(it: unknown): it is A
    /**
     * Wrap a client actor in an agent that offers convenient asynchronous actions.
     *
     * @param client Client actor that communicates with a server actor
     * @returns A new agent
     */
    createAgent<A extends Agency.Agent>(client: Agency.Client<A>): A
  }
  namespace Agency {
    /**
     * An agent is an active object.
     *
     * Every interaction with an agent is an asynchronous action i.e., it results in a JavaScript promise.
     * A client/server actor pair implements these actions, but the agent hides this actor complexity.
     * The agent offers convenient promises to await the action result.
     */
    interface Agent {}
    /**
     * Helper type to restrict agent interface to asynchronous actions.
     */
    type Agentic<A extends Agent> = {
      [K in keyof A]: A[K] extends (...parameters: infer P) => Promise<infer U>
        ? (...parameters: P) => Promise<U>
        : never
    }
    /**
     * A client actor forwards a message to a server, and reveals the action result from the server.
     */
    interface Client<A extends Agent> extends Theater.Actor {
      /**
       * Forward an action message to the server.
       *
       * @param reveal Reveal signal from server
       * @param selector Action selector
       * @param parameters  Action parameters
       */
      askAction<K extends keyof A>(
        reveal: Future.Reveal<Awaited<ReturnType<Agentic<A>[K]>>>,
        selector: K,
        parameters: Parameters<Agentic<A>[K]>
      ): void
      /**
       * Reveal the action result from the server.
       *
       * @param correlation Action correlation
       * @param signal Action result
       */
      answerAction<K extends keyof A>(
        correlation: number,
        signal: Future.Signal<Awaited<ReturnType<Agentic<A>[K]>>>
      ): void
    }
    /**
     * A server actor implements agent actions.
     */
    interface Server<A extends Agent> extends Theater.Actor {
      /**
       * Perform agent action.
       *
       * @param client Client that requests the action and expects an answer
       * @param correlation Action correlation
       * @param selector Action selector
       * @param parameters Action parameters
       */
      serveAction<K extends keyof A>(
        client: Client<A>,
        correlation: number,
        selector: K,
        parameters: Parameters<Agentic<A>[K]>
      ): void
    }
    /**
     * Servant roles implement scenes to compute the action result on the server side.
     */
    type Servant<A extends Agent> = {
      [K in keyof A]: A[K] extends (...parameters: infer P) => Promise<infer U>
        ? (...parameters: P) => Theater.Scene<U>
        : never
    }
    /**
     * Servant classes with agent action methods.
     */
    type ServantClass<A extends Agent, P extends unknown[]> = Fx.Constructor<Servant<A>, P>
    /**
     * Super class of all servant roles.
     */
    abstract class ServerRole<A extends Agent> extends Theater.Role<Server<A>> implements Theater.Script<Server<A>> {
      // scene method to serve actions; subclasses must implement servant methods for every action
      serveAction<K extends keyof A>(
        client: Client<A>,
        correlation: number,
        selector: K,
        parameters: Parameters<Agentic<A>[K]>
      ): Theater.Scene
    }
  }
}
