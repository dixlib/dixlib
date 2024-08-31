// --- TypeScript ---
import type Data from 'std.data'
// --- JavaScript ---
import { news } from "../extern.js"
import { parseTypeExpression, substituteTypeExpressions } from "./language.js"
import {
  boolean,
  createDummy,
  dictionary,
  int32,
  list,
  literal,
  number,
  optional,
  record,
  string,
  swapDummy,
  tuple,
  union,
  wildcard
} from "./type.js"

export function inflate(definitions: Data.TypeDefinitions): Data.Space {
  return new Space(definitions)
}

// ----------------------------------------------------------------------------------------------------------------- //
class Evaluation {
  readonly #definitions: Data.TypeDefinitions
  readonly #rootExpression: Data.TypeExpression
  readonly #cache: Map<Data.TypeExpression, Data.Type<Data.Value>>
  readonly #pending: Map<Data.TypeExpression, Data.Type<Data.Value>>
  #depth: number
  constructor(
    definitions: Data.TypeDefinitions,
    rootExpression: Data.TypeExpression,
    cache: Map<Data.TypeExpression, Data.Type<Data.Value>>
  ) {
    this.#rootExpression = rootExpression
    this.#definitions = definitions
    this.#cache = cache
    this.#pending = new Map()
    this.#depth = 0
  }
  public get type(): Data.Type<Data.Value> {
    const type = this.#rootExpression.match(evaluator, this)
    if (this.#pending.size > 0) {
      throw new Error(this.failure("with remaining pending expression(s)"))
    }
    return type
  }
  public failure(message: string) {
    return `internal error ${message} in evaluation of ${this.#rootExpression.text}`
  }
  public remember(expression: Data.TypeExpression, type: Data.Type<Data.Value>): Data.Type<Data.Value> {
    if (this.#cache.has(expression) && this.#cache.get(expression) !== type) {
      throw new Error(this.failure(`with cache conflict for expression ${expression.text}`))
    }
    this.#cache.set(expression, type)
    return type
  }
  public introduceDummy(expression: Data.TypeExpression) {
    this.#pending.set(expression, createDummy())
  }
  public rememberDummyAs(expression: Data.TypeExpression, type: Data.Type<Data.Value>): Data.Type<Data.Value> {
    const dummyType = this.#pending.get(expression)!
    if (!this.#pending.delete(expression)) {
      throw new Error(this.failure("while swapping dummy type"))
    }
    this.#cache.set(expression, dummyType)
    return swapDummy(dummyType, type)
  }
  public evaluateNested(expression: Data.TypeExpression): Data.Type<Data.Value> {
    const cachedType = this.#pending.get(expression) ?? this.#cache.get(expression)
    if (cachedType) {
      return cachedType
    }
    if (++this.#depth > 100) {
      throw new Error(this.failure("with maximum evaluation depth (100) exceeded"))
    }
    const type = expression.match(evaluator, this)
    this.#cache.set(expression, type)
    --this.#depth
    return type
  }
  public resolve(name: string): Data.TypeExpression | undefined {
    return this.#definitions[name]
  }
}
const evaluator: Data.TypeExpressionPattern<Data.Type<Data.Value>, [Evaluation]> = {
  basic(expression, [evaluation], reserved) {
    return evaluation.remember(expression, basicTypes[reserved])
  },
  literal(expression, [evaluation], value) {
    return evaluation.remember(expression, literal(value))
  },
  list(expression, [evaluation], elementary) {
    evaluation.introduceDummy(expression)
    const elementaryType = evaluation.evaluateNested(elementary)
    return evaluation.rememberDummyAs(expression, list(elementaryType))
  },
  dictionary(expression, [evaluation], elementary) {
    evaluation.introduceDummy(expression)
    const elementaryType = evaluation.evaluateNested(elementary)
    return evaluation.rememberDummyAs(expression, dictionary(elementaryType))
  },
  record(expression, [evaluation], fields) {
    evaluation.introduceDummy(expression)
    const fieldTypes: { [fieldName: string]: Data.Type<Data.Value> } = {}
    for (const fieldName in fields) {
      fieldTypes[fieldName] = evaluation.evaluateNested(fields[fieldName])
    }
    return evaluation.rememberDummyAs(expression, record(fieldTypes))
  },
  tuple(expression, [evaluation], parts) {
    evaluation.introduceDummy(expression)
    const tupleTypes: Data.Type<Data.Value>[] = []
    for (const part of parts) {
      tupleTypes.push(evaluation.evaluateNested(part))
    }
    return evaluation.rememberDummyAs(expression, tuple(tupleTypes as unknown as Data.TypesOf<Data.ValueSequence>))
  },
  union(expression, [evaluation], alternatives) {
    const alternativeTypes: Data.Type<Data.Value>[] = []
    for (const alternative of alternatives) {
      alternativeTypes.push(evaluation.evaluateNested(alternative))
    }
    return evaluation.remember(expression, union(alternativeTypes as unknown as Data.TypesOf<Data.ValueSequence>))
  },
  wildcard(expression, [evaluation]) {
    return evaluation.remember(expression, wildcard())
  },
  optional(expression, [evaluation], mandatory) {
    const mandatoryType = evaluation.evaluateNested(mandatory) as Data.Type<Data.Wildcard>
    return evaluation.remember(expression, optional(mandatoryType))
  },
  reference(expression, [evaluation], name) {
    const resolution = evaluation.resolve(name)
    if (!resolution) {
      throw new Error(evaluation.failure(`with undefined reference name "${name}"`))
    }
    if (resolution.arity === 0) {
      return evaluation.remember(expression, evaluation.evaluateNested(resolution))
    }
    const [formals, body] = resolution.match(extractMacro)
    const type = evaluation.evaluateNested(substituteTypeExpressions(body, formals))
    return evaluation.remember(expression, type)
  },
  macro(expression, [evaluation], formals, body) {
    const type = evaluation.evaluateNested(substituteTypeExpressions(body, formals))
    return evaluation.remember(expression, type)
  },
  application(expression, [evaluation], name, actuals) {
    const resolution = evaluation.resolve(name)
    if (!resolution) {
      throw new Error(evaluation.failure(`with undefined application name "${name}"`))
    } else if (resolution.arity === 0) {
      news.warn("unused type arguments in evaluation of %s", expression.text)
      return evaluation.remember(expression, evaluation.evaluateNested(resolution))
    } else if (actuals.length > resolution.arity) {
      news.warn("%d unused type arguments in evaluation of %s", actuals.length - resolution.arity, expression.text)
    }
    // extract formals and body from macro resolution
    const [formals, body] = resolution.match(extractMacro)
    // determine substitution parameters from formal and actual arguments
    const parameters: Data.TypeExpression[] = []
    for (let i = 0; i < resolution.arity; ++i) {
      parameters.push(i < actuals.length ? actuals[i] : formals[i])
    }
    const type = evaluation.evaluateNested(substituteTypeExpressions(body, parameters))
    return evaluation.remember(expression, type)
  },
  variable(expression, [evaluation]) { throw new Error(evaluation.failure(`unexpected variable ${expression.text}`)) },
  orelse(expression, [evaluation]) { throw new Error(evaluation.failure(`unknown ${expression.text}`)) }
}
const basicTypes = { boolean: boolean(), int32: int32(), number: number(), string: string() }
const extractMacro: Data.TypeExpressionPattern<[ReadonlyArray<Data.TypeExpression>, Data.TypeExpression], []> = {
  macro(_expression, _p, formals, body) { return [formals, body] },
  orelse() { throw new Error("internal error in extraction of macro formals") },
}
class Space implements Data.Space {
  readonly #definitions: Data.TypeDefinitions
  readonly #cache: Map<Data.TypeExpression, Data.Type<Data.Value>>
  constructor(definitions: Data.TypeDefinitions) {
    this.#definitions = definitions
    this.#cache = new Map<Data.TypeExpression, Data.Type<Data.Value>>()
  }
  public get definitions() { return this.#definitions }
  public evaluate<T extends Data.Value>(expressionSource: Data.TypeExpression | string): Data.Type<T> {
    const expression = express(expressionSource)
    // grab type from cache if possible; otherwise evaluate it (which adds the result to the cache)
    const type = this.#cache.get(expression) ?? new Evaluation(this.#definitions, expression, this.#cache).type
    return type as Data.Type<T>
  }
  public export<T extends Data.Value>(_expressionSource: Data.TypeExpression | string, _value: T): Data.Structure {
    return null as any
  }
  public import<T extends Data.Value>(_expressionSource: Data.TypeExpression | string, _structure: Data.Structure): T {
    return null as any
  }
}
function express(expression: Data.TypeExpression | string): Data.TypeExpression {
  return typeof expression === "string" ? parseTypeExpression(expression) : expression
}
