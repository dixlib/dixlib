declare module "std.assert" {
  import type Data from "std.data"
  import type Fx from "std.fx"
  export default Assert
  interface Assert {
    /**
     * Obtain assertion error class.
     *
     * This class almost behaves like the normal Error constructor.
     * The only difference is that the new keyword is mandatory when creating instances.
     *
     * @returns Assertion eror class
     */
    Error(): Fx.Constructor<Error, [string | undefined, ErrorOptions | undefined]>
    /**
     * Fail with descriptive message.
     *
     * @param message Error message
     * @throws Assertion error with given message
     */
    fail(message: string): never
    /**
     * Fail with not-yet-implemented message.
     *
     * @throws Assertion error
     */
    todo(): never
    /**
     * Assert condition is false.
     *
     * @param condition Condition to test
     * @param message Optional error message
     * @throws Assertion error if condition is not false
     */
    false(condition: boolean, message?: string): void
    /**
     * Assert condition is true.
     *
     * @param condition Condition to test
     * @param message Optional error message
     * @throws Assertion error if condition is not true
     */
    true(condition: boolean, message?: string): void
    /**
     * Assert expected and actual result are strictly equal ({@link Object.is}).,
     *
     * @param expected Expected result
     * @param actual Actual result
     * @param message Optional error message
     * @throws Assertion error if expected is not the same as actual
     */
    equal(expected: unknown, actual: unknown, message?: string): void
    /**
     * Assert expected and actual array to have strictly equal ({@link Object.is}) content.
     *
     * @param expected Expected array
     * @param actual Actual array
     * @param message Optional error message
     * @throws Assertion error if expected content in array is not the same as actual content
     */
    equalArray(expected: unknown[], actual: unknown[], message?: string): void
    /**
     * Assert expected and actual data value are equivalent.
     *
     * @param expected Expected data value
     * @param actual Actual data value
     * @param message Optional error message
     * @throws Assertion error is expected value is not equal to actual value
     */
    equivalent(expected: Data.Value, actual: Data.Value, message?: string): void
  }
}
