# Configurator

A **schema-based** configuration management library for Node.js applications that exposes a rich API for
customization and extension.

Developers have control over the entire configuration pipeline, from input to output.

For full documentation, see <https://docs.v0.net/configurator>.

## Requirements

- NodeJS 22.22.0+
- ESM Modules only

## Philosophy

Unlike command-line oriented libraries that focus solely on expressive argument parsing, Configurator takes a
data-first approach, and focuses on the "correctness" of the configured data that will be consumed by your
application and its subsystems.

The idea is that if the configuration system offers a strong contract for validating inputs
against well-defined configurable fields, then the output can be trusted, and treated more like
a data model. The final populated configuration should be exactly what was expected, no more, no less.

(Configurator's command-line processing is still highly expressive, but is constructed automatically
by introspecting the configuration schema's structure and custom metadata!)

## Basic Usage

```bash
npm install --save @versionzero/configurator
```

#### Example

(Source can be found in the [examples directory](https://github.com/argh/configurator/tree/main/examples))

```javascript title="basics.js"

import { Schema, Configurator } from '@versionzero/configurator';

const appName = 'basics';

// Define your configuration schema, and add metadata to customize the CLI
// and add text for '--help' generation:
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
      .meta('description', 'server port number')
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

See the full [documentation](https://docs.v0.net/configurator) for details on customizing how the schema's configurables are
mapped from sources like environment variables and command line arguments.

Also see the [examples directory](https://github.com/argh/configurator/tree/main/examples) for more advanced usage patterns:

- Configuration file loading
- Custom types and validators
- Custom configuration sources
- Conditional configuration
- Dynamic configuration resolution
- Command line "command" support
- Advanced schema features

## Key Features

**Expressive Schema**

Introspects [`@versionzero/schema`](https://github.com/argh/schema) structure and metadata to define configurables.

The fluent Schema API makes complex nested and variant configurations intuitive to build.  Your schema becomes 
the source of truth for structure, validation, and transformation.

The schema supports both sync and async processing, enabling lazy evaluation, dependency injection, validation of
network or file system resources, transforming data through complex processing pipelines, and dynamic resolution
to allow handling different data shapes based on runtime conditions.

Union schemas let you define multiple alternative schemas, and Selectors enable hierarchical command structures
where choosing one option activates related configuration sections.

Out of the box, the schema handles basic types and provides a rich library of processors for parsing and validation, 
and can be extended with your own custom schemas and processors.  Perfect for plugins, deployment targets, CLI commands, 
or any scenario where your config structure varies at runtime.

**Composable Configuration Sources**

`Configurator` treats configuration sources as independently defined first-class components. 
Each `ConfigurationSource` handles one concern (CLI args, env vars, JSON files, etc.) while participating in a 
systematic priority resolution process. This eliminates the manual orchestration typically required when combining 
multiple configuration approaches, and makes extending with additional sources straightforward.

**Configuration as a Data Model**

The structure of the validated output configuration object is intended to mirror an "idealized" config 
file format for your application.  If a schema hierarchy is created to align with the structure of the 
application and its subsystems, then each subsystem's configured properties will be nested inside a 
child object.  This child object can then be used in isolation to safely initialize that subsystem, without
extraneous data leaking in. This reduces the *"dig through a random bag of whatever"* output 
generated by many other configuration libraries.

**Built for Extension and Integration**

The source architecture naturally accommodates additional configuration inputs as your requirements grow. 
Whether you need to integrate with secrets management, parameter stores, feature flag systems, or database 
configuration, the same priority resolution and validation pipeline applies. Custom sources participate as 
first-class citizens alongside the built-in CLI, environment, and file sources.

For larger applications, the schema-first approach creates clean interfaces between subsystems. Each component 
can define its own local configuration schema, and the validated output provides exactly the properties that 
subsystem needs.

The [`ModuleManager`](https://github.com/argh/module-manager) (`@versionzero/module-manager`) package builds on this 
foundation to enable **embedded declarative schemas**, **dependency injection**, and **lifecycle management** 
for modular applications. But even standalone, `Configurator`'s architecture scales elegantly from simple CLI 
tools to enterprise systems with complex configuration requirements.

## License

Copyright 2026 Version Zero | github.com/argh

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this library except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
