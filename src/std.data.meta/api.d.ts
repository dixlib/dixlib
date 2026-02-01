declare module "std.data.meta" {
  import type { ServiceName } from "dixlib"
  import type Data from "std.data"
  import type Definition from "std.data.definition"
  export default Meta
  /**
   * The data meta service provides operations to deal with data types.
   */
  interface Meta {
    /**
     * Test whether it is a data type.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a type, otherwise false
     */
    isType<T extends Data.Value = Data.Value>(it: unknown): it is Meta.Type<T>
    /**
     * Derive dynamic type of a value.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param value Data value
     * @returns A data type
     */
    typeOf<T extends Data.Value = Data.Value>(value: T): Meta.Type<T>
    /**
     * Test type equivalence.
     *
     * @param left Left type
     * @param right Right type
     * @returns True if left and right are equal types, otherwise false
     */
    equalType<T extends Data.Value = Data.Value>(left: Meta.Type<T>, right: Meta.Type<T>): boolean
    /**
     * Inflate a new metadata space.
     *
     * @param serviceName Name of service that provides the type definitions for the new space
     * @returns Promise of new metadata space
     */
    inflate(serviceName: ServiceName): Promise<Meta.Space>
  }
  namespace Meta {
    /**
     * A type classifies a set of data values.
     */
    interface Type<T extends Data.Value> {
      /**
       * Test whether this type includes a value.
       *
       * @param v Value to test
       * @returns True if value is included, otherwise false
       */
      includes(v: Data.Value): v is T
      /**
       * Match a pattern on this type.
       *
       * @param pattern Pattern to match
       * @param parameters Additional parameters
       * @returns An output result
       */
      match<V, P extends unknown[]>(pattern: TypePattern<V, P>, ...parameters: P): V
    }
    /**
     * Derive types of fields in a record value.
     */
    type FieldTypesOf<F extends Data.FieldValues> = { readonly [K in keyof F]: Type<F[K]> }
    /**
     * Derive types of values in an array.
     */
    type TypesOf<T extends Data.Value[]> = { readonly [Ix in keyof T]: Type<T[Ix]> }
    /**
     * A type pattern computes an output result from the input type and input parameters.
     *
     * Type patterns implement a variation of the visitor pattern.
     */
    interface TypePattern<T, P extends unknown[]> {
      /**
       * Compute output result.
       *
       * @param input Boolean input type
       * @param parameters Supplied parameters
       * @returns Output result
       */
      boolean?(type: Type<boolean>, parameters: P): T
      /**
       * Compute output result.
       *
       * @param input Int32 input type
       * @param parameters Supplied parameters
       * @returns Output result
       */
      int32?(type: Type<number>, parameters: P): T
      /**
       * Compute output result.
       *
       * @param input Number input type
       * @param parameters Supplied parameters
       * @returns Output result
       */
      number?(type: Type<number>, parameters: P): T
      /**
       * Compute output result.
       *
       * @param input String input type
       * @param parameters Supplied parameters
       * @returns Output result
       */
      string?(type: Type<string>, parameters: P): T
      /**
       * Compute output result.
       *
       * @param input Literal input type
       * @param parameters Supplied parameters
       * @param value Basic value of type
       * @returns Output result
       */
      literal?<V extends Data.BasicValue>(type: Type<V>, parameters: P, value: V): T
      /**
       * Compute output result.
       *
       * @param input List input type
       * @param parameters Supplied parameters
       * @param elementary Type of list elements
       * @returns Output result
       */
      list?<V extends Data.Value>(type: Type<Data.List<V>>, parameters: P, elementary: Type<V>): T
      /**
       * Compute output result.
       *
       * @param input Dictionary input type
       * @param p Supplied parameters
       * @param elementary Type of dictionary elements
       * @returns Output result
       */
      dictionary?<V extends Data.Value>(type: Type<Data.Dictionary<V>>, p: P, elementary: Type<V>): T
      /**
       * Compute output result.
       *
       * @param input Record input type
       * @param parameters Supplied parameters
       * @param fields Types of record fields
       * @returns Output result
       */
      record?<F extends Data.FieldValues>(type: Type<Data.Record<F>>, parameters: P, fields: FieldTypesOf<F>): T
      /**
       * Compute output result.
       *
       * @param input Tuple input type
       * @param parameters Supplied parameters
       * @param parts Types of the tuple parts (at least two)
       * @returns Output result
       */
      tuple?<V extends Data.ValueSequence>(type: Type<Data.Tuple<V>>, parameters: P, parts: TypesOf<V>): T
      /**
       * Compute output result.
       *
       * @param input Union input type
       * @param parameters Supplied parameters
       * @param alternatives Types union alternatives (at least two)
       * @returns Output result
       */
      union?<V extends Data.ValueSequence>(type: Type<V[number]>, parameters: P, alternatives: TypesOf<V>): T
      /**
       * Compute output result.
       *
       * @param input Wildcard input type
       * @param parameters Supplied parameters
       * @returns Output result
       */
      wildcard?(type: Type<Data.Wildcard>, parameters: P): T
      /**
       * Compute output result.
       *
       * @param input Optional input type
       * @param parameters Supplied parameters
       * @param mandatory Mandatory type
       * @returns Output result
       */
      optional?<V extends Data.Wildcard>(type: Type<V | undefined>, parameters: P, mandatory: Type<V>): T
      /**
       * Compute default output.
       *
       * The default is computed when this pattern does not have a more specific match for the input type.
       *
       * @param input Input type
       * @param parameters Supplied parameters
       * @returns Output result
       */
      orelse(type: Type<Data.Value>, parameters: P): T
    }
    /**
     * A space facilitates import and export of data values.
     */
    interface Space {
      /**
       * The type definitions of this space.
       */
      readonly definitions: Definition.TypeDefinitions
      /**
       * The hashcode (SHA-1) that uniquely describes the (source text of) type definitions in this space.
       *
       * SHA-1 produces a 160-bit (or 20-byte) hashcode.
       */
      readonly hashcode: ArrayBuffer
      /**
       * Evaluate a type expression to a type.
       *
       * Type evaluation is referentially transparent i.e., the same expression always evaluates to the same type.
       *
       * @param expressionSource Type expression or source text of a type expression
       * @returns The evaluated type
       * @throws An error if the expression cannot be evaluated
       */
      evaluate<T extends Data.Value = Data.Value>(expressionSource: Definition.TypeExpression | string): Type<T>
      /**
       * Unevaluate a type back to possible type expressions in this space.
       *
       * @param type The type to unevaluate
       * @returns An iterator object over type expressions, sorted in ascending text length
       */
      unevaluate<T extends Data.Value = Data.Value>(type: Type<T>): IteratorObject<Definition.TypeExpression>
    }
  }
}
