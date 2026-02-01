import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.data.definition">): Promise<Service["std.data.definition"]> => {
  ;[syntax] = await use("std.syntax")
  return import("./intern.js")
}

export let syntax: Service["std.syntax"]
