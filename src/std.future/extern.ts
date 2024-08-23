// --- TypeScript ---
import type Fn from 'std.fn'
import type Future from 'std.future'
import type Fx from 'std.fx'
import type Loop from 'std.loop'
// --- JavaScript ---
export default async ({ use }: Contract<Future>): Promise<Future> => {
  [fn, fx, loop] = await use('std.fn', 'std.fx', 'std.loop')
  return import("./intern.js")
}
export let fn: Fn, fx: Fx, loop: Loop
