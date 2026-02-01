import type Fx from "std.fx"
import type System from "std.system"
import type Theater from "std.theater"
import type Agency from "std.theater.agency"
import { agency, fn, future, fx, theater } from "../extern.js"

export function ContainerRole<Home extends System.Container, S extends {} = object>(): Fx.Mixin<
  System.ContainerRole<Home>,
  S
> {
  return AnyContainerRoleMixin as Fx.Mixin<System.ContainerRole<Home>, S>
}

// ----------------------------------------------------------------------------------------------------------------- //
type Components = { [key: string]: System.Component }
type Containers = { [key: string]: System.Container }
type Contexts = { [key: string]: System.Context<System.Container> }
type AnyContainerRole = System.ContainerRole<System.Container>
class Context<Home extends System.Container> implements System.Context<Home> {
  // the exposed subject of this context
  readonly #subject: Home
  // all components, including containers
  readonly #components: Readonly<Components>
  // all subcontexts
  readonly #contexts: Readonly<Contexts>
  // find context from a list of keys
  #findContext<Sub extends System.Container>(keys: string[]): Context<Sub> | undefined {
    let context: System.Context<System.Container> = this
    for (const key of keys) {
      const descendant = context.lookupContext(key)
      if (!descendant) {
        return
      }
      context = descendant
    }
    return context as Context<Sub>
  }
  constructor(container: Home, components: Readonly<Components>, contexts: Readonly<Contexts>) {
    this.#subject = container
    this.#components = components
    this.#contexts = contexts
  }
  get subject() {
    return this.#subject
  }
  get listing() {
    return fn.iterateKeys(this.#components) as IteratorObject<string>
  }
  lookup<Item extends System.Component>(key: string): Item | undefined {
    return (key === "" ? this.#subject : this.#components[key]) as Item
  }
  lookupContext<Sub extends System.Container>(key: string): System.Context<Sub> | undefined {
    return (key === "" ? this : this.#contexts[key]) as System.Context<Sub> | undefined
  }
  resolve<Item extends System.Component>(path: string): Item | undefined {
    const keys = path.split("/")
    const lastKey = keys.pop() as string
    return this.#findContext(keys)?.lookup(lastKey)
  }
  resolveContext<Sub extends System.Container>(path: string): System.Context<Sub> | undefined {
    return this.#findContext<Sub>(path.split("/"))
  }
}
const AnyContainerRoleMixin = fx.mixin<AnyContainerRole>(Super => {
  class ContainerRole<Home extends System.Container>
    extends agency.ServerRole<System.Container>()(Super)
    implements Agency.Servant<System.Container>
  {
    // all components
    readonly #components: Components
    // all containers (prototype of this.#components)
    readonly #containers: Containers
    // contexts of containers
    readonly #contexts: Contexts
    // agent subject
    #subject?: Home
    // readonly view
    #view?: Context<Home>
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
    protected *initializeRole() {
      this.#subject = agency.createAgent(theater.startActor(agency.Client(), this.self))
    }
    protected assignComponent<A extends System.Component>(key: string, component: A) {
      this.#validateNewKey(key, "assign component")
      this.#components[key] = component
    }
    protected mountContext<C extends System.Container>(key: string, context: System.Context<C>) {
      this.#validateNewKey(key, "mount container")
      this.#containers[key] = context.subject
      this.#contexts[key] = context
    }
    constructor() {
      super()
      this.#containers = Object.create(null)
      this.#components = Object.create(this.#containers)
      this.#contexts = Object.create(null)
      this.#subject = this.#view = void 0
    }
    @agency.Serve *view(): Theater.Scene<System.Context<Home>> {
      this.#view ??= new Context<Home>(this.#subject as Home, this.#components, this.#contexts)
      return this.#view
    }
    @agency.Serve *assign<Item extends System.Component>(key: string, component: Item): Theater.Scene<void> {
      this.assignComponent(key, component)
    }
    @agency.Serve *mount<Home extends System.Container>(
      key: string,
      container: Home
    ): Theater.Scene<System.Context<System.Container>> {
      const context = future.when<System.Context>(yield future.pledge(container.view()))
      this.mountContext(key, context)
      return context
    }
  }
  return ContainerRole as unknown as typeof Super & Fx.Constructor<AnyContainerRole, []>
})
