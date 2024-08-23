// --- TypeScript ---
import type Fn from 'std.fn'
// --- JavaScript ---
export default (): Promise<Fn> => import("./intern.js")