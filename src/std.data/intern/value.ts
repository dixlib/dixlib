// --- TypeScript ---
import type Data from 'std.data'
// --- JavaScript ---
import { loop } from "../extern.js"

export function isValue(it: unknown): it is Data.Value {
  switch (typeof it) {
    case "boolean": case "string": case "undefined": return true
    case "number": return Number.isFinite(it)
    case "object": return it instanceof CompositeValue
    default: return false
  }
}

export function isComposition(it: unknown): it is Data.Composition {
  return it instanceof CompositeValue
}

export function isList<T extends Data.Value = Data.Value>(it: unknown): it is Data.List<T> {
  return it instanceof ListValue
}

export function isDictionary<T extends Data.Value = Data.Value>(it: unknown): it is Data.Dictionary<T> {
  return it instanceof DictionaryValue
}

export function isRecord<F extends Data.FieldValues = Data.FieldValues>(it: unknown): it is Data.Record<F> {
  return it instanceof RecordValue
}

export function isTuple<T extends Data.ValueSequence = Data.ValueSequence>(it: unknown): it is Data.Tuple<T> {
  return it instanceof TupleValue
}

export function equals<T extends Data.Value>(left: T, right: T): boolean {
  if (left === right) {
    // identical values are equal values
    return true
  }
  switch (typeof left) {
    case "string": case "boolean": case "number": case "undefined":
      // primitive values are equal iff identical
      return false
  }
  if (right instanceof CompositeValue && left.constructor === right.constructor && left.size === right.size) {
    // left and right are similar compositions i.e., two lists, two dictionaries, two records or two tuples
    for (const ix of left.indices) {
      if (typeof ix === "string" && !right.has(ix) || !equals((left as CompositeValue<Data.Index, Data.Value, Data.Composition, {}>).at(ix), right.at(ix))) {
        return false
      }
    }
    // all members of left and right are equal, hence left and right are equal
    return true
  }
  return false
}

export function list<T extends Data.Value>(type: Data.Type<Data.List<T>>, members: T[]): Data.List<T> {
  const shadow = new Array(members.length), elementary = type.match(listElementType)
  for (let i = 0; i < members.length; ++i) {
    const member = members[i]
    if (!elementary.includes(member)) {
      throw new Error(`invalid list element at ${i + 1}`)
    }
    shadow[i] = member
  }
  Object.freeze(shadow)
  return new ListValue(type, shadow)
}

export function dictionary<T extends Data.Value>(type: Data.Type<Data.Dictionary<T>>,
  members: Data.Table<T>
): Data.Dictionary<T> {
  const shadow: Data.Table<T> = Object.create(null), descriptor: PropertyDescriptor = { enumerable: true, value: void 0 }
  const elementary = type.match(dictionaryElementType)
  let n = 0
  for (const key in members) {
    const member = descriptor.value = members[key]
    if (!elementary.includes(member)) {
      throw new Error(`invalid dictionary element at "${key}"`)
    }
    Reflect.defineProperty(shadow, key, descriptor)
    ++n
  }
  Object.preventExtensions(shadow)
  return new DictionaryValue(type, shadow, n)
}

export function record<F extends Data.FieldValues>(type: Data.Type<Data.Record<F>>, members: F): Data.Record<F> {
  const shadow = Object.create(null), descriptor: PropertyDescriptor = { enumerable: true, value: void 0 }
  const fieldTypes = type.match(recordFieldTypes)
  let n = 0
  for (const selector in fieldTypes) {
    const member = descriptor.value = members[selector]
    if (!fieldTypes[selector].includes(member)) {
      throw new Error(`invalid record member at "${selector}"`)
    }
    Reflect.defineProperty(shadow, selector, descriptor)
    ++n
  }
  Object.preventExtensions(shadow)
  return new RecordValue(type, shadow, n)
}

export function tuple<T extends Data.ValueSequence>(type: Data.Type<Data.Tuple<T>>, members: T): Data.Tuple<T> {
  const shadow = new Array(members.length) as T, types = type.match(tupleTypes)
  if (types.length !== members.length) {
    throw new Error(`arity mismatch: tuple expected ${types.length} members, but got ${members.length}`)
  }
  for (let i = 0; i < members.length; ++i) {
    const member = members[i]
    if (!types[i].includes(member)) {
      throw new Error(`invalid tuple element at ${i + 1}`)
    }
    shadow[i] = member
  }
  Object.freeze(shadow)
  return new TupleValue(type, shadow)
}

// ----------------------------------------------------------------------------------------------------------------- //
abstract class CompositeValue<Ix extends Data.Index, T extends Data.Value, C extends Data.Composition, S>
  implements Data.CompositeValue<Ix, T, C, S> {
  readonly #type: Data.Type<C>
  readonly #shadow: S
  constructor(type: Data.Type<C>, shadow: S) {
    this.#type = type
    this.#shadow = shadow
  }
  public get type(): Data.Type<C> { return this.#type }
  public get shadow(): S { return this.#shadow }
  public abstract get size(): number
  public abstract get indices(): IterableIterator<Ix>
  public abstract get entries(): IterableIterator<[Ix, T]>
  public abstract get members(): IterableIterator<T>
  public abstract at(ix: Ix): T | undefined
  public abstract has(ix: Ix): boolean
}
class ListValue<T extends Data.Value> extends CompositeValue<number, T, Data.List<T>, T[]> {
  public get size() { return this.shadow.length }
  public get indices() { return loop.count(1, this.size) }
  public get entries() { return loop.zip(this.indices, this.members) }
  public get members() { return loop.over(this.shadow) }
  public at(ix: number) {
    if (ix !== 0) {
      return this.shadow.at(ix < 0 ? ix : ix - 1)
    }
  }
  public has(ix: number) { return ix === ~~ix && ix !== 0 && Math.abs(ix) <= this.size }
}
const listElementType: Data.TypePattern<Data.Type<Data.Value>, []> = {
  list(_type, _p, elementary) { return elementary }, orelse() { throw new Error("expected a list type") }
}
class DictionaryValue<T extends Data.Value> extends CompositeValue<string, T, Data.Dictionary<T>, Data.Table<T>> {
  readonly #size: number
  constructor(type: Data.Type<Data.Dictionary<T>>, shadow: Data.Table<T>, size: number) {
    super(type, shadow)
    this.#size = size
  }
  public get size() { return this.#size }
  public get indices() { return loop.keys(this.shadow) }
  public get entries() { return loop.entries(this.shadow) as IterableIterator<[string, T]> }
  public get members() { return loop.values(this.shadow) as IterableIterator<T> }
  public at(ix: string) { return this.shadow[ix] }
  public has(ix: string) { return ix in this.shadow }
}
const dictionaryElementType: Data.TypePattern<Data.Type<Data.Value>, []> = {
  dictionary(_type, _p, elementary) { return elementary }, orelse() { throw new Error("expected a dictionary type") }
}
class RecordValue<F extends Data.FieldValues> extends CompositeValue<string, F[keyof F], Data.Record<F>, F> {
  readonly #size: number
  constructor(type: Data.Type<Data.Record<F>>, shadow: F, size: number) {
    super(type, shadow)
    this.#size = size
  }
  public get size() { return this.#size }
  public get indices() { return loop.keys(this.shadow) }
  public get entries() { return loop.entries(this.shadow) as IterableIterator<[string, F[keyof F]]> }
  public get members() { return loop.values(this.shadow) as IterableIterator<F[keyof F]> }
  public at(ix: keyof F) { return this.shadow[ix] }
  public has(ix: string) { return ix in this.shadow }
}
const recordFieldTypes: Data.TypePattern<Data.FieldTypesOf<Data.FieldValues>, []> = {
  record(_type, _p, fieldTypes) { return fieldTypes }, orelse() { throw new Error("expected a record type") }
}
class TupleValue<T extends Data.ValueSequence> extends CompositeValue<number, T[number], Data.Tuple<T>, T> {
  public get size() { return this.shadow.length }
  public get indices() { return loop.count(1, this.size) }
  public get entries() { return loop.zip(this.indices, this.members) }
  public get members() { return loop.over(this.shadow) }
  public at(ix: number) {
    if (ix !== 0) {
      return this.shadow.at(ix < 0 ? ix : ix - 1)
    }
  }
  public has(ix: number) { return ix === ~~ix && ix !== 0 && Math.abs(ix) <= this.size }
}
const tupleTypes: Data.TypePattern<Data.Type<Data.Value>[], []> = {
  tuple(_type, _p, types) { return types as Data.Type<Data.Value>[] },
  orelse() { throw new Error("expected a tuple type") },
}
