// --- TypeScript ---
import type Data from 'std.data'
// --- JavaScript ---
import { fx } from "../extern.js"
import { isDictionary, isList, isRecord, isTuple } from "./value.js"

export function isType<T extends Data.Value = Data.Value>(it: unknown): it is Data.Type<T> {
  return facade.isHandling(it)
}

export function typeOf<T extends Data.Value = Data.Value>(value: T): Data.Type<T> {
  switch (typeof value) {
    case "boolean": return booleanType as Data.Type<T>
    case "number": return (value === ~~value ? int32Type : numberType) as Data.Type<T>
    case "string": return stringType  as Data.Type<T>
    case "undefined": return anyType  as Data.Type<T>
    default: return value.type  as Data.Type<T>
  }
}

export function boolean(): Data.Type<boolean> {
  return booleanType
}

export function int32(): Data.Type<number> {
  return int32Type
}

export function number(): Data.Type<number> {
  return numberType
}

export function string(): Data.Type<string> {
  return stringType
}

export function literal<T extends Data.Literal>(value: T): Data.Type<T> {
  const weakly = allLiteralTypes.get(value) as WeakRef<Data.Type<T>> | undefined
  const existing = weakly?.deref()
  if (existing) {
    return existing
  } else {
    const pristine = facade.handle<Data.Type<T>>(new LiteralDatatype<T>(value))
    allLiteralTypes.set(value, new WeakRef(pristine))
    literalFinalization.register(pristine, value)
    return pristine
  }
}

export function list<T extends Data.Value>(elementary: Data.Type<T>): Data.Type<Data.List<T>> {
  const existing = allListTypes.get(elementary) as Data.Type<Data.List<T>> | undefined
  if (existing) {
    return existing
  } else {
    const pristine = facade.handle<Data.Type<Data.List<T>>>(new ListDatatype<T>(elementary))
    allListTypes.set(elementary, pristine)
    return pristine
  }
}

export function dictionary<T extends Data.Value>(elementary: Data.Type<T>): Data.Type<Data.Dictionary<T>> {
  const existing = allDictionaryTypes.get(elementary) as Data.Type<Data.Dictionary<T>> | undefined
  if (existing) {
    return existing
  } else {
    const pristine: Data.Type<Data.Dictionary<T>> = facade.handle(new DictionaryDatatype<T>(elementary))
    allDictionaryTypes.set(elementary, pristine)
    return pristine
  }
}

export function record<F extends Data.FieldValues>(fields: Data.FieldTypesOf<F>): Data.Type<Data.Record<F>> {
  const keys = Object.keys(fields).sort(), unique = keys.join(" ")
  let existingTypes = allRecordTypes.get(unique)
  if (existingTypes) {
    for (const weakly of existingTypes) {
      const candidateType = weakly.deref() as unknown as Data.Type<Data.Record<F>>
      if (candidateType && equalFieldType(fields, candidateType.match(recordFieldTypes))) {
        return candidateType 
      }
    }
  } else {
    allRecordTypes.set(unique, existingTypes = new Set())
  }
  const pristine = facade.handle<Data.Type<Data.Record<Data.FieldValues>>>(new RecordDatatype(fields, keys))
  existingTypes.add(new WeakRef(pristine))
  recordFinalization.register(pristine, unique)
  return pristine as unknown as Data.Type<Data.Record<F>>
}

export function tuple<T extends Data.ValueSequence>(parts: Data.TypesOf<T>): Data.Type<Data.Tuple<T>> {
  if (parts.length < 2) {
    throw new Error("tuple type requires at least two parts")
  }
  let existingTypes = allTupleTypes[parts.length - 2]
  if (existingTypes) {
    for (const weakly of existingTypes) {
      const candidateType = weakly.deref()
      if (candidateType && equalTypes(parts as Data.Type<Data.Value>[], candidateType.match(tupleTypes))) {
        return candidateType as Data.Type<Data.Tuple<T>>
      }
    }
  } else {
    allTupleTypes[parts.length - 2] = existingTypes = new Set()
  }
  const pristine = facade.handle<Data.Type<Data.Tuple<T>>>(new TupleDatatype<T>(parts))
  existingTypes.add(new WeakRef(pristine))
  tupleFinalization.register(pristine, parts.length)
  return pristine
}

export function union<T extends Data.ValueSequence>(alternatives: Data.TypesOf<T>): Data.Type<T[number]> {
  const [isOptional, significant] = sortSignificant(alternatives)
  if (significant.length === 1) {
    // no need for a union type when only one significant alternative remains
    return isOptional ? optional(significant[0]) : significant[0]
  }
  let existingTypes = allUnionTypes[significant.length - 2]
  if (existingTypes) {
    for (const weakly of existingTypes) {
      const candidateType = weakly.deref() as Data.Type<Data.Wildcard>
      if (candidateType && equalTypes(significant, candidateType.match(unionAlternatives))) {
        return isOptional ? optional(candidateType) : candidateType
      }
    }
  } else {
    allUnionTypes[significant.length - 2] = existingTypes = new Set()
  }
  const pristine = facade.handle<Data.Type<T[number]>>(new UnionDatatype<T>(significant as Data.TypesOf<T>))
  existingTypes.add(new WeakRef(pristine))
  unionFinalization.register(pristine, significant.length)
  return isOptional ? optional(pristine as Data.Type<Data.Wildcard>) : pristine
}

export function wildcard(): Data.Type<Data.Wildcard> {
  return wildcardType
}

export function optional<T extends Data.Wildcard>(mandatory: Data.Type<T>): Data.Type<T | undefined> {
  if (facade.expose(mandatory) instanceof OptionalDatatype) {
    // idempotency: it's not possible to create an optional optional type
    return mandatory
  }
  const existing = allOptionalTypes.get(mandatory) as Data.Type<T | undefined>
  if (existing) {
    return existing
  } else {
    const pristine = facade.handle<Data.Type<T | undefined>>(new OptionalDatatype<T>(mandatory))
    allOptionalTypes.set(mandatory, pristine)
    return pristine
  }
}

export function createDummy(): Data.Type<Data.Value> {
  return facade.handle(dummy)
}

export function swapDummy(dummyType: Data.Type<Data.Value>, type: Data.Type<Data.Value>): Data.Type<Data.Value> {
  if (facade.expose(dummyType) !== dummy) {
    throw new Error("internal error with dummy of type swap")
  }
  const datatype = facade.expose(type)
  if (datatype === dummy) {
    throw new Error("internal error with type of dummy swap")
  }
  // swap dummmy reference with other reference
  facade.reset(dummyType, datatype)
  facade.reset(type, dummy)
  return dummyType
}

// ----------------------------------------------------------------------------------------------------------------- //
const facade = fx.facade<Data.Type<Data.Value>, Datatype<Data.Value>>(
  "std.data:Type",
  Object.create(Object.prototype, {
    includes: { value(v: Data.Value) { return facade.expose(this).test(v) } },
    match: {
      value<O, P extends unknown[]>(pattern: Data.TypePattern<O, P>, ...p: P): O {
        return facade.expose(this).accept(this, pattern, p)
      }
    }
  })
)
abstract class Datatype<T extends Data.Value> {
  protected abstract get order(): number
  public compare(other: Datatype<Data.Value>): number { return Math.sign(this.order - other.order) }
  public abstract test(v: Data.Value): v is T
  public abstract accept<O, P extends unknown[]>(type: Data.Type<Data.Value>, pattern: Data.TypePattern<O, P>, p: P): O
}
const dummy = new class DummyDatatype extends Datatype<undefined> {
  protected get order(): number {
    throw new Error("internal error with illegal access of dummy type")
  }
  public compare(_other: Datatype<Data.Value>): number { 
    throw new Error("internal error with illegal access of dummy type")
  }
  public test(_v: Data.Value): _v is undefined {
    throw new Error("internal error with illegal access of dummy type")
  }
  public accept<O, P extends unknown[]>(_type: Data.Type<Data.Value>, _pattern: Data.TypePattern<O, P>, _p: P): O {
    throw new Error("internal error with illegal access of dummy type")
  }
}
function compareDatatype(left: Datatype<Data.Value>, right: Datatype<Data.Value>): number {
  return left === right ? 0 : left.compare(right)
}
function compareType(left: Data.Type<Data.Value>, right: Data.Type<Data.Value>): number {
  return left === right ? 0 : compareDatatype(facade.expose(left), facade.expose(right))
}
function equalType(left: Data.Type<Data.Value>, right: Data.Type<Data.Value>): boolean {
  return left === right || facade.expose(left) === facade.expose(right)
}
const booleanType = facade.handle<Data.Type<boolean>>(new class BooleanDatatype extends Datatype<boolean> {
  protected get order() { return 10 }
  public test(v: Data.Value): v is boolean { return typeof v === "boolean" }
  public accept<O, P extends unknown[]>(type: Data.Type<boolean>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.boolean ? pattern.boolean(type, p) : pattern.orelse(type, p)
  }
})
const int32Type = facade.handle<Data.Type<number>>(new class Int32Datatype extends Datatype<number> {
  protected get order() { return 20 }
  public test(v: Data.Value): v is number { return typeof v === "number" && ~~v === v }
  public accept<O, P extends unknown[]>(type: Data.Type<number>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.int32 ? pattern.int32(type, p) : pattern.orelse(type, p)
  }
})
const numberType = facade.handle<Data.Type<number>>(new class NumberDatatype extends Datatype<number> {
  protected get order() { return 30 }
  public test(v: Data.Value): v is number { return Number.isFinite(v) }
  public accept<O, P extends unknown[]>(type: Data.Type<number>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.number ? pattern.number(type, p) : pattern.orelse(type, p)
  }
})
const stringType = facade.handle<Data.Type<string>>(new class StringDatatype extends Datatype<string> {
  protected get order() { return 40 }
  public test(v: Data.Value): v is string { return typeof v === "string" }
  public accept<O, P extends unknown[]>(type: Data.Type<string>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.string ? pattern.string(type, p) : pattern.orelse(type, p)
  }
})
class LiteralDatatype<T extends Data.Literal> extends Datatype<T> {
  readonly #value: T
  constructor(value: T) {
    super()
    this.#value = value
  }
  protected get order() {
    switch (typeof this.#value) {
      case "boolean": return 100
      case "number": return 110
      case "string": return 120
    }
  }
  public compare(other: LiteralDatatype<Data.Literal>): number {
    return super.compare(other) || (this.#value < other.#value ? -1 : this.#value === other.#value ? 0 : 1)
  }
  public test(v: Data.Value): v is T { return v === this.#value }
  public accept<O, P extends unknown[]>(type: Data.Type<T>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.literal ? pattern.literal(type, p, this.#value) : pattern.orelse(type, p)
  }
}
const allLiteralTypes: Map<Data.Literal, WeakRef<Data.Type<Data.Literal>>> = new Map()
const literalFinalization = new FinalizationRegistry<Data.Literal>(literalValue => {
  const weakly = allLiteralTypes.get(literalValue)
  if (weakly && !weakly.deref()) {
    allLiteralTypes.delete(literalValue)
  }
})
class ListDatatype<T extends Data.Value> extends Datatype<Data.List<T>> {
  readonly #elementary: Data.Type<T>
  constructor(elementary: Data.Type<T>) {
    super()
    this.#elementary = elementary
  }
  protected get order() { return 1_000 }
  public compare(other: ListDatatype<Data.Value>): number {
    return super.compare(other) || compareType(this.#elementary, other.#elementary)
  }
  public test(v: Data.Value): v is Data.List<T> {
    if (isList(v)) {
      const elementary = this.#elementary
      for (const member of v.members) {
        if (!elementary.includes(member)) {
          return false
        }
      }
      return true
    }
    return false
  }
  public accept<O, P extends unknown[]>(type: Data.Type<Data.List<T>>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.list ? pattern.list(type, p, this.#elementary) : pattern.orelse(type, p)
  }
}
const allListTypes: WeakMap<Data.Type<Data.Value>, Data.Type<Data.List<Data.Value>>> = new WeakMap()
class DictionaryDatatype<T extends Data.Value> extends Datatype<Data.Dictionary<T>> {
  readonly #elementary: Data.Type<T>
  constructor(elementary: Data.Type<T>) {
    super()
    this.#elementary = elementary
  }
  protected get order() { return 2_000 }
  public compare(other: DictionaryDatatype<Data.Value>): number {
    return super.compare(other) || compareType(this.#elementary, other.#elementary)
  }
  public test(v: Data.Value): v is Data.Dictionary<T> {
    if (isDictionary<T>(v)) {
      const elementary = this.#elementary
      for (const member of v.members) {
        if (!elementary.includes(member)) {
          return false
        }
      }
      return true
    }
    return false
  }
  public accept<O, P extends unknown[]>(type: Data.Type<Data.Dictionary<T>>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.dictionary ? pattern.dictionary(type, p, this.#elementary) : pattern.orelse(type, p)
  }
}
const allDictionaryTypes: WeakMap<Data.Type<Data.Value>, Data.Type<Data.Dictionary<Data.Value>>> = new WeakMap()
class RecordDatatype<F extends Data.FieldValues> extends Datatype<Data.Record<F>> {
  readonly #fields: Data.FieldTypesOf<F>
  readonly #sortedKeys: string[]
  constructor(fields: Data.FieldTypesOf<F>, sortedKeys: string[]) {
    super()
    this.#fields = fields
    this.#sortedKeys = sortedKeys
  }
  protected get order() { return 10_000 + this.#sortedKeys.length }
  public compare(other: RecordDatatype<Data.FieldValues>): number {
    const orderComparison = super.compare(other)
    if (orderComparison) {
      // order-based comparison is sufficient
      return orderComparison
    }
    for (let i = 0; i < this.#sortedKeys.length; ++i) {
      const thisKey = this.#sortedKeys[i], otherKey = other.#sortedKeys[i]
      if (thisKey < otherKey) {
        return -1
      } else if (thisKey > otherKey) {
        return 1
      }
      const comparison = compareType(this.#fields[thisKey], other.#fields[thisKey])
      if (comparison) {
        return comparison
      }
    }
    return 0
  }
  public test(v: Data.Value): v is Data.Record<F> {
    if (isRecord(v)) {
      const shadow = v.shadow, fieldTypes = this.#fields
      for (const selector in fieldTypes) {
        if (!fieldTypes[selector].includes(shadow[selector])) {
          return false
        }
      }
      return true
    }
    return false
  }
  public accept<O, P extends unknown[]>(type: Data.Type<Data.Record<F>>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.record ? pattern.record(type, p, this.#fields) : pattern.orelse(type, p)
  }
}
const allRecordTypes: Map<string, Set<WeakRef<Data.Type<Data.Record<Data.FieldValues>>>>> = new Map()
const recordFinalization = new FinalizationRegistry<string>(tag => {
  const recordTypes = allRecordTypes.get(tag)
  if (recordTypes) {
    for (const weakly of recordTypes) {
      if (!weakly.deref()) {
        recordTypes.delete(weakly)
      }
    }
    if (recordTypes.size === 0) {
      allRecordTypes.delete(tag)
    }
  }
})
const recordFieldTypes: Data.TypePattern<Data.FieldTypesOf<Data.FieldValues>, []> = {
  record(_type, _p, fieldTypes) { return fieldTypes }, orelse() { throw new Error("expected a record type") }
}
function equalFieldType(left: Data.FieldTypesOf<Data.FieldValues>, right: Data.FieldTypesOf<Data.FieldValues>) {
  for (const key in left) {
    if (!equalType(left[key], right[key])) {
      return false
    }
  }
  return true
}
class TupleDatatype<T extends Data.ValueSequence> extends Datatype<Data.Tuple<T>> {
  readonly #parts: Data.TypesOf<T>
  constructor(parts: Data.TypesOf<T>) {
    super()
    this.#parts = parts
  }
  protected get order() { return 100_000 + this.#parts.length }
  public compare(other: TupleDatatype<Data.ValueSequence>): number {
    const orderComparison = super.compare(other)
    if (orderComparison) {
      return orderComparison
    }
    for (let i = 0; i < this.#parts.length; ++i) {
      const comparison = compareType(this.#parts[i], other.#parts[i])
      if (comparison) {
        return comparison
      }
    }
    return 0
  }
  public test(v: Data.Value): v is Data.Tuple<T> {
    if (isTuple(v)) {
      const shadow = v.shadow, partTypes = this.#parts
      if (shadow.length === partTypes.length) {
        for (let i = 0; i < partTypes.length; ++i) {
          if (!partTypes[i].includes(shadow[i])) {
            return false
          }
        }
        return true
      }
    }
    return false
  }
  public accept<O, P extends unknown[]>(type: Data.Type<Data.Tuple<T>>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.tuple ? pattern.tuple(type, p, this.#parts) : pattern.orelse(type, p)
  }
}
const allTupleTypes: Set<WeakRef<Data.Type<Data.Tuple<Data.ValueSequence>>>>[] = []
const tupleFinalization = new FinalizationRegistry<number>(n => {
  const tupleTypes = allTupleTypes[n - 2]
  if (tupleTypes) {
    for (const weakly of tupleTypes) {
      if (!weakly.deref()) {
        tupleTypes.delete(weakly)
      }
    }
  }
})
const tupleTypes: Data.TypePattern<Data.Type<Data.Value>[], []> = {
  tuple(_type, _p, types ) { return types as Data.Type<Data.Value>[] },
  orelse() { throw new Error("expected a tuple type") },
}
class UnionDatatype<T extends Data.ValueSequence> extends Datatype<T[number]> {
  readonly #alternatives: Data.TypesOf<T>
  constructor(alternatives: Data.TypesOf<T>) {
    super()
    this.#alternatives = alternatives
  }
  protected get order() { return 1_000_000 + this.#alternatives.length }
  public compare(other: UnionDatatype<Data.ValueSequence>): number {
    const orderComparison = super.compare(other)
    if (orderComparison) {
      return orderComparison
    }
    for (let i = 0; i < this.#alternatives.length; ++i) {
      const comparison = compareType(this.#alternatives[i], other.#alternatives[i])
      if (comparison) {
        return comparison
      }
    }
    return 0
  }
  public test(v: Data.Value): v is T[number] {
    for (const alternative of this.#alternatives) {
      if (alternative.includes(v)) {
        return true
      }
    }
    return false
  }
  public accept<O, P extends unknown[]>(type: Data.Type<T[number]>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.union ? pattern.union(type, p, this.#alternatives) : pattern.orelse(type, p)
  }
}
const allUnionTypes: Set<WeakRef<Data.Type<Data.ValueSequence[number]>>>[] = []
const unionFinalization = new FinalizationRegistry<number>(n => {
  const union = allUnionTypes[n - 2]
  if (union) {
    for (const weakly of union) {
      if (!weakly.deref()) {
        union.delete(weakly)
      }
    }
  }
})
const unionAlternatives: Data.TypePattern<Data.Type<Data.Value>[], []> = {
  union(_type, _p, alternatives) { return alternatives as Data.Type<Data.Value>[] },
  orelse() { throw new Error("expected a union type") },
}
function sortSignificant(alternatives: Data.TypesOf<Data.ValueSequence>): [boolean, Data.Type<Data.Wildcard>[]] {
  let isOptional = false, isWildcard = false, isBoolean = false, isInt32 = false, isNumber = false, isString = false
  const literalTypes = new Map<Data.Literal, Data.Type<Data.Literal>>()
  const listTypes = new Set<Data.Type<Data.List<Data.Value>>>()
  const dictionaryTypes = new Set<Data.Type<Data.Dictionary<Data.Value>>>()
  const recordTypes = new Set<Data.Type<Data.Record<Data.FieldValues>>>()
  const tupleTypes = new Set<Data.Type<Data.Tuple<Data.ValueSequence>>>()
  const addAlternative: Data.TypePattern<void, []> = {
    boolean() { isBoolean = true },
    int32() { isInt32 = true },
    number() { isNumber = true },
    string() { isString = true },
    literal(t, _p, v) { literalTypes.set(v, t) },
    list(t) { listTypes.add(t) },
    dictionary(t) { dictionaryTypes.add(t) },
    record(t) { recordTypes.add(t as unknown as Data.Type<Data.Record<Data.FieldValues>>) },
    tuple(t) { tupleTypes.add(t) },
    union(_t, _p, nestedAlternatives) {
      for (const alternative of nestedAlternatives) {
        alternative.match(addAlternative)
      }
    },
    wildcard() { isWildcard = true },
    optional(_t, _p, mandatory) {
      isOptional = true
      mandatory.match(addAlternative)
    },
    orelse() { throw new Error("internal error in construction of union type") }
  }
  for (const type of alternatives) {
    type.match(addAlternative)
  }
  const significant: Data.Type<Data.Wildcard>[] = []
  if (isWildcard) significant.push(wildcardType)
  else {
    if (isBoolean || literalTypes.has(false) && literalTypes.has(true)) significant.push(booleanType)
    if (isInt32 && !isNumber) significant.push(int32Type)
    if (isNumber) significant.push(numberType)
    if (isString) significant.push(stringType)
    const literalNumbers: number[] = [], literalStrings: string[] = []
    for (const [literalValue, literalType] of literalTypes.entries()) {
      switch (typeof literalValue) {
        case "boolean":
          if (!isBoolean) significant.push(literalType) // either true or false, never both
          break
        case "number":
          if (!isInt32 && !isNumber) literalNumbers.push(literalValue)
          break
        case "string":
          if (!isString) literalStrings.push(literalValue)
          break
      }
    }
    if (literalNumbers.length) {
      for (const n of literalNumbers.sort((n, m) => n - m)) significant.push(literalTypes.get(n)!)
    }
    if (literalStrings.length) {
      for (const s of literalStrings.sort()) significant.push(literalTypes.get(s)!)
    }
    for (const listType of [...listTypes].sort(compareType)) {
      significant.push(listType)
    }
    for (const dictionaryType of [...dictionaryTypes].sort(compareType)) {
      significant.push(dictionaryType)
    }
    for (const recordType of [...recordTypes].sort(compareType)) {
      significant.push(recordType)
    }
    for (const tupleType of [...tupleTypes].sort(compareType)) {
      significant.push(tupleType)
    }
  }
  return [isOptional, significant]
}
const wildcardType = facade.handle<Data.Type<Data.Wildcard>>(
  new class WildcardDatatype extends Datatype<Data.Wildcard> {
    protected get order() { return 9_999_999 }
    public test(v: Data.Value): v is Data.Wildcard { return v !== void 0 }
    public accept<O, P extends unknown[]>(type: Data.Type<Data.Wildcard>, pattern: Data.TypePattern<O, P>, p: P): O {
      return pattern.wildcard ? pattern.wildcard(type, p) : pattern.orelse(type, p)
    }
  }
)
class OptionalDatatype<T extends Data.Wildcard> extends Datatype<T | undefined> {
  readonly #mandatory: Data.Type<T>
  constructor(mandatory: Data.Type<T>) {
    super()
    this.#mandatory = mandatory
  }
  protected get order() { return 10_000_000 }
  public compare(other: OptionalDatatype<T>): number {
    return super.compare(other) || compareType(this.#mandatory, other.#mandatory)
  }
  public test(v: Data.Value): v is T | undefined {
    return v === void 0 || this.#mandatory.includes(v)
  }
  public accept<O, P extends unknown[]>(type: Data.Type<T | undefined>, pattern: Data.TypePattern<O, P>, p: P): O {
    return pattern.optional ? pattern.optional(type, p, this.#mandatory) : pattern.orelse(type, p)
  }
}
const allOptionalTypes: WeakMap<Data.Type<Data.Wildcard>, Data.Type<Data.Value>> = new WeakMap()
const anyType = optional(wildcardType)
function equalTypes(left: Data.Type<Data.Value>[], right: Data.Type<Data.Value>[]) {
  if (left.length === right.length) {
    for (let i = 0; i < left.length; ++i) {
      if (!equalType(left[i], right[i])) {
        return false
      }
    }
    return true
  }
  return false
}
