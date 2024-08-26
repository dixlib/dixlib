import startSystem from "dixlib"

try {
  const start = performance.now()
  const system = await startSystem([])
  const stop = performance.now()
  const loader = system.loader(), news = await loader.provide('std.news')
  news.debug("started system %O in %d ms", system, stop - start)
  const [future, theater] = await Promise.all([
    loader.provide('std.future'),
    loader.provide('std.theater'),
  ])
  theater.play(function* () {
    news.info("waiting for 500 ms")
    yield future.timeout(500)
    news.info("done waiting")
    throw "yikes"
  }).run()
  const subsystem = theater.cast({ Role: system.Subsidiary(), p: [[]], guard: () => "punish" })
  const id = await subsystem.id()
  news.info("started subsystem (%d)", id)
  const sublogger = theater.cast({ Role: system.Nearby(), p: [id, "logger"], guard: () => "punish" })
  const now = performance.now()
  await sublogger.report({
    severity: "error",
    format: "Hello from sublogger",
    parameters: [],
    timestamp: now,
    origin: [id, 0]
  })
  await theater.cast({ Role: system.Nearby(), p: [id, ""], guard: () => "punish" }).bla(42)
} catch (cause) {
  console.error(new Error("cannot start system", { cause }))
}
