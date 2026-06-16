import type Future from "std.future"
import type News from "std.news"
import { future } from "./extern.js"

export function debug<P extends unknown[]>(format: string, ...parameters: P) {
  produceNow("debug", format, parameters)
}

export function info<P extends unknown[]>(format: string, ...parameters: P) {
  produceNow("info", format, parameters)
}

export function log<P extends unknown[]>(format: string, ...parameters: P) {
  produceNow("log", format, parameters)
}

export function warn<P extends unknown[]>(format: string, ...parameters: P) {
  produceNow("warn", format, parameters)
}

export function error<P extends unknown[]>(format: string, ...parameters: P) {
  produceNow("error", format, parameters)
}

export function consume<P extends unknown[]>(): Future.Event<News.Message<P>> {
  return messageExchange.consume()
}

// ----------------------------------------------------------------------------------------------------------------- //
// 'infinite' buffer capacity for news messages
const messageExchange = future.createExchange<News.Message<unknown[]>>()
// produce now, consume later
function produceNow(severity: News.Severity, format: string, parameters: unknown[]) {
  const message: News.Message<unknown[]> = {
    severity,
    format,
    parameters,
    timestamp: performance.now(),
  }
  if (!messageExchange.tryProduce(message)) {
    // this should not happen
    throw new Error("unable to buffer news message")
  }
}
