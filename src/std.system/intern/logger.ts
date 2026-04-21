import type News from "std.news"
import type System from "std.system"
import type Theater from "std.theater"
import { future, news, theater } from "../extern.js"
import { ancestry } from "./info.js"
import { root } from "./root.js"

// a console logger is usually only created in the top system; subsystems also use this logger of the top system
export class ConsoleLoggerRole extends theater.Role<System.Logger>()(Object) implements Theater.Script<System.Logger> {
  @theater.Play *report<P extends unknown[]>(message: System.LogMessage<P>): Theater.Scene {
    const format = `[${message.origin.join(".")}@${Math.round(message.timestamp)}ms] ${message.format}`
    console[message.severity](format, ...message.parameters)
  }
}

// a news reader consumes news messages of this system and reports log messages
export class NewsReaderRole extends theater.Role()(Object) {
  protected *initializeRole(): Theater.Scene {
    yield* super.initializeRole()
    const origin = ancestry()
    // perpetual news consumption
    for (;;) {
      const message = future.when<News.Message<unknown[]>>(yield news.consume())
      const loggerRef = root().lookup("logger") as Theater.ActorRef<System.Logger>
      loggerRef().report({ ...message, origin })
    }
  }
}
