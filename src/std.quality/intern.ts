import type Dixlib from "dixlib"
import type Loader from "std.loader"
import type Quality from "std.quality"
import type Theater from "std.theater"
import { assert, future, fx, loader, news, theater } from "./extern.js"

export function TestRunner() {
  return TestRunnerRole
}

// ----------------------------------------------------------------------------------------------------------------- //
class TestRunnerRole extends theater.Role<Quality.TestRunner>()(Object) implements Theater.Script<Quality.TestRunner> {
  #defaultWatcherRef: Theater.ActorRef<Quality.TestWatcher> | undefined
  get #watcherRef() {
    return this.#defaultWatcherRef as Theater.ActorRef<Quality.TestWatcher>
  }
  // determine (service name, bundle id) pairs with test modules that implement a service test
  #determineTestLoad(name?: Dixlib.ServiceName, bundle?: string): Set<[Dixlib.ServiceName, string]> {
    const options: Loader.QueryOptions = {
      orientation: "vertical",
      aspects: ["verification"],
      bundles: bundle ? [bundle] : void 0,
    }
    const testLoad = new Set<[Dixlib.ServiceName, string]>()
    for (const queryResult of loader.query(options)) {
      if (!name) {
        queryResult.serviceNames.forEach(serviceName => {
          testLoad.add([serviceName, queryResult.bundle])
        })
      } else if (queryResult.hasBindingFor(name)) {
        testLoad.add([name, queryResult.bundle])
      }
    }
    return testLoad
  }
  protected *initializeRole() {
    yield* super.initializeRole()
    // default watcher if runner is not being watched by a sender (e.g. when questioner is initiating the tests)
    this.#defaultWatcherRef = this.castChild<Quality.TestWatcher, []>({
      Role: DefaultWatcherRole,
      parameters: [],
      guard: guardWatcher,
    })
  }
  @theater.Play
  *runTest({ name, bundle, watch }: Quality.TestConfiguration): Theater.Scene {
    // determine test modules to load in this run
    const testLoad = this.#determineTestLoad(name, bundle)
    // spawn child collector that accumulates a test report, using a watcher to track progress
    const context = this.messageContext()
    const watcherRef = watch ? (context.sender as Theater.ActorRef<Quality.TestWatcher>) : this.#watcherRef
    const collectorRef = this.castChild<
      Collector,
      [Set<[Dixlib.ServiceName, string]>, Theater.ActorRef<Quality.TestWatcher>]
    >({
      Role: CollectorRole,
      parameters: [testLoad, watcherRef],
      guard: guardCollector,
    })
    // pass message context to collector and start generating a test report for the sender
    collectorRef(context).generateReport()
  }
}
const guardWatcher = theater.createDefaultGuard("forgive", "unexpected incident with default test watcher: %O")
// default watcher reports progress as debug news messages
class DefaultWatcherRole
  extends theater.Role<Quality.TestWatcher>()(Object)
  implements Theater.Script<Quality.TestWatcher>
{
  @theater.Play
  *beginPreparation(name: Dixlib.ServiceName, bundle: string, start: number): Theater.Scene {
    news.debug("started service test preparation of service '%s' in bundle %s at %s", name, bundle, start)
  }
  @theater.Play
  *endPreparation(
    name: Dixlib.ServiceName,
    bundle: string,
    start: number,
    stop: number,
    failure?: Error | undefined
  ): Theater.Scene {
    news.debug(
      "completed service test preparation of service '%s' in bundle %s at %s (%s ms) [%O]",
      name,
      bundle,
      stop,
      (stop - start).toFixed(3),
      failure ?? "success"
    )
  }
  @theater.Play
  *beginOperationTest(name: Dixlib.ServiceName, bundle: string, operation: never, start: number): Theater.Scene {
    news.debug("started service operation test '%s'.%s in bundle %s at %s", name, operation, bundle, start)
  }
  @theater.Play
  *endOperationTest(
    name: Dixlib.ServiceName,
    bundle: string,
    operation: never,
    start: number,
    stop: number,
    failure?: Error | undefined
  ): Theater.Scene {
    news.debug(
      "completed service operation test '%s'.%s in bundle %s at %s (%s ms) [%O]",
      name,
      operation,
      bundle,
      stop,
      (stop - start).toFixed(3),
      failure ?? "success"
    )
  }
  @theater.Play
  *beginDestruction(name: Dixlib.ServiceName, bundle: string, start: number): Theater.Scene {
    news.debug("started service test destruction of service '%s' in bundle %s at %s", name, bundle, start)
  }
  @theater.Play
  *endDestruction(
    name: Dixlib.ServiceName,
    bundle: string,
    start: number,
    stop: number,
    failure?: Error | undefined
  ): Theater.Scene {
    news.debug(
      "completed service test destruction of service '%s' in bundle %s at %s (%s ms) [%O]",
      name,
      bundle,
      stop,
      (stop - start).toFixed(3),
      failure ?? "success"
    )
  }
}
const guardCollector = theater.createDefaultGuard(
  "punish",
  "aborting after unexpected incident with test collector: %O"
)
interface Collector extends Theater.Sender {
  generateReport(): Theater.OneWay
}
class CollectorRole extends theater.Role<Collector>()(Object) implements Theater.Script<Collector> {
  readonly #testLoad: Set<[Dixlib.ServiceName, string]>
  readonly #watcherRef: Theater.ActorRef<Quality.TestWatcher>
  readonly #collected: Set<Quality.ServiceTestReport<Dixlib.ServiceName>>
  #reply: Theater.MessageContext<Theater.Sender> | undefined
  #replyWithTestReport() {
    const report: { [Name in Dixlib.ServiceName]: Set<Quality.ServiceTestReport<Dixlib.ServiceName>> } =
      Object.create(null)
    for (const serviceTestReport of this.#collected) {
      const { name } = serviceTestReport
      report[name] ??= new Set<Quality.ServiceTestReport<Dixlib.ServiceName>>()
      report[name].add(serviceTestReport)
    }
    const reply = this.#reply as Theater.MessageContext<Theater.Sender>
    const sender = reply.sender as Theater.ActorRef<Theater.Sender>
    sender({ correlation: reply.correlation }).return(report as Quality.TestReport)
  }
  constructor(testLoad: Set<[Dixlib.ServiceName, string]>, watcherRef: Theater.ActorRef<Quality.TestWatcher>) {
    super()
    this.#testLoad = testLoad
    this.#watcherRef = watcherRef
    this.#collected = new Set()
    this.#reply = void 0
  }
  @theater.Play
  *generateReport(): Theater.Scene {
    // hold on to message context of sender to which the full report will be returned
    this.#reply = this.messageContext<Theater.Sender>()
    if (this.#testLoad.size === 0) {
      // reply with empty test report
      this.#replyWithTestReport()
    } else {
      for (const [name, bundle] of this.#testLoad) {
        // create dedicated child actor for each test module
        const testerRef = this.castChild<
          ServiceTester,
          [Dixlib.ServiceName, string, Theater.ActorRef<Quality.TestWatcher>]
        >({
          Role: ServiceTesterRole,
          parameters: [name, bundle, this.#watcherRef],
          guard: guardTester,
        })
        // run service test in child actor and collect returned result
        testerRef().testService(this.self)
      }
    }
  }
  @theater.Play
  *return<Result>(result: Result): Theater.Scene {
    this.#collected.add(result as Quality.ServiceTestReport<Dixlib.ServiceName>)
    // collected all service test reports?
    if (this.#collected.size === this.#testLoad.size) {
      // reply with full test report that contains collected service test reports
      this.#replyWithTestReport()
      // terminate the actor
      this.exitSelf()
    }
  }
}
function* guardTester(incident: Theater.Incident<Theater.Actor>): Theater.Scene<Theater.Verdict> {
  // escalate to collector
  throw new Error("unexpected incident with service tester", { cause: incident })
}
interface ServiceTester extends Theater.Actor {
  testService(collectorRef: Theater.ActorRef<Collector>): Theater.OneWay
}
class ServiceTesterRole<Name extends Dixlib.ServiceName>
  extends theater.Role<ServiceTester>()(Object)
  implements Theater.Script<ServiceTester>
{
  readonly #name: Name
  readonly #bundle: string
  readonly #watcherRef: Theater.ActorRef<Quality.TestWatcher>
  #successCount: number
  #failureCount: number;
  *#loadServiceTest(): Theater.Scene<Quality.ServiceTest<Name>> {
    const url = new URL(`${this.#name}/test.js`, this.#bundle)
    const [testModule, provider] = future.when<[Quality.TestModule<Name>, Dixlib.Service[Name]]>(
      yield future.pledge(Promise.all([import(url.toString()), loader.provide(this.#name)]))
    )
    // call default export of test module, passing assertion support and service provider as arguments
    return testModule.default({ assert, provider })
  }
  *#prepare({ prepare }: Quality.TestHooks): Theater.Scene<number> {
    const start = performance.now()
    let stop: number, failure: Error | undefined
    this.#watcherRef().beginPreparation(this.#name, this.#bundle, start)
    if (prepare) {
      try {
        future.when<void>(yield future.pledge(Promise.try(prepare, loader.use)))
      } catch (problem) {
        failure = new Error("preparation failure", { cause: problem })
      }
      stop = performance.now()
    } else {
      stop = start
    }
    this.#watcherRef().endPreparation(this.#name, this.#bundle, start, stop, failure)
    if (failure) {
      // rethrow as incident on stage to cancel the service tester when preparation fails
      throw failure
    } else {
      return start
    }
  }
  *#destroy({ destroy }: Quality.TestHooks): Theater.Scene<number> {
    const start = performance.now()
    let stop: number, failure: Error | undefined
    this.#watcherRef().beginDestruction(this.#name, this.#bundle, start)
    if (destroy) {
      try {
        future.when<void>(yield future.pledge(Promise.try(destroy)))
      } catch (problem) {
        failure = new Error("destruction failure", { cause: problem })
      }
      stop = performance.now()
    } else {
      stop = start
    }
    this.#watcherRef().endDestruction(this.#name, this.#bundle, start, stop, failure)
    // ignore any destruction failure
    return stop
  }
  *#testOperation(
    operation: keyof Dixlib.Service[Name],
    testCase: () => Promise<void> | void
  ): Theater.Scene<Quality.ServiceTestReport<Name>["operation"][keyof Dixlib.Service[Name]]> {
    const start = performance.now()
    this.#watcherRef().beginOperationTest(this.#name, this.#bundle, operation, start)
    let failure: Error | undefined
    try {
      future.when<void>(yield future.pledge(Promise.try(testCase)))
      ++this.#successCount
    } catch (problem) {
      failure = fx.erroneous(problem)
      ++this.#failureCount
    }
    const stop = performance.now()
    this.#watcherRef().endOperationTest(this.#name, this.#bundle, operation, start, stop, failure)
    return { failure, start, stop }
  }
  *#testOperations(testCases: Quality.TestCases<Name>): Theater.Scene<Quality.ServiceTestReport<Name>["operation"]> {
    const results: {
      [Operation in keyof Dixlib.Service[Name]]: Quality.ServiceTestReport<Name>["operation"][Operation]
    } = Object.create(null)
    for (const operation in testCases) {
      results[operation] = yield* this.#testOperation(operation, testCases[operation])
    }
    return results
  }
  constructor(name: Name, bundle: string, watcherRef: Theater.ActorRef<Quality.TestWatcher>) {
    super()
    this.#name = name
    this.#bundle = bundle
    this.#watcherRef = watcherRef
    this.#successCount = this.#failureCount = 0
  }
  @theater.Play
  *testService(collectorRef: Theater.ActorRef<Collector>): Theater.Scene {
    const [hooks, testCases] = yield* this.#loadServiceTest()
    // create report before dereferencing the collector ref
    // if not, a theater incident in this service tester results in a bad contextual state for the collector
    // the collector is the supervisor, and supervising an incident will dereference the collector ref again,
    // before the return message has been sent, causing a bad contextual state in the collector
    const report: Quality.ServiceTestReport<Name> = {
      name: this.#name,
      bundle: this.#bundle,
      start: yield* this.#prepare(hooks),
      operation: yield* this.#testOperations(testCases),
      successCount: this.#successCount,
      failureCount: this.#failureCount,
      stop: yield* this.#destroy(hooks),
    }
    // return service test report to collector
    collectorRef().return(report)
    // terminate actor after returning the report
    this.exitSelf()
  }
}
