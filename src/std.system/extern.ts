import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.system">): Promise<Service["std.system"]> => {
  ;[agency, concurrency, fn, future, fx, kernel, loader, news, theater] = await use(
    "std.agency",
    "std.concurrency",
    "std.fn",
    "std.future",
    "std.fx",
    "std.kernel",
    "std.loader",
    "std.news",
    "std.theater"
  )
  return import("./intern.js")
}

export let agency: Service["std.agency"]

export let concurrency: Service["std.concurrency"]

export let fn: Service["std.fn"]

export let future: Service["std.future"]

export let fx: Service["std.fx"]

export let kernel: Service["std.kernel"]

export let loader: Service["std.loader"]

export let news: Service["std.news"]

export let theater: Service["std.theater"]
