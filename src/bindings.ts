import type { ServiceBindings } from "dixlib"

export const id = import.meta.url

export const service: ServiceBindings = {
  "std.agency": { specification: true, implementation: true },
  "std.concurrency": { specification: true, implementation: true },
  "std.data": { specification: true, implementation: true, typedefs: true },
  "std.fn": { specification: true, implementation: true },
  "std.future": { specification: true, implementation: true },
  "std.fx": { specification: true, implementation: true },
  "std.kernel": { specification: true, implementation: true },
  "std.loader": { specification: true },
  "std.news": { specification: true, implementation: true },
  "std.syntax": { specification: true, implementation: true },
  "std.system": { specification: true, implementation: true },
  "std.theater": { specification: true, implementation: true },
}
