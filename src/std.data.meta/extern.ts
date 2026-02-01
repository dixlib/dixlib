import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.data.meta">): Promise<Service["std.data.meta"]> => {
  ;[data, definition, fx, loader, news] = await use(
    "std.data",
    "std.data.definition",
    "std.fx",
    "std.loader",
    "std.news"
  )
  return import("./intern.js")
}

export let data: Service["std.data"]

export let definition: Service["std.data.definition"]

export let fx: Service["std.fx"]

export let loader: Service["std.loader"]

export let news: Service["std.news"]
