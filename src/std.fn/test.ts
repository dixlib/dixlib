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
        "isGeneratorFunction should return true with generator function"
      )
      assert.false(
        provider.isGeneratorFunction(regular),
        "isGeneratorFunction should return false with regular function"
      )
      assert.false(
        provider.isGeneratorFunction(void 0),
        "isGeneratorFunction should return false with undefined argument"
      )
      assert.false(provider.isGeneratorFunction(null), "isGeneratorFunction should return false with null argument")
    },
    isInt32() {
      assert.todo()
    },
    iterateKeys() {
      const obj = {}
      assert.equalArray(
        [],
        [...provider.iterateKeys(obj)],
        "iterateKeys with empty object should return empty iterator"
      )
    },
    iterateValues() {
      assert.todo()
    },
    iterateEntries() {
      assert.todo()
    },
    returnThis() {
      assert.equal(void 0, provider.returnThis(), "unbound returnThis should return undefined")
      assert.equal(null, provider.returnThis.bind(null)(), "returnThis bound to null should return null")
      assert.equal("ab", provider.returnThis.bind("ab")(), "returnThis bound to a string should return that string")
      assert.equal(42, provider.returnThis.bind(42)(), "returnThis bound to 42 should return 42")
      const obj = {}
      assert.equal(obj, provider.returnThis.bind(obj)(), "returnThis bound to an object should return that object")
    },
    returnIt() {
      assert.equal(void 0, provider.returnIt(void 0), "returnIt with undefined should return undefined")
      assert.equal(null, provider.returnIt(null), "returnIt with null should return null")
      assert.equal("ab", provider.returnIt("ab"), "returnIt with a string should return that string")
      assert.equal(42, provider.returnIt(42), "returnIt with 42 should return 42")
      const obj = {}
      assert.equal(obj, provider.returnIt(obj), "returnIt with an object should return that object")
    },
    returnTuple() {
      assert.todo()
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
