import type News from "std.news"
import type Theater from "std.theater"
import type Future from "std.theater.future"
import { future, fx, news } from "../extern.js"
import { Role } from "./role.js"
import { doNothing, exit, isSceneMethod } from "./scene.js"
import { schedule } from "./stage.js"
import { improvising, initializing, obituary, poisonPill, supervising } from "./unique.js"

export function isActorRef<A extends Theater.Actor = Theater.Actor>(it: unknown): it is Theater.ActorRef<A> {
  return typeof it === "function" && actorReferenceMarker in it
}

export function isGhostRef(actorRef: Theater.ActorRef): boolean {
  return dereferenceObj(actorRef).isGhost
}

export function startActor<A extends Theater.Actor>(
  TopRole: Theater.RoleClass<A, unknown[]>,
  ...parameters: unknown[]
): Theater.ActorRef<A> {
  return director.startChild({ Role: TopRole, parameters, guard: guardToplevel }).self as Theater.ActorRef<A>
}

export function createDefaultGuard<A extends Theater.Actor>(
  verdict: Theater.Verdict,
  message?: string,
  severity?: News.Severity
): Theater.Guard<A> {
  return function* guard(incident: Theater.Incident<A>): Theater.Scene<Theater.Verdict> {
    const text = message ?? "Unexpected incident: %O"
    news[severity ?? "error"](text, incident)
    return verdict
  }
}

export class ActorObj {
  // the reference to this actor object
  #self?: Theater.ActorRef
  // state and behavior of this actor is combined in a role object
  #role?: Theater.Role<Theater.Actor>
  // an actor must have a supervisor, otherwise it's considered to be a ghost
  #supervisor?: ActorObj
  // when this actor is suspended, it cannot process messages but it can receive them
  #suspended: boolean
  // an actor is currently in a status, like ready, waiting, idle, etc. (see stage.ts)
  #status?: Set<ActorObj>
  // an actor supervises zero or more family members
  #family?: Map<ActorObj, Theater.Guard<Theater.Actor>>
  // if defined, zero or more pending messages
  // this relies on unique messages! every time a message is sent, a new message object is created
  #inbox?: Set<ActorMsg>
  // if defined, this actor is currently working on a message
  #message?: ActorMsg
  // if defined, context of current message
  #context?: Theater.MessageContext
  // if defined, this actor is currently playing a scene to process the message
  #scene?: Theater.Scene
  // if defined, the actor is currently committed to block on a pending cue in the scene performance
  #rollback?: Future.Rollback
  // if defined, this actor is ready to continue the scene with a signal
  #progress?: Future.Signal<unknown>
  // if defined, the set of actors that are mourning the death of this actor
  #mourners?: Set<ActorObj>
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
    if (!this.#suspended) {
      // if this actor was not suspended, suspend all family members before suspending this actor
      this.#family?.keys().forEach(member => {
        member.#suspend()
      })
    }
    this.#suspended = true
    schedule(this)
  }
  #resume() {
    if (!this.#supervisor) {
      throw new Error("cannot resume a ghost")
    }
    if (!this.#suspended) {
      throw new Error("actor cannot resume if it is not suspended")
    }
    this.#suspended = false
    // if this actor resumes, resume all family members as well
    this.#family?.keys().forEach(member => {
      member.#resume()
    })
    if (!this.#message && this.#inbox?.size) {
      // resume with message processing if actor was idle upon original suspension
      this.#pullMessage()
    }
    schedule(this)
  }
  #terminate() {
    if (!this.#supervisor) {
      throw new Error("cannot terminate a ghost")
    }
    if (!this.#suspended) {
      throw new Error("cannot terminate actor when it is not suspended")
    }
    // break bond with supervisor
    //biome-ignore lint/style/noNonNullAssertion: this actor must be part of the supervised family
    if (!this.#supervisor!.#family!.delete(this)) {
      throw new Error("corrupt supervision hierarchy on termination")
    }
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
      startActor(ZombieRole, this.#role, this.#self, this.#mourners)
    } else {
      // send obituaries when actor is officially dead
      sendObituaries(this.#self as Theater.ActorRef, this.#mourners)
    }
    this.#self = this.#role = this.#supervisor = this.#family = void 0
    this.#inbox = this.#message = this.#scene = this.#rollback = this.#progress = this.#mourners = void 0
  }
  constructor(ActorRole: Theater.RoleClass<Theater.Actor, unknown[]>, parameters: unknown[], supervisor?: ActorObj) {
    const self = ActorRef.bind(facade.handle(this)) as Theater.ActorRef<BasicActor>
    Reflect.defineProperty(self, actorReferenceMarker, { value: this })
    this.#self = self
    this.#role = new ActorRole(...parameters)
    this.#supervisor = supervisor ?? this
    this.#suspended = false
    this.#status = this.#family = this.#inbox = void 0
    this.#message = this.#context = this.#scene = this.#rollback = this.#progress = this.#mourners = void 0
    //@ts-expect-error: access protected method
    if (this.#role.initializeRole !== doNothing) {
      // ready to process initialization message
      self()[initializing](parameters)
    } else {
      // start as idle actor
      schedule(this)
    }
  }
  // opaque actor self reference
  get self() {
    return this.#self
  }
  // a ghost can never play scenes on stage
  get isGhost() {
    return !this.#supervisor
  }
  // a suspended actor cannot play scenes on stage, but that might change in the future
  get isSuspended() {
    return this.#suspended
  }
  // a blocked actor is waiting for a cue to reveal a signal
  get isBlocked() {
    // when a rollback is defined, the message and scene are also defined
    return !this.#suspended && !!this.#rollback
  }
  // a ready actor wants to play on stage
  get isReady() {
    return !this.#suspended && !!this.#message && !this.#rollback
  }
  messageContext<ReplyTo extends Theater.Actor = Theater.Actor>(): Theater.MessageContext<ReplyTo> {
    if (!this.#message) {
      throw new Error("missing contextual message")
    }
    return this.#message.context as Theater.MessageContext<ReplyTo>
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
  assignContext(context: Theater.MessageContext) {
    if (this.#context) {
      throw new Error("invalid contextual state")
    }
    this.#context = context
  }
  send(selector: string | symbol, parameters: unknown[]): Theater.OneWay {
    if (!this.#supervisor) {
      // report dead letter warning; a dead letter is sent to a ghost actor
      news.warn('dead letter: "%s"/%d', String(selector), parameters.length)
    } else {
      if (!this.#context) {
        throw new Error("invalid contextual state")
      }
      const message = new ActorMsg(selector, parameters, this.#context)
      this.#context = void 0
      // if actor is suspended or already working on another message, add this message to the inbox
      if (this.#suspended || this.#message) {
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
      throw new Error("ghost actor cannot start new child actors")
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
    if (this.#suspended) {
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
        // pull next message from inbox when this message has been processed
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
      const supervisor = this.#supervisor as ActorObj
      const supervisorRef = supervisor.#self as Theater.ActorRef<BasicActor>
      const offender = this.#self as Theater.ActorRef
      supervisorRef()[supervising]({ offender, blooper, selector, parameters })
    }
    // reschedule actor after stage performance completes, and actor is still alive
    schedule(this)
  }
  // perform scene to supervise incident in family member
  *superviseIncident(incident: Theater.Incident<Theater.Actor>): Theater.Scene {
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot supervise other actors")
    }
    const member = dereferenceObj(incident.offender)
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
  monitorHealth(actorRef: Theater.ActorRef) {
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot monitor health of other actors")
    }
    // an actor can try to monitor its own health, but it has no effect
    const self = this.#self as Theater.ActorRef<BasicActor>
    if (actorRef !== self) {
      const actorObj = dereferenceObj(actorRef)
      if (actorObj.isGhost) {
        // send obituary message, because the actor to monitor has already terminated
        self()[obituary](actorRef)
      } else {
        // this actor mourns the death of the other actor
        actorObj.#mourners ??= new Set()
        actorObj.#mourners.add(this)
      }
    }
  }
  terminateChild(actorRef: Theater.ActorRef) {
    if (!this.#supervisor) {
      throw new Error("ghost actor cannot terminate a child actor")
    }
    const member = dereferenceObj(actorRef)
    if (this.#family?.has(member)) {
      member.#suspend()
      member.#terminate()
    }
    // else ignore dead or illegal child actor
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
// an actor reference is a function, bound to an actor proxy
function ActorRef(this: Theater.Actor, context?: Theater.MessageContext): Theater.Actor {
  // assign context for subsequent message
  facade.expose(this).assignContext(context ? createMessageContext(context) : emptyMessageContext)
  return this
}
// a bound reference is marked to distinguish it
const actorReferenceMarker: unique symbol = Symbol("actor reference")
// dereference without calling the reference
function dereferenceObj(actorRef: Theater.ActorRef): ActorObj {
  //@ts-expect-error: access hidden property of actor reference
  return actorRef[actorReferenceMarker]
}
// every basic actor understands some hidden helper messages
interface BasicActor extends Theater.Actor {
  [initializing](parameters: unknown[]): Theater.OneWay
  [supervising](incident: Theater.Incident<Theater.Actor>): Theater.OneWay
  [obituary](actor: Theater.ActorRef): Theater.OneWay
}

// facade hides actor object behind an actor proxy
const facade = fx.createFacade<Theater.Actor, ActorObj>(
  "std.theater/Actor",
  new Proxy(Object.create(null), {
    get(_: never, selector: string | symbol) {
      sendMessageCache[selector] ??= function sendMessage(
        this: Theater.Actor,
        ...parameters: unknown[]
      ): Theater.OneWay {
        return facade.expose(this).send(selector, parameters)
      }
      return sendMessageCache[selector]
    },
  })
)
// cache send methods on message selector
const sendMessageCache = Object.create(null)
// an actor object processes contextual messages
class ActorMsg<A extends Theater.Actor = Theater.Actor> {
  readonly #selector: string | symbol
  readonly #parameters: unknown[]
  readonly #context: Theater.MessageContext<A>
  constructor(selector: string | symbol, parameters: unknown[], context: Theater.MessageContext<A>) {
    this.#selector = selector
    this.#parameters = parameters
    this.#context = context
  }
  get selector(): string | symbol {
    return this.#selector
  }
  get parameters(): unknown[] {
    return this.#parameters
  }
  get context(): Theater.MessageContext<A> {
    return this.#context
  }
}
// reuse empty message context
const emptyMessageContext = createMessageContext({})
// create immutable message context
function createMessageContext(context: Theater.MessageContext): Theater.MessageContext {
  return Object.preventExtensions(
    Object.create(null, {
      sender: { value: context.sender },
      correlation: { value: context.correlation },
      transfer: { value: context.transfer },
    })
  )
}
// the director is the actor object that supervises all toplevel actors
const director = new ActorObj(Role()(Object), [])
// strict supervision for toplevel actors
const guardToplevel = createDefaultGuard("punish", "toplevel fatality: %O")
// report dead letters when an actor terminates with a nonempty inbox
function reportDeadLetter({ selector, parameters }: ActorMsg) {
  news.warn('dead letter: "%s"/%d', String(selector), parameters.length)
}
// send obituary message to all mourners
function sendObituaries(actorRef: Theater.ActorRef, mourners?: Set<ActorObj>) {
  if (mourners?.size) {
    for (const mournerObj of mourners) {
      // avoid sending an obituary to ghosts
      if (!mournerObj.isGhost) {
        const mournerRef = mournerObj.self as Theater.ActorRef<BasicActor>
        mournerRef()[obituary](actorRef)
      }
    }
  }
}
// a zombie only lives to clean up the mess of some other terminated actor
class ZombieRole extends Role()(Object) {
  protected *initializeRole(
    mess: Theater.Role<Theater.Actor>,
    actorRef: Theater.ActorRef,
    mourners?: Set<ActorObj>
  ): Theater.Scene {
    yield* super.initializeRole()
    //@ts-expect-error: access protected method
    yield* mess.disposeRole(actorRef)
    // send obituaries after disposal
    sendObituaries(actorRef, mourners)
    // terminate zombie after clean up
    exit()
  }
}
