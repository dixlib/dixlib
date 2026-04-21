import type Fx from "std.fx"
import type Theater from "std.theater"
import { fx, news } from "../extern.js"
import { doNothing, exit, Play } from "./scene.js"
import { busyShowing } from "./stage.js"
import { improvising, initializing, obituary, supervising } from "./unique.js"

export function Role<A extends Theater.Actor, S extends {} = object>(): Fx.Mixin<Theater.Role<A>, S> {
  return AnyRoleMixin as Fx.Mixin<Theater.Role<A>, S>
}

// ----------------------------------------------------------------------------------------------------------------- //
const AnyRoleMixin = fx.mixin<Theater.Role<Theater.Actor>>(Super => {
  class Role extends Super implements Theater.Script<Theater.Actor> {
    protected get self(): Theater.ActorRef {
      return busyShowing(this).self as Theater.ActorRef
    }
    protected messageContext<ReplyTo extends Theater.Actor = Theater.Actor>(): Theater.MessageContext<ReplyTo> {
      return busyShowing(this).messageContext<ReplyTo>()
    }
    protected return<Result>(result: Result): void {
      const { sender, correlation } = this.messageContext<Theater.Sender>()
      if (!sender) {
        news.warn("missing contextual sender to return result")
      } else {
        sender({ correlation }).return<Result>(result)
      }
    }
    protected exitSelf(): never {
      exit()
    }
    protected castChild(casting: Theater.Casting<Theater.Actor, unknown[]>): Theater.ActorRef {
      return busyShowing(this).startChild(casting).self as Theater.ActorRef
    }
    protected terminateChild(actorRef: Theater.ActorRef): void {
      busyShowing(this).terminateChild(actorRef)
    }
    protected monitorHealth(actorRef: Theater.ActorRef): void {
      busyShowing(this).monitorHealth(actorRef)
    }
    protected *improviseScene(selector: string | symbol, parameters: unknown[]): Theater.Scene {
      // report an inert letter error; an inert letter is misunderstood, and essentially ignored, by an actor
      news.error('inert letter: "%s"/%d', String(selector), parameters.length)
    }
    // helper method for improvisation
    [improvising](selector: string | symbol, parameters: unknown[]): Theater.Scene {
      busyShowing(this)
      return this.improviseScene(selector, parameters)
    }
    // helper scene for initialization
    @Play *[initializing](parameters: unknown[]): Theater.Scene {
      busyShowing(this)
      //@ts-expect-error: access protected method
      yield* (this as Theater.Role<Theater.Actor>).initializeRole(...parameters)
    }
    // helper scene for supervision
    @Play *[supervising](incident: Theater.Incident<Theater.Actor>): Theater.Scene {
      yield* busyShowing(this).superviseIncident(incident)
    }
    // helper scene for obituary message
    @Play *[obituary](actorRef: Theater.ActorRef): Theater.Scene {
      busyShowing(this)
      //@ts-expect-error: access protected method
      yield* (this as Theater.Role<Theater.Actor>).observeTermination(actorRef)
    }
    // default death scene
    @Play *terminate(): Theater.Scene {
      exit()
    }
  }
  const prototype = Role.prototype as Role & {
    [selector in "initializeRole" | "disposeRole" | "observeTermination"]: () => Theater.Scene
  }
  // default initialization, disposal and obituary observation does nothing
  prototype.initializeRole = prototype.disposeRole = prototype.observeTermination = doNothing
  return Role as unknown as typeof Super & Fx.Constructor<Theater.Role<Theater.Actor>>
})
