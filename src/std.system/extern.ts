// --- TypeScript ---
import type Future from 'std.future'
import type Fx from 'std.fx'
import type Kernel from 'std.kernel'
import type Loader from 'std.loader'
import type Loop from 'std.loop'
import type News from 'std.news'
import type System from 'std.system'
import type Theater from 'std.theater'

// --- JavaScript ---
export default async ({ use }: Contract<System>): Promise<System> => {
  [future, fx, kernel, loader, loop, news, theater] = await use(
    'std.future',
    'std.fx',
    'std.kernel',
    'std.loader',
    'std.loop',
    'std.news',
    'std.theater'
  )
  return import("./intern.js")
}
export let future: Future, fx: Fx, kernel: Kernel, loader: Loader, loop: Loop, news: News, theater: Theater
