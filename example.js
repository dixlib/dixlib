import startSystem from "dixlib"

try {
  const start = performance.now()
  const system = await startSystem([])
  const stop = performance.now()
  const loader = system.loader()
  const [assert, data, definition, future, kernel, meta, news, portability, syntax, theater] = await loader.use(
    "std.assert",
    "std.data",
    "std.data.definition",
    "std.theater.future",
    "std.kernel",
    "std.data.meta",
    "std.news",
    "std.data.portability",
    "std.syntax",
    "std.theater"
  )
  news.info("started at %d ms in %d ms", start, stop - start)
  news.info(
    "services: %O %O %O %O %O %O %O %O %O %O %O %O",
    assert,
    data,
    definition,
    future,
    kernel,
    loader,
    meta,
    news,
    portability,
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
  subloggerRef().report({
    origin: [42, 5, 0],
    timestamp: 12345,
    format: "bla %s %d",
    parameters: ["di bla", id],
    severity: "error",
  })
  subloggerRef().bla()
  setTimeout(() => subsystemRef().terminate(), 2_000)
  const space = await meta.inflate("std.data")
  news.info("binary hashcode %O", space.hashcode)
  news.info("base64 hashcode %O", await kernel.encodeBase64URI(space.hashcode))
  news.info("test result %O", await system.test())
  // space.evaluate("<[(Data.Bla(D.S, string), D.B)]>").match({
  //   string() {
  //     news.log("singular type!")
  //   },
  //   union() {
  //     news.log("union type")
  //   },
  //   orelse() {
  //     news.log("something else")
  //   },
  // })
  // news.log("uneval string: %s", space.unevaluate(space.evaluate("string")).next().value.text)
  // news.log("uneval boolean: %s", space.unevaluate(space.evaluate("boolean")).next().value.text)
  // news.info("metadata: %o", space)
  // const format = portability.createDefaultFormat(space)
  // const listNumbersType = space.evaluate("[int32]")
  // const list = data.list(listNumbersType, [1, 2, 3, 4])
  // news.info("%o", format.marshall(list))
  // news.info("%o", format.marshall(list, "[int32]"))
  // news.info("%o", format.marshall(void 0))
  // news.info("%o", definition.parseTypeExpression("101").text)
  // news.info("%o", format.unmarshall(format.marshall(list)))
} catch (cause) {
  console.error(new Error("cannot start system", { cause }))
}
