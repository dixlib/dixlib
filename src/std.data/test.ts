import type Data from "std.data"
import type Quality from "std.quality"

export default ({ assert, provider }: Quality.ServiceUnderTest<"std.data">): Quality.ServiceTest<"std.data"> => {
  let space: Data.Space
  let anyListType: Data.Type<Data.List<Data.Value>>
  let emptyList: Data.List<Data.Value>
  let nonemptyList: Data.List<Data.Value>
  let anyDictionaryType: Data.Type<Data.Dictionary<Data.Value>>
  let emptyDictionary: Data.Dictionary<Data.Value>
  let nonemptyDictionary: Data.Dictionary<Data.Value>
  let emptyRecordType: Data.Type<Data.Record<Data.FieldValues>>
  let emptyRecord: Data.Record<Data.FieldValues>
  let anyTupleType: Data.Type<Data.Tuple<[Data.Value, Data.Value]>>
  let anyTuple: Data.Tuple<Data.ValueSequence>
  return [
    // no hooks
    {
      async prepare() {
        space = await provider.inflate("std.data")
        anyListType = space.evaluate("Data.List")
        emptyList = provider.list(anyListType, [])
        nonemptyList = provider.list(anyListType, [42])
        anyDictionaryType = space.evaluate("Data.Dictionary")
        emptyDictionary = provider.dictionary(anyDictionaryType, {})
        nonemptyDictionary = provider.dictionary(anyDictionaryType, { foo: 42 })
        emptyRecordType = space.evaluate("Data.Spread")
        emptyRecord = provider.record(emptyRecordType, {})
        anyTupleType = space.evaluate("Data.Pair")
        anyTuple = provider.tuple(anyTupleType, [42, void 0])
      },
    },
    // test cases
    {
      isValue() {
        assert.true(provider.isValue(void 0), "isValue with undefined should return true ")
        assert.false(provider.isValue(null), "isValue with null should return false")
        assert.true(provider.isValue(true), "isValue with true should return true")
        assert.true(provider.isValue(false), "isValue with false should return true")
        assert.true(provider.isValue(0), "isValue with 0 should return true")
        assert.true(provider.isValue(1), "isValue with 1 should return true")
        assert.true(provider.isValue(1_000), "isValue with 1000 should return true")
        assert.true(provider.isValue(-1_000), "isValue with -1000 should return true")
        assert.true(provider.isValue(3.14), "isValue with 3.14 should return true")
        assert.false(provider.isValue(NaN), "isValue with NaN should return false")
        assert.false(provider.isValue(Infinity), "isValue with Infinity should return false")
        assert.false(provider.isValue(-Infinity), "isValue with -Infinity should return false")
        assert.false(provider.isValue(42n), "isValue with big integer should return false")
        assert.false(provider.isValue(Symbol()), "isValue with symbol should return false")
        assert.false(provider.isValue({}), "isValue with object should return false")
        assert.false(provider.isValue([]), "isValue with array should return false")
        assert.true(provider.isValue(emptyList), "isValue with empty list should return true")
        assert.true(provider.isValue(nonemptyList), "isValue with nonempty list should return true")
        assert.true(provider.isValue(emptyDictionary), "isValue with empty dictionary should return true")
        assert.true(provider.isValue(nonemptyDictionary), "isValue with nonempty dictionary should return true")
        assert.true(provider.isValue(emptyRecord), "isValue with empty record should return true")
        assert.true(provider.isValue(anyTuple), "isValue with tuple should return true")
      },
      isComposition() {
        // assert
      },
      isList() {
        // assert
      },
      isDictionary() {
        // assert
      },
      isRecord() {
        // assert
      },
      isTuple() {
        // assert
      },
      isType() {
        // assert
      },
      isTypeExpression() {
        // assert
      },
      equalValue() {
        // assert
      },
      equalType() {
        // assert
      },
      list() {
        // assert
      },
      dictionary() {
        // assert
      },
      record() {
        // assert
      },
      tuple() {
        // assert
      },
      typeOf() {
        // assert
      },
      inflate() {
        // assert
      },
      parseTypeExpression() {
        // assert
      },
      substituteTypeExpressions() {
        // assert
      },
      createFormatJSON() {
        // assert
      },
    },
  ]
}
