## Service

`dixlib` is a service library.
It's important to clearly define what a _service_ means, because it's an overloaded term in the IT industry.
In the context of `dixlib`, a service is a TypeScript interface and namespace.
Each service furthermore has a module name e.g., `'std.theater'` or `'std.system'`.
The name identifies a service at runtime whereas the interface and namespace are compile-time constructs.

A _service provider_ is an implementation of a service.
A provider can access its own resources, but the resources of other service providers are off limits.
A service provider must express its dependencies on other services, but it does not have control over their implementations.
`dixlib` enforces a strict separation between service interface and implementation.

`dixlib` uses a variation on the _service locator pattern_ ([Wikipedia](https://en.wikipedia.org/wiki/Service_locator_pattern)).
The central registry is known as the _service loader_ in `dixlib`.
The service loader itself is a provider of the `'std.loader'` service.
Although all service providers depend on some loader to construct a service implementation, they do not explicitly depend on **the** service loader.
Service providers express their dependencies on services in a manner that does not rely on a global service loader.

## Anatomy of a service

Every service is located in its own _service directory_ whose name corresponds with the service name.
For example, the resources of the service `'acme.awesome'` are located in directory `src/acme.awesome`.
A service directory contains one or more of the following files.

### `api.d.ts`

This file declares an [ambient](https://www.typescriptlang.org/docs/handbook/modules) module in which the service interface and related types are defined.
The module name is the service name.
The default export combines the interface and namespace.

```typescript
declare module 'acme.awesome' {
  import type Fabulous from 'acme.fabulous'
  import type Sublime from 'acme.sublime'
  export default Awesome
  interface Awesome {
    // service operations
    foo(): Awesome.Thing
    bar(p: Fabulous.Thing): Sublime.Thing
    ...
  }
  namespace Awesome {
    // related types, interfaces, etc.
    type Thing = Fabulous.Thing | Sublime.Thing | "specialConstant" | ...
  }
}
```

### `extern.ts`

This module expresses the external dependencies of a service provider.
The default export is a function, the _service contractor_, which returns a promise of the internal implementation.
The contractor usually returns an import of `intern.js`, located in the same service directory.
The contractor receives one argument, the _service contract_.
This contract can be used to provide other services on which the internal implementation depends.
These providers are exported to make them available to the internal implementation.

```typescript
import type { Contract, Service } from "dixlib"

export default async ({ use }: Contract<Service['acme.awesome']>): Promise<Service['acme.awesome']> {
  // provide service dependencies
  [fabulous, sublime] = await use('acme.fabulous', 'acme.sublime')
  return import("./intern.js")
}

export let fabulous: Service['acme.fabulous']

export let sublime: Service['acme.sublime']
```

### `intern.ts`

This module implements the service interface.
It exports functions for the service operations, which are defined in the service interface.
It relies on `extern.js` to provide services that this service provider depends on.
The next example is a simple service provider that restricts the whole internal implementation to just this module.
A complex provider benefits from a more modular organization of the internal implementation.

```typescript
import type Awesome from 'acme.awesome'
import type Fabulous from 'acme.fabulous'
import type Sublime from 'acme.sublime'
import { fabulous, sublime } from "./extern.js"

export function foo(): Awesome.Thing {
  fabulous.prepareIt()
  const awesomeThing = baz(fabulous.createIt())
  ...
  return awesomeThing
}

export function bar(p: Fabulous.Thing): Sublime.Thing {
  const sublimeThing = sublime.conceptualize(p)
  qux()
  ...
  return sublimeThing
}

// ------------------------------------------------------------------------- //
function baz(p: Fabulous.Thing): Awesome.Thing { ... }
function qux(): void { ... }
...
```

### `datatype.ts`

Data types define the structure of immutable data values.
Data values are used in different areas, but most importantly, in messages for remote actors.
This ensures messages on the sender side are equivalent to messages on the receiver side.
But data values also appear in other places e.g., to configure a service.

The [data service](#stddata) provides operations to load type definitions in a data space.
Data spaces can evaluate these definitions to actual types.

```typescript
export const definitions = {
  // int32 is a subtype of number, but it's still a basic number
  "Data.Basic": "boolean|number|string",
  // defined values
  "Data.Wildcard": "*",
  // any value, including undefined
  "Data.Any": "*?",
  // optional values
  "Data.Maybe": "a=* a?",
  // sequential and string-keyed collections
  "Data.List": "a=*? [a]",
  "Data.Dictionary": "a=*? <a>",
  // multidimensional tuples
  "Data.Pair": "a=*? b=*? (a,b)",
  ...
  // spread record fields
  "Data.Spread": "a={} b={} c={} d={} e={} f={} g={} h={} i={} j={} {/a,/b,/c,/d,/e,/f,/g,/h,/i,/j}",
}
```

### `test.ts`

This module implements test cases to verify the quality of a service provider.
The [quality service](#stdquality) uses these modules to run service tests and collect them in test reports.


```typescript
import type Quality from 'std.quality'

export default ({ assert, provider }: Quality.ServiceUnderTest<'std.fn'>): Quality.ServiceTest<'std.fn'> => [
  // no hooks
  {},
  // test cases
  {
    isGeneratorFunction() {
      function* generator() {}
      function regular() {}
      assert.true(provider.isGeneratorFunction(generator), "isGeneratorFunction with generator function should return true")
      assert.false(provider.isGeneratorFunction(regular), "isGeneratorFunction with regular function should return false")
      ...
    },
    isInt32() {
      assert.true(provider.isInt32(0), "isInt32 with 0 should return true")
      assert.true(provider.isInt32(1), "isInt32 with 1 should return true")
      ...
    },
    iterateKeys() {
      assert.deepEqual([], [...provider.iterateKeys({})], "iterateKeys with empty object should return empty iterator")
      assert.deepEqual(["a", "b", "c"], [...provider.iterateKeys({ a: 42, b: 54, c: 68 })], "iterateKeys should preserve key order")
      ...
    },
    iterateValues() {
      ...
    },
    iterateEntries() {
      ...
    },
    ...
  },
]
```

## Standard services

### `std.loader`

The standard loader is the odd one out.
At boot time, all service providers can be refined or redefined, except for the standard loader.
The implementation of the standard loader is hardcoded in `dixlib`.
It is the only service, which is already bound to a provider at boot time.

### `std.fn`

JavaScript packs a lot of standard functionality.
The standard functions of `dixlib` augment in niches where this functionality is missing or awkward.

### `std.fx`

This service provides various utilities.
The standard utilities of `dixlib` are simple tools for common problems e.g., class mixins.

### `std.kernel`

JavaScript was originally invented for web browsers, but it can now be found in all kinds of environments.
The operations of the standard kernel cover functionality that is not part of JavaScript, even though common JavaScript environments implement it e.g., multithreading with workers.

### `std.syntax`

The standard syntax service contains utilities for building a recursive descent parser.

### `std.data`

The standard data service deals with typed data values.
These immutable values are designed to be easily transported over the wire e.g., in JSON format.
The service introduces a language for type definitions.

### `std.theater`

The standard theater is an actor system for JavaScript environments.

### `std.future`

The standard future service contains utilities for events.
An event reveals an asynchronous signal that somebody e.g., an actor, can await.

### `std.system`

The standard system is the component manager.
It deploys components and subsystems.

### `std.news`

The standard news service is a logging solution.
Subsystems forward their log messages to the top system.

### `std.assert`

The standard assert service provides operations to test assumptions about your code.
If the assumption is wrong, a runtime assertion error is thrown.
The assert service is used in service tests, but it is not restricted to tests.

### `std.quality`

The standard quality service is a testing framework.
It uses actors to concurrently test service providers.

### `std.config`

The standard config service allows for tailored service configurations.
It builds on the same principle as service providers, where bundles higher up in the stack can refine configurations lower in the stack.
