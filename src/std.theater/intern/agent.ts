// --- TypeScript ---
import type Theater from 'std.theater'
import type Future from 'std.future'
type Actor = Theater.Actor
type Immortals = [Janitor, Troupe]
interface Director extends Actor {
  bootstrap(): Theater.Job<Immortals>
}
interface Janitor extends Actor { }
interface Troupe extends Actor { }
// --- JavaScript ---
import { fx } from "../extern.js"
import { Gig, surprise } from "./gig.js"
import { Destiny, ExclusiveStatus } from "./lifecycle.js"
import { Role } from "./role.js"
import { Play, doNothing, isSceneMethod } from "./scene.js"
import { negotiate } from "./stage.js"

export function isActor<A extends Actor>(it: unknown): it is A {
  return facade.isHandling(it)
}

export function isEmployable(actor: Actor) {
  return !facade.expose(actor).isSuspended
}

export function play<T, P extends unknown[]>(scenic: Theater.Scenic<T, P>, ...p: P): Theater.Job<T> {
  return new Gig(facade.expose(janitor), anonymous, [scenic, p]).job as Theater.Job<T>
}

export function cast<A extends Actor, P extends unknown[]>(casting: Theater.Casting<Actor, A, P>): A {
  return facade.expose(troupe).cast(
    casting as unknown as Theater.Casting<Theater.Actor, Theater.Actor, unknown[]>
  ).actor as A
}

export function mourn(actor: Actor): Future.Cue<void> {
  return facade.expose(actor).completion.autocue()
}

export class Agent extends Destiny {
  // corresponding actor handle
  readonly #actor: Actor
  // if true, an actor is unable to work on gigs
  #suspended: boolean
  // agent of supervisor
  #manager?: Agent
  // all team members and their supervision guards
  #team?: Map<Agent, Theater.Guard<Actor, Actor>>
  // ready to work on gigs from workload
  #workload?: ExclusiveStatus<Gig>
  // anticipating to work on gigs from agenda
  #agenda?: ExclusiveStatus<Gig>
  // role encapsulates transient state of actor
  #role?: Theater.Role<Actor>
  // install or reinstall fresh role
  #install(Role: Theater.RoleClass<Actor, unknown[]>, p: unknown[]) {
    // @ts-ignore: access protected method
    const { initializeRole }: Theater.Role<Theater.Role> = this.#role = new Role(...p)
    if (initializeRole !== doNothing) {
      // ready to initialize new role
      new Gig(this, initializeRole, p).start()
    }
  }
  // clean up mess of role, either before burial or reinstall
  #reset(reason: string) {
    this.#ghost("cannot reset")
    if (!this.#suspended) {
      throw new Error("should be suspended on reset")
    }
    for (const member of this.#team!.keys()) {
      // all team members die upon reset
      member.bury()
    }
    const agenda = this.#agenda!, workload = this.#workload!, role = this.#role!
    // @ts-ignore: access protected method
    const { disposeRole } = role
    for (let gig: Gig | undefined; (gig = agenda.first ?? workload.first);) {
      gig.stop(reason)
    }
    if (disposeRole !== doNothing) {
      // clean up with janitor
      play(disposeRole.bind(role)).run()
    }
    if (this.#team!.size) {
      throw new Error("team should be empty after reset")
    }
    if (this.#workload!.size) {
      throw new Error("workload should be empty after reset")
    }
    if (this.#agenda!.size) {
      throw new Error("agenda should be empty after reset")
    }
  }
  #ghost(message: string) {
    if (this.fate) {
      throw new Error(`${message} after fate has been sealed`)
    }
  }
  constructor(Role: Theater.RoleClass<Actor, unknown[]>, p: unknown[], manager?: Agent) {
    super()
    this.#actor = facade.handle(this)
    this.#suspended = false
    this.#manager = manager ?? this
    this.#team = new Map()
    this.#workload = new ExclusiveStatus("running")
    this.#agenda = new ExclusiveStatus("anticipated")
    this.#install(Role, p)
    negotiate(this)
  }
  public get isSuspended() {
    return this.#suspended
  }
  public get actor() {
    return this.#actor
  }
  public get manager() {
    this.#ghost("actor is unmanaged")
    return this.#manager!
  }
  public get role() {
    this.#ghost("actor is not playing a role")
    return this.#role!
  }
  public get workload() {
    this.#ghost("actor does not have a workload")
    return this.#workload!
  }
  public get agenda() {
    this.#ghost("actor does not have an agenda")
    return this.#agenda!
  }
  public createScene({ selector, parameters }: Gig): Theater.Scene<unknown> {
    const { role } = this
    if (typeof selector === "function") {
      return selector.apply(role, parameters)
    } else {
      // @ts-ignore: probe for scene method
      const method = role[selector]
      // invoke scene method from role class
      return isSceneMethod(method) ? method.apply(role, parameters) :
        // @ts-ignore: improvise on stage
        role.improviseScene(selector, parameters)
    }
  }
  public suspend() {
    this.#ghost("actor cannot suspend")
    if (this.#suspended) {
      throw new Error("cannot suspend twice")
    }
    for (const member of this.#team!.keys()) {
      member.suspend()
    }
    this.#suspended = true
    negotiate(this)
  }
  public resume({ Role, p, guard }: Theater.Casting<Actor, Actor, unknown[]>) {
    this.#ghost("actor cannot resume")
    if (!this.#suspended) {
      throw new Error("should be suspended on resumption")
    }
    const team = this.#manager!.#team!
    if (!team.get(this)) {
      throw new Error("invalid team membership on resumption")
    }
    team.set(this, guard)
    this.#reset("actor recast")
    // leave suspended state with fresh role
    this.#suspended = false
    this.#install(Role, p)
    negotiate(this)
  }
  public bury() {
    this.#reset("actor funeral")
    // remove all tracks of ghost team member
    this.#manager!.#team!.delete(this)
    this.#manager = this.#team = this.#role = this.#workload = this.#agenda = void 0
    this.finish({})
  }
  public cast({ Role, p, guard }: Theater.Casting<Actor, Actor, unknown[]>): Agent {
    const member = new Agent(Role, p, this)
    this.#team!.set(member, guard)
    return member
  }
  // utility method for thenable jobs
  public settleHint(hint: Future.Hint<unknown>, resolve: (it: unknown) => void, reject: (reason: unknown) => void) {
    return new Gig(facade.expose(janitor), settleHint, [hint, resolve, reject]).job
  }
  public superviseIncident(incident: Theater.Incident<Actor>): Theater.Verdict {
    const guard = this.#team!.get(facade.expose(incident.offender))
    if (!guard) {
      throw new Error("offender must be a supervised team member")
    }
    return guard(incident, this.actor)
  }
  public post(gig: Gig) {
    if (gig.fate) {
      throw new Error("job cannot be posted after its fate has been sealed")
    }
    if (this !== gig.agent) {
      throw new Error("posted job must belong to performing actor")
    }
    if (this.fate) {
      // ghost is not allowed to work on gigs
      gig.stop("ghost encounter")
    } else {
      // add more work
      if (gig.isAnticipated) {
        this.#agenda!.add(gig)
      } else {
        this.#workload!.add(gig)
      }
      negotiate(this)
    }
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
// facade hides agent of an actor handle
const facade = fx.facade<Actor, Agent>("std.theater:Actor", new Proxy(Object.create(null), {
  get(_ignored: never, selector: string | symbol) {
    return jobFactoryCache[selector] ??= function createJob(this: Actor, ...p: unknown[]) {
      // create job for this particular actor
      return new Gig(facade.expose(this), selector, p).job
    }
  }
}))
// cache job factories on method selector
const jobFactoryCache = Object.create(null)
// hide "this" (the janitor role) when unbound scenic code is played on stage
function* anonymous<T, P extends unknown[]>(scenic: Theater.Scenic<T, P>, p: P) {
  return yield* scenic(...p)
}
// resolve or reject promise with signal of a hint
function* settleHint<T>(hint: Future.Hint<T>, resolve: (result: T) => void, reject: (reason: unknown) => void) {
  const { blooper, prompt }: Future.Signal<T> = yield hint
  if (blooper) {
    reject(blooper)
  } else {
    resolve(prompt!)
  }
}
// base class for roles of immortal actors
class ImmortalRole extends Role<Actor>()(Object) {
  @Play
  public *kill() {
    // immortal actor cannot be killed
    return false
  }
}
class DirectorRole extends Role<Director>()(ImmortalRole) implements Theater.Script<Director> {
  @Play
  public *bootstrap(): Theater.Scene<Immortals> {
    // inform about incidents in background jobs of janitor
    function background({ blooper, selector, parameters }: Theater.Incident<Actor>): Theater.Verdict {
      console.info(`background failure in "${String(selector)}"/${parameters.length}`, blooper)
      return "forgive"
    }
    // warn about incidents of troupe actor (only happens when a toplevel actor escalates a blooper)
    function unexpected({ blooper, selector, parameters }: Theater.Incident<Actor>): Theater.Verdict {
      console.warn(`escalation incident in "${String(selector)}"/${parameters.length}`, blooper)
      return "forgive"
    }
    return [
      this.castChild<Janitor, []>({ Role: ImmortalRole, p: [], guard: background }),
      this.castChild<Troupe, []>({ Role: ImmortalRole, p: [], guard: unexpected }),
    ]
  }
}
// unsupervised, immortal theater director
const director = new Agent(DirectorRole, []).actor as Director
// perform bootstrap operation that creates supervised immortal child actors of director
const [janitor, troupe] = surprise(director.bootstrap()) as Immortals
