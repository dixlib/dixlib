import type Future from "std.theater.future"
import { future, kernel } from "../extern.js"
import type { ActorObj } from "./actor.js"

// signal idle theater
export function nextIdle(): Future.Cue<void> {
  return future.once(
    (reveal, cue) => {
      // when begin is called, there is at least one actor active on stage
      idleRevelations.set(cue, reveal)
    },
    (revealing, cue) => {
      // remove pending idle revelation
      if (!revealing && !idleRevelations.delete(cue)) {
        throw new Error("invalid idle revelation")
      }
    }
  )
}

// move actor to its current stage status
export function schedule(actorObj: ActorObj) {
  if (actorObj.isGhost) {
    throw new Error("scheduled actor must be alive")
  }
  if (actorObj.isSuspended) {
    actorObj.become(suspended)
  } else if (actorObj.isBlocked) {
    actorObj.become(blocked)
  } else if (actorObj.isReady) {
    actorObj.become(ready)
    if (!showing && !willEntertain) {
      // give stage to ready actor in a microtask (i.e. in current cycle of the event loop)
      willEntertain = true
      queueMicrotask(microEntertainment)
    }
  } else {
    actorObj.become(idle)
  }
}

// either obtain active actor object in some unknown role, or fail when theater is not showing this entertainment
export function busyShowing(it: unknown): ActorObj {
  const [actorObj] = active
  if (actorObj?.isPlaying(it)) {
    return actorObj
  } else {
    throw new Error("not busy showing expected entertainment")
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
// one active actor on stage
const active = new Set<ActorObj>()
// suspended actors are prevented from processing messages
const suspended = new Set<ActorObj>()
// blocked actors are waiting on a cue to reveal a signal
const blocked = new Set<ActorObj>()
// ready actors want to go on stage
const ready = new Set<ActorObj>()
// idle actors have nothing to do
const idle = new Set<ActorObj>()
// true if showing entertainment on stage
let showing = false
// true if future entertainment is pending
let willEntertain = false
// open curtain and provide entertainment as long as the budget allows
function showEntertainment(budget: number) {
  if (showing) {
    throw new Error("cannot nest theater entertainment")
  }
  showing = true
  willEntertain = false
  try {
    const start = performance.now()
    while (ready.size > 0 && Math.max(0, start + budget - performance.now()) > 0) {
      if (active.size > 0) {
        throw new Error("theater stage must be empty when taking stage")
      }
      // first ready actor becomes active performer on stage
      const [performer] = ready
      performer.become(active)
      performer.takeStage()
      if (active.size > 0) {
        throw new Error("theater stage must be empty when leaving stage")
      }
    }
  } finally {
    active.clear()
    showing = false
  }
  // this code will only execute on a clean exit
  if (ready.size > 0) {
    // give stage to ready actor in macrotask (i.e. in a future cycle of the event loop)
    willEntertain = true
    // 10 ms budget for macro entertainmet
    kernel.queueMacrotask(macroEntertainment)
  } else {
    // reveal on insertion order, one by one, because a revelation can cancel another pending idle revelation
    while (idleRevelations.size > 0) {
      const [[cue, reveal]] = idleRevelations
      idleRevelations.delete(cue)
      reveal({})
    }
  }
}
// 6 ms budget for micro entertainmet
const microEntertainment = () => showEntertainment(6)
// 10 ms budget for macro entertainmet
const macroEntertainment = () => showEntertainment(10)
// all pending revelations of an idle theater
const idleRevelations = new Map<Future.Cue<void>, Future.Reveal<void>>()
