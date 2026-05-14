declare module "dixlib" {
  interface ServiceAspects {
    /**
     * If true, a datatype module specifies the type definitions of a service.
     */
    readonly typedefs?: boolean
  }
}
declare module "std.data" {
  import type Meta from "std.data.meta"
  export default Data
  /**
   * The data service provides operations to work with immutable data values.
   */
  interface Data {
    /**
     * Test whether it is a data value.
     *
     * @param it Thing to test
     * @returns True if it is a value, otherwise false
     */
    isValue(it: unknown): it is Data.Value
    /**
     * Test whether it is a data composition i.e., a list, dictionary, record or tuple.
     *
     * @param it Thing to test
     * @returns True if it is a composition, otherwise false
     */
    isComposition(it: unknown): it is Data.Composition
    /**
     * Test whether it is a data list.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a list, otherwise false
     */
    isList<T extends Data.Value = Data.Value>(it: unknown): it is Data.List<T>
    /**
     * Test whether it is a data dictionary.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a dictionary, otherwise false
     */
    isDictionary<T extends Data.Value = Data.Value>(it: unknown): it is Data.Dictionary<T>
    /**
     * Test whether it is a data record.
     *
     * The validity of type hint F, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a record, otherwise false
     */
    isRecord<F extends Data.FieldValues = Data.FieldValues>(it: unknown): it is Data.Record<F>
    /**
     * Test whether it is a data tuple.
     *
     * The validity of type hint T, if supplied, is the caller's responsibility.
     *
     * @param it Thing to test
     * @returns True if it is a tuple, otherwise false
     */
    isTuple<T extends Data.ValueSequence = Data.ValueSequence>(it: unknown): it is Data.Tuple<T>
    /**
     * Test structural equivalence.
     *
     * @param left Left value
     * @param right Right value
     * @returns True if left and right are equal values, otherwise false
     */
    equalValue<T extends Data.Value>(left: T, right: T): boolean
    /**
     * Create list value.
     *
     * @param type List type
     * @param members List members
     * @returns A list value
     * @throws If one of the list members does not obey the elementary type
     */
    list<T extends Data.Value>(type: Meta.Type<Data.List<T>>, members: T[]): Data.List<T>
    /**
     * Create dictionary value.
     *
     * @param type Dictionary type
     * @param members Dictionary members
     * @returns A dictionary value
     * @throws If one of the dictionary members does not obey the elementary type
     */
    dictionary<T extends Data.Value>(type: Meta.Type<Data.Dictionary<T>>, members: Data.Table<T>): Data.Dictionary<T>
    /**
     * Create record value.
     *
     * @param type Record type
     * @param members Record field members
     * @returns A record value
     * @throws If one of the record field members does not obey the field type
     */
    record<F extends Data.FieldValues>(type: Meta.Type<Data.Record<F>>, members: F): Data.Record<F>
    /**
     * Create tuple value.
     *
     * @param type Tuple type
     * @param members Tuple members
     * @returns A tuple value
     * @throws If one of the tuple members does not obey the type at that position
     */
    tuple<T extends Data.ValueSequence>(type: Meta.Type<Data.Tuple<T>>, members: T): Data.Tuple<T>
  }
  namespace Data {
    /**
     * An immutable value may be undefined.
     */
    type Value = undefined | Wildcard
    /**
     * A wildcard value is defined.
     */
    type Wildcard = BasicValue | Composition
    /**
     * A basic value is a primitive boolean, number or string.
     */
    type BasicValue = boolean | number | string
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
    interface CompositeValue<Ix extends Index, T extends Value, C extends Composition, Shadow> {
      /**
       * The composite type of this value e.g., a list or dictionary type.
       */
      readonly type: Meta.Type<C>
      /**
       * The shadow exposes convenient access to the members of this composite value.
       *
       * For example, a list exposes a shadow array with member values.
       */
      readonly shadow: Shadow
      /**
       * Number of members in this composite value.
       */
      readonly size: number
      /**
       * Iterate over indices of this value.
       */
      readonly indices: IteratorObject<Ix>
      /**
       * Iterate over association pairs of this value.
       */
      readonly associations: IteratorObject<[Ix, T]>
      /**
       * Iterate over members of this value.
       */
      readonly members: IteratorObject<T>
      /**
       * Get member of this composite value.
       *
       * @param ix Index of member
       * @returns The member value at index or undefined
       */
      at(ix: Ix): T | undefined
      /**
       * Test whether this composite value has a member under given index.
       *
       * @param ix Index to test
       * @returns True if index references a member, otherwise false
       */
      has(ix: Ix): boolean
    }
    /**
     * A list is a composite value with numeric indices.
     */
    interface List<T extends Value> extends CompositeValue<number, T, List<T>, readonly T[]> {}
    /**
     * Shadow table object of a dictionary value.
     */
    type Table<T extends Value> = { readonly [ix: string]: T }
    /**
     * A dictionary is a composite value with string indices.
     */
    interface Dictionary<T extends Value> extends CompositeValue<string, T, Dictionary<T>, Table<T>> {}
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
  }
}
