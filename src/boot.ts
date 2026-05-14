import type { Service, ServiceAspect, ServiceName } from "dixlib"
import type Loader from "std.loader"
import type System from "std.system"

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
// lazy service providers are instantiated on demand
interface Lazy<Name extends ServiceName> {
  // promise to load contractor from extern module of a service provider
  (): Promise<Loader.Contractor<Name>>
  // if defined, the former lazy provider of this service (below current layer)
  former?: Lazy<Name>
}
// loader layers provide service aspects
interface Layer {
  // layer id is module specifier of bindings
  readonly id: string
  // affected services per aspect
  readonly aspects: { readonly [A in ServiceAspect]?: Set<ServiceName> }
}
// edges in dependency graph
interface DependencyEdges {
  readonly direct: Set<string>
  readonly indirect: Set<string>
}
let bootLoader: Loader
async function provideSystem() {
  // bootstrap system loader
  const { provide } = await bootLoader.provide("std.loader")
  // provide the system service using bindings of bundle stack
  return provide("std.system")
}
function createBootLoader(bundles: Loader.Bindings[]) {
  const loader: Loader = { provide, use, query }
  // service loader stacks multiple layers on top of each other
  const stack = new Map<string, Layer>()
  // all service aspects that are bound in at least one layer
  const boundAspects = new Set<ServiceAspect>()
  // set with all specified services
  const specifications = new Set<string>()
  // keep track of instantiated service providers
  const instantiated: { [name in ServiceName]: Promise<Service[ServiceName]> } = Object.create(null)
  // lazy providers are uninstantiated
  const uninstantiated: { [name in ServiceName]: Lazy<ServiceName> } = Object.create(null)
  // add lazy provider of this loader service
  uninstantiated["std.loader"] = () => Promise.resolve(() => Promise.resolve(loader))
  // direct and indirect dependencies in dependency graph for meaningful error reporting
  const dependencyGraph: { [name: string]: DependencyEdges } = Object.create(null)
  function provide<Name extends ServiceName>(name: Name): Promise<Service[Name]> {
    if (name in instantiated) {
      // provide instantiated provider once and only once
      return instantiated[name] as Promise<Service[Name]>
    } else if (name in uninstantiated) {
      // instantiate lazy provider
      //@ts-expect-error: assume service name is valid
      const lazy: Lazy<Name> = uninstantiated[name]
      dependencyGraph[name] = { direct: new Set(), indirect: new Set() }
      delete uninstantiated[name]
      instantiated[name] = instantiate<Name>(name, lazy)
      return instantiated[name] as Promise<Service[Name]>
    } else {
      return Promise.reject(new Error(`cannot provide unknown service '${name}'`))
    }
  }
  function use<Names extends ServiceName[]>(...names: Names) {
    return Promise.all(names.map(name => provide(name))) as Promise<{ [Ix in keyof Names]: Service[Names[Ix]] }>
  }
  // query bound services of this loader
  function* query(options?: Loader.QueryOptions): Generator<Loader.QueryResult> {
    const aspectFilter = options?.aspects
    const bundleFilter = options?.bundles
    // set with covered aspects of this query
    const covAspects = Array.isArray(aspectFilter) ? new Set(aspectFilter) : boundAspects
    // iterator over covered bundles of this query
    const covBundles = Array.isArray(bundleFilter) ? new Set(bundleFilter).values() : stack.keys()
    // apply filter functions when appropriate
    const aspectIterable = typeof aspectFilter !== "function" ? covAspects : covAspects.values().filter(aspectFilter)
    const bundleIterable = typeof bundleFilter !== "function" ? covBundles : covBundles.filter(bundleFilter)
    // collect (potential) iterators, because they might be iterated multiple times
    const aspects = [...aspectIterable]
    const bundles = [...bundleIterable]
    if (options?.orientation === "vertical") {
      // vertical query orders results by service aspect and bindings id
      for (const aspect of aspects) {
        for (const id of bundles) {
          const serviceNames = stack.get(id)?.aspects[aspect]
          if (serviceNames) {
            yield new QueryResult(aspect, id, serviceNames)
          }
        }
      }
    } else {
      // horizontal query orders results by bindings id and service aspect
      for (const id of bundles) {
        for (const aspect of aspects) {
          const serviceNames = stack.get(id)?.aspects[aspect]
          if (serviceNames) {
            yield new QueryResult(aspect, id, serviceNames)
          }
        }
      }
    }
  }
  // instantiate a service from a lazy provider
  async function instantiate<Name extends ServiceName>(name: Name, lazy: Lazy<Name>): Promise<Service[Name]> {
    // construction of former provider, if any
    const { former } = lazy
    lazy.former = void 0
    // wait for contractor to provide the contract
    const contractor = await lazy()
    let providingFormer: Promise<Service[Name]> | undefined = void 0
    const provider = await contractor({
      name,
      // instantiate former provider in lower layer at most once
      former: former
        ? () => {
            providingFormer ??= instantiate(name, former)
            return providingFormer
          }
        : void 0,
      use<Names extends ServiceName[]>(...names: Names): Promise<{ [Ix in keyof Names]: Service[Names[Ix]] }> {
        // register direct dependencies on other services
        const { direct } = dependencyGraph[name]
        for (const dependency of names) {
          // fail if a dependency cycle is detected
          addDependency(direct, name, dependency)
        }
        return Promise.all(names.map(provide)) as Promise<{ readonly [Ix in keyof Names]: Service[Names[Ix]] }>
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
  function addDependency(set: Set<string>, from: string, to: string) {
    if (!set.has(to)) {
      set.add(to)
      if (from === to) {
        // perform breadth-first search over direct dependencies
        for (const paths = [[from]], visited = new Set<string>(); paths.length; ) {
          const path = paths.shift() as string[]
          const last = path[path.length - 1]
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
    const aspects: { [A in ServiceAspect]?: Set<ServiceName> } = Object.create(null)
    for (const serviceName in service) {
      const name = serviceName as ServiceName
      for (const key in service[name]) {
        const aspect = key as ServiceAspect
        boundAspects.add(aspect)
        if (service[name][aspect]) {
          aspects[aspect] ??= new Set()
          aspects[aspect].add(name)
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
        throw new Error(`duplicate service spefication for '${[...intersection].join("','")}' in bundle ${id}`)
      }
      specification.forEach(name => {
        specifications.add(name)
      })
    }
    // install lazy service providers
    if (implementation) {
      // 'std.loader' is hardcoded and cannot be refined
      if (implementation.has("std.loader")) {
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
const emptyNames = new Set<ServiceName>()
class QueryResult implements Loader.QueryResult {
  readonly #aspect: ServiceAspect
  readonly #id: string
  readonly #serviceNames: Set<ServiceName>
  constructor(aspect: ServiceAspect, id: string, serviceNames = emptyNames) {
    this.#aspect = aspect
    this.#id = id
    this.#serviceNames = serviceNames
  }
  get aspect() {
    return this.#aspect
  }
  get bundle() {
    return this.#id
  }
  get size() {
    return this.#serviceNames.size
  }
  get serviceNames() {
    return this.#serviceNames.values()
  }
  hasBindingFor(serviceName: ServiceName): boolean {
    return this.#serviceNames.has(serviceName)
  }
}
