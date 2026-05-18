import type Quality from "std.quality"

export default ({ assert, provider }: Quality.ServiceUnderTest<"std.fn">): Quality.ServiceTest<"std.fn"> => [
  // no hooks
  {},
  // test cases
  {
    isGeneratorFunction() {
      function* generator() {}
      function regular() {}
      assert.true(
        provider.isGeneratorFunction(generator),
        "isGeneratorFunction with generator function should return true"
      )
      assert.false(
        provider.isGeneratorFunction(regular),
        "isGeneratorFunction with regular function should return false"
      )
      assert.false(provider.isGeneratorFunction(void 0), "isGeneratorFunction with undefined should return false")
      assert.false(provider.isGeneratorFunction({}), "isGeneratorFunction with empty object should return false")
      assert.false(provider.isGeneratorFunction(null), "isGeneratorFunction with null should return false")
      assert.false(provider.isGeneratorFunction(42), "isGeneratorFunction with 42 should return false")
      assert.false(provider.isGeneratorFunction(false), "isGeneratorFunction with false should return false")
      assert.false(provider.isGeneratorFunction("ab"), "isGeneratorFunction with a string should return false")
    },
    isInt32() {
      assert.true(provider.isInt32(0), "isInt32 with 0 should return true")
      assert.true(provider.isInt32(1), "isInt32 with 1 should return true")
      assert.true(provider.isInt32(-1), "isInt32 with -1 should return true")
      assert.true(provider.isInt32(2 ** 31 - 1), "isInt32 with 2^31-1 should return true")
      assert.false(provider.isInt32(2 ** 31), "isInt32 with 2^31 should return false")
      assert.false(provider.isInt32(2 ** 31 + 1), "isInt32 with 2^31+1 should return false")
      assert.true(provider.isInt32(-1), "isInt32 with -1 should return true")
      assert.true(provider.isInt32(-(2 ** 31) + 1), "isInt32 with -2^31+1 should return true")
      assert.true(provider.isInt32(-(2 ** 31)), "isInt32 with -2^31 should return true")
      assert.false(provider.isInt32(-(2 ** 31) - 1), "isInt32 with -2^31-1 should return false")
      assert.false(provider.isInt32(0.1), "isInt32 with 0.1 should return false")
      assert.false(provider.isInt32(41.99), "isInt32 with 41.99 should return false")
      assert.false(provider.isInt32(void 0), "isInt32 with undefined should return false")
      assert.false(provider.isInt32({}), "isInt32 with empty object should return false")
      assert.false(provider.isInt32(null), "isInt32 with null should return false")
      assert.false(provider.isInt32(false), "isInt32 with false should return false")
      assert.false(provider.isInt32("ab"), "isInt32 with a string should return false")
    },
    iterateKeys() {
      assert.deepEqual([], [...provider.iterateKeys({})], "iterateKeys with empty object should return empty iterator")
      assert.deepEqual(
        ["a", "b", "c"],
        [...provider.iterateKeys({ a: 42, b: 54, c: 68 })],
        "iterateKeys should preserve key order"
      )
      assert.deepEqual(
        ["b", "a", "c"],
        [...provider.iterateKeys({ b: 42, a: 54, c: 68 })],
        "iterateKeys should preserve key order"
      )
      assert.deepEqual(
        ["c", "a", "b"],
        [...provider.iterateKeys({ c: 42, a: 54, b: 68 })],
        "iterateKeys should preserve key order"
      )
    },
    iterateValues() {
      assert.deepEqual(
        [],
        [...provider.iterateValues({})],
        "iterateValues with empty object should return empty iterator"
      )
      assert.deepEqual(
        [42, 54, 68],
        [...provider.iterateValues({ a: 42, b: 54, c: 68 })],
        "iterateValues should preserve key order"
      )
      assert.deepEqual(
        [54, 42, 68],
        [...provider.iterateValues({ a: 54, b: 42, c: 68 })],
        "iterateValues should preserve key order"
      )
      assert.deepEqual(
        [68, 42, 54],
        [...provider.iterateValues({ a: 68, b: 42, c: 54 })],
        "iterateValues should preserve key order"
      )
    },
    iterateEntries() {
      assert.deepEqual(
        [],
        [...provider.iterateEntries({})],
        "iterateEntries with empty object should return empty iterator"
      )
      assert.deepEqual(
        [
          ["a", 42],
          ["b", 54],
          ["c", 68],
        ],
        [...provider.iterateEntries({ a: 42, b: 54, c: 68 })],
        "iterateEntries should preserve key order"
      )
      assert.deepEqual(
        [
          ["b", 42],
          ["a", 54],
          ["c", 68],
        ],
        [...provider.iterateEntries({ b: 42, a: 54, c: 68 })],
        "iterateEntries should preserve key order"
      )
      assert.deepEqual(
        [
          ["c", 42],
          ["a", 54],
          ["b", 68],
        ],
        [...provider.iterateEntries({ c: 42, a: 54, b: 68 })],
        "iterateEntries should preserve key order"
      )
    },
    returnThis() {
      // make sure to use unbound returnThis; otherwise it's bound to std.fn provider at call site
      const { returnThis: unbound } = provider
      assert.equal(void 0, unbound(), "unbound returnThis should return undefined")
      assert.equal(void 0, provider.returnThis.bind(void 0)(), "returnThis bound to undefined should return undefined")
      assert.equal(null, provider.returnThis.bind(null)(), "returnThis bound to null should return null")
      assert.equal("ab", provider.returnThis.bind("ab")(), "returnThis bound to a string should return that string")
      assert.equal(42, provider.returnThis.bind(42)(), "returnThis bound to 42 should return 42")
      assert.equal(false, provider.returnThis.bind(false)(), "returnThis bound to false should return false")
      const obj = {}
      assert.equal(obj, provider.returnThis.bind(obj)(), "returnThis bound to an object should return that object")
    },
    returnIt() {
      assert.equal(void 0, provider.returnIt(void 0), "returnIt with undefined should return undefined")
      assert.equal(null, provider.returnIt(null), "returnIt with null should return null")
      assert.equal("ab", provider.returnIt("ab"), "returnIt with a string should return that string")
      assert.equal(42, provider.returnIt(42), "returnIt with 42 should return 42")
      assert.equal(false, provider.returnIt(false), "returnIt with false should return false")
      const obj = {}
      assert.equal(obj, provider.returnIt(obj), "returnIt with an object should return that object")
    },
    returnTuple() {
      assert.deepEqual([], provider.returnTuple(), "returnTuple without argument should return empty array")
    },
    returnNothing() {
      assert.equal(void 0, provider.returnNothing(), "returnNothing should return undefined")
    },
    returnFalse() {
      assert.equal(false, provider.returnFalse(), "returnFalse should return false")
    },
    returnTrue() {
      assert.equal(true, provider.returnTrue(), "returnTrue should return true")
    },
  },
]
