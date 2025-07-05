import { ModuleManager } from '../module-manager.js';
import { AppModule } from '../app-module.js';
import { Logger } from '@argh/logger';

// Hello World, Enterprise Edition
//
// This example artificially splits the application functionality into multiple modules in order to demonstrate
// how to configure and use modules that have dependencies on each other, as well as how to dynamically select one of
// several possible module implementations at runtime based on configuration.
//
// For this example, the module dependency graph is as follows:
//   (Welcome App) -> (Greeter) -> [Greeting Provider Resolver] -> (Concrete Greeting Provider)

// First, we define an abstract GreetingProvider to use as the base class for our dynamically selectable module
// implementations.  Although there is no architectural requirement to use class inheritance, we do so here
// in order to emphasize the expected calling contract.

class GreetingProvider {
  static moduleInfo = {
    provides: 'JustAnotherGreetingProvider',
  }

  /** getGreeting - the public method that delegates to the per-implementation _greeting getter
   * @param {boolean} [capitalize] - a flag to request that the greeting be capitalized
   * @returns {string}
   */
  getGreeting(capitalize) {
    if (!this.running) {
      throw new Error('not running');
    }
    return capitalize ? this._greeting.toUpperCase() : this._greeting;
  }

  /** @abstract - override in custom GreetingProviders */
  get _greeting() {
    throw new Error('not implemented');
  }

  /** @type {boolean} - fake little state flag set to demonstrate module lifecycle */
  running = false;

  /** start - lifecycle method called after initialization is complete. */
  async start() {
    this.running = true;
  }

  /** stop - lifecycle method called after the main module (if any) has completed execution. */
  async stop() {
    this.running = false;
  }
}

// Here are two concrete implementations of the greeting provider.
//
// Module names can be implicitly derived from class names, but are explicitly set for these classes as the names are
// the actual values that will be specified for dynamic configuration, and thus benefit from being "user-friendly".
// Other module settings are inherited (or individually merged) from the base class.  In this case, the "configurables"
// and the "provides" settings are both inherited.
//
// The "provides" setting marks a module as a "provider" of some (arbitrarily) named functionality.  It also triggers
// the registration of a special "resolver" module that will handle indirection to whatever matching "provider" module
// is configured (if any).
//
// Every registered module also becomes a unique configurable field value type; in the case of resolver modules, only
// modules registered with a compatible "provider" setting will be considered a candidate for assignment to configuration
// with the matching resolver module field type.
//
// Note that in the GreetingProvider base class, the provider name "JustAnotherGreetingProvider" was chosen simply
// to make it distinct to readers of this example, and to make it clear that the name is completely arbitrary.  In normal
// usage it would be better practice to set the "provides" value to name of your (perhaps notional) interface, e.g.
// "GreetingProvider".


class FormalGreetingProvider extends GreetingProvider {
  static moduleName = 'formal';
  get _greeting() { return 'hello'; }
}

class InformalGreetingProvider extends GreetingProvider {
  static moduleName = 'informal';
  get _greeting() { return 'hi'; }
}

// Intermediary Greeter module to demonstrate dependencies and configuration

class Greeter {
  static moduleConfigurables = [
    {field: 'provider', type: 'JustAnotherGreetingProvider', required: true, flagHint: 'p' , description: 'select a greeting type'},
    {field: 'capitalize', type: 'boolean', default: false, required: false, description: 'flag to request the greeting be capitalized'},
  ]

  provider;
  capitalize;

  greet(recipient) {
    const greeting = this.provider.getGreeting(this.capitalize);
    console.log(`${greeting} ${recipient}`);
  }
}

// The app itself.  (The AppModule base class is an optional convenience class that provides some
// commonly used capabilities like logging and signal handling.)

class AdvancedWelcomeApp extends AppModule {
  static moduleInfo = {
    name: 'welcome',
    configurables: [
      {field: 'recipient', default: 'world'},
      {field: 'greeter', type: Greeter, required: true}
    ]
  }
  recipient = 'everyone';
  greeter;

  // The existence of an (optional) "main" method implicitly sets the "isMain" module setting, which marks
  // a module as implementing the top-level application logic to run after initialization.
  //
  // The module manager choreographs execution by first populating a validated configuration object (containing
  // all referenced fields and resolved modules dependencies), and then running opt-in lifecycle methods on
  // instantiated modules in phases:
  //
  //   (configure + instantiate) -> initialize -> start -> [main] -> stop -> terminate -> (process exits)
  //
  async main() {
    this.greeter.greet(this.recipient);
  }
}

await new ModuleManager()
  .register(FormalGreetingProvider)
  .register(FormalGreetingProvider)
  .register(InformalGreetingProvider)
  .register(Greeter)
  .register(Logger)
  .register(AdvancedWelcomeApp)
  .run(
    {
      defaults: { greeter: { capitalize: false }, x: true },
      env: { WELCOME_RECIPIENT: 'peeps' },
      argv: [ /*'--help', 'advanced', */'-p', 'formal', '--gc'],
    }
  )

// As with the basic example, the context passed to "run" is overriding the process defaults for "argv" and "env", so
// if you would like to try this example with the actual command line, clear those keys from the context object.
// (Try running with --help to see the full set of available options!)
