import type { Service } from "dixlib"

export default (): Promise<Service["std.kernel"]> => import("./intern.js")
