import startSystem from "dixlib"

try {
  const start = performance.now()
  const system = await startSystem([])
  const news = await system.loader().provide('std.news')
  news.debug("started system %O in %d ms", system, performance.now() - start)
} catch (cause) {
  console.error(new Error("cannot start system", { cause }))
}
