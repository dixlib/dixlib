// --- TypeScript ---
import type Kernel from 'std.kernel'
// --- JavaScript ---
export default (): Promise<Kernel> => import("./intern.js")
