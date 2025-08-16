import { Configurator, ConfigurationSchema } from '../src/index.js';

// This example shows how to define a command hierarchy

const appName = 'cloud';
const schema = new ConfigurationSchema();

// Top-level schema
schema.field('region', {type: 'string', description: 'cloud region', default: 'west-1', validator: {$in: ['west-1', 'west-2', 'east-1']}})
      .field('command', {type: 'string', command: true, required: true, description: 'cloud command'})
      .field('debug', { type: 'boolean', flagHint: 'D', advanced: true, description: 'enable debug mode' })

// A small normal schema hierarchy to highlight parsing differences with commands
schema.child('credentials')
      .field('token', { type: 'string', description: 'cloud security token', required: true })
      .field('key', { type: 'string', description: 'cloud security key', required: true })

// STORAGE COMMAND

// From the schema's perspective, there isn't actually anything particularly special about commands.  There is just
// a field that has a "command:true" set on it, and a linked child schema at the same level.
// The magic comes to play only in how CommandLineSource interprets these settings:
// 1. Child schemas that link up to a command field via linkedParentFieldName define the possible command assignments
//    via the linkedParentFieldValue (which defaults to the child name if omitted).
// 2. A schema condition is automatically created that only enables the child schema if the command value
//    (the linkedParentFieldName field) matches the linkedParentFieldValue.
// 3. During argument parsing, CommandLineSource uses the command hierarchy to refine the available options
//    (and their names) to the linked child schema.  Higher-level options are not available once a command has
//    been specified.

// To demonstrate the command hierarchy, we will also define a sub-command for "storage" called "storageCommand".

const storageSchema = schema.child('storage', { linkedParentFieldName: 'command' })
                            .field('bandwidth', {type: 'number', default: 500, validator: {$range: {min: 1, max: 1000}}, description: 'storage bandwidth in Mbps' })
                            .field('iops', {type: 'number', default: 100, validator: {$range: {min: 1, max: 10000}}, description: 'storage IOPS' })
                            .field('storageCommand', {type: 'string', command: true, description: 'storage command', required: true})

// STORAGE SUB-COMMANDS

storageSchema.child('list', { linkedParentFieldName: 'storageCommand' })
             .field('bucket', {type: 'string', description: 'storage bucket name', required: true})
             .field('recursive', {type: 'boolean', description: 'list subdirectories', default: false});

// you can have a different child name than the command value by specifying an explicit linkedParentFieldValue.
storageSchema.child('getConfig', { linkedParentFieldName: 'storageCommand', linkedParentFieldValue: 'get' })
             .field('bucket', {type: 'string', description: 'storage bucket name', required: true})
             .field('key', {type: 'string', description: 'storage key name', required: true})

storageSchema.child('put', { linkedParentFieldName: 'storageCommand' })
             .field('bucket', {type: 'string', description: 'storage bucket name', required: true})
             .field('key', {type: 'string', description: 'storage key name', required: true})
             .field('data', {type: 'string', validator: '$file', general: true, description: 'storage file to upload'})

// COMPUTE

// As with "storage" above, we'll create a sub-command for "compute" called "computeCommand".

const computeSchema = schema.child('compute', { linkedParentFieldName: 'command' })
                            .field('watch', {type: 'boolean', description: 'watch for compute events', default: false })
                            .field('computeCommand', {type: 'string', command: true, required: true});

// You can use a schema as a template for children (but this can make it awkward to set linkedParentFieldValue, so you
// will probably want to ensure that child names work for your command values.)
// Note that "debug" is set to inherit, so if set in the top-level schema, each child command inherits the value.
// "De-normalizing" settings can often be simpler than trying to provide ways to provide access to a common setting
// throughout the application.

const computeCommandSchema = new ConfigurationSchema({ linkedParentFieldName: 'computeCommand' })
  .field('cluster', {type: 'string', description: 'compute cluster name', validator: '$alphanum', required: true })
  .field('debug', {type: 'boolean', inherit: true })

// COMPUTE SUB-COMMANDS

computeSchema.child('create', computeCommandSchema);
computeSchema.child('destroy', computeCommandSchema);

// The schema used for the child is cloned, so you can add additional fields to it as needed.
computeSchema.child('describe', computeCommandSchema)
             .field('id', {type: 'string', description: 'compute instance id', validator: '$uuid', required: true})

// Help text tries to intelligently chop down alternative values, and wrap long descriptions.  Run with --help to see this in action.
computeSchema.child('instances', computeCommandSchema)
             .field('filter', {type: 'string', validator: {$in: ['running', 'stopped', 'all', 'long-text', 'otherstuff', 'chopchop', 'keepgoing', 'long', 'wtf', 'this-is-silly']}, description: 'compute instance filter, but maybe the description is really long and needs to be wrapped', default: 'running'})

computeSchema.child('provision', computeCommandSchema)
             .field('image', {type: 'string', description: 'compute image name', default: 'linux', required: true})
             .field('architecture', {type: 'string', description: 'compute architecture', default: 'arm64', required: true})

try {
  const config = await new Configurator({schema}).configure({
    appName,

    env: { 'CLOUD_STORAGE_BANDWIDTH' : '750' },                                              // normally omit, defaults to process.env
//    argv: ['--help']                                                                       // this is a good example for showing help formatting
//    argv: ['--ct=abc', '--ck=123', 'storage', 'get', '-b', 'mybucket', '-k', 'mykey' ],    // normally omit, defaults to process.argv
//    argv: ['--ct=abc', '--ck=123', 'compute', 'describe', '--cluster', 'fred', '-i=336aac1e-feee-4974-9f6b-cbbe18914899']
    argv: ['--ct=abc', '--ck=123', 'compute', 'instances', '--cluster', 'fred']

  });
  // Observe that storage.bandwidth does not show up unless the command is "storage" (a condition is synthesized from the linkedParentFieldName)
  console.log('Configuration results: ', config);

  // In Configurator, commands don't actually "do" anything on their own; they simply provide
  // structured hints for the command line to hierarchically assemble the configuration in a
  // friendly manner.  The actual work of interpreting what a command "means" is up to the application.
  //
  // (For a higher-level abstraction that uses Configurator commands to select code to execute,
  // see the @versionzero/module-manager package.)

  console.log(`*** Executing command "${config.command}" subcommand "${config.command === 'compute'? config.compute.computeCommand : config.storage.storageCommand}"`)

}
catch (error) {
  console.error(error.message);
  process.exit(1);
}
