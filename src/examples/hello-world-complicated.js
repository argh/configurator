import { setTimeout } from 'node:timers/promises';
import { ModuleManager } from '../module-manager.js';
import { AppModule } from '../app-module.js';

// More complicated Hello World Example
//
// This is almost exactly the same as the "hello-world-advanced" example (read that one first),
// but this one but demonstrates user-provided module resolution instead of relying on the built-in
// "Provider Resolver".

/** Abstract base class for demonstrating module inheritance */
class GreetingProvider {
  static moduleInfo = {
    configurables: [ {field: 'capitalize', type: 'boolean'} ],
    inject: true // adding an explicit request for injection because we're adding an init() that disables
    // note that "provides" has been removed here!
  }
  /** @type {boolean} - a simple flag to demonstrate injectable configuration */
  capitalize = false;

  /** getGreeting - the public access method that delegates to the per-implementation _greeting getter
   * @returns {string}
   */
  getGreeting() {
    if (!this._running) {
      throw new Error('not running');
    }
    return this.capitalize ? this._greeting.toUpperCase() : this._greeting;
  }

  /** @abstract - override in custom GreetingProviders */
  get _greeting() { throw new Error('not implemented'); }

  /** @type {boolean} - flag set to demonstrate module lifecycle */
  _running = false;
  async start() {
    this._running = true;
  }

  async stop() {
    this._running = false;
  }
}

class FormalGreetingProvider extends GreetingProvider {
  static moduleName = 'formal-greeting';
  get _greeting() { return 'hello'; }
}

class InformalGreetingProvider extends GreetingProvider {
  static moduleName = 'informal-greeting';
  get _greeting() { return 'hi'; }
}

class Greeter {
  static moduleConfigurables = [
    {field: 'greetingProvider', type: 'GreetingProvider', required: true},
    {field: 'initDelay', type: 'number', default: 1, validator: '$positive', required: true, advanced: true}
  ]

  /** @type {GreetingProvider} - configurable provider */
  greetingProvider;

  /** @type {number} - configurable async fake work delay in milliseconds */
  initDelay = 1000;

  /**
   * @typedef GreeterConfig
   * @property {GreetingProvider} [greetingProvider] - configurable provider
   * @property {number} [initDelay] - fake some work, configurable delay in milliseconds
   */

  /**
   * Asynchronous module initialization.  Note that the existence of this optional method
   * disables implicit dependency injection for this module (can re-enable with module settings).
   * @param {GreeterConfig} config
   * @returns {Promise<void>}
   */
  async init(config) {
    this.initDelay = config.initDelay;
    this.greetingProvider = config.greetingProvider;

    await setTimeout(this.initDelay);  // pretend to do work
  }

  greet(recipient) {
    const greeting = this.greetingProvider.getGreeting();
    console.log(`${greeting} ${recipient}`);
  }
}

class AdvancedWelcomeApp extends AppModule {
  static moduleInfo = {
    name: 'welcome',
    configurables: [
      {field: 'recipient', default: 'world'},
      {field: 'greeter', type: Greeter, required: true},
      {field: 'informal', type: 'boolean', default: false}
    ]
  }
  /** @type {string} - configurable recipient, module default or other configured value will get injected */
  recipient = 'everyone';
  /** @type {Greeter} - configurable greeter, there is no default, must provide a value via configuration */
  greeter;

  /**
   * Main entry point.
   *
   * The existence of the (optional) "main" method is an implicit way to enable the "isMain" module setting,
   * which marks a module as the entry point encapsulating the top level application logic.
   *
   * The module manager choreographs execution by first populating a configuration that resolves any referenced
   * module dependencies, and then running opt-in lifecycle methods on instantiated modules in phases:
   *
   *   (configure + instantiate) -> initialize -> start -> [main] -> stop -> terminate -> (process exits)
   */
  async main() {
    this.greeter.greet(this.recipient);
  }
}

await new ModuleManager()
  .register(FormalGreetingProvider)
  .register(InformalGreetingProvider)
  .register(Greeter)
  .register(AdvancedWelcomeApp)
  .registerResolver('GreetingProvider', (value, config, type) => {
    // note that resolvers get the global config, not the per-module view
    if (value !== 'greeting-getter') {
      return value;
    }
    if (config.welcome?.informal === true) {
      return 'informal-greeting';
    }
    else if (config.welcome?.informal === false) {
      return 'formal-greeting';
    }
    else {
      return undefined;
    }

  })
  .run(
    {
      defaults: { greeter: { initDelay: 2000 }, moduleManager: { lifecycleTimeoutMillis: 2001 } },
      env: { WELCOME_RECIPIENT: 'peeps' },
      //argv: [ '--informal=false' ]
      argv: [ '--greeter-greeting-provider', 'formal-greeting']
    }
  )

//
