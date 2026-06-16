import type Syntax from "std.syntax"

export function createLexicon<L extends Syntax.Patterns>(patterns: L): Syntax.Lexicon<Extract<keyof L, string>> {
  return new Lexicon<L>(patterns)
}

export function createParser<Root extends Syntax.Node, N extends string>({
  lexicon,
  insignificance,
  parseRoot,
}: Syntax.Language<Root, N>): Syntax.Parser<Root> {
  // convert arrays of string to more convenient sets of strings for scanners
  const ignore = new Set((insignificance?.ignore ?? []).map(name => lexicon.kind[name]))
  const gather = new Set((insignificance?.gather ?? []).map(name => lexicon.kind[name]))
  return (source: Syntax.Source) => parseRoot(new Scanner(lexicon, ignore, gather, source))
}

// ----------------------------------------------------------------------------------------------------------------- //
// utility functions for filtering and sorting literal patterns
function nonEmpty(s: string) {
  return s.length > 0
}
function onDescendingLength(left: string, right: string) {
  return right.length - left.length
}
// special token kinds
const mismatch = Symbol("invalid character")
const terminator = Symbol("source text terminator")
// lexicon matches patterns in source texts
class Lexicon<L extends Syntax.Patterns> implements Syntax.Lexicon<Extract<keyof L, string>> {
  readonly #kinds: { [Name in keyof L]: symbol }
  readonly #patterns: { [kind: symbol]: string }
  readonly #testers: { [name: string]: Syntax.PatternTester }
  constructor(lexicon: L) {
    const kinds: { [Name in keyof L]: symbol } = Object.create(null)
    const patterns: { [kind: symbol]: string } = Object.create(null)
    const testers: { [name: string]: Syntax.PatternTester } = Object.create(null)
    for (const name in lexicon) {
      // convert all pattern definitions to tester functions
      const kind = Symbol(name)
      kinds[name] = kind
      patterns[kind] = name
      const definition = lexicon[name]
      if (typeof definition === "function") {
        testers[name] = definition
      } else if (definition instanceof RegExp) {
        // use sticky and Unicode flag
        const normalized = new RegExp(definition.source, "uy")
        testers[name] = (text, start) => {
          normalized.lastIndex = start
          return normalized.exec(text) ? normalized.lastIndex : start
        }
      } else if (Array.isArray(definition)) {
        // sort distinct nonempty literal strings on descending length
        const sorted = [...new Set(definition.filter(nonEmpty))].sort(onDescendingLength)
        testers[name] = (text, start) => {
          for (const literal of sorted) {
            if (text.startsWith(literal, start)) {
              return start + literal.length
            }
          }
          return start
        }
      } else {
        throw new Error(`unknown lexicon definition for pattern "${name}"`)
      }
    }
    // make sure kinds and patterns are immutable
    this.#kinds = Object.freeze(kinds)
    this.#patterns = Object.freeze(patterns)
    this.#testers = testers
  }
  get kind() {
    return this.#kinds
  }
  get pattern() {
    return this.#patterns
  }
  *tokenize(text: string) {
    const testers = this.#testers
    const kinds = this.#kinds
    let start = 0
    matchToken: while (start < text.length) {
      for (const name in testers) {
        const tester = testers[name]
        const stop = tester(text, start)
        if (stop > start) {
          yield { kind: kinds[name], start, stop }
          start = stop
          continue matchToken
        }
      }
      // special kind for token mismatch on character
      yield { kind: mismatch, start, stop: ++start }
    }
  }
}
class Scanner<N extends string> implements Syntax.Scanner {
  readonly #lexicon: Syntax.Lexicon<N>
  readonly #source: Syntax.Source
  // even indices for line start, odd indices for line stop
  readonly #lineOffsets: number[]
  // tokens are gathered while scanner loops over significant tokens
  readonly #gathered: Syntax.Token[]
  // zero or more unconsumed tokens ahead
  readonly #ahead: Syntax.Token[]
  // loop over significant tokens
  #significant: IteratorObject<Syntax.Token>
  #peekFurther() {
    const result = this.#significant.next()
    if (result.done) {
      this.#significant = emptyIterator
      return false
    } else {
      const token = result.value
      if (token.kind === mismatch) {
        throw new Error(this.failure("token mismatch on", token))
      }
      // one more token seen ahead
      this.#ahead.push(result.value)
      return true
    }
  }
  // check token expectation
  #checkToken(expectation: Syntax.Expectation, token: Syntax.Token) {
    if (typeof expectation === "symbol") {
      if (expectation !== token.kind) {
        return false
      }
    } else {
      const { start, stop } = token
      if (stop - start !== expectation.length || !this.#source.text.startsWith(expectation, start)) {
        return false
      }
    }
    return true
  }
  constructor(lexicon: Syntax.Lexicon<N>, ignore: Set<symbol>, gather: Set<symbol>, source: Syntax.Source) {
    this.#lexicon = lexicon
    this.#source = source
    const { text } = source
    // first line starts at offset 0
    const re = /\r\n|\r|\n|\v|\f|\u2028|\u2029/g
    this.#lineOffsets = [0]
    let match = re.exec(text)
    while (match) {
      // add offsets where previous line stops and next line starts
      this.#lineOffsets.push(match.index, re.lastIndex)
      match = re.exec(text)
    }
    // last line stops at text length
    this.#lineOffsets.push(text.length)
    this.#gathered = []
    this.#ahead = []
    this.#significant = lexicon.tokenize(text).filter(token => {
      const { kind } = token
      if (ignore.has(kind)) {
        return false
      }
      if (gather.has(kind)) {
        this.#gathered.push(token)
        return false
      }
      return true
    })
  }
  get lineCount() {
    return this.#lineOffsets.length / 2
  }
  get atEnd() {
    return this.#ahead.length === 0 && !this.#peekFurther()
  }
  get lookahead() {
    if (!this.atEnd) {
      return this.#ahead[0]
    }
    const n = this.#source.text.length
    return { kind: terminator, start: n, stop: n }
  }
  get gathered() {
    return this.#gathered.values()
  }
  failure(message: string, token: Syntax.Token) {
    const { start } = token
    const { location } = this.#source
    const { line, column } = this.position(start)
    return `${location ?? "literal text"} ${line},${column}: ${message} "${this.extract(token, 15)}"`
  }
  peek(...expectations: Syntax.Expectation[]) {
    while (this.#ahead.length < expectations.length) {
      if (!this.#peekFurther()) {
        return false
      }
    }
    for (let i = 0; i < expectations.length; ++i) {
      if (!this.#checkToken(expectations[i], this.#ahead[i])) {
        return false
      }
    }
    return true
  }
  accept(expectation: Syntax.Expectation) {
    if (!this.atEnd && this.#checkToken(expectation, this.#ahead[0])) {
      return this.#ahead.shift()
    }
  }
  expect(expectation: Syntax.Expectation) {
    const token = this.accept(expectation)
    if (!token) {
      const pattern = typeof expectation === "symbol" ? this.#lexicon.pattern[expectation] : `"${expectation}"`
      throw new Error(this.failure(`${pattern} expected but found`, this.lookahead))
    }
    return token
  }
  extract({ start, stop }: Syntax.Token, max = stop - start) {
    return this.#source.text.substring(start, Math.min(start + max, stop))
  }
  position(offset: number): Syntax.Position {
    if (offset < 0 || offset > this.#source.text.length) {
      throw new Error(`invalid source text offset ${offset}`)
    }
    const offsets = this.#lineOffsets
    let bottom = 0
    let top = offsets.length / 2
    do {
      const probe = Math.floor((bottom + top) / 2)
      if (offset < offsets[2 * probe]) {
        top = probe
      } else {
        bottom = probe + 1
      }
    } while (bottom < top)
    const ix = 2 * bottom - 2
    const lineOffset = offsets[ix]
    return { line: bottom, column: Math.min(offset - lineOffset, offsets[ix + 1] - lineOffset) + 1 }
  }
  extractLine(line: number, max = Infinity): string {
    const offsets = this.#lineOffsets
    const ix = (line - 1) * 2
    if (~~ix !== ix || ix < 0 || ix >= offsets.length) {
      throw new Error(`invalid line number ${line} to extract from source`)
    }
    const start = offsets[ix]
    const stop = offsets[ix + 1]
    return this.#source.text.substring(start, Math.min(start + max, stop))
  }
}
const emptyIterator = [].values()
