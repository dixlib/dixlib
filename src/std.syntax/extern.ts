import type { Service } from "dixlib"

export default (): Promise<Service["std.syntax"]> => import("./intern.js")
