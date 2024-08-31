// --- TypeScript ---
import type Data from 'std.data'
import type Syntax from 'std.syntax'
// root node in syntax tree of type expression
interface RootNode extends Syntax.Node {
  readonly kind: "type"
  readonly expression: TypeExpression
}
// positions of type variables in scope when parsing
type Scope = { readonly [name: string]: number }
// --- JavaScript ---
import { loop, syntax } from "../extern.js"

export function isTypeExpression(it: unknown): it is Data.TypeExpression {
  return it instanceof TypeExpression
}

export function parseTypeExpression(text: string, location?: string): Data.TypeExpression {
  return expressionCache[text] ??= parseSource({ text, location }).root.expression
}

export function substituteTypeExpressions(
  expression: Data.TypeExpression,
  parameters: ReadonlyArray<Data.TypeExpression>
): Data.TypeExpression {
  return (expression as TypeExpression)[substitute](parameters)
}

// ----------------------------------------------------------------------------------------------------------------- //
// cache parsed type expressions
const expressionCache: { [text: string]: TypeExpression } = Object.create(null)
const lexicon = syntax.createLexicon({
  whitespace: /\s+/,
  typename: /[A-Z][0-9A-Za-z]*(?:\.[A-Za-z][0-9A-Za-z]*)+/,
  selector: /[A-Za-z][0-9A-Za-z]*/,
  symbol: ["(", ",", ")", "[", "]", "{", ":", "}", "<", ">", "=", "|", "?", "*"],
  decimal: /[0-9]{1,9}/,
  text: /"[\w\-\] !@#$%^&*()_~={}[|:;'<>,./?]{0,99}"/,
})
const parseSource = syntax.createParser({ lexicon, insignificance: { ignore: ["whitespace"] }, parseRoot })
const letterRegex = /^[a-z]$/
function peekVariable(scanner: Syntax.Scanner) {
  // extract only character of unconsumed selector token and test whether it is a lowercase letter
  const { lookahead } = scanner, { start, stop } = lookahead
  return stop - start === 1 && scanner.peek(lexicon.kind.selector) && letterRegex.test(scanner.extract(lookahead))
}
function compareExpressions({ text: left }: TypeExpression, { text: right }: TypeExpression) {
  return left < right ? -1 : left === right ? 1 : 0
}
function textual(expression: TypeExpression): string { return expression.text }
function* loopVariablePositions(mask: number): IterableIterator<number> {
  for (let position = 1, bit = 1; bit <= mask; ++position, bit <<= 1) {
    if (mask & bit) { yield position }
  }
}
function combineMask(mask: number, expression: TypeExpression): number {
  return mask | TypeExpression.maskOf(expression)
}
function combineMasks(expressions: TypeExpression[]) { return expressions.reduce(combineMask, 0) }
function combineFieldMask(mask: number, [_, expression]: [string, TypeExpression]) {
  return combineMask(mask, expression)
}
function parseRoot(scanner: Syntax.Scanner): Syntax.ParseResult<RootNode> {
  const warnings: string[] = []
  // EBNF: TypeExpr1 | Variable "=" TypeExpr1 (Variable "=" TypeExpr1)* TypeExpr1
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
    const body = parseTypeExpr1(scanner, scope), accu: string[] = []
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
    const text = mandatory.text + "?"
    return expressionCache[text] ??= new OptionalExpression(text, mandatory)
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
    return expressionCache[text] ??= new UnionExpression(text, expressions)
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
  //    | "{" (selector ":" TypeExpr1 ("," selector ":" TypeExpr1)* ","?)? "}"
  //    | TypeVariable
  if (scanner.accept("*")) {
    return expressionCache["*"] ??= new WildcardExpression("*")
  } else if (scanner.peek("boolean") || scanner.peek("int32") || scanner.peek("number") || scanner.peek("string")) {
    const text = scanner.extract(scanner.expect(lexicon.kind.selector))
    return expressionCache[text] ??= new BasicExpression(text)
  } else if (scanner.peek("false") || scanner.peek("true")) {
    const value = scanner.extract(scanner.expect(lexicon.kind.selector)) === "true", text = String(value)
    return expressionCache[text] ??= new LiteralExpression(text, value)
  } else if (scanner.peek(lexicon.kind.decimal)) {
    const value = Number(scanner.extract(scanner.expect(lexicon.kind.decimal))), text = String(value)
    return expressionCache[text] ??= new LiteralExpression(text, value)
  } else if (scanner.peek(lexicon.kind.text)) {
    const text = scanner.extract(scanner.expect(lexicon.kind.text)), value = JSON.parse(text)
    return expressionCache[text] ??= new LiteralExpression(text, value)
  } else if (scanner.peek(lexicon.kind.typename, "(")) {
    const name = scanner.extract(scanner.expect(lexicon.kind.typename))
    scanner.expect("(")
    const actuals: TypeExpression[] = []
    do {
      actuals.push(parseTypeExpr1(scanner, scope))
    } while (scanner.accept(","))
    scanner.expect(")")
    const text = `${name}(${actuals.map(textual).join(",")})`
    return expressionCache[text] ??= new ApplicationExpression(text, name, actuals)
  } else if (scanner.peek(lexicon.kind.typename)) {
    const text = scanner.extract(scanner.expect(lexicon.kind.typename))
    return expressionCache[text] ??= new ReferenceExpression(text)
  } else if (scanner.accept("[")) {
    const elementary = parseTypeExpr1(scanner, scope)
    scanner.expect("]")
    const text = `[${elementary.text}]`
    return expressionCache[text] ??= new ListExpression(text, elementary)
  } else if (scanner.accept("<")) {
    const elementary = parseTypeExpr1(scanner, scope)
    scanner.expect(">")
    const text = `<${elementary.text}>`
    return expressionCache[text] ??= new DictionaryExpression(text, elementary)
  } else if (scanner.accept("(")) {
    const parts = [parseTypeExpr1(scanner, scope)]
    scanner.expect(",")
    do {
      parts.push(parseTypeExpr1(scanner, scope))
    } while (scanner.accept(","))
    scanner.expect(")")
    const text = `(${parts.map(textual).join(",")})`
    return expressionCache[text] ??= new TupleExpression(text, parts)
  } else if (scanner.accept("{")) {
    const fields: { [name: string]: TypeExpression } = Object.create(null)
    if (scanner.peek(lexicon.kind.selector)) {
      do {
        const selectorToken = scanner.expect(lexicon.kind.selector), name = scanner.extract(selectorToken)
        if (fields[name]) {
          throw scanner.failure("duplicate record field", selectorToken)
        }
        scanner.expect(":")
        fields[name] = parseTypeExpr1(scanner, scope)
      } while (scanner.accept(",") && !scanner.peek("}"))
    }
    scanner.expect("}")
    const text = `{${Object.keys(fields).sort().map(name => `${name}:${fields[name].text}`).join(",")}}`
    return expressionCache[text] ??= new RecordExpression(text, fields)
  } else if (peekVariable(scanner)) {
    const selectorToken = scanner.expect(lexicon.kind.selector), position = scope[scanner.extract(selectorToken)]
    if (!position) {
      throw scanner.failure("variable is unbound", selectorToken)
    }
    // source text is normalized variable name, derived from position
    const text = String.fromCharCode("a".charCodeAt(0) + position - 1)
    return expressionCache[text] ??= new VariableExpression(text, position)
  } else {
    throw scanner.failure("expected start of type expression but found", scanner.lookahead)
  }
}
const substitute = Symbol("substitute method")
abstract class TypeExpression implements Data.TypeExpression {
  public static maskOf(expression: TypeExpression): number { return expression.#mask }
  // canonical source text of this expression
  readonly #text: string
  // track variable usage (position-based) in an expression
  readonly #mask: number
  constructor(text: string, mask: number) {
    this.#text = text
    this.#mask = mask
  }
  public get text() { return this.#text }
  public get arity(): number { return 0 }
  public get freeVariables(): IterableIterator<number> {
    return this.#mask === 0 ? loop.over() : loopVariablePositions(this.#mask)
  }
  public get hasFreeVariables() { return this.#mask > 0 }
  public abstract match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O
  public abstract [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression
}
class MacroExpression extends TypeExpression {
  readonly #formals: ReadonlyArray<TypeExpression>
  readonly #body: TypeExpression
  constructor(text: string, formals: TypeExpression[], body: TypeExpression) {
    super(text, 0)
    this.#formals = Object.freeze(formals)
    this.#body = body
  }
  public get arity() { return this.#formals.length }
  public get formals() { return this.#formals }
  public get body() { return this.#body }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.macro ? pattern.macro(this, p, this.#formals, this.#body) : pattern.orelse(this, p)
  }
  public [substitute](): Data.TypeExpression {
    throw new Error("illegal parameter substitution in macro expression")
  }
}
class OptionalExpression extends TypeExpression {
  public static mandatoryOf(expression: OptionalExpression): TypeExpression {
    return expression.#mandatory
  }
  readonly #mandatory: TypeExpression
  constructor(text: string, mandatory: TypeExpression) {
    super(text, TypeExpression.maskOf(mandatory))
    this.#mandatory = mandatory
  }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.optional ? pattern.optional(this, p, this.#mandatory) : pattern.orelse(this, p)
  }
  public [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    const substitution = this.#mandatory[substitute](parameters) as TypeExpression
    if (substitution instanceof OptionalExpression) {
      return substitution
    }
    const text = substitution.text + "?"
    return expressionCache[text] ??= new OptionalExpression(text, substitution)
  }
}
class UnionExpression extends TypeExpression {
  readonly #alternatives: ReadonlyArray<TypeExpression>
  constructor(text: string, alternatives: TypeExpression[]) {
    super(text, combineMasks(alternatives))
    this.#alternatives = Object.freeze(alternatives)
  }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.union ? pattern.union(this, p, this.#alternatives) : pattern.orelse(this, p)
  }
  public [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
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
      const text = mandatory.text + "?"
      return expressionCache[text] ??= new OptionalExpression(text, mandatory)
    } else {
      return mandatory
    }
  }
}
class WildcardExpression extends TypeExpression {
  constructor(text: string) { super(text, 0) }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.wildcard ? pattern.wildcard(this, p) : pattern.orelse(this, p)
  }
  public [substitute](): Data.TypeExpression { return this }
}
class BasicExpression extends TypeExpression {
  constructor(text: string) { super(text, 0) }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.basic ? pattern.basic(this, p, this.text as Data.BasicNames) : pattern.orelse(this, p)
  }
  public [substitute](): Data.TypeExpression { return this }
}
class LiteralExpression extends TypeExpression {
  readonly #value: Data.Literal
  constructor(text: string, value: Data.Literal) {
    super(text, 0)
    this.#value = value
  }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.literal ? pattern.literal(this, p, this.#value) : pattern.orelse(this, p)
  }
  public [substitute](): Data.TypeExpression { return this }
}
class ReferenceExpression extends TypeExpression {
  constructor(text: string) { super(text, 0) }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.reference ? pattern.reference(this, p, this.text) : pattern.orelse(this, p)
  }
  public [substitute](): Data.TypeExpression { return this }
}
class ApplicationExpression extends TypeExpression {
  readonly #name: string
  readonly #actuals: ReadonlyArray<TypeExpression>
  constructor(text: string, name: string, actuals: TypeExpression[]) {
    super(text, combineMasks(actuals))
    this.#name = name
    this.#actuals = Object.freeze(actuals)
  }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.application ? pattern.application(this, p, this.#name, this.#actuals) : pattern.orelse(this, p)
  }
  public [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    const actuals: TypeExpression[] = []
    for (const actual of this.#actuals) {
      if (!actual.hasFreeVariables) {
        actuals.push(actual)
      } else {
        actuals.push(actual[substitute](parameters) as TypeExpression)
      }
    }
    const text = `${this.#name}(${actuals.map(textual).join(",")})`
    return expressionCache[text] ??= new ApplicationExpression(text, name, actuals)
  }
}
class ListExpression extends TypeExpression {
  readonly #elementary: TypeExpression
  constructor(text: string, elementary: TypeExpression) {
    super(text, TypeExpression.maskOf(elementary))
    this.#elementary = elementary
  }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.list ? pattern.list(this, p, this.#elementary) : pattern.orelse(this, p)
  }
  public [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    if (this.#elementary.hasFreeVariables) {
      const elementary = this.#elementary[substitute](parameters) as TypeExpression
      const text = `[${elementary.text}]`
      return expressionCache[text] ??= new ListExpression(text, elementary)
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
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.dictionary ? pattern.dictionary(this, p, this.#elementary) : pattern.orelse(this, p)
  }
  public [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    if (this.#elementary.hasFreeVariables) {
      const elementary = this.#elementary[substitute](parameters) as TypeExpression
      const text = `<${elementary.text}>`
      return expressionCache[text] ??= new DictionaryExpression(text, elementary)
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
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.tuple ? pattern.tuple(this, p, this.#parts) : pattern.orelse(this, p)
  }
  public [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    const parts: TypeExpression[] = []
    for (const part of this.#parts) {
      if (!part.hasFreeVariables) {
        parts.push(part)
      } else {
        parts.push(part[substitute](parameters) as TypeExpression)
      }
    }
    const text = `(${parts.map(textual).join(",")})`
    return expressionCache[text] ??= new TupleExpression(text, parts)
  }
}
class RecordExpression extends TypeExpression {
  readonly #fields: { readonly [name: string]: TypeExpression }
  constructor(text: string, fields: { readonly [name: string]: TypeExpression }) {
    super(text, Object.entries(fields).reduce(combineFieldMask, 0))
    this.#fields = Object.freeze(fields)
  }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.record ? pattern.record(this, p, this.#fields) : pattern.orelse(this, p)
  }
  public [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    const fields: { [name: string]: TypeExpression } = Object.create(null)
    for (const fieldKey in this.#fields) {
      const fieldTypeExpression = this.#fields[fieldKey]
      const substitution = !fieldTypeExpression.hasFreeVariables ? fieldTypeExpression :
        fieldTypeExpression[substitute](parameters) as TypeExpression
      fields[fieldKey] = substitution
    }
    const text = `{${Object.keys(fields).sort().map(name => `${name}:${fields[name].text}`).join(",")}}`
    return expressionCache[text] ??= new RecordExpression(text, fields)
  }
}
class VariableExpression extends TypeExpression {
  readonly #position: number
  constructor(text: string, position: number) {
    super(text, 1 << (position - 1))
    this.#position = position
  }
  public match<O, P extends unknown[]>(pattern: Data.TypeExpressionPattern<O, P>, ...p: P): O {
    return pattern.variable ? pattern.variable(this, p, this.#position) : pattern.orelse(this, p)
  }
  public [substitute](parameters: ReadonlyArray<Data.TypeExpression>): Data.TypeExpression {
    return parameters[this.#position - 1]
  }
}
