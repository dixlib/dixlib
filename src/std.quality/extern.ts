import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.quality">): Promise<Service["std.quality"]> => {
  ;[assert, future, fx, loader, news, theater] = await use(
    "std.assert",
    "std.theater.future",
    "std.fx",
    "std.loader",
    "std.news",
    "std.theater"
  )
  return import("./intern.js")
}

export let assert: Service["std.assert"]

export let future: Service["std.theater.future"]

export let fx: Service["std.fx"]

export let loader: Service["std.loader"]

export let news: Service["std.news"]

export let theater: Service["std.theater"]
