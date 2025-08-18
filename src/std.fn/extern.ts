import type { Service } from "dixlib"

export default (): Promise<Service["std.fn"]> => import("./intern.js")
