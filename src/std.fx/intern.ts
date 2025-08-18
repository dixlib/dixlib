import type Fx from "std.fx"

export function erroneous(it: unknown): Error {
  return it instanceof Error ? it : new Error(stringify(it))
}

//biome-ignore lint/complexity/noBannedTypes: {} is appropriate supertype
export function mixin<M extends {}, S extends {} = {}>(template: Fx.Template<M, S>): Fx.Mixin<M, S> {
  const cache = new WeakMap()
  const marker = Symbol("mixin instance")
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

export function createFacade<Opaq extends {}, Impl extends {}>(name: string, proto?: object): Fx.Facade<Opaq, Impl> {
  const hidden = Symbol(`${name} implementation`)
  return Object.freeze({
    isHandling(it: unknown): it is Opaq {
      return typeof it === "object" && !!it && hidden in it
    },
    handle<SubOpaq extends Opaq>(impl: Impl): SubOpaq {
      const opaq = Object.create(proto ?? null, {
        [Symbol.toStringTag]: { value: name },
        [hidden]: { value: impl, configurable: true },
      })
      return Object.preventExtensions(opaq)
    },
    expose(opaq: Opaq & { [hidden]: Impl }): Impl {
      return opaq[hidden]
    },
    reset(opaq: Opaq, impl: Impl): void {
      // ensure proper handle
      if (hidden in opaq) {
        Reflect.defineProperty(opaq, hidden, {
          value: impl,
          configurable: true,
        })
      }
    },
  })
}

// ----------------------------------------------------------------------------------------------------------------- //
function stringify(it: unknown) {
  try {
    return String(it)
  } catch (_) {
    try {
      // when it is not derived from Object.prototype
      return Object.prototype.toString.call(it)
    } catch (problem) {
      try {
        // return string representation of problem
        return String(problem)
      } catch (_) {
        // if everything fails
        return "cannot stringify"
      }
    }
  }
}
