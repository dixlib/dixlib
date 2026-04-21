import type System from "std.system"
import type Theater from "std.theater"
import { news, theater } from "../extern.js"
import { root } from "./root.js"

export class QuestionerRole
  extends theater.Role<System.Questioner>()(Object)
  implements Theater.Script<System.Questioner>
{
  readonly #correlatedResolutions: { [correlation: number]: (result: unknown) => void }
  #nextCorrelation: number
  constructor() {
    super()
    this.#correlatedResolutions = Object.create(null)
    this.#nextCorrelation = 1
  }
  @theater.Play *ask<A extends Theater.Actor, Result>(
    actorRef: Theater.ActorRef<A>,
    question: (actor: A) => Theater.OneWay,
    resolve: (result: Result) => void
  ): Theater.Scene {
    const correlation = this.#nextCorrelation++
    this.#correlatedResolutions[correlation] = resolve as (result: unknown) => void
    question(actorRef({ sender: this.self, correlation }))
  }
  @theater.Play *return<Result>(result: Result): Theater.Scene {
    const { correlation } = this.messageContext()
    if (!correlation) {
      // correlation must be defined and nonzero
      news.warn("return with invalid correlation (%s)", correlation)
    } else if (!this.#correlatedResolutions[correlation]) {
      // unknown correlation does not identify a resolver
      news.warn("return with unknown correlation (%d)", correlation)
    } else {
      // remove correlation upon resolution
      const resolve = this.#correlatedResolutions[correlation] as (result: Result) => void
      delete this.#correlatedResolutions[correlation]
      // resolve with result
      resolve(result)
    }
  }
}

export function ask<A extends Theater.Actor, Result>(
  actorRef: Theater.ActorRef<A>,
  question: (actor: A) => Theater.OneWay
): Promise<Result> {
  const { promise, resolve } = Promise.withResolvers<Result>()
  const questionerRef = root().lookup("questioner") as Theater.ActorRef<System.Questioner>
  questionerRef().ask(actorRef, question, resolve)
  return promise
}
