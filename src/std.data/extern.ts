import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.data">): Promise<Service["std.data"]> => {
  ;[fn, fx, loader, news, syntax] = await use("std.fn", "std.fx", "std.loader", "std.news", "std.syntax")
  return import("./intern.js")
}

export let fn: Service["std.fn"]

export let fx: Service["std.fx"]

export let loader: Service["std.loader"]

export let news: Service["std.news"]

export let syntax: Service["std.syntax"]
