import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.news">): Promise<Service["std.news"]> => {
  ;[future] = await use("std.future")
  return import("./intern.js")
}

export let future: Service["std.future"]
