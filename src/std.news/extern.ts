import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.news">): Promise<Service["std.news"]> => {
  ;[concurrency] = await use("std.theater.concurrency")
  return import("./intern.js")
}

export let concurrency: Service["std.theater.concurrency"]
