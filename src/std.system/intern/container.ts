// --- TypeScript ---
import type Fx from 'std.fx'
import type System from 'std.system'
import type Theater from 'std.theater'
type Components = { [key: string]: Theater.Actor }
type Containers = { [key: string]: System.Container }
type Contexts = { [key: string]: System.Context<System.Container> }
type AnyContainerRole = System.ContainerRole<System.Container>
// --- JavaScript ---
import { fx, loop, theater } from "../extern.js"

export function ContainerRole<C extends System.Container, S extends {} = {}>(): Fx.Mixin<System.ContainerRole<C>, S> {
  return AnyContainerRoleMixin as Fx.Mixin<System.ContainerRole<C>, S>
}

// ----------------------------------------------------------------------------------------------------------------- //
class Context<C extends System.Container> implements System.Context<C> {
  // the exposed container of this context
  readonly #container: C
  // all components, including containers
  readonly #components: Readonly<Components>
  // all subcontexts
  readonly #contexts: Readonly<Contexts>
  // find context from a list of keys
  #findContext<D extends System.Container>(keys: string[]): Context<D> | undefined {
    let context: System.Context<System.Container> = this
    for (const key of keys) {
      const descendant = context.lookupContext(key)
      if (!descendant) {
        return
      }
      context = descendant
    }
    return context as Context<D>
  }
  constructor(container: C, components: Readonly<Components>, contexts: Readonly<Contexts>) {
    this.#container = container
    this.#components = components
    this.#contexts = contexts
  }
  public get container() { return this.#container }
  public get listing() { return loop.keys(this.#components) }
  public lookup<A extends Theater.Actor>(key: string): A | undefined {
    return (key === "" ? this.#container : this.#components[key]) as A
  }
  public lookupContext<D extends System.Container>(key: string): System.Context<D> | undefined {
    return (key === "" ? this : this.#contexts[key]) as System.Context<D> | undefined
  }
  public resolve<A extends Theater.Actor>(path: string): A | undefined {
    const keys = path.split("/"), lastKey = keys.pop()!
    return this.#findContext(keys)?.lookup(lastKey)
  }
  public resolveContext<D extends System.Container>(path: string): System.Context<D> | undefined {
    return this.#findContext<D>(path.split("/"))
  }
}
const AnyContainerRoleMixin = fx.mixin<AnyContainerRole>(Super => {
  class ContainerRole extends theater.Role<System.Container>()(Super) implements Theater.Script<System.Container> {
    // all components
    readonly #components: Components
    // all containers (prototype of this.#components)
    readonly #containers: Containers
    // contexts of containers
    readonly #contexts: Contexts
    // readonly view
    #view?: Context<System.Container>
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
    constructor(...p: unknown[]) {
      super(...p)
      this.#containers = Object.create(null)
      this.#components = Object.create(this.#containers)
      this.#contexts = Object.create(null)
      this.#view = void 0
    }
    protected assignComponent<A extends Theater.Actor>(key: string, component: A) {
      this.#validateNewKey(key, "assign component")
      this.#components[key] = component
    }
    protected mountContext<C extends System.Container>(key: string, context: System.Context<C>) {
      this.#validateNewKey(key, "mount container")
      this.#containers[key] = context.container
      this.#contexts[key] = context
    }
    @theater.Play
    public *view(): Theater.Scene<System.Context<System.Container>> {
      return this.#view ??= new Context(this.self, this.#components, this.#contexts)
    }
    @theater.Play
    public *assign<A extends Theater.Actor>(key: string, component: A): Theater.Scene<void> {
      this.assignComponent(key, component)
    }
    @theater.Play
    public *mount<C extends System.Container>(key: string, container: C): Theater.Scene<System.Context<C>> {
      const context = yield* theater.when(container.view())
      this.mountContext(key, context)
      return context
    }
  }
  return ContainerRole as unknown as typeof Super & Fx.Constructor<AnyContainerRole>
})
