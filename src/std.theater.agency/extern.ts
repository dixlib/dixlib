import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.theater.agency">): Promise<Service["std.theater.agency"]> => {
  ;[fn, fx, news, theater] = await use("std.fn", "std.fx", "std.news", "std.theater")
  return import("./intern.js")
}

export let fn: Service["std.fn"]

export let fx: Service["std.fx"]

export let news: Service["std.news"]

export let theater: Service["std.theater"]
