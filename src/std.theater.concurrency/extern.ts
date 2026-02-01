import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.theater.concurrency">): Promise<Service["std.theater.concurrency"]> => {
  ;[future] = await use("std.theater.future")
  return import("./intern.js")
}

export let future: Service["std.theater.future"]
