import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<"std.net">): Promise<Service["std.net"]> => {
  use
  return import("./intern.js")
}
