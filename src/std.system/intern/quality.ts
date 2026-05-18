import type Dixlib from "dixlib"
import type Quality from "std.quality"
import type Theater from "std.theater"
import { ask } from "./questioner.js"
import { root } from "./root.js"

export function test(name?: Dixlib.ServiceName, bundle?: string): Promise<Quality.TestReport> {
  const testRunnerRef = root().lookup("quality") as Theater.ActorRef<Quality.TestRunner>
  return ask(testRunnerRef, runner => runner.runTest({ name, bundle }))
}
