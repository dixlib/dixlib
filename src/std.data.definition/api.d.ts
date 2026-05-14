declare module "std.data.definition" {
  import type Data from "std.data"
  export default Definition
  /**
   * The data definition service provides operations to express data types.
   */
  interface Definition {
    /**
     * Test whether it is a data type expression.
     *
     * @param it Thing to test
     * @returns True if it is a type expression, otherwise false
     */
    isTypeExpression(it: unknown): it is Definition.TypeExpression
    /**
     * Parse source text of a type expression.
     *
     * Grammar of type expressions in EBNF:
     * * TypeExpression ::= TypeExpr1 | (Variable "=" TypeExpr1)+ TypeExpr1
     * * TypeExpr1 ::= TypeExpr2 "?"?
     * * TypeExpr2 ::= TypeExpr3 ("|" TypeExpr3)*
     * * TypeExpr3 ::= "*"
     * * | "boolean" | "int32" | "number" | "string"
     * * | "false" | "true" | decimal | quote
     * * | typename ("(" TypeExpr1 ("," TypeExpr1)* ")")?
     * * | "[" TypeExpr1 "]"
     * * | "<" TypeExpr1 ">"
     * * | "(" TypeExpr1 ("," TypeExpr1)+ ")"
     * * | "{" (selector ":" TypeExpr1 ("," selector ":" TypeExpr1)* ","?)? "}"
     * * | Variable
     * * Variable ::= "a" | "b" | "c" | ... | "y" | "z"
     *
     * Lexical tokens:
     * * decimal = natural number in decimal notation e.g., 321.
     * * quote  = qouted sentence e.g., "the quick brown fox"
     * * typename = name of type starts with a capital and contains at least one dot separator e.g., Data.List
     * * selector = identifier (or keyword) that starts with a letter followed by digits and letters e.g., firstName
     *
     * @param text Source text of type expression
     * @param location Optional location of source text
     * @returns A type expression
     * @throws When source text is invalid
     */
    parseTypeExpression(text: string, location?: string): Definition.TypeExpression
    /**
     * Substitute free variables of a type expression with type expression parameters.
     *
     * @param expression Type expression with free variables
     * @param parameters Type expression parameters (without free variables)
     * @returns A type expression
     */
    substituteTypeExpressions(
      expression: Definition.TypeExpression,
      parameters: ReadonlyArray<Definition.TypeExpression>
    ): Definition.TypeExpression
  }
  namespace Definition {
    /**
     * Type definitions provide names for type expressions.
     */
    type TypeDefinitions = { readonly [name: string]: TypeExpression }
    /**
     * A type expression evaluates to a type in a metadata space.
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
     * The type expressions of all fields in a record expression.
     */
    type FieldExpressions = { readonly [selector: string]: TypeExpression }
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
       * @param reserved Reserved name of basic type e.g., "boolean"
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
       * @param fields Type expressions of record fields
       * @returns Output result
       */
      record?(expression: TypeExpression, parameters: P, fields: FieldExpressions): T
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
  }
}
