import type Dixlib from "dixlib"

export const id = import.meta.url

export const service: Dixlib.ServiceBindings = {
  "std.kernel": { implementation: true },
}
