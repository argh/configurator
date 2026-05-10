import { Configurator, ConfiguratorError, Schema, SchemaResolver } from '@versionzero/configurator';


const schemax = new Schema('object')
  .property('version', Schema.literal('1.0.1').meta('internal').validator('$semver'))
  .property('prod', new Schema('boolean')
    .meta('description', 'enforce production rules')
    .default(process.env['NODE_ENV'] === 'production')
  )
  .property('server', new Schema('object')
      .property('token', new Schema('string')
        .required()
        .validator('$base64')
        .meta('description', 'auth token')
        .meta('secret')
        .serializer('****')
      )
      .property('url', new Schema('string')
        .default('http://127.0.0.1:3000')
        .meta('valueDescription', 'url')
        .meta('description', 'address (must be https in prod)')
        .validator('$url')
        .validator({$or: [
            {$eq: [{$reference: '/prod'}, false]},
            {$matches: /https:.+/}
          ]}
        )
      )
    )


const configuration = await new Configurator({schema:schemax}).configure(
  {
    argv: ['--help', 'advanced']
//    argv: ['--server-url', 'https://prod.example.com', '-p', '--st', 'bGVtbWUgaW4h']
  }
)
/*
Usage: command [options]
  --config (-C) [path|-]         - load configuration from file (or - for stdin)
  --help (-h) [advanced]         - display help information
  --prod (-p) [true|false]       - enforce production rules (default:false)
  --server-token (--st) <base64> - auth token (required)
  --server-url (--su) url        - address (must be https in prod)
                                   (default:http://127.0.0.1:3000)

{
  server: { token: 'bGVtbWUgaW4h', url: 'https://prod.example.com/' },
  prod: true,
  version: '1.0.1'
}

 */
console.log(configuration);


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
        .property('*', new Schema('MagicCode').validator({$matches: /^[^q]+$/}))
        .meta('description', 'magic secret codes')
        .meta('valueDescription', '{codes...} (alphanumeric, no q!)')
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
    .meta('advanced')  // default value for metadata is "true"
  )
);


const context = (process.env.CONFIGURATOR_TEST === 'true')?
  {
    appName,
    defaults: { [appName]: { verbose: true }},                               // app defaults are low priority but take precedence over schema defaults
    env: { 'BASICS_SERVER_HOST' : '127.0.0.1' },                             // normally omit, defaults to process.env
    argv: ['-D', '--server-port', '8081', '--codes', '5xx', 'z10', '123'],   // normally omit, defaults to process.argv
    overrides: { server: { protocol: 'https', port: 443 } }                  // overrides default to highest priority
  }
  : { appName }


try {
  const config = await new Configurator({schema, resolver}).configure(context);
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
  console.error(error)
  process.exit(1);
}