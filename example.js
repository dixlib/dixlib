import startSystem from "dixlib"

try {
  const start = performance.now()
  const system = await startSystem([])
  const stop = performance.now()
  const loader = system.loader(), news = await loader.provide('std.news')
  news.debug("started system %O in %d ms", system, stop - start)
  const [data, future, theater] = await Promise.all([
    loader.provide('std.data'),
    loader.provide('std.future'),
    loader.provide('std.theater'),
  ])
  news.debug("services: %O %O %O", data, future, theater)
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
  theater.run(function* () {
    yield future.timeout(2_000)
    yield subsystem.kill()
  })
  const definitions = await data.loadTypeDefinitions('std.data')
  const space = data.inflate(definitions)
  space.evaluate("Data.Bla(string, string)").match({ 
    string() { console.log("singular type!") },
    union() { console.log("union type") }, 
  })
  news.debug("data space: %O", space)
  await theater.cast({ Role: system.Nearby(), p: [id, ""], guard: () => "punish" }).bla(42)
} catch (cause) {
  console.error(new Error("cannot start system", { cause }))
}
