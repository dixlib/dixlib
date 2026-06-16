import type Data from "std.data"
import { fn, fx } from "../extern.js"
import { isDictionary, isList, isRecord, isTuple } from "./value.js"

export function isType<T extends Data.Value = Data.Value>(it: unknown): it is Data.Type<T> {
  return facade.isHandling(it)
}

export function typeOf<T extends Data.Value = Data.Value>(value: T): Data.Type<T> {
  switch (typeof value) {
    case "boolean":
      return booleanType as Data.Type<T>
    case "number":
      return (value === ~~value ? int32Type : numberType) as Data.Type<T>
    case "string":
      return stringType as Data.Type<T>
    case "undefined":
      return anyType as Data.Type<T>
    default:
      return value.type as Data.Type<T>
  }
}

export function equalType(left: Data.Type<Data.Value>, right: Data.Type<Data.Value>): boolean {
  return left === right || facade.expose(left) === facade.expose(right)
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

export function literal<T extends Data.BasicValue>(value: T): Data.Type<T> {
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
  if (existing && !isDummy(existing)) {
    return existing
  } else {
    const pristine = facade.handle<Data.Type<Data.List<T>>>(new ListDatatype<T>(elementary))
    allListTypes.set(elementary, pristine)
    return pristine
  }
}

export function dictionary<T extends Data.Value>(elementary: Data.Type<T>): Data.Type<Data.Dictionary<T>> {
  const existing = allDictionaryTypes.get(elementary) as Data.Type<Data.Dictionary<T>> | undefined
  if (existing && !isDummy(existing)) {
    return existing
  } else {
    const pristine: Data.Type<Data.Dictionary<T>> = facade.handle(new DictionaryDatatype<T>(elementary))
    allDictionaryTypes.set(elementary, pristine)
    return pristine
  }
}

export function record<F extends Data.FieldValues>(fields: Data.FieldTypesOf<F>): Data.Type<Data.Record<F>> {
  const keys = Object.keys(fields).sort()
  const unique = keys.join(" ")
  let existingTypes = allRecordTypes.get(unique)
  if (existingTypes) {
    for (const weakly of existingTypes) {
      const candidateType = weakly.deref() as unknown as Data.Type<Data.Record<F>>
      // dummy type can (temporarily) show up in the record type cache; weak reference will eventually break
      if (candidateType && !isDummy(candidateType) && equalFieldType(fields, candidateType.match(recordFieldTypes))) {
        return candidateType
      }
    }
  } else {
    existingTypes = new Set()
    allRecordTypes.set(unique, existingTypes)
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
      if (
        candidateType &&
        !isDummy(candidateType) &&
        equalTypes(parts as Data.Type<Data.Value>[], candidateType.match(tupleTypes))
      ) {
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

export function isDummy(type: Data.Type<Data.Value>) {
  return facade.expose(type) === dummy
}

// ----------------------------------------------------------------------------------------------------------------- //
const facade = fx.createFacade<Data.Type<Data.Value>, Datatype<Data.Value>>(
  "std.data/Type",
  Object.create(Object.prototype, {
    includes: {
      value(v: Data.Value) {
        return facade.expose(this).test(v)
      },
    },
    match: {
      value<T, P extends unknown[]>(pattern: Data.TypePattern<T, P>, ...parameters: P): T {
        return facade.expose(this).accept(this, pattern, parameters)
      },
    },
  })
)
abstract class Datatype<T extends Data.Value> {
  protected abstract get order(): number
  compare(other: Datatype<Data.Value>): number {
    return Math.sign(this.order - other.order)
  }
  abstract test(v: Data.Value): v is T
  abstract accept<T, P extends unknown[]>(
    type: Data.Type<Data.Value>,
    pattern: Data.TypePattern<T, P>,
    parameters: P
  ): T
}
const dummy = new (class DummyDatatype extends Datatype<undefined> {
  protected get order(): number {
    throw new Error("internal error with illegal access of dummy type")
  }
  compare(_: Datatype<Data.Value>): number {
    throw new Error("internal error with illegal access of dummy type")
  }
  test(_: Data.Value): _ is undefined {
    throw new Error("internal error with illegal access of dummy type")
  }
  accept<T, P extends unknown[]>(_type: Data.Type<Data.Value>, _pattern: Data.TypePattern<T, P>, _parameters: P): T {
    throw new Error("internal error with illegal access of dummy type")
  }
})()
function compareDatatype(left: Datatype<Data.Value>, right: Datatype<Data.Value>): number {
  return left === right ? 0 : left.compare(right)
}
function compareType(left: Data.Type<Data.Value>, right: Data.Type<Data.Value>): number {
  return left === right ? 0 : compareDatatype(facade.expose(left), facade.expose(right))
}
const booleanType = facade.handle<Data.Type<boolean>>(
  new (class BooleanDatatype extends Datatype<boolean> {
    protected get order() {
      return 10
    }
    test(v: Data.Value): v is boolean {
      return typeof v === "boolean"
    }
    accept<T, P extends unknown[]>(type: Data.Type<boolean>, pattern: Data.TypePattern<T, P>, parameters: P): T {
      return pattern.boolean ? pattern.boolean(type, parameters) : pattern.orelse(type, parameters)
    }
  })()
)
const int32Type = facade.handle<Data.Type<number>>(
  new (class Int32Datatype extends Datatype<number> {
    protected get order() {
      return 20
    }
    test(v: Data.Value): v is number {
      return fn.isInt32(v)
    }
    accept<T, P extends unknown[]>(type: Data.Type<number>, pattern: Data.TypePattern<T, P>, parameters: P): T {
      return pattern.int32 ? pattern.int32(type, parameters) : pattern.orelse(type, parameters)
    }
  })()
)
const numberType = facade.handle<Data.Type<number>>(
  new (class NumberDatatype extends Datatype<number> {
    protected get order() {
      return 30
    }
    test(v: Data.Value): v is number {
      return Number.isFinite(v)
    }
    accept<T, P extends unknown[]>(type: Data.Type<number>, pattern: Data.TypePattern<T, P>, parameters: P): T {
      return pattern.number ? pattern.number(type, parameters) : pattern.orelse(type, parameters)
    }
  })()
)
const stringType = facade.handle<Data.Type<string>>(
  new (class StringDatatype extends Datatype<string> {
    protected get order() {
      return 40
    }
    test(v: Data.Value): v is string {
      return typeof v === "string"
    }
    accept<T, P extends unknown[]>(type: Data.Type<string>, pattern: Data.TypePattern<T, P>, parameters: P): T {
      return pattern.string ? pattern.string(type, parameters) : pattern.orelse(type, parameters)
    }
  })()
)
class LiteralDatatype<T extends Data.BasicValue> extends Datatype<T> {
  readonly #value: T
  constructor(value: T) {
    super()
    this.#value = value
  }
  protected get order() {
    switch (typeof this.#value) {
      case "boolean":
        return 100
      case "number":
        return 110
      default: // case "string"
        return 120
    }
  }
  compare(other: LiteralDatatype<Data.BasicValue>): number {
    return super.compare(other) || (this.#value < other.#value ? -1 : this.#value === other.#value ? 0 : 1)
  }
  test(v: Data.Value): v is T {
    return v === this.#value
  }
  accept<Out, P extends unknown[]>(type: Data.Type<T>, pattern: Data.TypePattern<Out, P>, parameters: P): Out {
    return pattern.literal ? pattern.literal(type, parameters, this.#value) : pattern.orelse(type, parameters)
  }
}
const allLiteralTypes: Map<Data.BasicValue, WeakRef<Data.Type<Data.BasicValue>>> = new Map()
const literalFinalization = new FinalizationRegistry<Data.BasicValue>(literalValue => {
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
  protected get order() {
    return 1_000
  }
  compare(other: ListDatatype<Data.Value>): number {
    return super.compare(other) || compareType(this.#elementary, other.#elementary)
  }
  test(v: Data.Value): v is Data.List<T> {
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
  accept<Out, P extends unknown[]>(
    type: Data.Type<Data.List<T>>,
    pattern: Data.TypePattern<Out, P>,
    parameters: P
  ): Out {
    return pattern.list ? pattern.list(type, parameters, this.#elementary) : pattern.orelse(type, parameters)
  }
}
const allListTypes: WeakMap<Data.Type<Data.Value>, Data.Type<Data.List<Data.Value>>> = new WeakMap()
class DictionaryDatatype<T extends Data.Value> extends Datatype<Data.Dictionary<T>> {
  readonly #elementary: Data.Type<T>
  constructor(elementary: Data.Type<T>) {
    super()
    this.#elementary = elementary
  }
  protected get order() {
    return 2_000
  }
  compare(other: DictionaryDatatype<Data.Value>): number {
    return super.compare(other) || compareType(this.#elementary, other.#elementary)
  }
  test(v: Data.Value): v is Data.Dictionary<T> {
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
  accept<Out, P extends unknown[]>(
    type: Data.Type<Data.Dictionary<T>>,
    pattern: Data.TypePattern<Out, P>,
    parameters: P
  ): Out {
    return pattern.dictionary
      ? pattern.dictionary(type, parameters, this.#elementary)
      : pattern.orelse(type, parameters)
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
  protected get order() {
    return 10_000 + this.#sortedKeys.length
  }
  compare(other: RecordDatatype<Data.FieldValues>): number {
    const orderComparison = super.compare(other)
    if (orderComparison) {
      // order-based comparison is sufficient
      return orderComparison
    }
    for (let i = 0; i < this.#sortedKeys.length; ++i) {
      const thisKey = this.#sortedKeys[i]
      const otherKey = other.#sortedKeys[i]
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
  test(v: Data.Value): v is Data.Record<F> {
    if (isRecord(v)) {
      const shadow = v.shadow
      const fieldTypes = this.#fields
      for (const selector in fieldTypes) {
        if (!fieldTypes[selector].includes(shadow[selector])) {
          return false
        }
      }
      return true
    }
    return false
  }
  accept<Out, P extends unknown[]>(
    type: Data.Type<Data.Record<F>>,
    pattern: Data.TypePattern<Out, P>,
    parameters: P
  ): Out {
    return pattern.record ? pattern.record(type, parameters, this.#fields) : pattern.orelse(type, parameters)
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
  record(_type, _parameters, fieldTypes) {
    return fieldTypes
  },
  orelse() {
    throw new Error("expected a record type")
  },
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
  protected get order() {
    return 100_000 + this.#parts.length
  }
  compare(other: TupleDatatype<Data.ValueSequence>): number {
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
  test(v: Data.Value): v is Data.Tuple<T> {
    if (isTuple(v)) {
      const shadow = v.shadow
      const partTypes = this.#parts
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
  accept<Out, P extends unknown[]>(
    type: Data.Type<Data.Tuple<T>>,
    pattern: Data.TypePattern<Out, P>,
    parameters: P
  ): Out {
    return pattern.tuple ? pattern.tuple(type, parameters, this.#parts) : pattern.orelse(type, parameters)
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
  tuple(_type, _parameters, types) {
    return types as Data.Type<Data.Value>[]
  },
  orelse() {
    throw new Error("expected a tuple type")
  },
}
class UnionDatatype<T extends Data.ValueSequence> extends Datatype<T[number]> {
  readonly #alternatives: Data.TypesOf<T>
  constructor(alternatives: Data.TypesOf<T>) {
    super()
    this.#alternatives = alternatives
  }
  protected get order() {
    return 1_000_000 + this.#alternatives.length
  }
  compare(other: UnionDatatype<Data.ValueSequence>): number {
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
  test(v: Data.Value): v is T[number] {
    for (const alternative of this.#alternatives) {
      if (alternative.includes(v)) {
        return true
      }
    }
    return false
  }
  accept<Out, P extends unknown[]>(type: Data.Type<T[number]>, pattern: Data.TypePattern<Out, P>, parameters: P): Out {
    return pattern.union ? pattern.union(type, parameters, this.#alternatives) : pattern.orelse(type, parameters)
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
  union(_type, _parameters, alternatives) {
    return alternatives as Data.Type<Data.Value>[]
  },
  orelse() {
    throw new Error("expected a union type")
  },
}
function sortSignificant(alternatives: Data.TypesOf<Data.ValueSequence>): [boolean, Data.Type<Data.Wildcard>[]] {
  let isOptional = false
  let isWildcard = false
  let isBoolean = false
  let isInt32 = false
  let isNumber = false
  let isString = false
  const literalTypes = new Map<Data.BasicValue, Data.Type<Data.BasicValue>>()
  const listTypes = new Set<Data.Type<Data.List<Data.Value>>>()
  const dictionaryTypes = new Set<Data.Type<Data.Dictionary<Data.Value>>>()
  const recordTypes = new Set<Data.Type<Data.Record<Data.FieldValues>>>()
  const tupleTypes = new Set<Data.Type<Data.Tuple<Data.ValueSequence>>>()
  const addAlternative: Data.TypePattern<void, []> = {
    boolean() {
      isBoolean = true
    },
    int32() {
      isInt32 = true
    },
    number() {
      isNumber = true
    },
    string() {
      isString = true
    },
    literal(type, _parameters, v) {
      literalTypes.set(v, type)
    },
    list(type) {
      listTypes.add(type)
    },
    dictionary(types) {
      dictionaryTypes.add(types)
    },
    record(types) {
      recordTypes.add(types as unknown as Data.Type<Data.Record<Data.FieldValues>>)
    },
    tuple(types) {
      tupleTypes.add(types)
    },
    union(_type, _parameters, nestedAlternatives) {
      for (const alternative of nestedAlternatives) {
        alternative.match(addAlternative)
      }
    },
    wildcard() {
      isWildcard = true
    },
    optional(_type, _parameters, mandatory) {
      isOptional = true
      mandatory.match(addAlternative)
    },
    orelse() {
      throw new Error("internal error in construction of union type")
    },
  }
  for (const type of alternatives) {
    type.match(addAlternative)
  }
  const significant: Data.Type<Data.Wildcard>[] = []
  if (isWildcard) {
    significant.push(wildcardType)
  } else {
    if (isBoolean || (literalTypes.has(false) && literalTypes.has(true))) {
      significant.push(booleanType)
    }
    if (isInt32 && !isNumber) {
      significant.push(int32Type)
    }
    if (isNumber) {
      significant.push(numberType)
    }
    if (isString) {
      significant.push(stringType)
    }
    const literalNumbers: number[] = []
    const literalStrings: string[] = []
    for (const [literalValue, literalType] of literalTypes.entries()) {
      switch (typeof literalValue) {
        case "boolean":
          if (!isBoolean) {
            significant.push(literalType)
          } // either true or false, never both
          break
        case "number":
          if (!isInt32 && !isNumber) {
            literalNumbers.push(literalValue)
          }
          break
        case "string":
          if (!isString) {
            literalStrings.push(literalValue)
          }
          break
      }
    }
    if (literalNumbers.length) {
      for (const n of literalNumbers.sort((n, m) => n - m)) {
        significant.push(literalTypes.get(n) as Data.Type<Data.BasicValue>)
      }
    }
    if (literalStrings.length) {
      for (const s of literalStrings.sort()) {
        significant.push(literalTypes.get(s) as Data.Type<Data.BasicValue>)
      }
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
  new (class WildcardDatatype extends Datatype<Data.Wildcard> {
    protected get order() {
      return 9_999_999
    }
    test(v: Data.Value): v is Data.Wildcard {
      return v !== void 0
    }
    accept<T, P extends unknown[]>(type: Data.Type<Data.Wildcard>, pattern: Data.TypePattern<T, P>, parameters: P): T {
      return pattern.wildcard ? pattern.wildcard(type, parameters) : pattern.orelse(type, parameters)
    }
  })()
)
class OptionalDatatype<T extends Data.Wildcard> extends Datatype<T | undefined> {
  readonly #mandatory: Data.Type<T>
  constructor(mandatory: Data.Type<T>) {
    super()
    this.#mandatory = mandatory
  }
  protected get order() {
    return 10_000_000
  }
  compare(other: OptionalDatatype<T>): number {
    return super.compare(other) || compareType(this.#mandatory, other.#mandatory)
  }
  test(v: Data.Value): v is T | undefined {
    return v === void 0 || this.#mandatory.includes(v)
  }
  accept<Out, P extends unknown[]>(
    type: Data.Type<T | undefined>,
    pattern: Data.TypePattern<Out, P>,
    parameters: P
  ): Out {
    return pattern.optional ? pattern.optional(type, parameters, this.#mandatory) : pattern.orelse(type, parameters)
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
