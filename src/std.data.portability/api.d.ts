declare module "std.data.portability" {
  import type Data from "std.data"
  import type Definition from "std.data.definition"
  import type Meta from "std.data.meta"
  export default Portability
  /**
   * The data portability service is used to transform data values into network payloads, and vice versa.
   */
  interface Portability {
    /**
     * Create a default marshalling format.
     *
     * The default payload representation is JSON.
     *
     * @param metaspace Meta data space with type definitions
     * @returns A new portability format
     */
    createDefaultFormat(metaspace: Meta.Space): Portability.Format<Portability.JSON>
  }
  namespace Portability {
    /**
     * JSON is the default representation for portable payloads.
     *
     * Note that the JSON standard only supports finite numbers.
     * NaN's and Infinities are not part of the standard.
     */
    type JSON = null | boolean | number | string | JSON[] | { [propertyName: string]: JSON }
    /**
     * A portability format knows how to marshall values and how to unmarshall payloads.
     */
    interface Format<Payload> {
      /**
       * The metadata space with type defitions.
       */
      readonly metaspace: Meta.Space
      /**
       * Marshall value into equivalent payload representation e.g., JSON, XML, Protobuf, etc.
       *
       * If provided, the type expression parameter determines the contextual type.
       * Some payloads can be optimized if the contextual type matches the actual type of the value.
       *
       * @param value Data value
       * @param expressionSource Optional type expression (or source of type expression) defaults to "*?"
       * @returns An equivalent payload
       */
      marshall(value: Data.Value, expressionSource?: Definition.TypeExpression | string): Payload
      /**
       * Unmarshall payload back to data value.
       *
       * If provided, the type expression parameter determines the contextual type.
       * Some payloads are optimized if the contextual type matches the actual type of the value.
       *
       * @param payload Payload representation
       * @param expressionSource Optional type expression (or source of type expression) defaults to "*?"
       * @returns An equivalent data value
       */
      unmarshall(payload: Payload, expressionSource?: Definition.TypeExpression | string): Data.Value
    }
  }
}
