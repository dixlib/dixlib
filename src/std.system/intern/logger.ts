// --- TypeScript ---
import type System from 'std.system'
import type Theater from 'std.theater'
// --- JavaScript ---
import { theater } from "../extern.js"

export class LoggerRole extends theater.Role<System.Logger>()(Object) implements Theater.Script<System.Logger> {

  @theater.Play public *report<P extends unknown[]>(message: System.LogMessage<P>): Theater.Scene<void> {
    const format = `[${message.origin.join(":")}@${Math.round(message.timestamp)}ms] ${message.format}`
    console[message.severity](format, ...message.parameters)
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
