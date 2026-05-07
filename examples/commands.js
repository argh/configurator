import { Configurator, ConfiguratorError, Schema } from '@versionzero/configurator';

// This example shows how to use selectors to define a command hierarchy.

const appName = 'cloud';

// Top-level schema
const rootSchema = new Schema()
  .property('debug', new Schema('boolean')
    .meta('hidden')
    .meta('description', 'enable debug mode (secret flag!)')
  );

// This will be the "app" schema.  The "command" field will be used to drive the app's behavior.
const cloudSchema = new Schema('object')
  .property('region', new Schema('string')
    .meta('description', 'cloud region')
    .default('west-1')
    .validator({$in: ['west-1', 'west-2', 'east-1']})
  )
  .property('command', new Schema('string')
    .selector()
    .required()
    .meta('description','cloud command')
  )
  // add some hierarchical properties to demonstrate difference with selectors
  .property('credentials', new Schema('object')
    .property('token', new Schema('string')
      .meta('description', 'cloud security token')
      .required()
    )
    .property('key', new Schema('string')
      .required()
      .meta('description', 'cloud security key')
    )
  );



rootSchema.property('cloud', cloudSchema);


// STORAGE COMMAND

// From the schema's perspective, there isn't actually anything particularly special about commands.  There is just
// a property that has a "selector" option set on it, and a linked child schema at the same level.
//
// The magic comes to play only in how CommandLineSource interprets these settings:
//
// 1. Child schemas that link up to a property via "selector" define the possible command assignments
//    via the "selection" (which defaults to the child name if omitted).
// 2. A schema condition is automatically created that only enables the child schema if the command value
//    (the selector property) matches the selection.
// 3. During argument parsing, once a selector has been set, CommandLineSource constrains the following available options
//    (and their names) to the linked child selection schema.  Higher-level options are not available once a
//    selection has been specified.
//
// This makes it feel to the user like the selection is a command that you can then refine with options.
//
// However, all that is actually happening is that values in a configuration object are being intelligently set.

// To demonstrate a command hierarchy, we will also define a sub-command for "storage" called "storageCommand".

const storageSchema = new Schema('object')
  .selection('storage')
  .property('bandwidth', new Schema('number')
    .default(500)
    .validator({$range: {min: 1, max: 1000}})
    .meta('description', 'storage bandwidth in Mbps')
  )
  .property('iops', new Schema('number')
    .default(100)
    .validator({$range: {min: 1, max: 10000}})
    .meta('description', 'storage IOPS')
  )
  .property('storageCommand', new Schema('string')
    .selector()
    .required()
    .meta('description', 'storage command')
  );
cloudSchema.property('storage', storageSchema);


// STORAGE SUB-COMMANDS
//
// (Notice how "bucket" is redefined individually per subcommand;
// we'll use a different approach for "compute" to demonstrate how
// to avoid this.)

storageSchema.property('list', new Schema('object')
  .selection(true)
  .property('bucket', new Schema('string')
    .meta('description', 'storage bucket name')
    .required()
  )
  .property('recursive', new Schema('boolean')
    .meta('description', 'list subdirectories')
    .default(false)
  )
);

storageSchema.property('getConfig', new Schema('object')
  .selection('get')
  .property('bucket', new Schema('string')
    .meta('description', 'storage bucket name')
    .required()
  )
  .property('key', new Schema('string')
    .meta('description', 'storage key name')
    .required()
  )
);

storageSchema.property('put', new Schema('object')
  .selection(true)
  .property('bucket', new Schema('string')
    .meta('description', 'storage bucket name')
    .required()
  )
  .property('key', new Schema('string')
    .meta('description', 'storage key name')
    .required()
  )
  .property('data', new Schema('string')
    .validator('$file')
    .meta('general', true)
    .meta('description', 'storage file to upload')
  )
);


// COMPUTE

// As with "storage" above, we'll create a sub-command for "compute" called "computeCommand".

const computeSchema = new Schema('object')
  .selection(true)
  .property('watch', new Schema('boolean')
    .meta('description', 'watch for compute events')
    .default(false)
  )
  .property('computeCommand', new Schema('string')
    .selector()
    .required()
  );

cloudSchema.property('compute', computeSchema);

// To avoid repetition, you can reuse a shared schema, just be careful to make a copy if you need to extend it!
const computeCommandSchema = new Schema('object')
  .selection()  // this will look dynamically at wherever this schema is attached at runtime for the property name!
  .property('cluster', new Schema('string')
    .meta('description', 'compute cluster name')
    .validator('$alphanum')
    .required()
  )
  .property('debug', Schema.inherit());  // each child inherits this (de-normalizing for convenience!)


// COMPUTE SUB-COMMANDS

computeSchema
  .property('create', computeCommandSchema)
  .property('destroy', computeCommandSchema)
  .property('describe', computeCommandSchema.clone()  // copy to avoid mutating the shared schema!
    .property('id', new Schema('string')
      .meta('description', 'compute instance id')
      .validator('$uuid')
      .required()
    )
  )
  .property('instances', new Schema(computeCommandSchema) // another way to make a copy
    .property('filter', new Schema('string')
      .validator({$in: ['running', 'stopped', 'all', 'long-text', 'otherstuff', 'chopchop', 'keepgoing', 'long', 'wtf', 'this-is-silly']})
      .meta('description', 'compute instance filter, but maybe the description is really long and needs to be wrapped')
      .default('running')
    )
  )
  .property('provision', computeCommandSchema.clone()
    .property('image', new Schema('string')
      .meta('description', 'compute image name')
      .default('linux')
      .required()
    )
    .property('architecture', new Schema('string')
      .meta('description', 'compute architecture')
      .default('arm64')
      .required()
    )
  );

// context is hard-coded for examples when running automated tests:
const context = (process.env.CONFIGURATOR_TEST === 'true')?
  {
    appName,

    env: { 'CLOUD_STORAGE_BANDWIDTH' : '750' },                                              // normally omit, defaults to process.env
//    argv: ['--help']                                                                       // this is a good example for showing help formatting
//    argv: ['--ct=abc', '--ck=123', 'storage', 'get', '-b', 'mybucket', '-k', 'mykey' ],    // normally omit, defaults to process.argv
    argv: ['--ct=abc', '--ck=123', '--debug', 'compute', '--watch', 'describe', '--cluster', 'fred', '-i=336aac1e-feee-4974-9f6b-cbbe18914899']
//    argv: ['--ct=abc', '--ck=123', 'compute', 'instances', '--cluster', 'fred']

  }
  : { appName }

try {
  const config = await new Configurator({schema: rootSchema}).configure(context);
  // Observe that storage.bandwidth does not show up unless the command is "storage" (a condition is synthesized from the selection)
  console.log('Configuration results: ', JSON.stringify(config, null, 2));

  // In Configurator, commands don't actually "do" anything on their own; they simply provide
  // structured hints for the command line to hierarchically assemble the configuration in a
  // friendly manner.  The actual work of interpreting what a command "means" is up to the application.

  console.log(`*** Executing command "${config.cloud?.command}" subcommand "${config.cloud.command === 'compute'? config.cloud?.compute?.computeCommand : config.cloud?.storage?.storageCommand}"`)

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