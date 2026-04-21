import type Fx from "std.fx"
import type System from "std.system"
import type Theater from "std.theater"
import { fx, theater } from "../extern.js"

export function ContainerRole<Home extends System.Container, S extends {} = object>(): Fx.Mixin<
  System.ContainerRole<Home>,
  S
> {
  return AnyContainerRoleMixin as Fx.Mixin<System.ContainerRole<Home>, S>
}

// ----------------------------------------------------------------------------------------------------------------- //
type Components = { [key: string]: Theater.ActorRef }
type Containers = { [key: string]: Theater.ActorRef<System.Container> }
type Contexts = { [key: string]: System.ContainerContext<System.Container> }
type AnyContainerRole = System.ContainerRole<System.Container>
class ContainerContext<Home extends System.Container> implements System.ContainerContext<Home> {
  // the exposed subject of this context
  readonly #subject: Theater.ActorRef<Home>
  // all components, including containers
  readonly #components: Readonly<Components>
  // all subcontexts
  readonly #contexts: Readonly<Contexts>
  // find context from a list of keys
  #findContext<Sub extends System.Container>(keys: string[]): ContainerContext<Sub> | undefined {
    let context: System.ContainerContext<System.Container> = this
    for (const key of keys) {
      const descendant = context.lookupContext(key)
      if (!descendant) {
        return
      }
      context = descendant
    }
    return context as ContainerContext<Sub>
  }
  constructor(container: Theater.ActorRef<Home>, components: Readonly<Components>, contexts: Readonly<Contexts>) {
    this.#subject = container
    this.#components = components
    this.#contexts = contexts
  }
  get subject() {
    return this.#subject
  }
  get listing() {
    return Object.keys(this.#components)
  }
  containsKey(key: string): boolean {
    return key in this.#components
  }
  lookup<A extends Theater.Actor>(key: string): Theater.ActorRef<A> {
    return (key === "" ? this.#subject : this.#components[key]) as Theater.ActorRef<A>
  }
  lookupContext<Sub extends System.Container>(key: string): System.ContainerContext<Sub> {
    return (key === "" ? this : this.#contexts[key]) as System.ContainerContext<Sub>
  }
  resolve<A extends Theater.Actor>(path: string): Theater.ActorRef<A> | undefined {
    const keys = path.split("/")
    const lastKey = keys.pop() as string
    return this.#findContext(keys)?.lookup(lastKey)
  }
  resolveContext<Sub extends System.Container>(path: string): System.ContainerContext<Sub> | undefined {
    return this.#findContext<Sub>(path.split("/"))
  }
}
const AnyContainerRoleMixin = fx.mixin<AnyContainerRole>(Super => {
  class ContainerRole<Home extends System.Container>
    extends theater.Role<System.Container>()(Super)
    implements Theater.Script<System.Container>
  {
    // all components
    readonly #components: Components
    // all containers (prototype of this.#components)
    readonly #containers: Containers
    // contexts of containers
    readonly #contexts: Contexts
    // readonly view
    #view?: ContainerContext<Home>
    #observing?: Map<Theater.ActorRef, string>
    #monitorNewComponent(key: string, actorRef: Theater.ActorRef) {
      this.#observing ??= new Map()
      this.#observing.set(actorRef, key)
      this.monitorHealth(actorRef)
    }
    #validateNewKey(key: string, description: string) {
      if (key === "") {
        throw new Error(`cannot ${description} under empty key`)
      }
      if (key.includes("/")) {
        throw new Error(`cannot ${description} under invalid key "${key}"`)
      }
      if (this.#components[key]) {
        throw new Error(`cannot ${description} under duplicate key "${key}"`)
      }
    }
    protected *observeTermination(actorRef: Theater.ActorRef): Theater.Scene {
      if (this.#observing?.has(actorRef)) {
        const key = this.#observing.get(actorRef) as string
        if (this.#components[key] === actorRef) {
          if (key in this.#containers) {
            delete this.#containers[key]
            delete this.#contexts[key]
          } else {
            delete this.#components[key]
          }
          this.#observing.delete(actorRef)
        }
      }
    }
    protected *initializeRole(): Theater.Scene {
      yield* super.initializeRole()
      this.#view = new ContainerContext<Home>(this.self as Theater.ActorRef<Home>, this.#components, this.#contexts)
    }
    protected get containerContext() {
      return this.#view as System.ContainerContext<Home>
    }
    protected assignComponent<A extends Theater.Actor>(key: string, component: Theater.ActorRef<A>) {
      this.#validateNewKey(key, "assign component")
      this.#components[key] = component
      this.#monitorNewComponent(key, component)
    }
    protected mountContext<C extends System.Container>(key: string, context: System.ContainerContext<C>) {
      this.#validateNewKey(key, "mount container")
      this.#containers[key] = context.subject
      this.#contexts[key] = context
      this.#monitorNewComponent(key, context.subject)
    }
    constructor() {
      super()
      this.#containers = Object.create(null)
      this.#components = Object.create(this.#containers)
      this.#contexts = Object.create(null)
      this.#view = void 0
    }
    @theater.Play *view(): Theater.Scene {
      this.return<System.ContainerContext<Home>>(this.containerContext)
    }
    @theater.Play *assign<A extends Theater.Actor>(key: string, component: Theater.ActorRef<A>): Theater.Scene {
      this.assignComponent(key, component)
    }
    @theater.Play *mount<A extends System.Container>(key: string, context: System.ContainerContext<A>): Theater.Scene {
      this.mountContext(key, context)
    }
  }
  return ContainerRole as unknown as typeof Super & Fx.Constructor<AnyContainerRole, []>
})
