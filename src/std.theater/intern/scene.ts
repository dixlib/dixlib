import type Theater from "std.theater"
import { fn } from "../extern.js"
import { poisonPill } from "./unique.js"

export function isSceneMethod(it: unknown): it is (...parameters: unknown[]) => Theater.Scene {
  return typeof it === "function" && sceneMarker in it
}

export function Play(prototype: object, key: PropertyKey, descriptor: PropertyDescriptor) {
  const { name } = prototype.constructor
  if (!key) {
    throw new Error(`empty scene key in class ${name}`)
  }
  key = String(key)
  const method = descriptor.value
  if (!fn.isGeneratorFunction(method)) {
    throw new Error(`invalid scene method "${key}" in class ${name}`)
  }
  const defined = Reflect.defineProperty(method, sceneMarker, { value: sceneMarker })
  if (!defined) {
    throw new Error(`cannot define scene method "${key}" in class ${name}`)
  }
  return descriptor
}

export function exit(): never {
  throw poisonPill
}

export function* doNothing() {}

// ----------------------------------------------------------------------------------------------------------------- //
const sceneMarker = Symbol("scene method marker")
