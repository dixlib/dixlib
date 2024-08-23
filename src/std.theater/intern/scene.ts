// --- TypeScript ---
import type Theater from 'std.theater'
// --- JavaScript ---
export function isSceneMethod(it: unknown): it is Theater.Scenic<unknown, unknown[]> {
  return typeof it === "function" && sceneMarker in it
}

export function Play(prototype: object, key: PropertyKey, descriptor: PropertyDescriptor) {
  const { name } = prototype.constructor, method = descriptor.value
  if (!key) {
    throw new Error(`empty scene key in class ${name}`)
  }
  key = String(key)
  if (!scenicMethod.isPrototypeOf(method)) {
    throw new Error(`invalid scene method "${key}" in class ${name}`)
  }
  const defined = Reflect.defineProperty(method, sceneMarker, { value: sceneMarker })
  if (!defined) {
    throw new Error(`cannot define scene method "${key}" in class ${name}`)
  }
  return descriptor
}

export function* doNothing() { }

// ----------------------------------------------------------------------------------------------------------------- //
const sceneMarker = Symbol("scene method marker"), scenicMethod = Reflect.getPrototypeOf(function* () { })!
