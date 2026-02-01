import type { ServiceName } from "dixlib"
import type Data from "std.data"
import type Definition from "std.data.definition"
import type Meta from "std.data.meta"
import { definition, loader, news } from "../extern.js"
import {
  boolean,
  createDummy,
  dictionary,
  equalType,
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
  wildcard,
} from "./type.js"

export async function inflate(serviceName: ServiceName): Promise<Meta.Space> {
  const definitions = await loadTypeDefinitions(serviceName)
  const unique = []
  for (const key of Object.keys(definitions).sort()) {
    const definition = definitions[key]
    unique.push(key, "=", definition.text, "\n")
  }
  // asynchronously compute SHA-1 hashcode (presumed unique but not in a cryptographic context)
  const hashcode = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(unique.join("")))
  return new Space(definitions, hashcode)
}

// ----------------------------------------------------------------------------------------------------------------- //
interface TypeDefinitionsModule {
  // optional names of services whose type definitions should be included
  readonly include?: string[]
  // sources of type definitions
  readonly definitions: { readonly [name: string]: string }
}
class Evaluation {
  readonly #definitions: Definition.TypeDefinitions
  readonly #rootExpression: Definition.TypeExpression
  readonly #cache: Map<Definition.TypeExpression, Meta.Type<Data.Value>>
  readonly #reversedCache: Map<Meta.Type<Data.Value>, Definition.TypeExpression[]>
  readonly #pending: Map<Definition.TypeExpression, Meta.Type<Data.Value>>
  readonly #reversing: Map<Meta.Type<Data.Value>, Set<Definition.TypeExpression>>
  #depth: number
  #addReversing(expression: Definition.TypeExpression, type: Meta.Type<Data.Value>) {
    // keep track of the expressions that evaluated to a certain type
    const expressions = this.#reversing.get(type) ?? new Set()
    expressions.add(expression)
    this.#reversing.set(type, expressions)
  }
  constructor(
    definitions: Definition.TypeDefinitions,
    rootExpression: Definition.TypeExpression,
    cache: Map<Definition.TypeExpression, Meta.Type<Data.Value>>,
    reversedCached: Map<Meta.Type<Data.Value>, Definition.TypeExpression[]>
  ) {
    this.#rootExpression = rootExpression
    this.#definitions = definitions
    this.#cache = cache
    this.#reversedCache = reversedCached
    this.#pending = new Map()
    this.#reversing = new Map()
    this.#depth = 0
  }
  get type(): Meta.Type<Data.Value> {
    const type = this.#rootExpression.match(evaluator, this)
    if (this.#pending.size > 0) {
      throw new Error(this.failure("with remaining pending expression(s)"))
    }
    // register expressions that evaluated to a type (in this evaluation)
    for (const [evaluatedType, evaluatedExpressions] of this.#reversing) {
      // same type might have been evaluated before (with other expressions)
      const existingExpressions = this.#reversedCache.get(evaluatedType) ?? []
      const sortedExpressions = [...existingExpressions, ...evaluatedExpressions]
      sortedExpressions.sort(compareExpressions)
      this.#reversedCache.set(evaluatedType, sortedExpressions)
    }
    return type
  }
  failure(message: string) {
    return `internal error ${message} in evaluation of ${this.#rootExpression.text}`
  }
  remember(expression: Definition.TypeExpression, type: Meta.Type<Data.Value>): Meta.Type<Data.Value> {
    this.#addReversing(expression, type)
    if (this.#cache.has(expression)) {
      const cachedType = this.#cache.get(expression) as Meta.Type<Data.Value>
      if (!equalType(cachedType, type)) {
        throw new Error(this.failure(`with cache conflict for expression ${expression.text}`))
      }
      return cachedType
    } else {
      this.#cache.set(expression, type)
      return type
    }
  }
  introduceDummy(expression: Definition.TypeExpression) {
    this.#pending.set(expression, createDummy())
  }
  rememberDummyAs(expression: Definition.TypeExpression, type: Meta.Type<Data.Value>): Meta.Type<Data.Value> {
    const dummyType = this.#pending.get(expression) as Meta.Type<Data.Value>
    if (!this.#pending.delete(expression)) {
      throw new Error(this.failure("while swapping dummy type"))
    }
    this.#cache.set(expression, dummyType)
    this.#addReversing(expression, dummyType)
    return swapDummy(dummyType, type)
  }
  evaluateNested(expression: Definition.TypeExpression): Meta.Type<Data.Value> {
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
  resolve(name: string): Definition.TypeExpression | undefined {
    return this.#definitions[name]
  }
}
const evaluator: Definition.TypeExpressionPattern<Meta.Type<Data.Value>, [Evaluation]> = {
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
    const fieldTypes: { [fieldName: string]: Meta.Type<Data.Value> } = {}
    for (const fieldName in fields) {
      fieldTypes[fieldName] = evaluation.evaluateNested(fields[fieldName])
    }
    return evaluation.rememberDummyAs(expression, record(fieldTypes))
  },
  tuple(expression, [evaluation], parts) {
    evaluation.introduceDummy(expression)
    const tupleTypes: Meta.Type<Data.Value>[] = []
    for (const part of parts) {
      tupleTypes.push(evaluation.evaluateNested(part))
    }
    return evaluation.rememberDummyAs(expression, tuple(tupleTypes as unknown as Meta.TypesOf<Data.ValueSequence>))
  },
  union(expression, [evaluation], alternatives) {
    const alternativeTypes: Meta.Type<Data.Value>[] = []
    for (const alternative of alternatives) {
      alternativeTypes.push(evaluation.evaluateNested(alternative))
    }
    return evaluation.remember(expression, union(alternativeTypes as unknown as Meta.TypesOf<Data.ValueSequence>))
  },
  wildcard(expression, [evaluation]) {
    return evaluation.remember(expression, wildcard())
  },
  optional(expression, [evaluation], mandatory) {
    const mandatoryType = evaluation.evaluateNested(mandatory) as Meta.Type<Data.Wildcard>
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
    const type = evaluation.evaluateNested(definition.substituteTypeExpressions(body, formals))
    return evaluation.remember(expression, type)
  },
  macro(expression, [evaluation], formals, body) {
    const type = evaluation.evaluateNested(definition.substituteTypeExpressions(body, formals))
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
    const parameters: Definition.TypeExpression[] = []
    for (let i = 0; i < resolution.arity; ++i) {
      parameters.push(i < actuals.length ? actuals[i] : formals[i])
    }
    const type = evaluation.evaluateNested(definition.substituteTypeExpressions(body, parameters))
    return evaluation.remember(expression, type)
  },
  variable(expression, [evaluation]) {
    throw new Error(evaluation.failure(`unexpected variable ${expression.text}`))
  },
  orelse(expression, [evaluation]) {
    throw new Error(evaluation.failure(`unknown ${expression.text}`))
  },
}
const basicTypes = {
  boolean: boolean(),
  int32: int32(),
  number: number(),
  string: string(),
}
const extractMacro: Definition.TypeExpressionPattern<
  [ReadonlyArray<Definition.TypeExpression>, Definition.TypeExpression],
  []
> = {
  macro(_expression, _parameters, formals, body) {
    return [formals, body]
  },
  orelse() {
    throw new Error("internal error in extraction of macro formals")
  },
}
function compareExpressions(left: Definition.TypeExpression, right: Definition.TypeExpression) {
  return left.text.length - right.text.length
}
class Space implements Meta.Space {
  readonly #definitions: Definition.TypeDefinitions
  readonly #hashcode: ArrayBuffer
  readonly #cache: Map<Definition.TypeExpression, Meta.Type<Data.Value>>
  readonly #reversedCache: Map<Meta.Type<Data.Value>, Definition.TypeExpression[]>
  constructor(definitions: Definition.TypeDefinitions, hashcode: ArrayBuffer) {
    this.#definitions = definitions
    this.#hashcode = hashcode
    this.#cache = new Map<Definition.TypeExpression, Meta.Type<Data.Value>>()
    this.#reversedCache = new Map<Meta.Type<Data.Value>, Definition.TypeExpression[]>()
  }
  get definitions() {
    return this.#definitions
  }
  get hashcode() {
    return this.#hashcode
  }
  evaluate<T extends Data.Value>(expressionSource: Definition.TypeExpression | string): Meta.Type<T> {
    const expression =
      typeof expressionSource === "string" ? definition.parseTypeExpression(expressionSource) : expressionSource
    // grab type from cache if possible
    const type =
      this.#cache.get(expression) ??
      // otherwise evaluate it, adding results to the cache and the reversed cache
      new Evaluation(this.#definitions, expression, this.#cache, this.#reversedCache).type
    return type as Meta.Type<T>
  }
  unevaluate<T extends Data.Value = Data.Value>(type: Meta.Type<T>): IteratorObject<Definition.TypeExpression> {
    const expressions = this.#reversedCache.get(type) ?? []
    // iterate over expressions that evaluated to given type
    return expressions.values()
  }
}
// keep track of services whose type definitions are being loaded, or already have been loaded
const loading: { [serviceName: string]: Promise<Definition.TypeDefinitions> } = Object.create(null)
// compute dependency graph to detect inclusion cycles
const dependencyGraph: { [serviceName: string]: Set<string> } = Object.create(null)
function loadTypeDefinitions(serviceName: ServiceName): Promise<Definition.TypeDefinitions> {
  loading[serviceName] ??= load(serviceName)
  return loading[serviceName]
}
// load type definitions of service
async function load(serviceName: ServiceName): Promise<Definition.TypeDefinitions> {
  const dependencies = new Set<string>()
  dependencyGraph[serviceName] = dependencies
  // query loader to locate module with type definitions
  const bundles = []
  for (const result of loader.query({ aspects: ["typedefs"] })) {
    if (result.hasBindingFor(serviceName)) {
      bundles.push(result.bundle)
    }
  }
  // only one bundle can provide type definitions for a service
  if (bundles.length === 0) {
    throw new Error(`unable to locate type definitions for service '${serviceName}'`)
  } else if (bundles.length > 1) {
    throw new Error(`duplicate type definitions for '${serviceName}' in bundles "${bundles.join('","')}"`)
  }
  // load module with type definitions (datatype.js)
  const location = new URL(`${serviceName}/datatype.js`, bundles[0]).href
  const module: TypeDefinitionsModule = await import(location)
  // parse sources of type expressions
  const accu: { [typeName: string]: Definition.TypeExpression } = Object.create(null)
  for (const typeName in module.definitions) {
    accu[typeName] = definition.parseTypeExpression(module.definitions[typeName], `${location}@${typeName}`)
  }
  // check for cycles in dependency graph
  const inclusions = [...new Set(module.include ?? []).values()] as ServiceName[]
  for (const dependency of inclusions) {
    dependencies.add(dependency)
    for (const indirect of dependencyGraph[dependency] ?? []) {
      dependencies.add(indirect)
    }
    if (dependencies.has(serviceName)) {
      throw new Error(`cyclic inclusion of type definitions from service '${serviceName}' to '${dependency}'`)
    }
  }
  // load included type definitions
  const predefined = await Promise.all(inclusions.map(loadTypeDefinitions))
  // safely merge included type definitions into accumulator
  for (let i = 0; i < inclusions.length; ++i) {
    const dependency = inclusions[i]
    const definitions = predefined[i]
    for (const typeName in definitions) {
      const expression = definitions[typeName]
      if (accu[typeName] && accu[typeName] !== expression) {
        throw new Error(`merge conflict for type "${typeName}" in '${serviceName}' while including '${dependency}'`)
      }
      accu[typeName] = expression
    }
  }
  return Object.freeze(accu)
}
