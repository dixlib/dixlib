## Service

`dixlib` is a service library.
It's important to clearly define what a *service* means, because it's an overloaded term in the IT industry.
In the context of `dixlib`, a service is a TypeScript interface and namespace.
Each service furthermore has a module name e.g., `'std.theater'` or `'std.system'`.
The name identifies a service at runtime whereas the interface and namespace are compile-time constructs.

A *service provider* is an implementation of a service.
A provider can access its own resources, but the resources of other service providers are off limits.
A service provider must express its dependencies on other services, but it does not have control over their implementations.
`dixlib` enforces a strict separation between service interface and implementation.  

`dixlib` uses a variation on the *service locator pattern* ([Wikipedia](https://en.wikipedia.org/wiki/Service_locator_pattern)).
The central registry is known as the *service loader* in `dixlib`.
The service loader itself is a provider of the `'std.loader'` service.
Although all service providers depend on some loader to construct a service implementation, they do not explicitly depend on **the** service loader.
Service providers express their dependencies on services in a manner that does not rely on a global service loader.

## Anatomy of a service

Every service is located in its own *service directory* whose name corresponds with the service name.
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
The default export is a function, the *service contractor*, which returns a promise of the internal implementation.
The contractor usually returns an import of `intern.js`, located in the same service directory.
The contractor receives one argument, the *service contract*.
This contract can be used to provide other services on which the internal implementation depends.
These providers are exported to make them available to the internal implementation.

```typescript
// --- TypeScript --
import type Awesome from 'acme.awesome'
import type Fabulous from 'acme.fabulous'
import type Sumblime from 'acme.sublime'
// --- JavaScript ---
export default async ({ use }: Contract<Awesome>): Promise<Awesome> {
  // provide service dependencies
  [fabulous, sublime] = await use('acme.fabulous', 'acme.sublime')
  return import("./intern.js")
}
export let fabulous: Fabulous, sublime: Sublime
```

### `intern.ts`
This module implements the service interface.
It exports functions for the service operations, which are defined in the service interface.
It relies on `extern.js` to provide services that this service provider depends on.
The next example is a simple service provider that restricts the whole internal implementation to just this module.
A complex provider benefits from a more modular organization of the internal implementation.

```typescript
// --- TypeScript --
import type Awesome from 'acme.awesome'
import type Fabulous from 'acme.fabulous'
import type Sublime from 'acme.sublime'
// --- JavaScript ---
import { fabulous, sublime, } from "./extern.js"

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

### `std.theater`
The standard theater is an actor system for JavaScript environments.

### `std.system`
The standard system is the component manager.
It deploys components and subsystems.
