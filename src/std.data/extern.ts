import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.data">): Promise<Service["std.data"]> => {
  ;[fn] = await use("std.fn")
  return import("./intern.js")
}

export let fn: Service["std.fn"]
