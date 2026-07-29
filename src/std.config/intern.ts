import type Dixlib from "dixlib"
import type Config from "std.config"
import type Data from "std.data"
import { data, loader } from "./extern.js"

export function select<Options extends Data.Value>(serviceName: Dixlib.ServiceName): Promise<Options> {
  if (!selectingOptions[serviceName]) {
    selectingOptions[serviceName] = selecting(serviceName)
  }
  return selectingOptions[serviceName] as Promise<Options>
}

// ----------------------------------------------------------------------------------------------------------------- //
const selectingOptions: { [Name in Dixlib.ServiceName]?: Promise<Data.Value> } = Object.create(null)
async function selecting<Options extends Data.Value>(serviceName: Dixlib.ServiceName): Promise<Options> {
  const configStack: Config.ConfigModule[] = []
  for (const result of loader.query({ aspects: ["configuration"] })) {
    if (result.hasBindingFor(serviceName)) {
      const configModule: Config.ConfigModule = await import(new URL(`${serviceName}/config.js`, result.bundle).href)
      if (configStack.length === 0) {
        if (!configModule.datatype) {
          throw new Error(`bundle ${result.bundle} lacks a config type definition of '${serviceName}'`)
        }
        // the bundle that defines config type, must also define the service itself (because they go hand in hand)
        if (!loader.binds(serviceName, "specification", result.bundle)) {
          throw new Error(`bundle ${result.bundle} defines a config type but it does not define '${serviceName}'`)
        }
      } else {
        const datatype = configStack[0].datatype
        if (configModule.datatype && configModule.datatype !== datatype) {
          throw new Error(`bundle ${result.bundle} redefines config type "${datatype}" of '${serviceName}'`)
        }
      }
      configStack.push(configModule)
    }
  }
  // the configuration is undefined when there are no config modules for the service
  if (configStack.length === 0) {
    return void 0 as Options
  } else {
    // first merge the JSON representation from the stack of config modules
    let options: Data.JSON = null
    for (const configModule of configStack) {
      options = deepMerge(options, configModule.options)
    }
    // create a formatter to unmarshall the config value from the merged JSON options
    const datatype = configStack[0].datatype as string
    const [typeServiceName, typeSource] = datatype.split("/")
    const dataspace = await data.inflate(typeServiceName as Dixlib.ServiceName)
    return data.createFormatJSON(dataspace).unmarshall(options, typeSource) as Options
  }
}
function deepMerge(options: Data.JSON, refinement: Data.JSON): Data.JSON {
  if (isJSONObject(options) && isJSONObject(refinement)) {
    // deep merge of two JSON objects
    const result = structuredClone(options)
    for (const key in refinement) {
      result[key] = deepMerge(options[key] ?? null, refinement[key])
    }
    return result
  } else {
    // refinement replaces default, if either default or refinement is not a JSON object
    return structuredClone(refinement)
  }
}
function isJSONObject(json: Data.JSON): json is { readonly [key: string]: Data.JSON } {
  return typeof json === "object" && json !== null && !Array.isArray(json)
}
