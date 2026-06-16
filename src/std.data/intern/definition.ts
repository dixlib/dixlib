import type Data from "std.data"
import type Syntax from "std.syntax"
import { syntax } from "../extern.js"

export function isTypeExpression(it: unknown): it is Data.TypeExpression {
  return it instanceof TypeExpression
}

export function parseTypeExpression(text: string, location?: string): Data.TypeExpression {
  expressionCache[text] ??= parseSource({ text, location }).root.expression
  return expressionCache[text]
}

export function substituteTypeExpressions(
  expression: Data.TypeExpression,
  parameters: ReadonlyArray<Data.TypeExpression>
): Data.TypeExpression {
  return (expression as TypeExpression)[substitute](parameters)
}

// ----------------------------------------------------------------------------------------------------------------- //
// root node in syntax tree of type expression
interface RootNode extends Syntax.Node {
  readonly kind: "type"
  readonly expression: TypeExpression
}
// positions of type variables in scope when parsing
type Scope = { readonly [name: string]: number }
// streak of record fields
type Streak = { [selector: string]: TypeExpression }
// cache parsed type expressions
const expressionCache: { [text: string]: TypeExpression } = Object.create(null)
const lexicon = syntax.createLexicon({
  whitespace: /\s+/,
  typename: /[A-Z][0-9A-Za-z]*(?:\.[A-Za-z][0-9A-Za-z]*)+/,
  selector: /[A-Za-z][0-9A-Za-z]*/,
  symbol: ["*", "[", "]", "<", ">", "(", ",", ")", "{", ":", "/", "}", "|", "?", "="],
  decimal: /0|[1-9][0-9]{0,8}/,
  text: /"[\w\-\] !@#$%^&*()`~+={}[|:;'<>,./?]{0,99}"/,
})
const parseSource = syntax.createParser({ lexicon, insignificance: { ignore: ["whitespace"] }, parseRoot })
const letterRegex = /^[a-z]$/
function peekVariable(scanner: Syntax.Scanner) {
  // extract only character of unconsumed selector token and test whether it is a lowercase letter
  const { lookahead } = scanner
  const { start, stop } = lookahead
  return stop - start === 1 && scanner.peek(lexicon.kind.selector) && letterRegex.test(scanner.extract(lookahead))
}
function compareExpressions({ text: left }: TypeExpression, { text: right }: TypeExpression) {
  return left < right ? -1 : left === right ? 1 : 0
}
function textual(expression: TypeExpression): string {
  return expression.text
}
function* loopVariablePositions(mask: number) {
  for (let position = 1, bit = 1; bit <= mask; ++position, bit <<= 1) {
    if (mask & bit) {
      yield position
    }
  }
}
function combineMask(mask: number, expression: TypeExpression): number {
  return mask | TypeExpression.maskOf(expression)
}
function combineMasks(expressions: TypeExpression[]) {
  return expressions.reduce(combineMask, 0)
}
function combineChunksMask(chunks: Data.FieldsChunk[]) {
  let mask = 0
  for (const chunk of chunks) {
    if (isTypeExpression(chunk)) {
      mask |= combineMask(mask, chunk as TypeExpression)
    } else {
      for (const selector in chunk) {
        mask |= combineMask(mask, chunk[selector] as TypeExpression)
      }
    }
  }
  return mask
}
function parseRoot(scanner: Syntax.Scanner): Syntax.ParseResult<RootNode> {
  const warnings: string[] = []
  // EBNF: TypeExpr1 | (Variable "=" TypeExpr1)+ TypeExpr1
  // the grammar is not LL(1) because a single type variable is also a valid type expression
  // however, a variable can only semantically refer to an expression if it's part of an outer macro
  let expression: TypeExpression
  if (scanner.peek(lexicon.kind.selector, "=") && peekVariable(scanner)) {
    const scope: { [variable: string]: number } = Object.create(null)
    const formals: TypeExpression[] = []
    let n = 0
    do {
      const selectorToken = scanner.expect(lexicon.kind.selector)
      const variable = scanner.extract(selectorToken)
      if (scope[variable]) {
        throw scanner.failure("variable is already bound", selectorToken)
      }
      scanner.expect("=")
      formals.push(parseTypeExpr1(scanner, scope))
      scope[variable] = ++n
    } while (scanner.peek(lexicon.kind.selector, "=") && peekVariable(scanner))
    const body = parseTypeExpr1(scanner, scope)
    const accu: string[] = []
    if (body.hasFreeVariables) {
      const unused = formals.length - [...body.freeVariables].length
      if (unused > 0) {
        warnings.push(`${unused} unused parameter(s) in macro body: ${body.text}`)
      }
      for (let i = 0, code = "a".charCodeAt(0); i < formals.length; ++i, ++code) {
        if (i > 0) {
          accu.push(" ")
        }
        accu.push(String.fromCharCode(code), "=", formals[i].text)
      }
      accu.push(" ", body.text)
      const text = accu.join("")
      expression = expressionCache[text] ??= new MacroExpression(text, formals, body)
    } else {
      warnings.push(`dropping parameters of macro body without variables: ${body.text}`)
      expression = body
    }
  } else {
    expression = parseTypeExpr1(scanner, {})
  }
  if (!scanner.atEnd) {
    throw scanner.failure("expected end of input but found", scanner.lookahead)
  }
  return { root: { kind: "type", expression }, gathered: [], warnings }
}
function parseTypeExpr1(scanner: Syntax.Scanner, scope: Scope): TypeExpression {
  // EBNF: TypeExpr2 "?"?
  const mandatory = parseTypeExpr2(scanner, scope)
  if (scanner.accept("?")) {
    const text = `${mandatory.text}?`
    expressionCache[text] ??= new OptionalExpression(text, mandatory)
    return expressionCache[text]
  } else {
    return mandatory
  }
}
function parseTypeExpr2(scanner: Syntax.Scanner, scope: Scope): TypeExpression {
  // EBNF: TypeExpr3 ("|" TypeExpr3)*
  const alternatives = new Set<TypeExpression>()
  do {
    // collect distinct alternatives
    alternatives.add(parseTypeExpr3(scanner, scope))
  } while (scanner.accept("|"))
  if (alternatives.size > 1) {
    const expressions = [...alternatives].sort(compareExpressions)
    const text = expressions.map(textual).join("|")
    expressionCache[text] ??= new UnionExpression(text, expressions)
    return expressionCache[text]
  } else {
    const [singleAlternative] = alternatives
    return singleAlternative
  }
}
function parseTypeExpr3(scanner: Syntax.Scanner, scope: Scope): TypeExpression {
  // EBNF: "*"
  //    | "boolean" | "int32" | "number" | "string"
  //    | "false" | "true" | decimal | text
  //    | typename ("(" TypeExpr1 ("," TypeExpr1)* ")")?
  //    | "[" TypeExpr1 "]"
  //    | "<" TypeExpr1 ">"
  //    | "(" TypeExpr1 ("," TypeExpr1)+ ")"
  //    | "{" (Field ("," Field)* ","?)? "}"
  //    | TypeVariable
  if (scanner.accept("*")) {
    expressionCache["*"] ??= new WildcardExpression("*")
    return expressionCache["*"]
  } else if (scanner.peek("boolean") || scanner.peek("int32") || scanner.peek("number") || scanner.peek("string")) {
    const text = scanner.extract(scanner.expect(lexicon.kind.selector))
    expressionCache[text] ??= new BasicExpression(text)
    return expressionCache[text]
  } else if (scanner.peek("false") || scanner.peek("true")) {
    const value = scanner.extract(scanner.expect(lexicon.kind.selector)) === "true"
    const text = String(value)
    expressionCache[text] ??= new LiteralExpression(text, value)
    return expressionCache[text]
  } else if (scanner.peek(lexicon.kind.decimal)) {
    const value = Number(scanner.extract(scanner.expect(lexicon.kind.decimal)))
    const text = String(value)
    expressionCache[text] ??= new LiteralExpression(text, value)
    return expressionCache[text]
  } else if (scanner.peek(lexicon.kind.text)) {
    const text = scanner.extract(scanner.expect(lexicon.kind.text))
    const value = JSON.parse(text)
    expressionCache[text] ??= new LiteralExpression(text, value)
    return expressionCache[text]
  } else if (scanner.peek(lexicon.kind.typename, "(")) {
    const name = scanner.extract(scanner.expect(lexicon.kind.typename))
    scanner.expect("(")
    const actuals: TypeExpression[] = []
    do {
      actuals.push(parseTypeExpr1(scanner, scope))
    } while (scanner.accept(","))
    scanner.expect(")")
    const text = `${name}(${actuals.map(textual).join(",")})`
    expressionCache[text] ??= new ApplicationExpression(text, name, actuals)
    return expressionCache[text]
  } else if (scanner.peek(lexicon.kind.typename)) {
    const text = scanner.extract(scanner.expect(lexicon.kind.typename))
    expressionCache[text] ??= new ReferenceExpression(text)
    return expressionCache[text]
  } else if (scanner.accept("[")) {
    const elementary = parseTypeExpr1(scanner, scope)
    scanner.expect("]")
    const text = `[${elementary.text}]`
    expressionCache[text] ??= new ListExpression(text, elementary)
    return expressionCache[text]
  } else if (scanner.accept("<")) {
    const elementary = parseTypeExpr1(scanner, scope)
    scanner.expect(">")
    const text = `<${elementary.text}>`
    expressionCache[text] ??= new DictionaryExpression(text, elementary)
    return expressionCache[text]
  } else if (scanner.accept("(")) {
    const parts = [parseTypeExpr1(scanner, scope)]
    scanner.expect(",")
    do {
      parts.push(parseTypeExpr1(scanner, scope))
    } while (scanner.accept(","))
    scanner.expect(")")
    const text = `(${parts.map(textual).join(",")})`
    expressionCache[text] ??= new TupleExpression(text, parts)
    return expressionCache[text]
  } else if (scanner.accept("{")) {
    const chunks: Data.FieldsChunk[] = []
    const fields = new Set<string>()
    while (!scanner.peek("}")) {
      if (scanner.accept("/")) {
        if (!scanner.peek(lexicon.kind.typename) && !peekVariable(scanner)) {
          throw scanner.failure("expected a reference to spread", scanner.lookahead)
        }
        chunks.push(parseTypeExpr3(scanner, scope))
      } else if (scanner.peek(lexicon.kind.selector, ":")) {
        const streak: Streak = Object.create(null)
        do {
          const selectorToken = scanner.expect(lexicon.kind.selector)
          const selector = scanner.extract(selectorToken)
          if (fields.has(selector)) {
            throw scanner.failure("duplicate record field", selectorToken)
          }
          fields.add(selector)
          scanner.expect(":")
          streak[selector] = parseTypeExpr1(scanner, scope)
        } while (scanner.peek(",", lexicon.kind.selector, ":") && scanner.accept(","))
        chunks.push(Object.freeze(streak))
      } else {
        throw scanner.failure("expected field record spread or streak", scanner.lookahead)
      }
      if (scanner.peek(",", "}") || !scanner.peek("}")) {
        scanner.expect(",")
      }
    }
    scanner.expect("}")
    const text = `{${chunks.map(unparseChunk).join(",")}}`
    expressionCache[text] ??= new RecordExpression(text, chunks)
    return expressionCache[text]
  } else if (peekVariable(scanner)) {
    const selectorToken = scanner.expect(lexicon.kind.selector)
    const position = scope[scanner.extract(selectorToken)]
    if (!position) {
      throw scanner.failure("variable is unbound", selectorToken)
    }
    // source text is normalized variable name, derived from position
    const text = String.fromCharCode("a".charCodeAt(0) + position - 1)
    expressionCache[text] ??= new VariableExpression(text, position)
    return expressionCache[text]
  } else {
    throw scanner.failure("expected start of type expression but found", scanner.lookahead)
  }
}
function unparseChunk(chunk: Data.FieldsChunk): string {
  if (isTypeExpression(chunk)) {
    return `/${chunk.text}`
  } else {
    const associations: string[] = []
    for (const selector of Object.keys(chunk).sort()) {
      associations.push(`${selector}:${chunk[selector].text}`)
    }
    return associations.join(",")
  }
}
const substitute = Symbol("substitute method")
abstract class TypeExpression implements Data.TypeExpression {
  static maskOf(expression: TypeExpression): number {
    return expression.#mask
  }
  // canonical source text of this expression
  readonly #text: string
  // track variable usage (position-based) in an expression
  readonly #mask: number
  constructor(text: string, mask: number) {
    this.#text = text
    this.#mask = mask
  }
  get text() {
    return this.#text
  }
  get arity(): number {
    return 0
  }
  get freeVariables(): IteratorObject<number> {
    return this.#mask === 0 ? [].values() : loopVariablePositions(this.#mask)
  }
  get hasFreeVariables() {
    return this.#mask > 0
  }
  abstract match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T
  abstract [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression
}
class MacroExpression extends TypeExpression {
  readonly #formals: ReadonlyArray<TypeExpression>
  readonly #body: TypeExpression
  constructor(text: string, formals: TypeExpression[], body: TypeExpression) {
    super(text, 0)
    this.#formals = Object.freeze(formals)
    this.#body = body
  }
  get arity() {
    return this.#formals.length
  }
  get formals() {
    return this.#formals
  }
  get body() {
    return this.#body
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.macro ? pattern.macro(this, parameters, this.#formals, this.#body) : pattern.orelse(this, parameters)
  }
  [substitute](): Data.TypeExpression {
    throw new Error("illegal parameter substitution in macro expression")
  }
}
class OptionalExpression extends TypeExpression {
  static mandatoryOf(expression: OptionalExpression): TypeExpression {
    return expression.#mandatory
  }
  readonly #mandatory: TypeExpression
  constructor(text: string, mandatory: TypeExpression) {
    super(text, TypeExpression.maskOf(mandatory))
    this.#mandatory = mandatory
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.optional ? pattern.optional(this, parameters, this.#mandatory) : pattern.orelse(this, parameters)
  }
  [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    const substitution = this.#mandatory[substitute](parameters) as TypeExpression
    if (substitution instanceof OptionalExpression) {
      return substitution
    }
    const text = `${substitution.text}?`
    expressionCache[text] ??= new OptionalExpression(text, substitution)
    return expressionCache[text]
  }
}
class UnionExpression extends TypeExpression {
  readonly #alternatives: ReadonlyArray<TypeExpression>
  constructor(text: string, alternatives: TypeExpression[]) {
    super(text, combineMasks(alternatives))
    this.#alternatives = Object.freeze(alternatives)
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.union ? pattern.union(this, parameters, this.#alternatives) : pattern.orelse(this, parameters)
  }
  [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    let optional = false
    const substitutions: Set<TypeExpression> = new Set()
    for (const alternative of this.#alternatives) {
      if (!alternative.hasFreeVariables) {
        substitutions.add(alternative)
      } else {
        const substitution = alternative[substitute](parameters) as TypeExpression
        if (substitution instanceof OptionalExpression) {
          optional = true
          substitutions.add(OptionalExpression.mandatoryOf(substitution))
        } else if (substitution instanceof UnionExpression) {
          for (const nestedAlternative of substitution.#alternatives) {
            substitutions.add(nestedAlternative)
          }
        } else {
          substitutions.add(substitution)
        }
      }
    }
    let mandatory: TypeExpression
    if (substitutions.size > 1) {
      const alternatives = [...substitutions].sort(compareExpressions)
      const text = alternatives.map(textual).join("|")
      mandatory = expressionCache[text] ??= new UnionExpression(text, alternatives)
    } else {
      const [singleAlternative] = substitutions
      mandatory = singleAlternative
    }
    if (optional) {
      const text = `${mandatory.text}?`
      expressionCache[text] ??= new OptionalExpression(text, mandatory)
      return expressionCache[text]
    } else {
      return mandatory
    }
  }
}
class WildcardExpression extends TypeExpression {
  constructor(text: string) {
    super(text, 0)
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.wildcard ? pattern.wildcard(this, parameters) : pattern.orelse(this, parameters)
  }
  [substitute](): Data.TypeExpression {
    return this
  }
}
class BasicExpression extends TypeExpression {
  constructor(text: string) {
    super(text, 0)
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parmeters: P): T {
    return pattern.basic
      ? pattern.basic(this, parmeters, this.text as Data.BasicNames)
      : pattern.orelse(this, parmeters)
  }
  [substitute](): Data.TypeExpression {
    return this
  }
}
class LiteralExpression extends TypeExpression {
  readonly #value: Data.BasicValue
  constructor(text: string, value: Data.BasicValue) {
    super(text, 0)
    this.#value = value
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.literal ? pattern.literal(this, parameters, this.#value) : pattern.orelse(this, parameters)
  }
  [substitute](): Data.TypeExpression {
    return this
  }
}
class ReferenceExpression extends TypeExpression {
  constructor(text: string) {
    super(text, 0)
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.reference ? pattern.reference(this, parameters, this.text) : pattern.orelse(this, parameters)
  }
  [substitute](): Data.TypeExpression {
    return this
  }
}
class ApplicationExpression extends TypeExpression {
  readonly #name: string
  readonly #actuals: ReadonlyArray<TypeExpression>
  constructor(text: string, name: string, actuals: TypeExpression[]) {
    super(text, combineMasks(actuals))
    this.#name = name
    this.#actuals = Object.freeze(actuals)
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.application
      ? pattern.application(this, parameters, this.#name, this.#actuals)
      : pattern.orelse(this, parameters)
  }
  [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    const actuals: TypeExpression[] = []
    for (const actual of this.#actuals) {
      if (!actual.hasFreeVariables) {
        actuals.push(actual)
      } else {
        actuals.push(actual[substitute](parameters) as TypeExpression)
      }
    }
    const text = `${this.#name}(${actuals.map(textual).join(",")})`
    expressionCache[text] ??= new ApplicationExpression(text, this.#name, actuals)
    return expressionCache[text]
  }
}
class ListExpression extends TypeExpression {
  readonly #elementary: TypeExpression
  constructor(text: string, elementary: TypeExpression) {
    super(text, TypeExpression.maskOf(elementary))
    this.#elementary = elementary
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.list ? pattern.list(this, parameters, this.#elementary) : pattern.orelse(this, parameters)
  }
  [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    if (this.#elementary.hasFreeVariables) {
      const elementary = this.#elementary[substitute](parameters) as TypeExpression
      const text = `[${elementary.text}]`
      expressionCache[text] ??= new ListExpression(text, elementary)
      return expressionCache[text]
    } else {
      return this
    }
  }
}
class DictionaryExpression extends TypeExpression {
  readonly #elementary: TypeExpression
  constructor(text: string, elementary: TypeExpression) {
    super(text, TypeExpression.maskOf(elementary))
    this.#elementary = elementary
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.dictionary
      ? pattern.dictionary(this, parameters, this.#elementary)
      : pattern.orelse(this, parameters)
  }
  [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    if (this.#elementary.hasFreeVariables) {
      const elementary = this.#elementary[substitute](parameters) as TypeExpression
      const text = `<${elementary.text}>`
      expressionCache[text] ??= new DictionaryExpression(text, elementary)
      return expressionCache[text]
    } else {
      return this
    }
  }
}
class TupleExpression extends TypeExpression {
  readonly #parts: ReadonlyArray<TypeExpression>
  constructor(text: string, parts: TypeExpression[]) {
    super(text, combineMasks(parts))
    this.#parts = Object.freeze(parts)
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.tuple ? pattern.tuple(this, parameters, this.#parts) : pattern.orelse(this, parameters)
  }
  [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    const parts: TypeExpression[] = []
    for (const part of this.#parts) {
      parts.push(part.hasFreeVariables ? (part[substitute](parameters) as TypeExpression) : part)
    }
    const text = `(${parts.map(textual).join(",")})`
    expressionCache[text] ??= new TupleExpression(text, parts)
    return expressionCache[text]
  }
}
class RecordExpression extends TypeExpression {
  readonly #chunks: ReadonlyArray<Data.FieldsChunk>
  constructor(text: string, chunks: Data.FieldsChunk[]) {
    super(text, combineChunksMask(chunks))
    this.#chunks = Object.freeze(chunks)
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.record ? pattern.record(this, parameters, this.#chunks) : pattern.orelse(this, parameters)
  }
  [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    const chunks: Data.FieldsChunk[] = []
    for (const chunk of this.#chunks) {
      if (isTypeExpression(chunk)) {
        const expression = chunk as TypeExpression
        chunks.push(expression.hasFreeVariables ? expression[substitute](parameters) : expression)
      } else {
        const streak: Streak = Object.create(null)
        for (const selector in chunk) {
          const expression = chunk[selector] as TypeExpression
          streak[selector] = expression.hasFreeVariables
            ? (expression[substitute](parameters) as TypeExpression)
            : expression
        }
        chunks.push(Object.freeze(streak))
      }
    }
    const text = `{${chunks.map(unparseChunk).join(",")}}`
    expressionCache[text] ??= new RecordExpression(text, chunks)
    return expressionCache[text]
  }
}
class VariableExpression extends TypeExpression {
  readonly #position: number
  constructor(text: string, position: number) {
    super(text, 1 << (position - 1))
    this.#position = position
  }
  match<T, P extends unknown[]>(pattern: Data.TypeExpressionPattern<T, P>, ...parameters: P): T {
    return pattern.variable ? pattern.variable(this, parameters, this.#position) : pattern.orelse(this, parameters)
  }
  [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    return parameters[this.#position - 1]
  }
}
