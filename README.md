# Configurator

A **schema-oriented** configuration management library for Node.js applications that exposes a rich API for 
customization and extension.

Developers have control over the entire configuration pipeline, from input to output.

For full documentation, see <https://docs.v0.net/configurator>.

## Philosophy

Unlike command-line oriented libraries that focus on expressive argument parsing, Configurator takes a
data-first approach, and focuses on the "correctness" of the configured data that will be consumed by your
application and its subsystems.

The idea is that if the configuration system offers a strong contract for validating inputs
against well-defined configurable fields, then the output can be trusted, and treated more like
a data model.  The final populated configuration should be exactly what was expected, no more, no less.

## Basic Usage

```bash
npm install --save @versionzero/configurator
```

#### Example
(Source can be found in the [examples directory](https://github.com/argh/configurator/tree/main/examples)
```javascript title="basics.js"
import { ConfigurationSchema, Configurator } from '@versionzero/configurator';

const appName = 'basics';
// Define your configuration schema
const schema = new ConfigurationSchema();

schema.field('debug', { type: 'boolean', flagHint: 'D', advanced: true })

schema.child(appName)
      .field('verbose', { type: 'boolean' })
      .field('codes', { type: 'array', validator: {$each: '$alphanum'}, required: true})
schema.child('server')
      .field('host', { default: '127.0.0.1' })
      .field('port', { type: 'number', default: 80, validator: '$positive'})
      .field('protocol', { validator: {$in: ['tcp', 'udp', 'https', 'http']}})

// Initialize the configurator with your schema
const config = await new Configurator({schema}).configure({
  appName,                                                 // application name
  defaults: { [appName]: { verbose: true }},               // low priority, but higher than field defaults
  env: process.env,                                        // (unnecessary, this is the default value)
  argv: process.argv,                                      // (unnecessary, this is the default value)
  overrides: { server: { protocol: 'https', port: 443 } }  // highest priority
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

Also see the [examples directory](https://github.com/argh/configurator/tree/main/examples) for more advanced usage patterns:

- Custom types and validators
- Custom configuration sources
- Conditional configuration
- Dynamic configuration resolution
- Configuration file loading


## Key Features

**Reasonable Defaults, "Batteries Included", etc.**

: The default `Configurator` setup is a great starting point for quickly providing configuration hooks for
typical applications.  The schema API is superficially similar to that of most command-line focused libraries,
so adoption is easy.  Out of the box, you get a command line parser with help text generation, environment
variable parsing, configuration file loading, and a library of field validators that cover many common needs.

**Extensible Schema Types and Validation**

: The `Configurator` manages a `ConfigurationSchema`, which by default is pre-loaded to understand basic
primitive types and common extensions (`string`, `number`, `boolean`, `array`, `object`, `date`, `buffer`),
as well as many useful field validators (e.g. `$positive`, `$alphanum`, `$directory`, etc.) but developers
can also define their own implementations.  Custom types and validators can provide arbitrary (potentially
asynchronous!) transformations from *configuration inputs* to *validated outputs*.

**Sequenced Configuration Sources**

: Central to the `Configurator` is the concept of a `ConfigurationSource`.  Each source encapsulates the
functionality of discovering configuration field assignments from a single origin: `ObjectSource` understands simple
objects, `EnvironmentSource` reads environment variables, `CommandLineSource` parses command line arguments,
and so forth.
: Each `ConfigurationSource` is loaded in sequence.  Field assignments discovered later in the sequence
override assignments from earlier in the sequence.
: The `Configurator` provides a default sequence of predefined sources, but this sequence can be changed,
and the sources individually provide options to tune their behavior.  The sequence can also be extended with
additional sources, either fully custom, or provided by optional external packages.

**Single Source of Truth: Configuration as a Data Model**

: The validated output configuration object mimics the structure of an "idealized" config file for the whole
application; if the schema is set up as a hierarchy that matches the structure of the application
and its subsystems, each subsystem's configurable fields will be are enclosed inside a child property
object, and can be safely used to configure that subsystem, without extraneous data leaking in.
This reduces the *"dig through a random bag of whatever"* output generated by many other configuration
libraries.

**Built to be Embedded**

: The observant reader may have noticed that if there was a way for subsystems to declare their own
schema internally, one could wrap the `Configurator` up such that these subsystems are introspected,
their internal schemas discovered, and each subsystem could be initialized with a validated object containing
only their requested configurables.  In fact, those subsystems could register *themselves* as types, with
a type resolver that returns singleton instances of those subsystems, allowing them to be assigned to
matching configurable fields... 🤔
: Good news, this exists!  It's called [`ModuleManager`](/module-manager), and it has its own section in the [documentation](./module-manager).
: It is a separately installed library [`@versionzero/module-manager`](https://github.com/argh/module-manager) that 
embeds `Configurator`, and still provides all the `Configurator` capabilities described in this documentation, but 
with a bias towards serving applications structured as a dependency graph of modular subsystems.  As a quick pitch,
`ModuleManager` provides **embedded declarative schemas**, **strongly typed references**, **dependency injection**, 
and **lifecycle management**.  It enables you to keep your configurable field definitions fully colocated with the
modules that consume them, and provides a structured approach to wiring everything together.  While the `Configurator`
is a fine library for direct use on its own, it really shines for larger applications when embedded in an active "smart"
layer -- like `ModuleManager` -- that understands how your functionality is partitioned.



### Multiple Configuration Sources

Configuration is gathered from multiple sources in priority order:

1. **Schema Defaults**: Defined in your schema
2. **Application Defaults**: Programmatically defined defaults
3. **Environment Variables**: From process.env
4. **Command Line Arguments**: From process.argv
5. **Configuration Files**: JSON files referenced via command line
6. **Overrides**: Programmatically defined overrides

### Custom Types

Define custom types for specialized configuration values:

```javascript
types.defineType('timestamp', (value) => {
  if (typeof value === 'number') {
    if (value < 0) throw new Error(`Invalid negative timestamp value: ${value}`);
    return value;
  }
  else if (!value || value === 'now') {
    return Date.now();
  }
  else {
    throw new Error(`Invalid timestamp value: ${value}`);
  }
});
```

### Custom Validators

Implement domain-specific validation logic:

```javascript
validators.register('inside-git-repo', async (value) => {
  // Validation logic that checks if a path is within a git repository
  // ...
});
```

### Custom Configuration Sources

Create your own configuration sources for specialized needs:

```javascript
class SecretsManagerSource extends ConfigurationSource {
  constructor() {
    super({sequence: ConfigurationSource.DefaultSequence.SECRETS});
  }

  async load(schema, context, loadOptions) {
    // Implementation that loads secrets from a secure source
    // ...
  }
}
```

## Command Line Interface

Command line arguments are automatically generated from your schema:

```
Usage: myapp [options]

Options:
  --debug (-D)                      - Debug mode
  --verbose                         - Verbose output (advanced)
  --codes <value...>                - Alphanumeric codes (required)
  --server-host <string-value>      - Server hostname (default: localhost)
  --server-port <number>            - Server port (default: 80)
  --server-protocol <https|http>    - Server protocol
```

## Environment Variables

Environment variables are automatically mapped from your schema using constant case:

```
DEBUG=true
VERBOSE=true
CODES=abc,def,123
SERVER_HOST=api.example.com
SERVER_PORT=443
SERVER_PROTOCOL=https
```

## Advanced Usage

See the examples directory for more advanced usage patterns:

- Custom types and validators
- Custom configuration sources
- Conditional configuration
- Dynamic configuration resolution
- Configuration file loading

## License

MIT
