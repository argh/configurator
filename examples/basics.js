import { Configurator, ConfigurationSchema } from '../src/index.js';

const appName = 'basics';
const schema = new ConfigurationSchema();

schema.field('debug', { type: 'boolean', flagHint: 'D', advanced: true })
schema.child(appName)
      .field('files', { type: 'array', general: true, allowEmpty: true, validator: {$each: '$file'}, description: 'files to process'})
      .field('verbose', { type: 'boolean', default: false, advanced: true, description: 'enable verbose diagnostics' })
      .field('codes', { type: 'array', validator: {$each: '$alphanum'}, required: true, description: 'secret codes'})
schema.child('server')
      .field('host', { default: '127.0.0.1', validator: {$or: ['$ipv4', '$ipv6', '$reachable']}, description: 'health check address' })
      .field('port', { type: 'number', default: 80, validator: '$port', description: 'health check port'})
      .field('protocol', { validator: {$in: ['https', 'http']}, description: 'health check protocol', advanced: true})

try {
  const config = await new Configurator({schema}).configure({
    appName,
    defaults: { [appName]: { verbose: true }},                                 // app defaults are low priority but take precedence over schema defaults
    env: { 'BASICS_SERVER_HOST' : 'localhost' },                               // normally omit, defaults to process.env
    argv: ['-D', '--server-port', '8081', '--codes', '5xx', 'z10', '123' ],    // normally omit, defaults to process.argv
    overrides: { server: { protocol: 'https', port: 443 } }                    // overrides default to highest priority

  });
  console.log('Configuration results: ', config);
}
catch (error) {
  console.error(error.message);
  process.exit(1);
}
