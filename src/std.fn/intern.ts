// --- JavaScript ---
export function returnThis<This>(this: This): This {
  return this
}

export function returnIt<T>(it: T): T {
  return it
}

export function returnAll<P extends unknown[]>(...p: P): P {
  return p
}

export function returnNothing(): void {
  return
}

export function returnFalse(): false {
  return false
}

export function returnTrue(): true {
  return true
}

// ----------------------------------------------------------------------------------------------------------------- //
