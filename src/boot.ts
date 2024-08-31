// --- TypeScript ---
import type Loader from 'std.loader'
import type System from 'std.system'
// lazy service providers are instantiated on demand
interface Lazy<S> {
  // promise to load contractor from extern module of a service provider
  (): Promise<Loader.Contractor<S>>
  // if defined, the former lazy provider of this service (below current layer)
  former?: Lazy<S>
}
// loader layers provide service aspects
interface Layer {
  // layer id is module specifier of bindings
  readonly id: string
  // affected services per aspect
  readonly aspects: {
    readonly [A in ServiceAspect]?: Set<string>
  }
}
// edges in dependency graph
interface DependencyEdges {
  readonly direct: Set<string>
  readonly indirect: Set<string>
}
// --- JavaScript ---
/**
 * Start a new system.
 * @param bundleStack Bindings of bundle stack
 * @returns A promise of the system provider
 */
export default function startSystem(bundleStack: Loader.Bindings[]): Promise<System> {
  if (bootLoader) {
    return Promise.reject(new Error("cannot boot twice"))
  } else {
    // create boot loader synchronously
    bootLoader = createBootLoader(bundleStack)
    // provide system asynchronously
    return provideSystem()
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
let bootLoader: Loader
async function provideSystem() {
  // bootstrap system loader
  const { provide } = await bootLoader.provide<Loader>('std.loader')
  // provide the system service using bindings of bundle stack
  return provide<System>('std.system')
}
function createBootLoader(bundles: Loader.Bindings[]) {
  const loader: Loader = { provide, query }
  // service loader stacks multiple layers on top of each other
  const stack = new Map<string, Layer>()
  // all service aspects that are bound in at least one layer
  const boundAspects = new Set<ServiceAspect>()
  // set with all specified services
  const specifications = new Set<string>()
  // keep track of instantiated service providers
  const instantiated: { [name: string]: Promise<unknown> } = Object.create(null)
  // lazy providers are uninstantiated
  const uninstantiated: { [name: string]: Lazy<unknown> } = Object.create(null)
  // add lazy provider of this loader service
  uninstantiated['std.loader'] = () => Promise.resolve(() => Promise.resolve(loader))
  // direct and indirect dependencies in dependency graph for meaningful error reporting
  const dependencyGraph: { [name: string]: DependencyEdges } = Object.create(null)
  function provide<S>(name: string): Promise<S> {
    if (name in instantiated) {
      // provide instantiated provider once and only once
      return instantiated[name] as Promise<S>
    } else if (name in uninstantiated) {
      // instantiate lazy provider
      const lazy = uninstantiated[name] as Lazy<S>
      dependencyGraph[name] = { direct: new Set(), indirect: new Set() }
      delete uninstantiated[name]
      return instantiated[name] = instantiate(name, lazy)
    } else {
      return Promise.reject(new Error(`cannot provide unknown service '${name}'`))
    }
  }
  // query bound services of this loader
  function* query(options?: Loader.QueryOptions): IterableIterator<Loader.QueryResult> {
    const aspectFilter = options?.aspects, bundleFilter = options?.bundles
    const aspects = Array.isArray(aspectFilter) ? new Set(aspectFilter) : boundAspects
    const bundles = Array.isArray(bundleFilter) ? new Set(bundleFilter) : stack.keys()
    if (options?.orientation === "vertical") {
      // vertical query orders results by service aspect and bindings id
      for (const aspect of aspects) {
        if (typeof aspectFilter !== "function" || aspectFilter(aspect)) {
          for (const id of bundles) {
            if (typeof bundleFilter !== "function" || bundleFilter(id)) {
              const serviceNames = stack.get(id)?.aspects[aspect]
              if (serviceNames) {
                yield new QueryResult(aspect, id, serviceNames)
              }
            }
          }
        }
      }
    } else {
      // horizontal query orders results by bindings id and service aspect
      for (const id of bundles) {
        if (typeof bundleFilter !== "function" || bundleFilter(id)) {
          for (const aspect of aspects) {
            if (typeof aspectFilter !== "function" || aspectFilter(aspect)) {
              const serviceNames = stack.get(id)?.aspects[aspect]
              if (serviceNames) {
                yield new QueryResult(aspect, id, serviceNames)
              }
            }
          }
        }
      }
    }
  }
  // instantiate a service from a lazy provider
  async function instantiate<S>(name: string, lazy: Lazy<S>): Promise<S> {
    // construction of former provider, if any
    const { former } = lazy
    lazy.former = void 0
    // wait for contractor to provide the contract
    const contractor = await lazy()
    let providingFormer: Promise<S> | undefined = void 0
    const provider = await contractor({
      name,
      // instantiate former provider in lower layer at most once
      former: former ? () => providingFormer ??= instantiate(name, former) : void 0,
      use<P extends unknown[]>(...names: string[]): Promise<P> {
        // register direct dependencies on other services
        const { direct } = dependencyGraph[name]
        for (const dependency of names) {
          // fail if a dependency cycle is detected
          addDependency(direct, name, dependency)
        }
        return Promise.all(names.map(provide)) as Promise<P>
      },
    })
    // determine service operations
    const operations = Object.create(null, { [Symbol.toStringTag]: { value: name } })
    if (provider && typeof provider === "object") {
      // collect operations from provider object of contractor
      const descriptor: PropertyDescriptor = { value: void 0, enumerable: true }
      for (const name in provider) {
        if (/^[A-Z][A-Z0-9]*$/i.test(name) && typeof provider[name] === "function") {
          descriptor.value = provider[name]
          Reflect.defineProperty(operations, name, descriptor)
        }
      }
    }
    // immutable provider with service operations
    return Object.preventExtensions(operations)
  }
  // register direct or indirect service dependency
  function addDependency(set: Set<String>, from: string, to: string) {
    if (!set.has(to)) {
      set.add(to)
      if (from === to) {
        // perform breadth-first search over direct dependencies
        for (const paths = [[from]], visited = new Set<string>(); paths.length;) {
          const path = paths.shift()!, last = path[path.length - 1]
          if (!visited.has(last)) {
            visited.add(last)
            for (const next of dependencyGraph[last].direct) {
              if (next === from) {
                throw new Error(`service dependency cycle '${[...path, next].join("'->'")}'`)
              }
              if (!visited.has(next)) {
                paths.push([...path, next])
              }
            }
          }
        }
        // should not happen
        throw new Error(`invalid cycle detection in service '${from}'`)
      }
      if (to in dependencyGraph) {
        const { indirect } = dependencyGraph[from]
        for (const dependency of [...dependencyGraph[to].direct, ...dependencyGraph[to].indirect]) {
          addDependency(indirect, from, dependency)
        }
      }
    }
  }
  // build bundle stack with given bindings
  for (const { id, service } of bundles) {
    if (stack.has(id)) {
      throw new Error(`invalid bindings with duplicate id "${id}"`)
    }
    // group services of bindings by service aspects
    const aspects: { [A in ServiceAspect]?: Set<string> } = Object.create(null)
    for (const name in service) {
      for (const key in service[name]) {
        const aspect = key as ServiceAspect
        boundAspects.add(aspect)
        if (service[name][aspect]) {
          const names = aspects[aspect] ??= new Set()
          names.add(name)
        }
      }
    }
    // push new layer on stack
    stack.set(id, { id, aspects })
    const { specification, implementation } = aspects
    // validate service specifications
    if (specification) {
      const intersection = specifications.intersection(specification)
      if (intersection.size > 0) {
        throw new Error(`duplicate service speficiations for '${[...intersection].join("','")}' in bundle ${id}`)
      }
      specification.forEach(name => specifications.add(name))
    }
    // install lazy service providers
    if (implementation) {
      // 'std.loader' is hardcoded and cannot be refined
      if (implementation.has('std.loader')) {
        throw new Error(`invalid provider of system loader service in bundle ${id}`)
      }
      for (const name of implementation) {
        // preload extern module that contains default export of contractor
        const preloading = import(new URL(`${name}/extern.js`, id).href)
        const lazy = () => preloading.then(m => m.default)
        // multiple implementation providers of same service are chained together from upper to lower layers
        lazy.former = uninstantiated[name]
        uninstantiated[name] = lazy
      }
    }
  }
  return loader
}
// query result at certain aspect and bindings id
const emptyNames = new Set<string>()
class QueryResult implements Loader.QueryResult {
  readonly #aspect: ServiceAspect
  readonly #id: string
  readonly #serviceNames: Set<string>
  constructor(aspect: ServiceAspect, id: string, serviceNames = emptyNames) {
    this.#aspect = aspect
    this.#id = id
    this.#serviceNames = serviceNames
  }
  public get aspect() { return this.#aspect }
  public get bundle() { return this.#id }
  public get size() { return this.#serviceNames.size }
  public get serviceNames() { return this.#serviceNames[Symbol.iterator]() }
  public hasBindingFor(serviceName: string): boolean {
    return this.#serviceNames.has(serviceName)
  }
}
