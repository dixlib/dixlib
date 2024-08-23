// --- TypeScript ---
import type Future from 'std.future'
import type News from 'std.news'
// --- JavaScript ---
export default async ({ use }: Contract<News>): Promise<News> => {
  [future] = await use('std.future')
  return import("./intern.js")
}
export let future: Future
