import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.theater">): Promise<Service["std.theater"]> => {
  ;[fn, future, fx, kernel, news] = await use("std.fn", "std.future", "std.fx", "std.kernel", "std.news")
  return import("./intern.js")
}

export let fn: Service["std.fn"]

export let future: Service["std.future"]

export let fx: Service["std.fx"]

export let kernel: Service["std.kernel"]

export let news: Service["std.news"]
