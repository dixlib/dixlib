declare module "dixlib" {
  interface ServiceAspects {
    /**
     * If true, a test module contains test cases for service operations.
     */
    readonly verification?: boolean
  }
}
declare module "std.quality" {
  import type Dixlib from "dixlib"
  import type Assert from "std.assert"
  import type Loader from "std.loader"
  import type Theater from "std.theater"
  export default Quality
  /**
   * The quality service is used to verify the functionality of services.
   */
  interface Quality {
    /**
     * Obtain role class for new test runners.
     *
     * @returns A role class for a test runner
     */
    TestRunner(): Theater.RoleClass<Quality.TestRunner, []>
  }
  namespace Quality {
    /**
     * A test module implements a service test.
     */
    interface TestModule<Name extends Dixlib.ServiceName> {
      /**
       * Determine the test hooks and test cases of a service test.
       *
       * @param sut System under test
       * @returns A tuple with test hooks and test cases
       */
      default(sut: ServiceUnderTest<Name>): ServiceTest<Name>
    }
    /**
     * Information about the service being tested.
     *
     * This information is passed to the default export of a test module.
     */
    interface ServiceUnderTest<Name extends Dixlib.ServiceName> {
      /**
       * Provider to test.
       */
      readonly provider: Dixlib.Service[Name]
      /**
       * Assertion support.
       */
      readonly assert: Assert
    }
    /**
     * A service test is a tuple that combines lifecycle hooks with test cases.
     *
     * The default export of a test module returns a service test.
     */
    type ServiceTest<Name extends Dixlib.ServiceName> = [TestHooks, TestCases<Name>]
    /**
     * Test cases cover service operations.
     *
     * Every operation must have a test case to verify its correctness.
     * A test case is either synchronous or asynchronous.
     */
    type TestCases<Name extends Dixlib.ServiceName> = {
      [K in keyof Dixlib.Service[Name]]: () => Promise<void> | void
    }
    /**
     * Lifecycle hooks of a service test.
     */
    interface TestHooks {
      /**
       * Optional async lifecycle hook to prepare a service test.
       *
       * @param use Use service providers
       * @returns A promise to prepare
       */
      prepare?(use: Loader["use"]): Promise<void> | void
      /**
       * Optional async lifecycle hook to clean up after a service test has run.
       *
       * @returns A promise to destroy the leftovers of a test
       */
      destroy?(): Promise<void> | void
    }
    /**
     * A service test report describes how the tests of a service went.
     */
    interface ServiceTestReport<Name extends Dixlib.ServiceName> {
      /**
       * Name of tested service.
       */
      readonly name: Name
      /**
       * Id of bundle that implements the service test.
       */
      readonly bundle: string
      /**
       * The moment when the service test started.
       */
      readonly start: Temporal.Instant
      /**
       * The moment when the service test stopped.
       */
      readonly stop: Temporal.Instant
      /**
       * Number of successfully completed service operation tests.
       */
      readonly successCount: number
      /**
       * Number of failed service operation tests.
       */
      readonly failureCount: number
      /**
       * Tests of service operations.
       */
      readonly operation: {
        readonly [Operation in keyof Dixlib.Service[Name]]: {
          /**
           * If defined, the operation test failed with this error.
           */
          readonly failure?: Error
          /**
           * The moment when the service operation test started.
           */
          readonly start: Temporal.Instant
          /**
           * The moment when the service operation test stopped.
           */
          readonly stop: Temporal.Instant
        }
      }
    }
    /**
     * A test report contains reports for all services that were tested.
     *
     * The set contains service test reports for one or more bundles with a test module that implements a service test.
     */
    type TestReport = {
      readonly [Name in Dixlib.ServiceName]?: Set<ServiceTestReport<Name>>
    }
    /**
     * A test configuration determines what needs to be tested by a test runner.
     */
    interface TestConfiguration {
      /**
       * If defined, only test a particular service.
       *
       * Otherwise all services are tested.
       */
      readonly name?: Dixlib.ServiceName
      /**
       * If defined, only load test modules from a particular bundle.
       *
       * Otherwise all bundles are examined.
       */
      readonly bundle?: string
      /**
       * If true, track progress with messages to a watcher ({@link TestWatcher}).
       */
      readonly watch?: boolean
    }
    /**
     * A test runner is an actor that manages service tests.
     *
     * A runner spawns a new actor to perform a service test.
     * Multiple service tests will run concurrently.
     */
    interface TestRunner extends Theater.Actor {
      /**
       * Run service tests.
       *
       * A test report ({@link TestReport}) is returned to the sender.
       *
       * If the runner is being watched ({@link TestConfiguration.watch}), the sender must also be a test watcher ({@link TestWatcher}).
       * Otherwise the runner reports progress with debug news messages.
       *
       * @param configuration Configuration to test
       */
      runTest(configuration: TestConfiguration): Theater.OneWay
    }
    /**
     * A test watcher is an actor that tracks progress of one or more service tests.
     */
    interface TestWatcher extends Theater.Actor {
      /**
       * Service test preparation was started.
       *
       * @param name Name of tested service
       * @param bundle Id of bundle that implements the service test
       * @param start The moment when preparation started
       */
      beginPreparation(name: Dixlib.ServiceName, bundle: string, start: Temporal.Instant): Theater.OneWay
      /**
       * Service test preparation was completed.
       *
       * If preparation fails, the whole service test is cancelled.
       *
       * @param name Name of tested service
       * @param bundle Id of bundle that implements the service test
       * @param start The moment when preparation started
       * @param stop The moment when preparation stopped
       * @param failure If defined, the preparation failed with this error
       */
      endPreparation(
        name: Dixlib.ServiceName,
        bundle: string,
        start: Temporal.Instant,
        stop: Temporal.Instant,
        failure?: Error
      ): Theater.OneWay
      /**
       * A service operation test was started.
       *
       * @param name Name of tested service
       * @param bundle Id of bundle that implements the service test
       * @param operation Service operation name
       * @param start The moment when the service operation test started
       */
      beginOperationTest<Name extends Dixlib.ServiceName>(
        name: Name,
        bundle: string,
        operation: keyof Dixlib.Service[Name],
        start: Temporal.Instant
      ): Theater.OneWay
      /**
       * A service operation test was completed.
       *
       * @param name Name of tested service
       * @param bundle Id of bundle that implements the service test
       * @param operation Service operation name
       * @param start The moment when the service operation test started
       * @param stop The moment when the service operation test stopped
       * @param failure If defined, the service operation test failed with this error
       */
      endOperationTest<Name extends Dixlib.ServiceName>(
        name: Name,
        bundle: string,
        operation: keyof Dixlib.Service[Name],
        start: Temporal.Instant,
        stop: Temporal.Instant,
        failure?: Error
      ): Theater.OneWay
      /**
       * Service test destruction was started.
       *
       * @param name Name of tested service
       * @param bundle Id of bundle that implements the service test
       * @param start The moment when destruction started
       */
      beginDestruction(name: Dixlib.ServiceName, bundle: string, start: Temporal.Instant): Theater.OneWay
      /**
       * Service test destruction was completed.
       *
       * @param name Name of tested service
       * @param bundle Id of bundle that implements the service test
       * @param start The moment when destruction started
       * @param stop The moment when destruction stopped
       * @param failure If defined, the destruction failed with this error
       */
      endDestruction(
        name: Dixlib.ServiceName,
        bundle: string,
        start: Temporal.Instant,
        stop: Temporal.Instant,
        failure?: Error
      ): Theater.OneWay
    }
  }
}
