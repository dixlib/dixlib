// --- TypeScript ---
import type Fx from 'std.fx'
// --- JavaScript ---
export function erroneous(it: unknown): Error {
  return it instanceof Error ? it : new Error(stringify(it))
}

export function mixin<M extends {}, S extends {} = {}>(template: Fx.Template<M, S>): Fx.Mixin<M, S> {
  const cache = new WeakMap(), marker = Symbol("mixin instance")
  function subclass<C extends Fx.Constructor<S>>(Super: C) {
    // test whether Super already implements mixin
    if (Super.prototype[marker] === marker) {
      return Super
    } else {
      // test whether Super already has a subclass that implements mixin
      const cached: Fx.Constructor<S & M> | undefined = cache.get(Super)
      if (cached) {
        return cached
      } else {
        // apply template to create cached subclass of Super that implements mixin
        const mixedInSubclass = template(Super)
        Reflect.defineProperty(mixedInSubclass.prototype, marker, { value: marker })
        cache.set(Super, mixedInSubclass)
        return mixedInSubclass
      }
    }
  }
  Reflect.defineProperty(subclass, "isImplementedBy", {
    value: (it: unknown) => typeof it === "object" && !!it && marker in it,
  })
  return subclass as Fx.Mixin<M, S>
}

export function facade<H extends {}, I extends {}>(name: string, proto?: object): Fx.Facade<H, I> {
  const hidden = Symbol(`${name} implementation`)
  return {
    isHandling(it: unknown): it is H {
      return typeof it === "object" && !!it && hidden in it
    },
    handle<X extends H>(impl: I): X {
      return Object.preventExtensions(Object.create(proto ?? null, {
        [Symbol.toStringTag]: { value: name },
        [hidden]: { value: impl, configurable: true },
      }))
    },
    expose(handle: H & { [hidden]: I }): I {
      return handle[hidden]
    },
    reset(handle: H, impl: I): void {
      // ensure proper handle
      if (hidden in handle) {
        Reflect.defineProperty(handle, hidden, { value: impl, configurable: true })
      }
    }
  }
}

// ----------------------------------------------------------------------------------------------------------------- //
function stringify(it: unknown) {
  try {
    return String(it)
  } catch (whatever) {
    try {
      // when it is not derived from Object.prototype
      return Object.prototype.toString.call(it)
    } catch (problem) {
      try {
        // return string representation of problem
        return String(problem)
      } catch (whatever) {
        // if everything fails
        return "cannot stringify"
      }
    }
  }
}
