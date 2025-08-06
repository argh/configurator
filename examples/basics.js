import { Configurator, ConfigurationSchema } from '../src/index.js';

const appName = 'basics';
const schema = new ConfigurationSchema();

schema.field('debug', { type: 'boolean', flagHint: 'D', hidden: true })
schema.child(appName)
      .field('verbose', { type: 'boolean', default: false, advanced: true })
      .field('codes', { type: 'array', validator: {$each: '$alphanum'}, required: true})
schema.child('server')
      .field('host', { default: '127.0.0.1' })
      .field('port', { type: 'number', default: 80, validator: '$positive'})
      .field('protocol', { validator: {$in: ['https', 'http']}, advanced: true})

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
  console.log(error.message);
}
