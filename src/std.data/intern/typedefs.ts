// --- TypeScript ---
import type Data from 'std.data'
interface TypeDefinitionsModule {
  // optional names of services whose type definitions should be included
  readonly include?: string[]
  // sources of type definitions
  readonly definitions: { readonly [name: string]: string }
}
// --- JavaScript ---
import { loader, loop } from "../extern.js"
import { parseTypeExpression } from "./language.js"

export function loadTypeDefinitions(serviceName: string): Promise<Data.TypeDefinitions> {
  return loading[serviceName] ??= load(serviceName)
}

// ----------------------------------------------------------------------------------------------------------------- //
// keep track of services whose type definitions are being loaded, or already have been loaded
const loading: { [serviceName: string]: Promise<Data.TypeDefinitions> } = Object.create(null)
// compute dependency graph to detect inclusion cycles
const dependencyGraph: { [serviceName: string]: Set<string> } = Object.create(null)
// load type definitions of service
async function load(serviceName: string): Promise<Data.TypeDefinitions> {
  const dependencies = dependencyGraph[serviceName] = new Set()
  // query loader to locate module with type definitions
  const bundles = []
  for (const result of loader.query({ aspects: ["typedefs"] })) {
    if (result.hasBindingFor(serviceName)) {
      bundles.push(result.bundle)
    }
  }
  // only one bundle can provide type definitions for a service
  if (bundles.length === 0) {
    throw new Error(`unable to locate type definitions for service '${serviceName}'`)
  } else if (bundles.length > 1) {
    throw new Error(`duplicate type definitions for '${serviceName}' in bundles "${bundles.join("\",\"")}"`)
  }
  // load module with type definitions (datatype.js)
  const location = new URL(`${serviceName}/datatype.js`, bundles[0]).href
  const module: TypeDefinitionsModule = await import(location)
  // parse sources of type expressions
  const accu: { [typeName: string]: Data.TypeExpression } = Object.create(null)
  for (const typeName in module.definitions) {
    accu[typeName] = parseTypeExpression(module.definitions[typeName], `${location}@${typeName}`)
  }
  // check for cycles in dependency graph
  const inclusions = [...new Set(module.include ?? []).values()]
  for (const dependency of inclusions) {
    dependencies.add(dependency)
    for (const indirect of dependencyGraph[dependency] ?? loop.over()) {
      dependencies.add(indirect)
    }
    if (dependencies.has(serviceName)) {
      throw new Error(`cyclic inclusion of type definitions from service '${serviceName}' to '${dependency}'`)
    }
  }
  // load included type definitions
  const predefined = await Promise.all(inclusions.map(loadTypeDefinitions))
  // safely merge included type definitions into accumulator 
  for (let i = 0; i < inclusions.length; ++i) {
    const dependency = inclusions[i], definitions = predefined[i]
    for (const typeName in definitions) {
      const expression = definitions[typeName]
      if (accu[typeName] && accu[typeName] !== expression) {
        throw new Error(`merge conflict for type "${typeName}" in '${serviceName}' while including '${dependency}'`)
      }
      accu[typeName] = expression
    }
  }
  return Object.freeze(accu)
}
