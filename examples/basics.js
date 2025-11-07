import { Configurator, SchemaResolver, Schema, ConfiguratorError } from '../src/index.js';

const appName = 'basics';

// Root schema
const schema = new Schema('object');

// Debug property at root level (factory function, fluent api)
schema.property('debug',
  new Schema('boolean')
    .meta('advanced', true)  // hide from basic CLI help
    .meta('flagHint', 'D')   // advanced options normally don't get a CLI flag allocated
    .meta('description', 'enable debugging')
);

const resolver = new SchemaResolver();

// Let's define a reusable schema base
resolver.registerSchema('MagicCode',
  new Schema('string')
    .validator('$alphanum')
    .meta('valueName', 'code')
)

// App-specific schema (fluent api)
schema.property(appName,
  new Schema('object')
    .property('files',
      new Schema('array').allowEmpty()
        .meta('general', true)  // CLI hint to not require an explicit option
        .meta('description', 'files to process')
        .property('*',
          new Schema('string').validator('$file')))
    .property('verbose',
      new Schema('boolean').default(false)
        .meta('advanced', true)
        .meta('description', 'enable verbose diagnostics'))
    .property('codes',
      new Schema('array').required()
        .meta('description', 'magic secret codes')
        .property('*', new Schema('MagicCode'))
        .validator({'$length': {min: 2}})))


// Server configuration schema, showing alternative attributes-based definition
// (attributes with an underscore are stored in metadata without underscore)
schema.property('server', new Schema('object')
  .property('host', new Schema('string', {
    default: 'localhost',
    validator: {$or: ['$ipv4', '$ipv6', '$reachable']},
    _description: 'health check address'
  }))
  .property('port', new Schema('number', {
    default: 80,
    validator: '$port',
    _description: 'health check port'
  }))
  .property('protocol', new Schema('string', {
    validator: {$in: ['https', 'http']},
    _description: 'health check protocol',
    advanced: true
  }))
);

try {
  const config = await new Configurator({schema, resolver}).configure({
    appName,
    defaults: { [appName]: { verbose: true }},                               // app defaults are low priority but take precedence over schema defaults
    env: { 'BASICS_SERVER_HOST' : '127.0.0.1' },                             // normally omit, defaults to process.env
    argv: ['-D', '--server-port', '8081', '--codes', '5xx', 'z10', '123'],  // normally omit, defaults to process.argv
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