import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.theater.future">): Promise<Service["std.theater.future"]> => {
  ;[fx] = await use("std.fx")
  return import("./intern.js")
}

export let fx: Service["std.fx"]
