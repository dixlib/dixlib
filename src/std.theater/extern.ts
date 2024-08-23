// --- TypeScript ---
import type Future from 'std.future'
import type Fx from 'std.fx'
import type Kernel from 'std.kernel'
import type Loop from 'std.loop'
import type Theater from 'std.theater'
// --- JavaScript ---
export default async ({ use }: Contract<Theater>): Promise<Theater> => {
  [future, fx, kernel, loop] = await use('std.future', 'std.fx', 'std.kernel', 'std.loop')
  return import("./intern.js")
}
export let future: Future, fx: Fx, kernel: Kernel, loop: Loop
