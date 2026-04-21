import type System from "std.system"
import { version as publishedVersion } from "../../../package.json" with { type: "json" }
import { kernel } from "../extern.js"
import { inherited } from "../main.js"

export function version(): string {
  return publishedVersion
}

export function ancestry() {
  return systemAncestry.slice() as System.Ancestry
}

export function id(): number {
  return systemAncestry[0]
}

// ----------------------------------------------------------------------------------------------------------------- //
// use inherited ancestry that parent passed on if this is not the top system in the network
const systemAncestry: [number, ...number[]] = kernel.isSupervised() ? inherited.ancestry : [0]
