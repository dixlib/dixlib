declare module 'std.syntax' {
  export default Syntax
  /**
   * The syntax service provides basic support for simple parsers.
   */
  interface Syntax {
    /**
     * Create a lexicon that splits an input text into tokens.
     * @param patterns Pattern definitions
     * @returns A lexicon
     */
    createLexicon<L extends Syntax.Patterns>(patterns: L): Syntax.Lexicon<keyof L & string>
    /**
     * Create a parser for given language.
     * @param language Language specification
     * @returns A parser for the language
     */
    createParser<Root extends Syntax.Node, N extends string>(language: Syntax.Language<Root, N>): Syntax.Parser<Root>
  }
  namespace Syntax {
    /**
     * A source object.
     */
    interface Source {
      /**
       * The source text.
       */
      readonly text: string
      /**
       * The source location, if any.
       */
      readonly location?: string
    }
    /**
     * A node in a syntax tree.
     */
    interface Node {
      /**
       * A symbolic kind is reserved for input tokens i.e., leaves in a concrete syntax tree.
       * Otherwise the kind identifies the internal node type.
       */
      readonly kind: string | symbol
    }
    /**
     * A token is a leaf in a concrete syntax tree.
     */
    interface Token extends Node { 
      readonly kind: symbol
      /**
       * Offset where token starts in source text.
       */
      readonly start: number
      /**
       * Offset where token stops in source text i.e., where the next token starts.
       */
      readonly stop: number
    }
    /**
     * Pattern definitions for a lexicon. Order is important in case of overlap!
     */
    type Patterns = { readonly [name: string]: PatternTester | RegExp | string[] }
    /**
     * A functional pattern tester.
     */
    interface PatternTester {
      /**
       * Try to match this pattern in text at given offset.
       * @param input Input text
       * @param start Offset to start matching
       * @returns Stop offset after match
       */
      (input: string, start: number): number
    }
    /**
     * A lexicon splits a text into tokens.
     */
    interface Lexicon<N extends string> {
      /**
       * Map pattern names to symbolic kinds.
       */
      readonly kind: { readonly [Name in N]: symbol }
      /**
       * Map token kinds to pattern names.
       */
      readonly pattern: { readonly [kind: symbol]: string }
      /**
       * Split a text into tokens that cover the whole text.
       * @param text A text
       * @returns An iterable iterator over tokens
       */
      tokenize(text: string): IterableIterator<Token>
    }
    /**
     * A scanner expects symbolic token kinds or literal nonempty strings.
     */
    type Expectation = symbol | string
    /**
     * Line and column position in source text.
     */
    type Position = { readonly line: number, readonly column: number }
    /**
     * A scanner assists a parser by consuming a source text, token by token.
     * It buffers zero or more tokens ahead that have not been consumed.
     */
    interface Scanner {
      /**
       * The number of source lines.
       */
      readonly lineCount: number
      /**
       * This scanner is at its end when all significant tokens have been consumed.
       */
      readonly atEnd: boolean
      /**
       * The lookahead is the first unconsumed token.
       * If this scanner is at its end, it returns an empty terminator token.
       */
      readonly lookahead: Token
      /**
       * Gathered insignificant tokens.
       */
      readonly gathered: IterableIterator<Token>
      /**
       * Create an error with token information.
       * @param message Error message
       * @param token Problematic token
       * @returns An error
       */
      failure(message: string, token: Token): Error
      /**
       * Peek ahead and check expectations.
       * @param expectations Scanner expectations
       * @returns True if tokens ahead match the expectations, otherwise false
       */
      peek(...expectations: Expectation[]): boolean
      /**
       * Consume next token ahead if it matches the expectation.
       * @param expectation Expectation to test
       * @returns A token if expectation holds, otherwise undefined
       */
      accept(expectation: Expectation): Token | undefined
      /**
      * Consume next token ahead that must match the expectation.
      * @param expectation Expectation to verify
      * @returns The matched token
      * @throws When this scanner is at its end
      * @throws When the expectation does not hold
      */
      expect(expectation: Expectation): Token
      /**
       * Extract text of token from source. 
       * @param token Token to extract
       * @param max Optional maximum length of extraction
       * @returns A string
       */
      extract(token: Token, max?: number): string
      /**
       * Determine line position of offset in text.
       * @param offset Offset in text e.g. start or stop offset of token
       * @returns A position with line and column info
       */
      position(offset: number): Position
      /**
       * Extract text of line from source.
       * @param line Line number
       * @param max Optional maximum length of extraction
       * @returns A string
       */
      extractLine(line: number, max?: number): string
    }
    /**
     * A parser turns a source into a syntax tree.
     */
    type Parser<Root extends Node> = (s: Source) => ParseResult<Root>
    /**
     * A (simple) parser is created for some language.
     */
    interface Language<Root extends Node, N extends string> {
      /**
       * Lexicon with token patterns.
       */
      readonly lexicon: Lexicon<N>
      /**
       * Token insignificance.
       * The scanner does not pass insignificant tokens to the parser.
       */
      readonly insignificance?: {
        /**
         * Pattern names of tokens to ignore completely.
         */
        ignore?: N[]
        /**
         * Pattern names of tokens to gather while scanning the source.
         */
        gather?: N[]
      }
      /**
       * Parse source with the given scanner.
       * @param scanner Scanner on the source object
       * @returns A parse result with root node and gathered tokens
       */
      parseRoot(scanner: Scanner): ParseResult<Root>
    }
    /**
     * Result after parsing.
     */
    type ParseResult<Root extends Node> = {
      /**
       * Root node of result, possibly with warnings.
       */
      readonly root: Root
      /**
       * Tokens gathered while parsing.
       */
      readonly gathered: Token[]
      /**
       * Semantic warnings.
       */
      readonly warnings: string[]
    }
  }
}
