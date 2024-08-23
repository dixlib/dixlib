// --- TypeScript ---
import type Data from 'std.data'
import type Fx from 'std.fx'
import type Loop from 'std.loop'
import type Syntax from 'std.syntax'
// --- JavaScript ---
export default async ({ use }: Contract<Data>): Promise<Data> => {
  [fx, loop, syntax] = await use('std.fx', 'std.loop', 'std.syntax')
  return import("./intern.js")
}
export let fx: Fx, loop: Loop, syntax: Syntax