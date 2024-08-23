// --- TypeScript ---
import type Future from 'std.future'
import type Theater from 'std.theater'
import type { Agent } from "./agent.ts"
type Actor = Theater.Actor
type Selector = string | symbol | ((...p: any[]) => Theater.Scene<unknown>)
// --- JavaScript ---
import { future, fx } from "../extern.js"
import { Destiny } from "./lifecycle.js"
import { isShowing, negotiate, performSolo, showing } from "./stage.js"

export function isEscalation<A extends Actor>(it: unknown): it is Theater.Escalation<A> {
  return it instanceof Escalation
}

export function isJob<T>(it: unknown): it is Theater.Job<T> {
  return facade.isHandling(it)
}

export function isInert(job: Theater.Job<unknown>) {
  return facade.expose(job).isInert
}

export function surprise<T>(job: Theater.Job<T>): T {
  if (isShowing()) {
    throw new Error("theater must be closed when surprising")
  }
  const gig = facade.expose(job)
  if (!gig.isInert) {
    throw new Error("surprising job must be inert")
  }
  if (gig.agent.isSuspended) {
    throw new Error("surprising actor must be employable")
  }
  performSolo(gig)
  const { fate } = gig
  if (fate) {
    if (fate.blooper) {
      throw fate.blooper
    } else {
      return fate.prompt as T
    }
  } else {
    gig.stop("end of surprise")
    throw new Error("surprise job must finish in one stage performance")
  }
}

export function* when<T>(hint: Future.Hint<T>): Theater.Scene<T> {
  const { blooper, prompt }: Future.Signal<T> = yield hint
  if (blooper) {
    const { agent, selector, parameters } = showing()
    // escalate incident in context of performing actor
    throw new Escalation({
      offender: agent.actor,
      blooper,
      selector: typeof selector === "function" ? selector.name : selector,
      parameters: parameters,
    })
  } else {
    return prompt!
  }
}

export function swallowPoison(): never {
  throw poisonPill
}

export class Gig extends Destiny {
  // job handle
  readonly #job: Theater.Job<unknown>
  // agent that works on this job
  #agent?: Agent
  // scene method or scenic code
  #selector?: Selector
  // scene parameters
  #parameters?: unknown[]
  // coroutine of scene
  #scene?: Theater.Scene<unknown>
  // signal from hint of previous stage performance
  #progress?: Future.Signal<unknown>
  // if defined, a rollback cancels side effects of the hint
  #rollback?: Future.Rollback
  // controller cue sets this gig in motion
  #controller?: Future.Cue<unknown>
  // lazy promise
  #promise?: Promise<unknown>
  #repost() {
    this.agent.post(this)
  }
  #manageBlooper(blooper: Error) {
    const { agent, selector, parameters } = this, { manager } = agent
    // complete this gig with blooper
    this.finish({ blooper })
    const incident = {
      offender: agent.actor,
      blooper,
      selector: typeof selector === "function" ? selector.name : selector,
      parameters: parameters,
    }
    // let manager decide what should happen with agent after stage incident
    const verdict = manager.superviseIncident(incident)
    if (verdict === "forgive") {
      // leave agent intact and available for work on other jobs
      negotiate(agent)
    } else {
      // suspend offender and its descendant actors
      agent.suspend()
      if (verdict === "punish") {
        // manager buries the offender
        new Gig(manager, buryMember, [agent]).#repost()
      } else if (verdict === "escalate") {
        // manager buries the offender, and escalates incident in supervision hierarchy
        new Gig(manager, escalateIncident, [agent, incident]).#repost()
      } else if (verdict.recast) {
        // manager resumes offender with a fresh role (all descendants of offender are killed!)
        new Gig(manager, resumeMember, [agent, verdict.recast]).#repost()
      } else {
        throw new Error("invalid verdict")
      }
    }
  }
  #done(message: string) {
    if (this.fate) {
      throw new Error(`${message} after fate has been sealed`)
    }
  }
  protected begin(reveal: Future.Reveal<unknown>, unique: Future.Cue<unknown>) {
    super.begin(reveal, unique)
    if (this.isInert) {
      // controller sets inert gig in motion
      this.#controller = unique
      this.#repost()
    }
  }
  protected end(revealing: boolean, unique: Future.Cue<unknown>) {
    super.end(revealing, unique)
    if (this.#controller === unique) {
      this.#controller = void 0
      if (!revealing) {
        // if controller is cancelled, so is the gig
        this.stop("cancel control")
      }
    }
  }
  protected finish(signal: Future.Signal<unknown>) {
    // clear everything except job handle and promise
    this.#agent = this.#selector = this.#parameters =
      this.#scene = this.#progress = this.#rollback = this.#controller = void 0
    super.finish(signal)
  }
  constructor(agent: Agent, selector: Selector, p: unknown[]) {
    super()
    this.#job = facade.handle(this)
    this.#agent = agent
    this.#selector = selector
    this.#parameters = p
    this.#scene = this.#progress = this.#rollback = this.#controller = this.#promise = void 0
  }
  public get isInert() {
    return !this.status && !!this.#agent
  }
  public get isAnticipated() {
    return !!this.#rollback
  }
  public get job() {
    return this.#job
  }
  public get agent() {
    this.#done("job has lost knowledge of actor")
    return this.#agent!
  }
  public get selector() {
    this.#done("job has lost knowledge of selector")
    return this.#selector!
  }
  public get parameters() {
    this.#done("job has lost knowledge of parameters")
    return this.#parameters!
  }
  public get promise() {
    return this.#promise ??= new Promise((resolve, reject) => {
      const { fate } = this
      if (fate) {
        if (fate.blooper) {
          reject(fate.blooper)
        } else {
          resolve(fate.prompt)
        }
      } else {
        if (!this.status) {
          // force this inert job to start running (without a controller)
          this.#repost()
        }
        // fork background job to settle the promise when this job eventually completes
        this.agent.settleHint(this.#job, resolve, reject).run()
      }
    })
  }
  public start() {
    // gig can be started if it is inert, otherwise starting is a noop
    if (this.isInert) {
      this.#repost()
    }
  }
  public stop(reason: string) {
    // gig can be stopped if it is not already done, otherwise stopping is a noop
    if (!this.fate) {
      const rollback = this.#rollback
      // complete gig with blooper
      this.finish({ blooper: fx.erroneous(reason) })
      // rollback if gig was waiting on signal from hint
      if (rollback) {
        rollback()
      }
    }
  }
  public takeStage() {
    if (this !== showing()) {
      throw new Error("job must be showing when it takes the stage")
    }
    // reset progress before the scene performance starts
    const progress = this.#progress
    this.#progress = void 0
    if (this.#scene) {
      if (!progress) {
        throw new Error("cannot proceed scene without progress")
      }
    } else if (progress) {
      throw new Error("cannot have progress without a scene to proceed")
    }
    // obtain existing scene to proceed with, or create new scene that starts first performance of this gig
    const scene = this.#scene ??= this.agent.createScene(this)
    try {
      // proceed scene with progress from last stage performance, or begin first performance of new scene
      const intermediate = scene.next(progress!)
      if (intermediate.done) {
        const { agent } = this
        // complete gig with final result
        this.finish({ prompt: intermediate.value })
        // update status of agent after this gig has finished 
        negotiate(agent)
      } else {
        // either wait for asynchronous hint or quickly resume scene on stage when progress is immediate
        this.#rollback = future.commit(intermediate.value, signal => {
          this.#progress = signal
          if (this.#rollback) {
            this.#rollback = void 0
            // move this gig to running status after revelation of asynchronous signal
            this.#repost()
          }
        })
        // move this gig to either running (when progress was immediate) or anticipated status
        this.#repost()
      }
    } catch (problem) {
      if (problem === poisonPill) {
        const { agent } = this
        // complete this gig with true result (i.e. a successful kill)
        this.finish({ prompt: true })
        // suspend agent to prevent further processing in actor and its descendants
        agent.suspend()
        // let manager bury the agent in a separate job 
        new Gig(agent.manager, buryMember, [agent]).#repost()
      } else {
        this.#manageBlooper(fx.erroneous(problem))
      }
    }
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
class Escalation<A extends Actor> extends Error {
  readonly #incident: Theater.Incident<A>
  constructor(incident: Theater.Incident<A>) {
    const { selector, parameters, blooper } = incident
    super(`stage incident at ${String(selector)}"/${parameters.length}`, { cause: blooper })
    this.#incident = incident
  }
  public get incident() {
    return this.#incident
  }
}
// hide gigs as opaque implementations behind job handles
const facade = fx.facade<Theater.Job<unknown>, Gig>("std.theater:Job", Object.create(Object.prototype, {
  // wait for completion of destiny object
  autocue: { value() { return facade.expose(this).completion.autocue() } },
  // chain new promise to handle job completion
  then: { value(happy: any, sad: any) { return facade.expose(this).promise.then(happy, sad) } },
  run: { value() { facade.expose(this).start() } },
  quit: { value() { facade.expose(this).stop("quit job") } },
}))
// an actor swallows poison pill on stage to perform death scene
const poisonPill = Symbol("poison pill")
// resume supervised member with fresh role
function* resumeMember(member: Agent, casting: Theater.Casting<Actor, Actor, unknown[]>): Theater.Scene<void> {
  member.resume(casting)
}
// terminate team membership
function* buryMember(member: Agent): Theater.Scene<void> {
  member.bury()
}
// terminate team membership and escalate incident further in the context of the manager
function* escalateIncident(member: Agent, incident: Theater.Incident<Actor>): Theater.Scene<void> {
  member.bury()
  throw new Escalation(incident)
}
