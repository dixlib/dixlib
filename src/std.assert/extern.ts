import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.assert">): Promise<Service["std.assert"]> => {
  ;[data] = await use("std.data")
  return import("./intern.js")
}

export let data: Service["std.data"]
