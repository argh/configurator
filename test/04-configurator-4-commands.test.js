import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { CommandLineSource } from '../src/configuration-sources/command-line-source.js';
import { Configurator } from '../src/index.js';

describe('Configurator Command Pattern', function() {
  let source;
  let schema;
  let configurator;

  beforeEach(async function () {
    source = new CommandLineSource('myapp');
    schema = new ConfigurationSchema();
    configurator = new Configurator({schema});

    schema.field('region', {type: 'string'})
          .field('command', {type: 'string', command: true, required: true})
          .child('credentials')
          .field('token', { type: 'string' })
          .field('key', { type: 'string' })


    const storageSchema = schema.child('storage', { linkedParentFieldName: 'command' })
                                .field('trace', {type: 'boolean'})
                                .field('storageCommand', {type: 'string', command: true});

    storageSchema.child('list', { linkedParentFieldName: 'storageCommand' })
                 .field('bucket', {type: 'string'})
                 .field('recursive', {type: 'boolean'});

    storageSchema.child('get', { linkedParentFieldName: 'storageCommand' })
                 .field('bucket', {type: 'string'})
                 .field('key', {type: 'string'})

    storageSchema.child('put', { linkedParentFieldName: 'storageCommand' })
                 .field('bucket', {type: 'string'})
                 .field('key', {type: 'string'})


    const computeSchema = schema.child('compute', { linkedParentFieldName: 'command' })
                                .field('watch', {type: 'boolean'})
                                .field('computeCommand', {type: 'string', command: true});

    // should be able to reuse a schema as a basis...

    const computeCommandSchema = new ConfigurationSchema({ linkedParentFieldName: 'computeCommand' })
      .field('cluster', {type: 'string'})

    computeSchema.child('list', computeCommandSchema)

    computeSchema.child('describe', computeCommandSchema)
                 .field('id', {type: 'string'})

    computeSchema.child('create', computeCommandSchema)
                 .field('image', {type: 'string'})
                 .field('type', {type: 'string'})

  });


  it('should support a command hierarchy', async function () {
    const context = {
      appName: 'myApp',
      env: {MY_APP_COMPUTE_WATCH: 'true'},
      argv: [
        '--credentials-token', 'token',
        '--ck=key',
        '--region=west',
        'compute',
        'create',
        '--cluster=fred',
        '-t', 'prod',
        '--image=ubuntu'
      ]
    };

    const config = await configurator.configure(context);

    assert.equal(config.region, 'west');
    assert.equal(config.command, 'compute');
    assert.equal(config.credentials?.token, 'token');
    assert.equal(config.credentials?.key, 'key');
    assert.equal(config.compute?.watch, true);
    assert.equal(config.compute?.create?.cluster, 'fred');
    assert.equal(config.compute?.create?.type, 'prod');
    assert.equal(config.compute?.create?.image, 'ubuntu');
  })
  it('should complain about unknown command options', async function () {
    const context = {
      appName: 'myApp',
      env: {MY_APP_COMPUTE_WATCH: 'true'},
      argv: [
        '--credentials-token', 'token',
        '--ck=key',
        '--region=west',
        'storage',
        'list',
        '--cluster=fred',
      ]
    };
    await assert.rejects(async () => {
      await configurator.configure(context);
    }, /Unknown option/);
  })
});


