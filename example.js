import startSystem from "dixlib"

try {
  const start = performance.now()
  const system = await startSystem([])
  const loader = system.loader()
  const [agency, data, future, kernel, news, syntax, theater] = await Promise.all([
    loader.provide("std.agency"),
    loader.provide("std.data"),
    loader.provide("std.future"),
    loader.provide("std.kernel"),
    loader.provide("std.news"),
    loader.provide("std.syntax"),
    loader.provide("std.theater"),
  ])
  news.info("started at %d", start)
  news.info("services: %o %o %o %o %o %o %o %o %0", agency, data, future, kernel, loader, news, syntax, system, theater)
  const subsystemServer = theater.startActor(system.Subsidiary(), [])
  const subsystemClient = theater.startActor(agency.Client(), subsystemServer)
  const subsystem = agency.createAgent(subsystemClient)
  const id = await subsystem.id()
  subsystem.tada()
  const sublogger = theater.startActor(system.Nearby(), id, "log")
  sublogger.report({
    origin: [42, 5, 0],
    timestamp: 12345,
    format: "bla %s",
    parameters: ["di bla"],
    severity: "error",
  })
  sublogger.bla()
  const subRootServer = theater.startActor(system.NearbyServer(), id, "")
  const subRootClient = theater.startActor(agency.Client(), subRootServer)
  const subRoot = agency.createAgent(subRootClient)
  news.debug("ancestry sub=%o", await subRoot.ancestry())
  const subs = []
  for (let i = 0; i < 20; ++i) {
    subs[i] = agency.createAgent(theater.startActor(agency.Client(), theater.startActor(system.Subsidiary(), [])))
  }
  const definitions = await data.loadTypeDefinitions("std.data")
  const space = await data.inflate(definitions)
  news.info("binary hashcode %o", space.hashcode)
  news.info("base64 hashcode %o", await kernel.encodeBase64URI(space.hashcode))
  space.evaluate("Data.Bla(string, string)").match({
    string() {
      news.log("singular type!")
    },
    union() {
      news.log("union type")
    },
  })
  news.info("data space: %o", space)
  setTimeout(() => {
    subsystem.shutdown()
    for (const sub of subs) {
      sub.shutdown()
    }
  }, 2_000)
} catch (cause) {
  console.error(new Error("cannot start system", { cause }))
}
