import { ConfigurationSchema } from '../src/configuration-schema.js';
import { Configurator } from '../src/configurator.js';

const schema = new ConfigurationSchema();

schema.field('debug', { type: 'boolean', flagHint: 'D', hidden: true })
      .field('verbose', { type: 'boolean', default: false, advanced: true })
      .field('codes', { type: 'array', validator: {$each: '$alphanum'}, required: true})
      .child('server')
           .field('host', { default: 'localhost' })
           .field('port', { type: 'number', default: 80, validator: '$positive'})
           .field('protocol', { validator: {$in: ['https', 'http']}, advanced: true})

try {
  const config = await new Configurator({schema}).configure({
    defaults: { verbose: true, server: { protocol: 'https' } },                // app defaults override field defaults
    env: { 'SERVER_HOST' : '127.0.0.1' },                                      // normally omit, defaults to process.env
    argv: ['-D', '--server-port', '8081', '--codes', '5xx', 'z10', '123' ],    // normally omit, defaults to process.argv

  });
  console.log('Configuration results: ', config);
}
catch (error) {
  console.log(error.message);
}
