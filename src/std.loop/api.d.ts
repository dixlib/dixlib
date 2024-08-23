declare module 'std.loop' {
  export default Loop
  /**
   * The operations of the loop service deal with iterators, iterables and iterable iterators.
   */
  interface Loop {
    /**
     * Is it an iterable object?
     * @param it Thing to test
     * @returns True if it is an iterable object, otherwise false
     */
    isIterable<T>(it: unknown): it is Iterable<T>
    /**
     * Is it an iterator with a next method?
     * This may return false positives, because next is a common method name!
     * @param it Thing to test
     * @returns True if it is an iterator (or at least an object with a next method), otherwise false
     */
    isIterator<T>(it: unknown): it is Iterator<T>
    /**
     * Is it an iterable iterator?
     * @param it Thing to test
     * @returns True if it is an iterable iterator, otherwise false
     */
    isIterableIterator<T>(it: unknown): it is IterableIterator<T>
    /**
     * Loop over elements.
     * The loop is empty if the elements are missing.
     * @param elements Iterator over elements and/or iterable elements
     * @returns An iterable iterator over elements
     */
    over<T>(elements?: Iterator<T> | Iterable<T>): IterableIterator<T>
    /**
     * Loop over property keys of a for-in loop.
     * @param o Object with enumerable properties
     * @returns An iterable iterator over property keys
     */
    keys(o: object): IterableIterator<string>
    /**
     * Loop over property key and value pairs of a for-in loop.
     * @param o Object with enumerable properties
     * @returns An iterable iterator over property key and value pairs
     */
    entries(o: object): IterableIterator<[string, unknown]>
    /**
     * Loop over property values of a for-in loop.
     * @param o Object with enumerable properties
     * @returns An iterable iterator over property values
     */
    values(o: object): IterableIterator<unknown>
    /**
     * Loop over numbers of a numeric for loop.
     * @param from Initial number
     * @param to Inclusive bound
     * @param step Optional step (default is 1)
     * @returns An iterable iterator over numbers
     */
    count(from: number, to: number, step?: number): IterableIterator<number>
    /**
     * Filter elements of iterator.
     * @param iter Iterator over elements
     * @param test Closure that tests whether an iterated element passes the filter
     * @param rcvr Optional receiver to bind in predicate applications
     * @returns An iterable iterator over filtered elements
     */
    filter<T, This>(iter: Iterator<T>, test: Loop.Test<T, This>, rcvr?: This): IterableIterator<T>
    /**
     * Convert elements of iterator.
     * @param iter Iterator over elements
     * @param conv Closure that computes converted element
     * @param rcvr Optional receiver to bind in conversion applications
     * @returns An iterable iterator over converted elements
     */
    map<T, U, This>(iter: Iterator<T>, conv: Loop.Convert<T, U, This>, rcvr?: This): IterableIterator<U>
    /**
     * Zip pairs of left and right iterator.
     * Zipping stops when either the left or right iterator is exhausted.
     * @param leftIter Left iterator
     * @param rightIter Right iterator
     * @returns An iterable iterator over left and right pairs
     */
    zip<T, U>(leftIter: Iterator<T>, rightIter: Iterator<U>): IterableIterator<[T, U]>
    /**
     * Reduce elements of iterator.
     * @param iter Iterator over elements
     * @param fold Closure that folds accumulator and an element into next accumulator
     * @param accu Initial accumulator
     * @param rcvr Optional receiver to bind in fold applications
     * @returns Last fold result or initial accumulator
     */
    reduce<T, U, This>(iter: Iterator<T>, fold: Loop.Fold<T, U, This>, accu: U, rcvr?: This): U
    /**
     * Take elements from iterator.
     * @param iter Iterator over elements
     * @param n Maximum number of elements to take
     * @param accu Optional accumulator where elements should be collected
     * @returns Collected elements
     */
    take<T>(iter: Iterator<T>, n: number, accu?: T[]): T[]
    /**
     * Drop elements from iterator.
     * @param iter Iterator over elements
     * @param n Maximum number of elements to drop
     */
    drop<T>(iter: Iterator<T>, n: number): void
  }
  namespace Loop {
    /**
     * Test predicate on iterated element.
     */
    type Test<T, This> = (this: This, it: T) => boolean
    /**
     * Convert iterated element.
     */
    type Convert<T, U, This> = (this: This, it: T) => U
    /**
     * Fold previous accumulator and iterated element into next accumulator.
     */
    type Fold<T, U, This> = (this: This, accu: U, it: T) => U
  }
}
