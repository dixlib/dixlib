// --- TypeScript ---
import type Future from 'std.future'
import type News from 'std.news'
// --- JavaScript ---
import { future } from "./extern.js"

export function debug<P extends unknown[]>(format: string, ...p: P) { produceNow("debug", format, p) }

export function info<P extends unknown[]>(format: string, ...p: P) { produceNow("info", format, p) }

export function log<P extends unknown[]>(format: string, ...p: P) { produceNow("log", format, p) }

export function warn<P extends unknown[]>(format: string, ...p: P) { produceNow("warn", format, p) }

export function error<P extends unknown[]>(format: string, ...p: P) { produceNow("error", format, p) }

export function consume<P extends unknown[]>(): Future.Cue<News.Message<P>> { return messageExchange.consume() }

// ----------------------------------------------------------------------------------------------------------------- //
const messageExchange = future.exchange<News.Message<unknown[]>>(512)

function produceNow(severity: News.Severity, format: string, p: unknown[]) {
  const message: News.Message<unknown[]> = { severity, format, parameters: p, timestamp: performance.now() }
  messageExchange.produceNow(message)
}
