import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.system">): Promise<Service["std.system"]> => {
  ;[fn, future, fx, kernel, loader, news, quality, theater] = await use(
    "std.fn",
    "std.future",
    "std.fx",
    "std.kernel",
    "std.loader",
    "std.news",
    "std.quality",
    "std.theater"
  )
  return import("./intern.js")
}

export let fn: Service["std.fn"]

export let future: Service["std.future"]

export let fx: Service["std.fx"]

export let kernel: Service["std.kernel"]

export let loader: Service["std.loader"]

export let news: Service["std.news"]

export let quality: Service["std.quality"]

export let theater: Service["std.theater"]
