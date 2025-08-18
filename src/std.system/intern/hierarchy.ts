import { kernel } from "../extern.js"
import { ancestry as inheritedAncestry } from "../main.js"

export function ancestry() {
  return systemAncestry.slice() as [number, ...number[]]
}

export function id(): number {
  return systemAncestry[0]
}

// ----------------------------------------------------------------------------------------------------------------- //
// use inherited ancestry that parent passed on if this is not the top system in the network
const systemAncestry: [number, ...number[]] = kernel.isUnsupervised() ? [0] : inheritedAncestry
