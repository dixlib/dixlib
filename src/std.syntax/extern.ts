// --- TypeScript ---
import type Loop from 'std.loop'
import type Syntax from 'std.syntax'
// --- JavaScript ---
export default async ({ use }: Contract<Syntax>): Promise<Syntax> => {
  [loop] = await use('std.loop')
  return import("./intern.js")
}
export let loop: Loop
