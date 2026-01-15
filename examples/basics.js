import { Configurator, SchemaResolver, Schema, ConfiguratorError } from '../src/index.js';

const appName = 'basics';

// Root schema
const schema = new Schema('object');

// Debug property at root level
schema.property('debug',
  new Schema('boolean')
    .meta('description', 'enable debugging')
    .meta('advanced', true)  // hide from basic CLI help
    .meta('flagHint', 'D')   // advanced options normally don't get a CLI flag allocated
);

const resolver = new SchemaResolver();

// Let's define a reusable schema base
resolver.registerSchema('MagicCode',
  new Schema('string')
    .normalizer('$lowercase')
    .validator('$alphanum')
    .meta('valueName', 'code')
);

// App-specific schema

schema.property(appName,
  new Schema('object')
    .property('files',
      new Schema('array')
        .allowEmpty()
        .meta('description', 'files to process')
        .meta('general', true)  // CLI hint to not require an explicit option
        .property('*', new Schema('string').validator('$file'))
    )
    .property('verbose',
      new Schema('boolean')
        .default(false)
        .meta('description', 'enable verbose diagnostics')
        .meta('advanced', true)
    )
    .property('codes', // accept magic codes that don't contain "q"
      new Schema('array')
        .required()
        .property('*', new Schema('MagicCode').validator(/^[^q]+$/))
        .meta('description', 'magic secret codes')
        .validator({'$length': {min: 2}})
    )
)

// As a personal style choice, you can alias the static factory function to make construction more terse:
const s = Schema.create;

// Server configuration schema
schema.property('server', s('object')
  .property('host', s('string')
    .default('localhost')
    .validator({$or: ['$ipv4', '$ipv6', '$reachable']})
    .meta('description', 'health check address')
  )
  .property('port', s('number')
    .default(80)
    .validator('$port')
    .meta('description', 'health check port')
  )
  .property('protocol', s('string')
    .validator({$in: ['https', 'http']})
    .meta('description', 'health check protocol')
    .meta('advanced')  // default value for metadata is
  )
);

try {
  const config = await new Configurator({schema, resolver}).configure({
    appName,
    defaults: { [appName]: { verbose: true }},                               // app defaults are low priority but take precedence over schema defaults
    env: { 'BASICS_SERVER_HOST' : '127.0.0.1' },                             // normally omit, defaults to process.env
    argv: ['-D', '--server-port', '8081', '--codes', '5xx', 'z10', '123'],   // normally omit, defaults to process.argv
    overrides: { server: { protocol: 'https', port: 443 } }                  // overrides default to highest priority
  });
  console.log('Configuration results: ', config);
}
catch (error) {
  if (error instanceof ConfiguratorError) {
    if (error.cause && error.cause.message) {
      console.error(`Configuration error: ${error.message} (${error.cause.message})`)
    }
    else {
      console.error(`Configuration error: ${error.message}`)
    }
    console.error(`Specify --help to list available command line options`)
  }
  else {
    console.error(error);
  }
  process.exit(1);
}