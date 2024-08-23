declare module 'std.data' {
  export default Data
  /**
   * The data service provides operations to work with immutable data values.
   */
  interface Data {
    /**
     * Test whether it is a data value.
     * @param it Thing to test
     * @returns True if it is a value, otherwise false
     */
    isValue(it: unknown): it is Data.Value
    /**
     * Test whether it is a data type.
     * The validity of a (static) type hint T, if supplied, is the caller's responsibility.
     * @param it Thing to test
     * @returns True if it is a type, otherwise false
     */
    isType<T extends Data.Value = Data.Value>(it: unknown): it is Data.Type<T>
    /**
     * Test whether it is a data type expression.
     * @param it Thing to test
     * @returns True if it is a type expression, otherwise false
     */
    isTypeExpression(it: unknown): it is Data.TypeExpression
    /**
     * Test whether it is a data composition i.e., a list, dictionary, record or tuple.
     * @param it Thing to test
     * @returns True if it is a composition, otherwise false
     */
    isComposition(it: unknown): it is Data.Composition
    /**
     * Test whether it is a data list.
     * The validity of a (static) type hint T, if supplied, is the caller's responsibility.
     * @param it Thing to test
     * @returns True if it is a list, otherwise false
     */
    isList<T extends Data.Value = Data.Value>(it: unknown): it is Data.List<T>
    /**
     * Test whether it is a data dictionary.
     * The validity of a (static) type hint T, if supplied, is the caller's responsibility.
     * @param it Thing to test
     * @returns True if it is a dictionary, otherwise false
     */
    isDictionary<T extends Data.Value = Data.Value>(it: unknown): it is Data.Dictionary<T>
    /**
     * Test whether it is a data record.
     * The validity of a (static) type hint F, if supplied, is the caller's responsibility.
     * @param it Thing to test
     * @returns True if it is a record, otherwise false
     */
    isRecord<F extends Data.FieldValues = Data.FieldValues>(it: unknown): it is Data.Record<F>
    /**
     * Test whether it is a data tuple.
     * The validity of a (static) type hint T, if supplied, is the caller's responsibility.
     * @param it Thing to test
     * @returns True if it is a tuple, otherwise false
     */
    isTuple<T extends Data.ValueSequence = Data.ValueSequence>(it: unknown): it is Data.Tuple<T>
    /**
     * Derive dynamic type of a value.
     * The validity of a (static) type hint T, if supplied, is the caller's responsibility.
     * @param value Data value
     * @returns A data type
     */
    typeOf<T extends Data.Value = Data.Value>(value: T): Data.Type<T>
    /**
     * Test structural equivalence.
     * @param left Left value
     * @param right Right value
     * @returns True if left and right are equal values, otherwise false
     */
    equals<T extends Data.Value>(left: T, right: T): boolean
    /**
     * Parse source text of a type expression.
     * Grammar of type expressions in EBNF:
     * * TypeExpression ::= TypeExpr1 | Variable "=" TypeExpr1 (Variable "=" TypeExpr1)* TypeExpr1
     * * TypeExpr1 ::= TypeExpr2 "?"?
     * * TypeExpr2 ::= TypeExpr3 ("|" TypeExpr3)*
     * * TypeExpr3 ::= "*"
     * * | "boolean" | "int32" | "number" | "string"
     * * | "false" | "true" | decimal | quote
     * * | typename ("(" TypeExpr1 ("," TypeExpr1)* ")")?
     * * | "[" TypeExpr1 "]"
     * * | "<" TypeExpr1 ">"
     * * | "(" TypeExpr1 ("," TypeExpr1)+ ")"
     * * | "{" (selector ":" TypeExpr1 ("," selector ":" TypeExpr1)* ","? "}"
     * * | Variable
     * * Variable ::= "a" | "b" | "c" | ... | "y" | "z"
     * 
     * Lexical tokens:
     * * decimal = natural number in decimal notation e.g., 321.
     * * quote  = qouted sentence e.g., "the quick brown fox"
     * * typename = name of type starts with a capital and contains at least one dot separator e.g., Std.List
     * * selector = identifier or keyword that starts with a letter followed by digits and letters e.g., firstName
     * @param text Source text of type expression
     * @param location Optional location of source text
     * @returns A type expression
     * @throws When source text is invalid
     */
    parseTypeExpression(text: string, location?: string): Data.TypeExpression
    /**
     * Inflate a new data space.
     * @param options Creation options for new space
     * @returns A new data space
     */
    inflate(options: Data.SpaceOptions): Data.Space
  }
  namespace Data {
    /**
     * An immutable value may be undefined.
     */
    type Value = undefined | Wildcard
    /**
     * A wildcard value is defined.
     */
    type Wildcard = Literal | Composition
    /**
     * A literal value is a primitive boolean, number or string.
     */
    type Literal = boolean | number | string
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
    interface CompositeValue<Ix extends Index, T extends Value, C extends Composition, S> {
      /**
       * The composite type of this value e.g., a list or dictionary type.
       */
      readonly type: Type<C>
      /**
       * The shadow structure exposes convenient access to the members of this composite value.
       * For example, a list exposes a shadow array with member values.
       */
      readonly shadow: S
      /**
       * Number of members in this composite value.
       */
      readonly size: number
      /**
       * Iterate over indices of this value.
       */
      readonly indices: IterableIterator<Ix>
      /**
       * Iterate over entry pairs of this value.
       */
      readonly entries: IterableIterator<[Ix, T]>
      /**
       * Iterate over members of this value.
       */
      readonly members: IterableIterator<T>
      /**
       * Get member of this composite value.
       * @param ix Index of member
       * @returns The member value at index or undefined
       */
      at(ix: Ix): T | undefined
      /**
       * Test whether this composite value has a member under given index.
       * @param ix Index to test
       * @returns True if index references a member, otherwise false
       */
      has(ix: Ix): boolean
    }
    /**
     * A list is a composite value with numeric indices.
     */
    interface List<T extends Value> extends CompositeValue<number, T, List<T>, readonly T[]> { }
    /**
     * Shadow table object of a dictionary value.
     */
    type Table<T extends Value> = { readonly [ix: string]: T }
    /**
     * A dictionary is a composite value with string indices.
     */
    interface Dictionary<T extends Value> extends CompositeValue<string, T, Dictionary<T>, Table<T>> { }
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
    interface Type<T extends Data.Value> {
      /**
       * Test whether this type includes a value.
       * @param v Value to test
       * @returns True if value is included, otherwise false
       */
      includes(v: Data.Value): v is T
      /**
       * Match a pattern on this type.
       * @param pattern Pattern to match
       * @param p Additional parameters
       * @returns An output result
       */
      match<O, P extends unknown[]>(pattern: TypePattern<O, P>, ...p: P): O
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
     * Type patterns implement a variation of the visitor pattern.
     */
    interface TypePattern<O, P extends unknown[]> {
      /**
       * Compute output result.
       * @param input Boolean input type
       * @param p Supplied parameters
       * @returns Output result
       */
      boolean?(type: Type<boolean>, p: P): O
      /**
       * Compute output result.
       * @param input Int32 input type
       * @param p Supplied parameters
       * @returns Output result
       */
      int32?(type: Type<number>, p: P): O
      /**
       * Compute output result.
       * @param input Number input type
       * @param p Supplied parameters
       * @returns Output result
       */
      number?(type: Type<number>, p: P): O
      /**
       * Compute output result.
       * @param input String input type
       * @param p Supplied parameters
       * @returns Output result
       */
      string?(type: Type<string>, p: P): O
      /**
       * Compute output result.
       * @param input Literal input type
       * @param p Supplied parameters
       * @param value Literal value of type
       * @returns Output result
       */
      literal?<T extends Literal>(type: Type<T>, p: P, value: T): O
      /**
       * Compute output result.
       * @param input List input type
       * @param p Supplied parameters
       * @param elementary Type of list elements
       * @returns Output result
       */
      list?<T extends Value>(type: Type<List<T>>, p: P, elementary: Type<T>): O
      /**
       * Compute output result.
       * @param input Dictionary input type
       * @param p Supplied parameters
       * @param elementary Type of dictionary elements
       * @returns Output result
       */
      dictionary?<T extends Value>(type: Type<Dictionary<T>>, p: P, elementary: Type<T>): O
      /**
       * Compute output result.
       * @param input Record input type
       * @param p Supplied parameters
       * @param fields Types of record fields
       * @returns Output result
       */
      record?<F extends FieldValues>(type: Type<Record<F>>, p: P, fields: FieldTypesOf<F>): O
      /**
       * Compute output result.
       * @param input Tuple input type
       * @param p Supplied parameters
       * @param parts Types of the tuple parts (at least two)
       * @returns Output result
       */
      tuple?<T extends ValueSequence>(type: Type<Tuple<T>>, p: P, parts: TypesOf<T>): O
      /**
       * Compute output result.
       * @param input Union input type
       * @param p Supplied parameters
       * @param alternatives Types union alternatives (at least two)
       * @returns Output result
       */
      union?<T extends ValueSequence>(type: Type<T[number]>, p: P, alternatives: TypesOf<T>): O
      /**
       * Compute output result.
       * @param input Wildcard input type
       * @param p Supplied parameters
       * @returns Output result
       */
      wildcard?(type: Type<Wildcard>, p: P): O
      /**
       * Compute output result.
       * @param input Optional input type
       * @param p Supplied parameters
       * @param mandatory Mandatory type
       * @returns Output result
       */
      optional?<T extends Wildcard>(type: Type<T | undefined>, p: P, mandatory: Type<T>): O
      /**
       * Compute default output.
       * The default is computed when this pattern does not have a more specific match for the input type.
       * @param input Input type
       * @param p Supplied parameters
       * @returns Output result
       */
      orelse(type: Type<Value>, p: P): O
    }
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
      readonly freeVariables: IterableIterator<number>
      /**
       * A type expression can have one or more free variables.
       */
      readonly hasFreeVariables: boolean
      /**
       * Match a pattern on this type expression.
       * @param pattern Type expression pattern
       * @param p Additional input parameters
       * @returns An output result
       */
      match<O, P extends unknown[]>(pattern: TypeExpressionPattern<O, P>, ...p: P): O
    }
    /**
     * The type expressions of all fields in a record expression.
     */
    type FieldExpressions = { readonly [selector: string]: TypeExpression }
    /**
     * A type expression pattern computes an output result from the input expression and input parameters.
     * Type expression patterns implement a variation of the visitor pattern.
     */
    interface TypeExpressionPattern<O, P extends unknown[]> {
      /**
       * Compute output result.
       * @param expression Basic input expression
       * @param p Supplied function parameters
       * @param reserved Reserved name of basic type e.g., "boolean"
       * @returns Output result
       */
      basic?(expression: TypeExpression, p: P, reserved: string): O
      /**
       * Compute output result.
       * @param expression Literal input expression
       * @param p Supplied function parameters
       * @param literal Literal value
       * @returns Output result
       */
      literal?(expression: TypeExpression, p: P, value: Literal): O
      /**
       * Compute output result.
       * @param expression List input expression
       * @param p Supplied function parameters
       * @param elementary Type expression of list elements
       * @returns Output result
       */
      list?(expression: TypeExpression, p: P, elementary: TypeExpression): O
      /**
       * Compute output result.
       * @param expression Dictionary input expression
       * @param p Supplied function parameters
       * @param elementary Type expression of dictionary elements
       * @returns Output result
       */
      dictionary?(expression: TypeExpression, p: P, elementary: TypeExpression): O
      /**
       * Compute output result.
       * @param expression Record input expression
       * @param p Supplied function parameters
       * @param fields Type expressions of record fields
       * @returns Output result
       */
      record?(expression: TypeExpression, p: P, fields: FieldExpressions): O
      /**
       * Compute output result.
       * @param expression Tuple input expression
       * @param p Supplied function parameters
       * @param parts Type expressions of tuple parts (at least two)
       * @returns Output result
       */
      tuple?(expression: TypeExpression, p: P, parts: ReadonlyArray<TypeExpression>): O
      /**
       * Compute output result.
       * @param expression Union input expression
       * @param p Supplied function parameters
       * @param parts Type expressions of alternatives (at least two)
       * @returns Output result
       */
      union?(expression: TypeExpression, p: P, alternatives: ReadonlyArray<TypeExpression>): O
      /**
       * Compute output result.
       * @param expression Wildcard input expression
       * @param p Supplied function parameters
       * @returns Output result
       */
      wildcard?(expression: TypeExpression, p: P): O
      /**
       * Compute output result.
       * @param expression Optional input expression
       * @param p Supplied function parameters
       * @param mandatory Mandatory expression
       * @returns Output result
       */
      optional?(expression: TypeExpression, p: P, mandatory: TypeExpression): O
      /**
       * Compute output result.
       * @param expression Reference input expression
       * @param p Supplied function parameters
       * @param name Type name
       * @returns Output result
       */
      reference?(expression: TypeExpression, p: P, name: string): O
      /**
       * Compute output result.
       * @param expression Macro input expression
       * @param p Supplied function parameters
       * @param formals Type expression of formal arguments (at least one)
       * @param body Macro body expression
       * @returns Output result
       */
      macro?(expression: TypeExpression, p: P, formals: ReadonlyArray<TypeExpression>, body: TypeExpression): O
      /**
       * Compute output result.
       * @param expression Application input expression
       * @param p Supplied function parameters
       * @param actual Type expression of actual arguments (at least one)
       * @param body Macro body expression
       * @returns Output result
       */
      application?(expression: TypeExpression, p: P, name: string, actuals: ReadonlyArray<TypeExpression>): O
      /**
       * Compute output result.
       * @param expression Application input expression
       * @param p Supplied function parameters
       * @param position Variable position (between 1 and 26)
       * @returns Output result
       */
      variable?(expression: TypeExpression, p: P, position: number): O
      /**
       * Compute default output.
       * The default is computed when this function does not have a more specific match for the input expression.
       * @param expression Input expression
       * @param p Supplied function parameters
       * @returns Output result
       */
      orelse(expression: TypeExpression, p: P): O
    }
    /**
     * Type definitions provide names for type expressions.
     */
    type TypeDefinitions = { readonly [name: string]: TypeExpression }
    interface SpaceOptions {
      readonly definitions: TypeDefinitions
    }
    interface Space {
      readonly definitions: TypeDefinitions
      evaluate<T extends Value = Value>(expression: TypeExpression | string): Type<T>
      export<T extends Value = Value>(value: T, expression?: TypeExpression | string): Structure
      import<T extends Value = Value>(structure: Structure, expression?: TypeExpression | string): T
    }
    type Structure = null | boolean | number | string | Structure[] | { [key: string]: Structure }
  }
}
