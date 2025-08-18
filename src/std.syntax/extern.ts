import type { Service } from "dixlib"

export default (): Promise<Service["std.syntax"]> => {
  return import("./intern.js")
}
