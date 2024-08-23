// --- TypeScript ---
import type Loader from 'std.loader'
import type System from 'std.system'
import type Theater from 'std.theater'
// --- JavaScript ---
import { ancestry as inheritedAncestry } from "../main.js"
import { kernel, loader as theLoader, theater } from "../extern.js"
import { ContainerRole } from './container.js'

export function ancestry() {
  return systemAncestry.slice() as [number, ...number[]]
}

export function id(): number {
  return systemAncestry[0]
}

export function root(): System.Context<System.Root> {
  return rootContext
}

export function loader(): Loader {
  return theLoader
}

// ----------------------------------------------------------------------------------------------------------------- //
// use inherited ancestry that parent passed on if this is not the top system 
const systemAncestry = kernel.isUnparented() ? [0] : inheritedAncestry
// role of a system actor
class RootRole extends ContainerRole<System.Root>()(Object) implements Theater.Script<System.Root> {
  @theater.Play
  public *ancestry(): Theater.Scene<[number, ...number[]]> { return ancestry() }
  @theater.Play
  public *id(): Theater.Scene<number> { return id() }
  @theater.Play
  public *launch(): Theater.Scene<void> {
    console.log(performance.now())
    throw new Error("dammit")
  }
}
const rootContext = await theater.cast<System.Root, []>({
  Role: RootRole, p: [],
  guard({ blooper, selector, parameters }: Theater.Incident<Theater.Actor>): Theater.Verdict {
    console.warn(`"${String(selector)}"/${parameters.length}: system container problem\n`, blooper)
    return "forgive"
  }
}).view()
