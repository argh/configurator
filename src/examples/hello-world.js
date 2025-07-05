import { ModuleManager } from '../module-manager.js';

// Hello World Example
//
// This example shows the smallest possible application that leverages the ModuleManager:
// a single application module, with a single configurable field.
//
// (This is of course rather silly, as the entire point of this library is to tame the
// complexity of larger applications that are built of multiple interconnected subsystems!)

class WelcomeApp {
  static moduleConfigurables = [{ field: 'message' }]
  message = 'configure me!';

  async main() {
    console.log(this.message);
  }
}

let foo = {
  bar: 'baz'
}

await new ModuleManager()
  .registerInstance(foo, {name: 'foo-object'} )
          .register(WelcomeApp)
          .run({ argv: [ '--message', 'hello world' ] })

// or..   .run( { env: { WELCOME_APP_MESSAGE: 'hello world' } })
// or..   .run( { defaults: { welcomeApp: { message: 'hello world' }}})
// or..   .run() // (by default will use process.argv and process.env)

// Modular applications tend to have a lot of tedious and error-prone complexity
// that emerges from the unavoidable need to wire up and manage the configuration and
// lifecycles of multiple interconnected subsystems.  The goal of this library is to reduce this
// complexity by providing some consistent yet flexible structure around these needs,
// without imposing the constraints of a rigid framework.

// In this library, Modules are fundamentally an abstracted way to provide encapsulated
// services throughout an application, via a dependency graph of automatically instantiated
// singletons that support dependency injection.

// Modules have a variety of optional settings to control their behavior,
// which can either be specified in static module properties or provided during
// registration.  Some settings are set to implicit defaults based on the properties
// of the registered module class itself.
//
// In this case, the WelcomeApp module is implicitly treated as the entry point of
// the application, and is set up for implicit dependency injection of a single configurable
// "message" field.  Configurable field values can be provided in a variety of ways; built-in
// defaults, environment variables, command line arguments, configuration files, or even user
// extensions such as cloud secrets providers.  The naming conventions of how to reference
// the field names naturally vary between different configuration sources, and each source
// has its own documented approach.
//
// The ModuleManager choreographs execution by first populating a validated configuration
// object containing requested simple field values (as well as the resolved instances of
// any referenced module dependencies.)  It then runs opt-in lifecycle methods on instantiated
// modules in phases:
//
//   (configure + instantiate) -> initialize -> start -> [main] -> stop -> terminate -> (process exits)
//
// In this example, the context object passed to "run" is overriding the
// actual command line by setting "argv".  If you would like to try running
// the app with actual command line arguments, either remove the context from
// the call to "run", or pass in { argv: process.argv }.  See the commented-out lines
// for examples.
//
// You can also provide configuration through environment variables, in
// this case "WELCOME_APP_MESSAGE".  As with the context override for argv,
// you can pass "env" in the context, or omit it entirely, and to default to process.env.
//
// You can also provide configuration settings in object form via
// context properties "defaults" (lowest priority) or "overrides" (highest priority).
//
// See the "hello-world-advanced" example for more advanced usage.

