import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.concurrency">): Promise<Service["std.concurrency"]> => {
  ;[future] = await use("std.future")
  return import("./intern.js")
}

export let future: Service["std.future"]
