import startSystem from "dixlib"

try {
  const start = performance.now()
  const system = await startSystem([])
  const loader = system.loader()
  const [agency, data, definition, future, kernel, meta, news, portability, syntax, theater] = await Promise.all([
    loader.provide("std.theater.agency"),
    loader.provide("std.data"),
    loader.provide("std.data.definition"),
    loader.provide("std.theater.future"),
    loader.provide("std.kernel"),
    loader.provide("std.data.meta"),
    loader.provide("std.news"),
    loader.provide("std.data.portability"),
    loader.provide("std.syntax"),
    loader.provide("std.theater"),
  ])
  news.info("started at %d", start)
  news.info(
    "services: %o %o %o %o %o %o %o %o %o %o %o",
    agency,
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
  const subsystemServer = theater.startActor(system.Subsidiary(), [])
  const subsystemClient = theater.startActor(agency.Client(), subsystemServer)
  const subsystem = agency.createAgent(subsystemClient)
  const id = await subsystem.id()
  subsystem.tada()
  const sublogger = theater.startActor(system.Nearby(), id, "log")
  sublogger.report({
    origin: [42, 5, 0],
    timestamp: 12345,
    format: "bla %s %d",
    parameters: ["di bla", id],
    severity: "error",
  })
  sublogger.bla()
  const subRootServer = theater.startActor(system.NearbyServer(), id, "")
  const subRootClient = theater.startActor(agency.Client(), subRootServer)
  const subRoot = agency.createAgent(subRootClient)
  news.debug("ancestry sub=%o", await subRoot.ancestry())
  const subs = []
  for (let i = 0; i < 2; ++i) {
    subs[i] = agency.createAgent(theater.startActor(agency.Client(), theater.startActor(system.Subsidiary(), [])))
  }
  setTimeout(async () => {
    await subsystem.shutdown()
    for (const sub of subs) {
      await sub.shutdown()
    }
  }, 2_000)
  const space = await meta.inflate("std.data")
  news.info("binary hashcode %o", space.hashcode)
  news.info("base64 hashcode %o", await kernel.encodeBase64URI(space.hashcode))
  space.evaluate("<[(Data.Bla(D.S, string), D.B)]>").match({
    string() {
      news.log("singular type!")
    },
    union() {
      news.log("union type")
    },
    orelse() {
      news.log("something else")
    },
  })
  news.log("uneval string: %s", space.unevaluate(space.evaluate("string")).next().value.text)
  news.log("uneval boolean: %s", space.unevaluate(space.evaluate("boolean")).next().value.text)
  news.info("metadata: %o", space)
  const format = portability.createDefaultFormat(space)
  const listNumbersType = space.evaluate("[int32]")
  const list = data.list(listNumbersType, [1, 2, 3, 4])
  news.info("%o", format.marshall(list))
  news.info("%o", format.marshall(list, "[int32]"))
  news.info("%o", format.marshall(void 0))
  news.info("%o", definition.parseTypeExpression("101").text)
  news.info("%o", format.unmarshall(format.marshall(list)))
} catch (cause) {
  console.error(new Error("cannot start system", { cause }))
}
