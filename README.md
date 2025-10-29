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
import { Schema, Configurator } from '@versionzero/configurator';

const appName = 'basics';

// Define your configuration schema using fluent API
const schema = new Schema('object')
  .property('debug', new Schema('boolean')
    .meta('flagHint', 'D')
    .meta('description', 'enable debug output')
    .meta('advanced', true))
  .property(appName, new Schema('object')
    .property('verbose', new Schema('boolean')
      .default(false)
      .meta('description', 'enable verbose logging'))
    .property('codes', new Schema('array')
      .required()
      .property('*', new Schema('string').validator('$alphanum'))
      .meta('description', 'secret magic codes')))  
  .property('server', new Schema('object')
    .property('host', new Schema('string')
      .default('127.0.0.1')
      .meta('description', 'server host address')
      .validator({$or: ['$ipv4', '$ipv6', '$reachable']}))
    .property('port', new Schema('number')
      .default(80)
      .meta('description', 'server port')
      .validator('$port'))
    .property('protocol', new Schema('string')
      .meta('description', 'server protocol')
      .validator({$in: ['https', 'http']})));

// Initialize the configurator with your schema
const config = await new Configurator({schema}).configure({
  appName,                                             // application name
  defaults: {[appName]: {verbose: true}},              // low priority, but higher than schema defaults
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

#### Union Types and Selectors Example

Here's a taste of union types and selectors for dynamic configuration:

```javascript
// Union types: different schemas based on discriminator
const deploySchema = new Schema('object')
  .unionSchema('aws', new Schema('object')
    .property('type', Schema.literal('aws'))
    .property('region', new Schema('string'))
    .property('accessKey', new Schema('string')))
  .unionSchema('local', new Schema('object')
    .property('type', Schema.literal('local'))
    .property('dataDir', new Schema('string')));

// Selectors: activate related configuration sections
const appSchema = new Schema('object')
  .property('command', new Schema('string').selector())
  .property('deployService', new Schema('object').selection('deploy')
    .property('environment', deploySchema))
  .property('testService', new Schema('object').selection('test')
    .property('pattern', new Schema('string')));

// Usage: myapp deploy --type aws --region us-west-2
// Or:    myapp test --pattern "*.spec.js"
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

**Schema-First Design with Fluent API**

: Define your configuration structure declaratively using composable `Schema` objects. The fluent API makes
complex nested structures intuitive to build, while union types let you handle different configuration shapes
based on runtime conditions. Unlike command-line-focused libraries, your schema becomes the single source of
truth for structure, validation, and transformation.

**Composable Configuration Sources**

: Unlike libraries that focus on a single input method, `Configurator` treats each configuration source as a 
first-class component. Each `ConfigurationSource` handles one concern (CLI args, env vars, JSON files, etc.) 
while participating in a systematic priority resolution process. This eliminates the manual orchestration 
typically required when combining multiple configuration approaches, and makes extending with additional 
sources straightforward.

**Simple to Start, Scales to Complex**

: Begin with the included "batteries" - command line parsing, environment variables, config files, and a rich
validator library (`$positive`, `$alphanum`, `$directory`, etc.). As your needs grow, add custom types, 
validators, and sources. The asynchronous normalization, transformation, and validation pipeline supports 
complex scenarios like lazy evaluation, async validation, and dynamic value resolution. The architecture 
scales from simple apps to complex enterprise systems with secrets management, feature flags, and 
multi-environment deployments.

**Union Types and Selectors for Dynamic Configuration**

: Handle different configuration shapes and subsystem activation intelligently. Union types let you define 
multiple schemas for the same property, with automatic resolution based on discriminator values. Selectors 
enable hierarchical command structures where choosing one option activates related configuration sections.
Perfect for plugins, deployment targets, CLI commands, or any scenario where your config structure varies 
at runtime.

**Single Source of Truth: Configuration as a Data Model**

: The structure of the validated output configuration object is intended to mirror an "idealized" config 
file format for your application.  If a schema hierarchy is created to align with the structure of the 
application and its subsystems, then each subsystem's configured properties will be nested inside a 
child object.  This child object can then be used in isolation to safely initialize that subsystem, without
extraneous data leaking in. This reduces the *"dig through a random bag of whatever"* output 
generated by many other configuration libraries.

**Built for Extension and Integration**

: The source architecture naturally accommodates additional configuration inputs as your requirements grow. 
Whether you need to integrate with secrets management, parameter stores, feature flag systems, or database 
configuration, the same priority resolution and validation pipeline applies. Custom sources participate as 
first-class citizens alongside the built-in CLI, environment, and file sources.

: For larger applications, the schema-first approach creates clean interfaces between subsystems. Each component 
can define its own configuration schema, and the validated output provides exactly the properties that subsystem 
needs - eliminating the "dig through a bag of properties" problem common in other libraries.

: [`ModuleManager`](https://github.com/argh/module-manager) (`@versionzero/module-manager`) builds on this 
foundation to provide **embedded declarative schemas**, **dependency injection**, and **lifecycle management** 
for modular applications. But even standalone, `Configurator`'s architecture scales elegantly from simple CLI 
tools to enterprise systems with complex configuration requirements.

## License

MIT
