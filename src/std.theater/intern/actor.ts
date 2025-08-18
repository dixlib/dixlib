import type Future from "std.future"
import type Theater from "std.theater"
import { future, fx, news } from "../extern.js"
import { Role } from "./role.js"
import { doNothing, exit, isSceneMethod } from "./scene.js"
import { schedule } from "./stage.js"
import { improvising, initializing, obituary, poisonPill, supervising } from "./unique.js"

export function isActor<A extends Theater.Actor>(it: unknown): it is A {
  return facade.isHandling(it)
}

export function isGhost(actor: Theater.Actor): boolean {
  return facade.expose(actor).isGhost
}

export function startActor<A extends Theater.Actor>(
  TopRole: Theater.RoleClass<A, unknown[]>,
  ...parameters: unknown[]
): A {
  return director.startChild({ Role: TopRole, parameters, guard: guardToplevel }).opaque as A
}

// actor implementations i.e., the objects behind the actor references
export class ActorObj {
  // public-facing opaque actor reference
  #opaq?: Theater.Actor
  // state and behavior of this actor is combined in a role object
  #role?: Theater.Role<Theater.Actor>
  // an actor must have a supervisor, otherwise it's considered to be a ghost
  #supervisor?: ActorObj
  // this actor is suspended if count is nonzero
  #suspendCount: number
  // an actor is currently in a status, like ready, waiting, idle, etc. (see stage.ts)
  #status?: Set<ActorObj>
  // an actor supervises zero or more family members
  #family?: Map<ActorObj, Theater.Guard<Theater.Actor>>
  // if defined, zero or more pending messages
  // this relies on unique messages! every time a message is sent, a new message object is created
  #inbox?: Set<ActorMsg>
  // if defined, this actor is currently working on a message
  #message?: ActorMsg
  // if defined, this actor is currently playing a scene to process the message
  #scene?: Theater.Scene
  // if defined, the actor is currently committed to block on a pending cue in the scene performance
  #rollback?: Future.Rollback
  // if defined, this actor is ready to continue the scene with a signal
  #progress?: Future.Signal<unknown>
  // if defined, the set of actors that are mourning the death of this actor
  #mourners?: Set<Theater.Actor>
  // create scene to process current message
  #createScene(): Theater.Scene {
    const role = this.#role as Theater.Role<Theater.Actor>
    const { selector, parameters } = this.#message as ActorMsg
    //@ts-expect-error: probe for scene method
    const method = role[selector]
    // invoke scene method from role class
    return isSceneMethod(method)
      ? method.apply(role, parameters)
      : //@ts-expect-error: improvise on stage
        role[improvising](selector, parameters)
  }
  // pull next message, if any, from inbox to start next scene
  #pullMessage() {
    const [message] = this.#inbox ?? []
    if (message) {
      //biome-ignore lint/style/noNonNullAssertion: the message came from a defined inbox
      this.#inbox!.delete(message)
    }
    this.#message = message
    this.#scene = void 0
  }
  #suspend() {
    if (!this.#supervisor) {
      throw new Error("cannot suspend a ghost")
    }
    if (this.#suspendCount === 0) {
      // if this actor was not suspended, suspend all family members before suspending this actor
      this.#family?.keys().forEach(member => {
        member.#suspend()
      })
    }
    ++this.#suspendCount
    schedule(this)
  }
  #resume() {
    if (!this.#supervisor) {
      throw new Error("cannot resume a ghost")
    }
    if (this.#suspendCount === 0) {
      throw new Error("actor cannot resume if it is not suspended")
    }
    --this.#suspendCount
    if (this.#suspendCount === 0) {
      if (!this.#message && this.#inbox?.size) {
        // resume with message processing if actor was idle upon original suspension
        this.#pullMessage()
      }
      // if this actor resumes, resume all family members as well
      this.#family?.keys().forEach(member => {
        member.#resume()
      })
    }
    schedule(this)
  }
  #terminate() {
    if (!this.#supervisor) {
      throw new Error("cannot terminate a ghost")
    }
    if (this.#suspendCount === 0) {
      throw new Error("cannot terminate actor when it is not suspended")
    }
    // break bond with supervisor
    //biome-ignore lint/style/noNonNullAssertion: this actor must be part of the supervised family
    if (!this.#supervisor!.#family!.delete(this)) {
      throw new Error("corrupt supervision hierarchy on termination")
    }
    const self = this.#opaq as Theater.Actor
    // reset reference to point to dead letter box
    facade.reset(self, deadLetterBox)
    // terminate family members
    this.#family?.keys().forEach(member => {
      member.#terminate()
    })
    // rollback pending cue
    this.#rollback?.()
    // remove from current status
    this.become(void 0)
    // report dead letters from inbox
    this.#inbox?.forEach(reportDeadLetter)
    //@ts-expect-error: access protected method
    if (this.#role.disposeRole !== doNothing) {
      // start a toplevel zombie actor to dispose of the role; wait with obituaries until disposal completes
      startActor(ZombieRole, this.#role, self, this.#mourners)
    } else {
      // send obituaries when actor is officially dead
      sendObituaries(self, this.#mourners)
    }
    this.#opaq = this.#role = this.#supervisor = this.#family = void 0
    this.#inbox = this.#message = this.#scene = this.#rollback = this.#progress = this.#mourners = void 0
  }
  constructor(ActorRole: Theater.RoleClass<Theater.Actor, unknown[]>, parameters: unknown[], supervisor?: ActorObj) {
    this.#opaq = facade.handle(this)
    const self = this.#opaq as BasicActor
    this.#role = new ActorRole(...parameters)
    this.#supervisor = supervisor ?? this
    this.#suspendCount = 0
    this.#status = this.#family = void 0
    this.#inbox = this.#message = this.#scene = this.#rollback = this.#progress = this.#mourners = void 0
    //@ts-expect-error: access protected method
    if (this.#role.initializeRole !== doNothing) {
      // ready to process initialization message
      self[initializing](parameters)
    } else {
      // start as idle actor
      schedule(this)
    }
  }
  // opaque actor reference
  get opaque() {
    return this.#opaq
  }
  // a ghost can never play scenes on stage
  get isGhost() {
    return !this.#supervisor
  }
  // a suspended actor cannot play scenes on stage, but that might change in the future
  get isSuspended() {
    return this.#suspendCount > 0
  }
  // a blocked actor is waiting for a cue to reveal a signal
  get isBlocked() {
    // when a rollback is defined, the message and scene are also defined
    return !this.#suspendCount && !!this.#rollback
  }
  // a ready actor wants to play on stage
  get isReady() {
    return !this.#suspendCount && !!this.#message && !this.#rollback
  }
  isPlaying(it: unknown) {
    return this.#role === it
  }
  become(status?: Set<ActorObj>) {
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot move to a new status")
    }
    const oldStatus = this.#status
    if (status !== oldStatus) {
      if (oldStatus && !oldStatus.delete(this)) {
        throw new Error("status corruption")
      }
      this.#status = status
      status?.add(this)
    }
  }
  send(selector: string | symbol, parameters: unknown[]) {
    if (!this.#supervisor) {
      // report dead letter warning; a dead letter is sent to a ghost actor
      news.warn('dead letter: "%s"/%d', String(selector), parameters.length)
    } else {
      const message = new ActorMsg(selector, parameters)
      // if actor is suspended or already working on another message, add this message to the inbox
      if (this.#suspendCount || this.#message) {
        this.#inbox ??= new Set()
        this.#inbox.add(message)
      } else {
        // actor is ready to process the message
        this.#message = message
      }
      schedule(this)
    }
  }
  startChild({ Role, parameters, guard }: Theater.Casting<Theater.Actor, unknown[]>): ActorObj {
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot spawn new actors")
    }
    const member = new ActorObj(Role, parameters, this)
    this.#family ??= new Map()
    this.#family.set(member, guard)
    return member
  }
  takeStage() {
    // consistency checks
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot perform on stage")
    }
    if (this.#suspendCount > 0) {
      throw new Error("suspended actor cannot perform on stage")
    }
    if (!this.#message) {
      throw new Error("actor cannot perform on stage without a message to process")
    }
    if (this.#scene && !this.#progress) {
      throw new Error("actor cannot continue a scene on stage without a signal to make progress")
    }
    if (!this.#scene && this.#progress) {
      throw new Error("actor cannot make progress on stage with a signal, but without a scene")
    }
    if (this.#rollback) {
      throw new Error("actor cannot perform on stage when scene is still blocked on a cue")
    }
    // reset progress before the stage performance starts
    const progress = this.#progress as Future.Signal<unknown>
    this.#progress = void 0
    try {
      // proceed scene with progress from last stage performance, or begin first performance of scene
      this.#scene ??= this.#createScene()
      const intermediate = this.#scene.next(progress)
      if (intermediate.done) {
        // pull next message from inbox when this message has been proccessed
        this.#pullMessage()
      } else {
        // either block scene on yielded cue or continue scene with progress when effect is immediate
        this.#rollback = future.commit(intermediate.value, signal => {
          this.#progress = signal
          // if this.#rollback is defined, the outer commit call has completed, and the effect must be asynchronous
          if (this.#rollback) {
            // clear rollback because commitment successfully completed with a signal
            this.#rollback = void 0
            // move this actor to ready status (if not suspended)
            schedule(this)
          }
        })
      }
    } catch (problem) {
      // suspend actor when it causes a problem on stage
      this.#suspend()
      if (problem === poisonPill) {
        // actor has decided to terminate itself
        this.#terminate()
        return
      }
      // send supervising message to supervisor that deals with incident on stage
      const blooper = fx.erroneous(problem)
      const { selector, parameters } = this.#message as ActorMsg
      this.#message = this.#scene = void 0
      //biome-ignore lint/style/noNonNullAssertion: supervisor should be defined
      const supervisor = this.#supervisor!.#opaq as BasicActor
      const offender = this.#opaq as Theater.Actor
      supervisor[supervising]({ offender, blooper, selector, parameters })
    }
    // reschedule actor after stage performance completes, and actor is still alive
    schedule(this)
  }
  // perform scene to supervise incident in family member
  *superviseIncident(incident: Theater.Incident<Theater.Actor>): Theater.Scene {
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot supervise other actors")
    }
    const member = facade.expose(incident.offender)
    // skip stale supervision when member has already terminated and left the family
    if (member.#supervisor) {
      const guard = this.#family?.get(member)
      if (!guard) {
        throw new Error("offender must be a supervised family member")
      }
      // decide appropriate verdict for suspended member
      const verdict = yield* guard(incident)
      if (verdict === "forgive") {
        // nothing happens; offender can keep on processing other messages
        member.#resume()
      } else if (verdict === "punish") {
        // capital punishment; offender drops pending messages as dead letters
        member.#terminate()
      }
    }
  }
  monitorHealth(actor: Theater.Actor) {
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot monitor health of other actors")
    }
    // an actor can try to monitor its own health, but it has no effect
    if (actor !== this.#opaq) {
      const actorObj = facade.expose(actor)
      if (!actorObj.#supervisor) {
        // send obituary message, because the actor to monitor has already terminated
        this.send(obituary, [actor])
      } else {
        // this actor mourns the death of the other actor
        actorObj.#mourners ??= new Set()
        actorObj.#mourners.add(this.#opaq as Theater.Actor)
      }
    }
  }
  terminateChild(actor: Theater.Actor) {
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot terminate a child actor")
    }
    const member = facade.expose(actor)
    if (this.#family?.has(member)) {
      member.terminateNow()
    }
    // else ignore dead or illegal child actor
  }
  // utility for synchronous termination
  terminateNow() {
    this.#suspend()
    this.#terminate()
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
// every actor understands basic messages
interface BasicActor extends Theater.Actor {
  [initializing](parameters: unknown[]): void
  [supervising](incident: Theater.Incident<Theater.Actor>): void
  [obituary](actor: Theater.Actor): void
}
// facade hides actor object behind an actor reference
const facade = fx.createFacade<Theater.Actor, ActorObj>(
  "std.theater/Actor",
  new Proxy(Object.create(null), {
    get(_: never, selector: string | symbol) {
      sendMessageCache[selector] ??= function sendMessage(this: Theater.Actor, ...parameters: unknown[]) {
        // send message to this particular actor object
        facade.expose(this).send(selector, parameters)
      }
      return sendMessageCache[selector]
    },
  })
)
// cache send methods on message selector
const sendMessageCache = Object.create(null)
// unique actor messages
class ActorMsg {
  readonly #selector: string | symbol
  readonly #parameters: unknown[]
  constructor(selector: string | symbol, parameters: unknown[]) {
    this.#selector = selector
    this.#parameters = parameters
  }
  get selector(): string | symbol {
    return this.#selector
  }
  get parameters(): unknown[] {
    return this.#parameters
  }
}
// the director is the actor object that supervises all toplevel actors
const director = new ActorObj(Role()(Object), [])
function* guardToplevel(incident: Theater.Incident<Theater.Actor>): Theater.Scene<Theater.Verdict> {
  news.error("toplevel fatality: %o", incident)
  return "punish"
}
// dead letter box is a toplevel actor which is terminated immediately
const deadLetterBox = facade.expose(startActor(Role()(Object)))
deadLetterBox.terminateNow()
// a zombie only lives to clean up the mess of some other terminated actor
class ZombieRole extends Role()(Object) {
  protected *initializeRole(
    mess: Theater.Role<Theater.Actor>,
    actor: Theater.Actor,
    mourners?: Set<Theater.Actor>
  ): Theater.Scene {
    //@ts-expect-error: access protected method
    yield* mess.disposeRole(actor)
    // send obituaries after disposal
    sendObituaries(actor, mourners)
    // terminate zombie after clean up
    exit()
  }
}
function reportDeadLetter({ selector, parameters }: ActorMsg) {
  news.warn('dead letter: "%s"/%d', String(selector), parameters.length)
}
function sendObituaries(actor: Theater.Actor, mourners?: Set<Theater.Actor>) {
  if (mourners?.size) {
    const parameters = [actor]
    for (const mourner of mourners) {
      const mournerObj = facade.expose(mourner)
      // avoid sending an obituary to ghosts
      if (!mournerObj.isGhost) {
        mournerObj.send(obituary, parameters)
      }
    }
  }
}
