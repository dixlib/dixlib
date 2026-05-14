import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.system">): Promise<Service["std.system"]> => {
  ;[concurrency, fn, future, fx, kernel, loader, news, quality, theater] = await use(
    "std.theater.concurrency",
    "std.fn",
    "std.theater.future",
    "std.fx",
    "std.kernel",
    "std.loader",
    "std.news",
    "std.quality",
    "std.theater"
  )
  return import("./intern.js")
}

export let concurrency: Service["std.theater.concurrency"]

export let fn: Service["std.fn"]

export let future: Service["std.theater.future"]

export let fx: Service["std.fx"]

export let kernel: Service["std.kernel"]

export let loader: Service["std.loader"]

export let news: Service["std.news"]

export let quality: Service["std.quality"]

export let theater: Service["std.theater"]
