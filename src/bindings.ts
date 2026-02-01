import type { ServiceBindings } from "dixlib"

export const id = import.meta.url

export const service: ServiceBindings = {
  "std.data": { specification: true, implementation: true, typedefs: true },
  "std.data.definition": { specification: true, implementation: true },
  "std.data.meta": { specification: true, implementation: true },
  "std.data.portability": { specification: true, implementation: true },
  "std.fn": { specification: true, implementation: true },
  "std.fx": { specification: true, implementation: true },
  "std.kernel": { specification: true, implementation: true },
  "std.loader": { specification: true },
  "std.news": { specification: true, implementation: true },
  "std.syntax": { specification: true, implementation: true },
  "std.system": { specification: true, implementation: true },
  "std.theater": { specification: true, implementation: true },
  "std.theater.agency": { specification: true, implementation: true },
  "std.theater.concurrency": { specification: true, implementation: true },
  "std.theater.future": { specification: true, implementation: true },
}
