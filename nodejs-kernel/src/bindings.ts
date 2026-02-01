import type { ServiceBindings } from "dixlib"

export const id = import.meta.url

export const service: ServiceBindings = { "std.kernel": { implementation: true } }
