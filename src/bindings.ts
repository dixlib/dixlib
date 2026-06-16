import type Dixlib from "dixlib"

export const id = import.meta.url

export const service: Dixlib.ServiceBindings = {
  "std.assert": { specification: true, implementation: true },
  "std.config": { specification: true, implementation: true },
  "std.data": { specification: true, implementation: true, typedefs: true },
  "std.fn": { specification: true, implementation: true, verification: true },
  "std.future": { specification: true, implementation: true },
  "std.fx": { specification: true, implementation: true },
  "std.kernel": { specification: true, implementation: true },
  "std.loader": { specification: true },
  "std.net": { specification: true, implementation: true, typedefs: false, configuration: false },
  "std.news": { specification: true, implementation: true },
  "std.quality": { specification: true, implementation: true },
  "std.syntax": { specification: true, implementation: true },
  "std.system": { specification: true, implementation: true },
  "std.theater": { specification: true, implementation: true },
}
