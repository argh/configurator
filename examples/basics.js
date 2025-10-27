import { Configurator, SchemaResolver, Schema } from '../src/index.js';

const appName = 'basics';
const schema = new Schema('object');

// Debug property at root level
schema.property('debug',
  new Schema('boolean')
    .meta('flagHint', 'D')
    .meta('advanced', true)
);

// App-specific schema
schema.property(appName,
  new Schema('object')
    .property('files',
      new Schema('array', {allowEmpty: true})
        .meta('general', true)
        .meta('description', 'files to process')
        .property('*',
          new Schema('string', {validator: '$file'})))
    .property('verbose',
      new Schema('boolean', { default: false })
        .meta('advanced', true)
        .meta('description', 'enable verbose diagnostics'))
    .property('codes',
      new Schema('array', { required: true })
        .meta('description', 'secret codes')
        .property('*', new Schema('string', { validator: '$alphanum' }))));


// Server configuration schema
// attributes with an underscore are interpreted as metadata
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
  const config = await new Configurator({schema}).configure({
    appName,
    defaults: { [appName]: { verbose: true }},                               // app defaults are low priority but take precedence over schema defaults
    env: { 'BASICS_SERVER_HOST' : '127.0.0.1' },                             // normally omit, defaults to process.env
    argv: ['-D', '--server-port', '8081', '--codes', '5xx', 'z10', '123'],  // normally omit, defaults to process.argv
    overrides: { server: { protocol: 'https', port: 443 } }                  // overrides default to highest priority
  });
  console.log('Configuration results: ', config);
}
catch (error) {
  console.error(error);
  process.exit(1);
}