// --- TypeScript ---
import type Fx from 'std.fx'
import type Theater from 'std.theater'
type Actor = Theater.Actor
type AnyRole = Theater.Role<Actor>
// --- JavaScript ---
import { fx } from "../extern.js"
import { Gig, swallowPoison } from "./gig.js"
import { Play, doNothing } from "./scene.js"
import { showing } from "./stage.js"

export function Role<A extends Actor, S extends {} = {}>(): Fx.Mixin<Theater.Role<A>, S> {
  return AnyRoleMixin as Fx.Mixin<Theater.Role<A>, S>
}

// ----------------------------------------------------------------------------------------------------------------- //
const AnyRoleMixin = fx.mixin<AnyRole>(Super => {
  class Role extends Super implements Theater.Script<Actor> {
    protected get self(): Actor {
      const { agent } = showing()
      if (this as unknown !== agent.role) {
        throw new Error("self must be playing on stage")
      }
      return agent.actor
    }
    protected *improviseScene(selector: string | symbol, p: unknown[]): Theater.Scene<unknown> {
      throw new Error(`"${String(selector)}"/${p.length} is not a scene selector`)
    }
    protected playScene(this: AnyRole, scenic: Theater.Scenic<unknown, unknown[]>, ...p: unknown[]) {
      const { agent } = showing()
      if (this !== agent.role) {
        throw new Error("self must be playing on stage")
      }
      return new Gig(agent, scenic, p).job
    }
    protected castChild(this: AnyRole, casting: Theater.Casting<Actor, Actor, unknown[]>): Actor {
      const { agent } = showing()
      if (this !== agent.role) {
        throw new Error("self must be playing on stage")
      }
      return agent.cast(casting).actor
    }
    @Play public *kill(): Theater.Scene<boolean> {
      swallowPoison()
    }
  }
  const prototype = Role.prototype as Role & {
    initializeRole: () => Theater.Scene<void>,
    disposeRole: () => Theater.Scene<void>
  }
  prototype.initializeRole = prototype.disposeRole = doNothing
  return Role as unknown as typeof Super & Fx.Constructor<AnyRole>
})
