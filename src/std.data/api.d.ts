declare module "dixlib" {
  interface ServiceAspects {
    /**
     * If true, a datatype module specifies the type definitions of a service.
     */
    readonly typedefs?: boolean
  }
}
declare module "std.data" {
  import type Dixlib from "dixlib"
  export default Data
  /**
   * The data service provides operations to work with immutable data values.
   */
  interface Data {
    /**
     * Test whether it is a data value.
     *
     * @param it Thing to test
     * @returns True if it is a value, otherwise false
     */
    isValue(it: unknown): it is Data.Value
    /**
     * Test whether it is a data composition i.e., a list, dictionary, record or tuple.
     *
     * @param it Thing to test
     * @returns True if it is a composition, otherwise false
     */
    isComposition(it: unknown): it is Data.Composition
    /**
     * Test whether it is a data list.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a list, otherwise false
     */
    isList<T extends Data.Value = Data.Value>(it: unknown): it is Data.List<T>
    /**
     * Test whether it is a data dictionary.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a dictionary, otherwise false
     */
    isDictionary<T extends Data.Value = Data.Value>(it: unknown): it is Data.Dictionary<T>
    /**
     * Test whether it is a data record.
     *
     * The validity of type hint F, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a record, otherwise false
     */
    isRecord<F extends Data.FieldValues = Data.FieldValues>(it: unknown): it is Data.Record<F>
    /**
     * Test whether it is a data tuple.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a tuple, otherwise false
     */
    isTuple<T extends Data.ValueSequence = Data.ValueSequence>(it: unknown): it is Data.Tuple<T>
    /**
     * Test whether it is a data type.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a type, otherwise false
     */
    isType<T extends Data.Value = Data.Value>(it: unknown): it is Data.Type<T>
    /**
     * Test whether it is a data type expression.
     *
     * @param it Thing to test
     * @returns True if it is a type expression, otherwise false
     */
    isTypeExpression(it: unknown): it is Data.TypeExpression
    /**
     * Test structural equivalence.
     *
     * @param left Left value
     * @param right Right value
     * @returns True if left and right are equal values, otherwise false
     */
    equalValue<T extends Data.Value>(left: T, right: T): boolean
    /**
     * Test type equivalence.
     *
     * @param left Left type
     * @param right Right type
     * @returns True if left and right are equal types, otherwise false
     */
    equalType<T extends Data.Value = Data.Value>(left: Data.Type<T>, right: Data.Type<T>): boolean
    /**
     * Create list value.
     *
     * @param type List type
     * @param members List members
     * @returns A list value
     * @throws If one of the list members does not obey the elementary type
     */
    list<T extends Data.Value>(type: Data.Type<Data.List<T>>, members: T[]): Data.List<T>
    /**
     * Create dictionary value.
     *
     * @param type Dictionary type
     * @param members Dictionary members
     * @returns A dictionary value
     * @throws If one of the dictionary members does not obey the elementary type
     */
    dictionary<T extends Data.Value>(type: Data.Type<Data.Dictionary<T>>, members: Data.Table<T>): Data.Dictionary<T>
    /**
     * Create record value.
     *
     * @param type Record type
     * @param members Record field members
     * @returns A record value
     * @throws If one of the record field members does not obey the field type
     */
    record<F extends Data.FieldValues>(type: Data.Type<Data.Record<F>>, members: F): Data.Record<F>
    /**
     * Create tuple value.
     *
     * @param type Tuple type
     * @param members Tuple members
     * @returns A tuple value
     * @throws If one of the tuple members does not obey the type at that position
     */
    tuple<T extends Data.ValueSequence>(type: Data.Type<Data.Tuple<T>>, members: T): Data.Tuple<T>
    /**
     * Derive dynamic type of a value.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param value Data value
     * @returns A data type
     */
    typeOf<T extends Data.Value = Data.Value>(value: T): Data.Type<T>
    /**
     * Inflate a new data space.
     *
     * @param serviceName Name of service that provides the type definitions for the new space
     * @returns Promise of new data space
     */
    inflate(serviceName: Dixlib.ServiceName): Promise<Data.Space>
    /**
     * Parse source text of a type expression.
     *
     * Grammar of type expressions in EBNF:
     * * TypeExpression ::= TypeExpr1 | (Variable "=" TypeExpr1)+ TypeExpr1
     * * TypeExpr1 ::= TypeExpr2 "?"?
     * * TypeExpr2 ::= TypeExpr3 ("|" TypeExpr3)*
     * * TypeExpr3 ::= "*" | SimpleExpr | ListExpr | DictionaryExpr | TupleExpr | RecordExpr | ReferenceExpr
     * * SimpleExpr ::= "boolean" | "int32" | "number" | "string" | "false" | "true" | decimal | quote
     * * ListExpr ::= "[" TypeExpr1 "]"
     * * DictionaryExpr ::= "<" TypeExpr1 ">"
     * * TupleExpr ::= "(" TypeExpr1 ("," TypeExpr1)+ ")"
     * * RecordExpr ::= "{" (Field ("," Field)* ","?)? "}"
     * * ReferenceExpr ::= typename ("(" TypeExpr1 ("," TypeExpr1)* ")")? | Variable
     * * Field ::= selector ":" TypeExpr1 | "/"  ReferenceExpr
     * * Variable ::= "a" | "b" | "c" | ... | "y" | "z"
     *
     * Lexical tokens:
     * * decimal = natural number in decimal notation e.g., 321.
     * * quote  = qouted text e.g., "the quick brown fox"
     * * typename = name of type starts with a capital and contains at least one dot separator e.g., Data.List
     * * selector = selector starts with a letter followed by digits and letters e.g., firstName
     *
     * @param text Source text of type expression
     * @param location Optional location of source text
     * @returns A type expression
     * @throws When source text is invalid
     */
    parseTypeExpression(text: string, location?: string): Data.TypeExpression
    /**
     * Substitute free variables of a type expression with type expression parameters.
     *
     * @param expression Type expression with free variables
     * @param parameters Type expression parameters (without free variables)
     * @returns A type expression
     */
    substituteTypeExpressions(
      expression: Data.TypeExpression,
      parameters: ReadonlyArray<Data.TypeExpression>
    ): Data.TypeExpression
    /**
     * Create a default marshalling format.
     *
     * The default payload representation is JSON.
     *
     * @param dataspace Data space with type definitions
     * @returns A new portability format
     */
    createDefaultFormat(dataspace: Data.Space): Data.Format<Data.JSON>
  }
  namespace Data {
    /**
     * An immutable value may be undefined.
     */
    type Value = undefined | Wildcard
    /**
     * A wildcard value is defined.
     */
    type Wildcard = BasicValue | Composition
    /**
     * A basic value is a primitive boolean, number or string.
     */
    type BasicValue = boolean | number | string
    /**
     * A composition is a list, dictionary, record or tuple value.
     */
    type Composition = List<Value> | Dictionary<Value> | Record<FieldValues> | Tuple<ValueSequence>
    /**
     * Index of a member value in a composite value.
     */
    type Index = string | number
    /**
     * A composite value contains zero or more member values.
     */
    interface CompositeValue<Ix extends Index, T extends Value, C extends Composition, Shadow> {
      /**
       * The composite type of this value e.g., a list or dictionary type.
       */
      readonly type: Type<C>
      /**
       * The shadow exposes convenient access to the members of this composite value.
       *
       * For example, a list exposes a shadow array with member values.
       */
      readonly shadow: Shadow
      /**
       * Number of members in this composite value.
       */
      readonly size: number
      /**
       * Iterate over indices of this value.
       */
      readonly indices: IteratorObject<Ix>
      /**
       * Iterate over association pairs of this value.
       */
      readonly associations: IteratorObject<[Ix, T]>
      /**
       * Iterate over members of this value.
       */
      readonly members: IteratorObject<T>
      /**
       * Get member of this composite value.
       *
       * @param ix Index of member
       * @returns The member value at index or undefined
       */
      at(ix: Ix): T | undefined
      /**
       * Test whether this composite value has a member under given index.
       *
       * @param ix Index to test
       * @returns True if index references a member, otherwise false
       */
      has(ix: Ix): boolean
    }
    /**
     * A list is a composite value with numeric indices.
     */
    interface List<T extends Value> extends CompositeValue<number, T, List<T>, readonly T[]> {}
    /**
     * Shadow table object of a dictionary value.
     */
    type Table<T extends Value> = { readonly [ix: string]: T }
    /**
     * A dictionary is a composite value with string indices.
     */
    interface Dictionary<T extends Value> extends CompositeValue<string, T, Dictionary<T>, Table<T>> {}
    /**
     * Shadow fields of a record value.
     */
    type FieldValues = Table<Value>
    /**
     * A record is a composite value with field name indices.
     */
    interface Record<F extends FieldValues> extends CompositeValue<string, F[keyof F], Record<F>, F> {
      // refine type signature
      at<Ix extends keyof F>(ix: Ix): F[Ix]
    }
    /**
     * At least two values in a sequence.
     */
    type ValueSequence = [Value, Value, ...Value[]]
    /**
     * A tuple is a composite value with numeric indices and individually typed members.
     */
    interface Tuple<T extends ValueSequence> extends CompositeValue<number, T[number], Tuple<T>, T> {
      // refine type signature
      at<Ix extends number>(ix: Ix): T[Ix]
    }
    /**
     * A type classifies a set of data values.
     */
    interface Type<T extends Value> {
      /**
       * Test whether this type includes a value.
       *
       * @param v Value to test
       * @returns True if value is included, otherwise false
       */
      includes(v: Value): v is T
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
    type FieldTypesOf<F extends FieldValues> = { readonly [K in keyof F]: Type<F[K]> }
    /**
     * Derive types of values in an array.
     */
    type TypesOf<T extends Value[]> = { readonly [Ix in keyof T]: Type<T[Ix]> }
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
      literal?<V extends BasicValue>(type: Type<V>, parameters: P, value: V): T
      /**
       * Compute output result.
       *
       * @param input List input type
       * @param parameters Supplied parameters
       * @param elementary Type of list elements
       * @returns Output result
       */
      list?<V extends Value>(type: Type<List<V>>, parameters: P, elementary: Type<V>): T
      /**
       * Compute output result.
       *
       * @param input Dictionary input type
       * @param p Supplied parameters
       * @param elementary Type of dictionary elements
       * @returns Output result
       */
      dictionary?<V extends Value>(type: Type<Dictionary<V>>, p: P, elementary: Type<V>): T
      /**
       * Compute output result.
       *
       * @param input Record input type
       * @param parameters Supplied parameters
       * @param fields Types of record fields
       * @returns Output result
       */
      record?<F extends FieldValues>(type: Type<Record<F>>, parameters: P, fields: FieldTypesOf<F>): T
      /**
       * Compute output result.
       *
       * @param input Tuple input type
       * @param parameters Supplied parameters
       * @param parts Types of the tuple parts (at least two)
       * @returns Output result
       */
      tuple?<V extends ValueSequence>(type: Type<Tuple<V>>, parameters: P, parts: TypesOf<V>): T
      /**
       * Compute output result.
       *
       * @param input Union input type
       * @param parameters Supplied parameters
       * @param alternatives Types union alternatives (at least two)
       * @returns Output result
       */
      union?<V extends ValueSequence>(type: Type<V[number]>, parameters: P, alternatives: TypesOf<V>): T
      /**
       * Compute output result.
       *
       * @param input Wildcard input type
       * @param parameters Supplied parameters
       * @returns Output result
       */
      wildcard?(type: Type<Wildcard>, parameters: P): T
      /**
       * Compute output result.
       *
       * @param input Optional input type
       * @param parameters Supplied parameters
       * @param mandatory Mandatory type
       * @returns Output result
       */
      optional?<V extends Wildcard>(type: Type<V | undefined>, parameters: P, mandatory: Type<V>): T
      /**
       * Compute default output.
       *
       * The default is computed when this pattern does not have a more specific match for the input type.
       *
       * @param input Input type
       * @param parameters Supplied parameters
       * @returns Output result
       */
      orelse(type: Type<Value>, parameters: P): T
    }
    /**
     * A space supports the evaluation of type expressions to types.
     */
    interface Space {
      /**
       * The type definitions of this space.
       */
      readonly definitions: TypeDefinitions
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
      evaluate<T extends Value = Value>(expressionSource: TypeExpression | string): Type<T>
      /**
       * Unevaluate a type back to possible type expressions in this space.
       *
       * @param type The type to unevaluate
       * @returns An iterator object over type expressions, sorted in ascending text length
       */
      unevaluate<T extends Value = Value>(type: Type<T>): IteratorObject<TypeExpression>
    }
    /**
     * Type definitions provide names for type expressions.
     */
    type TypeDefinitions = { readonly [name: string]: TypeExpression }
    /**
     * A type expression evaluates to a type in a data space.
     */
    interface TypeExpression {
      /**
       * Canonical source text of this type expression.
       */
      readonly text: string
      /**
       * Number of type arguments that the type expression expects.
       */
      readonly arity: number
      /**
       * Iterate over positions of free variables in this type expression.
       */
      readonly freeVariables: IteratorObject<number>
      /**
       * A type expression can have one or more free variables.
       */
      readonly hasFreeVariables: boolean
      /**
       * Match a pattern on this type expression.
       *
       * @param pattern Type expression pattern
       * @param parameters Additional input parameters
       * @returns An output result
       */
      match<T, P extends unknown[]>(pattern: TypeExpressionPattern<T, P>, ...parameters: P): T
    }
    /**
     * A fields chunk is either the spread of a record reference or a streak of associations.
     */
    type FieldsChunk = TypeExpression | { readonly [selector: string]: TypeExpression }
    /**
     * Reserved names of basic types.
     */
    type BasicNames = "boolean" | "int32" | "number" | "string"
    /**
     * A type expression pattern computes an output result from the input expression and input parameters.
     *
     * Type expression patterns implement a variation of the visitor pattern.
     */
    interface TypeExpressionPattern<T, P extends unknown[]> {
      /**
       * Compute output result.
       *
       * @param expression Basic input expression
       * @param parameters Supplied function parameters
       * @param reserved Reserved name of basic type i.e., "boolean", "int32", "number" and "string"
       * @returns Output result
       */
      basic?(expression: TypeExpression, parameters: P, reserved: BasicNames): T
      /**
       * Compute output result.
       *
       * @param expression Literal input expression
       * @param parameters Supplied function parameters
       * @param literal Literal basic value
       * @returns Output result
       */
      literal?(expression: TypeExpression, parameters: P, value: Data.BasicValue): T
      /**
       * Compute output result.
       *
       * @param expression List input expression
       * @param parameters Supplied function parameters
       * @param elementary Type expression of list elements
       * @returns Output result
       */
      list?(expression: TypeExpression, parameters: P, elementary: TypeExpression): T
      /**
       * Compute output result.
       *
       * @param expression Dictionary input expression
       * @param parameters Supplied function parameters
       * @param elementary Type expression of dictionary elements
       * @returns Output result
       */
      dictionary?(expression: TypeExpression, parameters: P, elementary: TypeExpression): T
      /**
       * Compute output result.
       *
       * @param expression Record input expression
       * @param parameters Supplied function parameters
       * @param chunks Zero or more chunks with field spreads or streaks
       * @returns Output result
       */
      record?(expression: TypeExpression, parameters: P, chunks: ReadonlyArray<FieldsChunk>): T
      /**
       * Compute output result.
       *
       * @param expression Tuple input expression
       * @param parameters Supplied function parameters
       * @param parts Type expressions of tuple parts (at least two)
       * @returns Output result
       */
      tuple?(expression: TypeExpression, parameters: P, parts: ReadonlyArray<TypeExpression>): T
      /**
       * Compute output result.
       *
       * @param expression Union input expression
       * @param parameters Supplied function parameters
       * @param parts Type expressions of alternatives (at least two)
       * @returns Output result
       */
      union?(expression: TypeExpression, parameters: P, alternatives: ReadonlyArray<TypeExpression>): T
      /**
       * Compute output result.
       *
       * @param expression Wildcard input expression
       * @param parameters Supplied function parameters
       * @returns Output result
       */
      wildcard?(expression: TypeExpression, parameters: P): T
      /**
       * Compute output result.
       *
       * @param expression Optional input expression
       * @param parameters Supplied function parameters
       * @param mandatory Mandatory expression
       * @returns Output result
       */
      optional?(expression: TypeExpression, parameters: P, mandatory: TypeExpression): T
      /**
       * Compute output result.
       *
       * @param expression Reference input expression
       * @param parameters Supplied function parameters
       * @param name Type name
       * @returns Output result
       */
      reference?(expression: TypeExpression, parameters: P, name: string): T
      /**
       * Compute output result.
       *
       * @param expression Macro input expression
       * @param parameters Supplied function parameters
       * @param formals Type expression of formal arguments (at least one)
       * @param body Macro body expression
       * @returns Output result
       */
      macro?(expression: TypeExpression, parameters: P, formals: ReadonlyArray<TypeExpression>, body: TypeExpression): T
      /**
       * Compute output result.
       *
       * @param expression Application input expression
       * @param parameters Supplied function parameters
       * @param actual Type expression of actual arguments (at least one)
       * @param body Macro body expression
       * @returns Output result
       */
      application?(expression: TypeExpression, parameters: P, name: string, actuals: ReadonlyArray<TypeExpression>): T
      /**
       * Compute output result.
       *
       * @param expression Application input expression
       * @param parameters Supplied function parameters
       * @param position Variable position (between 1 and 26)
       * @returns Output result
       */
      variable?(expression: TypeExpression, parameters: P, position: number): T
      /**
       * Compute default output.
       *
       * The default is computed when this function does not have a more specific match for the input expression.
       *
       * @param expression Input expression
       * @param parameters Supplied function parameters
       * @returns Output result
       */
      orelse(expression: TypeExpression, parameters: P): T
    }
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
       * The data space with type definitions.
       */
      readonly dataspace: Space
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
      marshall(value: Value, expressionSource?: TypeExpression | string): Payload
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
      unmarshall(payload: Payload, expressionSource?: TypeExpression | string): Value
    }
  }
}
