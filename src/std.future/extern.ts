import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.future">): Promise<Service["std.future"]> => {
  ;[fx] = await use("std.fx")
  return import("./intern.js")
}

export let fx: Service["std.fx"]
