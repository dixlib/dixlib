// --- TypeScript ---
import type Data from 'std.data'
// --- JavaScript ---
// import { fn, syntax } from "../extern.js"

import { parseTypeExpression } from "./language.js"
import { boolean, int32, list, literal, number, string } from "./type.js"

export function inflate(): Data.Space {
  return new Space()
}

// ----------------------------------------------------------------------------------------------------------------- //
class Space implements Data.Space {
  readonly #definitions: Data.TypeDefinitions
  readonly #evaluator: Data.TypeExpressionPattern<Data.Type<Data.Value>, []>
  constructor() {
    this.#definitions = {}
    const evaluator: Data.TypeExpressionPattern<Data.Type<Data.Value>, []> = this.#evaluator = {
      basic(_expression, _p, reserved) {
        switch (reserved) {
          case "boolean": return boolean()
          case "int32": return int32()
          case "number": return number()
          default: return string()
        }
      },
      literal(_expression, _p, value) { return literal(value) },
      list(_expression, _p, elementary) {
        return list(elementary.match(evaluator))
      },
      orelse() { throw new Error("internal error in type evaluation") }
    }
  }
  public get definitions() { return this.#definitions }
  public evaluate<T extends Data.Value>(expression: Data.TypeExpression | string): Data.Type<T> {
    return express(expression).match(this.#evaluator) as Data.Type<T>
  }
  public export<T extends Data.Value>(_value: T, _expression?: Data.TypeExpression | string): Data.Structure {
    return null as any
  }
  public import<T extends Data.Value>(_structure: Data.Structure, _expression?: Data.TypeExpression | string): T {
    return null as any
  }
}
function express(expression: Data.TypeExpression | string): Data.TypeExpression {
  return typeof expression === "string" ? parseTypeExpression(expression) : expression
}