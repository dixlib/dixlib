import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.config">): Promise<Service["std.config"]> => {
  ;[data, loader] = await use("std.data", "std.loader")
  return import("./intern.js")
}

export let data: Service["std.data"]

export let loader: Service["std.loader"]
