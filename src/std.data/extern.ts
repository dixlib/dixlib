// --- TypeScript ---
import type Data from 'std.data'
import type Fx from 'std.fx'
import type Loader from 'std.loader'
import type Loop from 'std.loop'
import type News from 'std.news'
import type Syntax from 'std.syntax'
// --- JavaScript ---
export default async ({ use }: Contract<Data>): Promise<Data> => {
  [fx, loader, loop, news, syntax] = await use('std.fx', 'std.loader', 'std.loop', 'std.news', 'std.syntax')
  return import("./intern.js")
}
export let fx: Fx, loader: Loader, loop: Loop, news: News, syntax: Syntax