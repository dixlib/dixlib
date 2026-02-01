import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.data.portability">): Promise<Service["std.data.portability"]> => {
  ;[data, definition, fn, meta] = await use("std.data", "std.data.definition", "std.fn", "std.data.meta")
  return import("./intern.js")
}

export let data: Service["std.data"]

export let definition: Service["std.data.definition"]

export let fn: Service["std.fn"]

export let meta: Service["std.data.meta"]
