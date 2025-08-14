import { Configurator, ConfigurationSchema } from '../src/index.js';

const appName = 'cloud';
const schema = new ConfigurationSchema();

schema.field('region', {type: 'string', description: 'cloud region', default: 'west-1', validator: {$in: ['west-1', 'west-2', 'east-1']}})
      .field('command', {type: 'string', command: true, required: true, description: 'cloud command'})
      .child('credentials')
      .field('token', { type: 'string', description: 'cloud security token', required: true })
      .field('key', { type: 'string', description: 'cloud security key', required: true })


const storageSchema = schema.child('storage', { linkedParentFieldName: 'command' })
                            .field('bandwidth', {type: 'number', default: 500, validator: {$range: {min: 1, max: 1000}}, description: 'storage bandwidth in Mbps' })
                            .field('iops', {type: 'number', default: 100, validator: {$range: {min: 1, max: 10000}}, description: 'storage IOPS' })
                            .field('storageCommand', {type: 'string', command: true, description: 'storage command', required: true})

storageSchema.child('list', { linkedParentFieldName: 'storageCommand' })
             .field('bucket', {type: 'string', description: 'storage bucket name', required: true})
             .field('recursive', {type: 'boolean', description: 'list subdirectories', default: false});

storageSchema.child('getConfig', { linkedParentFieldName: 'storageCommand', linkedParentFieldValue: 'get' })
             .field('bucket', {type: 'string', description: 'storage bucket name', required: true})
             .field('key', {type: 'string', description: 'storage key name', required: true})

storageSchema.child('put', { linkedParentFieldName: 'storageCommand' })
             .field('bucket', {type: 'string', description: 'storage bucket name', required: true})
             .field('key', {type: 'string', description: 'storage key name', required: true})
             .field('data', {type: 'string', validator: '$file', general: true, description: 'storage file to upload'})

const computeSchema = schema.child('compute', { linkedParentFieldName: 'command' })
                            .field('watch', {type: 'boolean', description: 'watch for compute events', default: false })
                            .field('computeCommand', {type: 'string', command: true, required: true});

// you can use a schema as a template for children...
const computeCommandSchema = new ConfigurationSchema({ linkedParentFieldName: 'computeCommand' })
  .field('cluster', {type: 'string', description: 'compute cluster name', validator: '$alphanum', required: true })

computeSchema.child('list', computeCommandSchema)
             .field('filter', {type: 'string', validator: {$in: ['running', 'stopped', 'all']}, description: 'compute instance filter', default: 'running'})

computeSchema.child('describe', computeCommandSchema)
             .field('id', {type: 'string', description: 'compute instance id', validator: '$uuid', required: true})

computeSchema.child('create', computeCommandSchema)
             .field('image', {type: 'string', description: 'compute image name', default: 'linux', required: true})
             .field('architecture', {type: 'string', description: 'compute architecture', default: 'arm64', required: true})

try {
  const config = await new Configurator({schema}).configure({
    appName,

    env: { 'CLOUD_STORAGE_BANDWIDTH' : '750' },                               // normally omit, defaults to process.env
//    argv: ['--help']
//    argv: ['--ct=abc', '--ck=123', 'storage', 'get', '-b', 'mybucket', '-k', 'mykey' ],    // normally omit, defaults to process.argv
    argv: ['--ct=abc', '--ck=123', 'compute', 'describe', '--cluster', 'fred', '-i=336aac1e-feee-4974-9f6b-cbbe18914899']

  });
  // Observe that storage.bandwidth does not show up unless the command is "storage" (a condition is synthesized from the linkedParentFieldName)
  console.log('Configuration results: ', config);

  console.log(`*** Executing command "${config.command}" subcommand "${config.command === 'compute'? config.compute.computeCommand : config.storage.storageCommand}"`)

}
catch (error) {
  console.log(error.message);
}
