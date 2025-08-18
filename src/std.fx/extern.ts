import type { Service } from "dixlib"

export default (): Promise<Service["std.fx"]> => import("./intern.js")
