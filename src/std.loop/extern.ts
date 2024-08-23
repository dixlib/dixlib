// --- TypeScript ---
import type Fn from 'std.fn'
import type Loop from 'std.loop'
// --- JavaScript ---
export default async ({ use }: Contract<Loop>): Promise<Loop> => {
  [fn] = await use('std.fn')
  return import("./intern.js")
}
export let fn: Fn