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
    protected get self(): Theater.Actor {
      return busyShowing(this).opaque as Theater.Actor
    }
    protected exitSelf(): never {
      exit()
    }
    protected startChild(casting: Theater.Casting<Theater.Actor, unknown[]>): Theater.Actor {
      return busyShowing(this).startChild(casting).opaque as Theater.Actor
    }
    protected terminateChild(actor: Theater.Actor): void {
      busyShowing(this).terminateChild(actor)
    }
    protected monitorHealth(actor: Theater.Actor): void {
      busyShowing(this).monitorHealth(actor)
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
    @Play *[obituary](actor: Theater.Actor): Theater.Scene {
      busyShowing(this)
      //@ts-expect-error: access protected method
      yield* (this as Theater.Role<Theater.Actor>).observeTermination(actor)
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
