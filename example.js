import startSystem from "dixlib"

try {
  const start = performance.now()
  const system = await startSystem([])
  const stop = performance.now()
  const loader = system.loader()
  const [assert, config, data, future, kernel, net, news, syntax, theater] = await loader.use(
    "std.assert",
    "std.config",
    "std.data",
    "std.future",
    "std.kernel",
    "std.net",
    "std.news",
    "std.syntax",
    "std.theater"
  )
  news.info("started at %d ms in %d ms", start, stop - start)
  news.info(
    "services: %O %O %O %O %O %O %O %O %O %O",
    assert,
    data,
    future,
    kernel,
    loader,
    net,
    news,
    syntax,
    system,
    theater
  )
  const subsystemRef = theater.startActor(system.Subsidiary(), [])
  const id = await system.ask(subsystemRef, subsystem => subsystem.id())
  news.info("subsystem %d started?", id)
  news.info("%O", system.root().resolve(`subsidiary/${id}`))
  subsystemRef().tada()
  const subloggerRef = theater.startActor(system.Nearby(), id, "logger")
  subloggerRef().bla()
  subloggerRef().report({
    origin: [42, 5, 0],
    timestamp: 12345,
    format: "bla %s %d",
    parameters: ["di bla", id],
    severity: "error",
  })
  setTimeout(() => subsystemRef().terminate(), 2_000)
  const dataspace = await data.inflate("std.data")
  news.info("binary hashcode %O %O", dataspace.hashcode, dataspace)
  news.info("base64 hashcode %O", await kernel.encodeBase64URI(dataspace.hashcode))
  const qualityRef = theater.startActor(system.Nearby(), id, "quality")
  news.info("test result %O", await system.ask(qualityRef, quality => quality.runTest({})))
  const options = await config.select("std.data")
  news.info("%O", options)
  // net.join()
} catch (cause) {
  console.error(new Error("cannot start system", { cause }))
}
