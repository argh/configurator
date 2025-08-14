# Configurator

A **schema-oriented** configuration management library for Node.js applications that exposes a rich API for
customization and extension.

Developers have control over the entire configuration pipeline, from input to output.

For full documentation, see <https://docs.v0.net/configurator>.

## Requirements

- NodeJS 20.9.0+
- ESM Modules only

## Philosophy

Unlike command-line oriented libraries that focus on expressive argument parsing, Configurator takes a
data-first approach, and focuses on the "correctness" of the configured data that will be consumed by your
application and its subsystems.

The idea is that if the configuration system offers a strong contract for validating inputs
against well-defined configurable fields, then the output can be trusted, and treated more like
a data model. The final populated configuration should be exactly what was expected, no more, no less.

## Basic Usage

```bash
npm install --save @versionzero/configurator
```

#### Example

(Source can be found in the [examples directory](https://github.com/argh/configurator/tree/main/examples))

```javascript title="basics.js"
import { ConfigurationSchema, Configurator } from '@versionzero/configurator';

const appName = 'basics';
// Define your configuration schema
const schema = new ConfigurationSchema();

schema.field('debug', {type: 'boolean', flagHint: 'D', advanced: true})

schema.child(appName)
      .field('verbose', {type: 'boolean'})
      .field('codes', {type: 'array', validator: {$each: '$alphanum'}, required: true})
schema.child('server')
      .field('host', {default: '127.0.0.1'})
      .field('port', {type: 'number', default: 80, validator: '$positive'})
      .field('protocol', {validator: {$in: ['tcp', 'udp', 'https', 'http']}})

// Initialize the configurator with your schema, and pass in any (optional) source context
const config = await new Configurator({schema}).configure({
  appName,                                             // application name
  defaults: {[appName]: {verbose: true}},              // low priority, but higher than field defaults
  env: process.env,                                    // (unnecessary, this is the default value)
  argv: process.argv,                                  // (unnecessary, this is the default value)
  overrides: {server: {protocol: 'https', port: 443}}  // highest priority
});

console.log('Configuration results:', config);
```

Try running it with a mix of environment variables and command line options:

```bash
% export BASICS_SERVER_HOST=localhost
% node basics.js -D --server-port 8081 --codes 5xx z10 123

Configuration results:  {
  debug: true,
  basics: { verbose: true, codes: [ '5xx', 'z10', '123' ] },
  server: { host: 'localhost', port: 443, protocol: 'https' }
}
```

See the full [documentation](https://docs.v0.net/configurator) for details on how the schema's configurables are
mapped to environment variables and command line arguments.

Also see the [examples directory](https://github.com/argh/configurator/tree/main/examples) for more advanced usage
patterns:

- Configuration file loading
- Custom types and validators
- Custom configuration sources
- Conditional configuration
- Dynamic configuration resolution
- Command line "command" support

## Key Features

**Reasonable Defaults, "Batteries Included", etc.**

: The default `Configurator` setup is a great starting point for quickly providing configuration hooks for
typical applications. The schema API is superficially similar to that of most command-line focused libraries,
so adoption is easy. Out of the box, you get a command line parser with help text generation, environment
variable parsing, configuration file loading, and a library of field validators that cover many common needs.

**Extensible Schema Types and Validation**

: The `Configurator` is pre-loaded with basic primitive types and common extensions (`string`, `number`, 
`boolean`, `array`, `object`, `date`, `buffer`), as well as many useful field validators
(e.g. `$positive`, `$alphanum`, `$directory`, etc.) but developers can also define their own implementations. 
Custom types and validators can provide arbitrary (potentially asynchronous!) transformations from 
*configuration inputs* to *validated outputs*.

**Sequenced Configuration Sources**

: Central to the `Configurator` is the concept of a `ConfigurationSource`. Each source encapsulates the
functionality of discovering configuration field assignments from a single origin: `ObjectSource` understands simple
objects, `EnvironmentSource` reads environment variables, `CommandLineSource` parses command line arguments,
and so forth.
: Each `ConfigurationSource` is loaded in sequence. Field assignments discovered later in the sequence
override assignments from earlier in the sequence.
: The `Configurator` provides a default sequence of predefined sources, but this sequence can be changed,
and the sources individually provide options to tune their behavior. The sequence can also be extended with
additional sources, either fully custom, or provided by optional external packages.

**Single Source of Truth: Configuration as a Data Model**

: The structure of the validated output configuration object is intended to mirror an "idealized" config 
file format for your application.  If a schema hierarchy is created to align with the structure of the 
application and its subsystems, then each subsystem's configured properties will be nested inside a 
child object.  This child object can then be used in isolation to safely initialize that subsystem, without
extraneous data leaking in. This reduces the *"dig through a random bag of whatever"* output 
generated by many other configuration libraries.

**Built to be Embedded**

: The observant reader may have noticed that the combination of features described above suggests that if
subsystems were each built as self-contained modules, each module could internally define its own 
configuration schema.  One could then build a system on top of `Configurator` that introspects these 
modules, discovers their internal schemas, and initializes each modular subsystem with a validated
object containing only their requested configurables.  Furthermore, those modules could be *themselves*
be registered as new schema types, with a type resolver that returns singleton instances of those subsystems,
allowing them to be assigned to matching configuration fields in other modules... 🤔
: Good news, this exists!
: [`ModuleManager`](https://github.com/argh/module-manager) is a separately installed library 
(`@versionzero/module-manager`) that embeds `Configurator`.  It still
provides all the `Configurator` capabilities, but with a bias towards serving applications structured as a
dependency graph of modular subsystems. As a quick pitch, `ModuleManager` provides **embedded declarative schemas**,
**strongly typed references**, **dependency injection**, and **lifecycle management**. It enables you to keep your
configurable field definitions fully colocated with the modules that consume them, and provides a structured approach
to wiring everything together. While the `Configurator` is a fine library for direct use on its own, it really shines
for larger applications when embedded in an active "smart" layer (such as `ModuleManager`) that understands how
your functionality is partitioned.

## License

MIT
