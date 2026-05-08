import { stat, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import * as path from 'node:path';
import { Configurator, ConfiguratorError, Schema, SchemaResolver } from '@versionzero/configurator';
import { ConfigurationSource, ObjectSource, EnvironmentSource, CommandLineSource, JsonFileSource, DefaultSequence } from '@versionzero/configurator/sources';
import { isConstructor, isTruthy, toConstantCase } from '@versionzero/schema/helpers';

// This example aggregates (almost) everything you can do with Configurator into one
// extremely contrived demo.

// SCHEMAS AND VALUE PROCESSORS
const resolver = new SchemaResolver();

// In addition to defining structure, Schemas may define optional handlers, several of which are called
// during the process of converting an input value into an output value:
//
// * condition   - check whether to process the current schema or ignore it
// * normalizer  - ensure the input is in a canonical input format
// * transformer - convert the normalized input format to the output format
// * validator   - ensure the output format meets specified constraints
// * serializer  - convert the output format back to a serializable (e.g. json) input format
//
// Handlers are built as a pipeline of value processor functions.  The built-in schemas for basic types
// are almost entirely defined by their handler pipelines.  Your custom schemas can augment these
// basic handler pipelines, or you can define your own from scratch.
//
// Value processors in all the handler pipelines all share the the same call signature:
//
//   output = processor(input, target, location, options)
//
// where "input" is the value being specified in the assignment, "target" is
// the current value of the entire configuration object being built, "location" contains the
// traversal location within the schema hierarchy of the current input and schema, as well as
// where the value will eventually be written within the target.  Options are passed through
// from the top-level call that invoked the processor.  (Many handlers only need the first argument!)
//
// Processors may be synchronous (return value directly) or asynchronous (return a Promise that resolves to the value).
// The schema internals attempt to maintain fully synchronous processor call chains until a Promise is returned,
// at which point they switch to async processing.
//
// Normalizers, transformers, validators, and serializers must either:
// 1. Return a (potentially altered) value
// 2. Return undefined if the value cannot (currently) be provided
// 3. Throw an error if there is a fundamental problem with the provided value or the current state.
//    (Conditions should return true if the schema should be processed, false otherwise.)
//
// In most cases, handler calls that return undefined (and conditions that return false) will be retried
// until a value is resolved or the configuration has stabilized.  This allows types to be defined where
// their value is dynamic or depends on other aspects of the configuration state.

// Here is an example of a schema that can accept either a positive number,
// an ISO string, or the string "now" to indicate the current time should be used:

resolver.registerSchema('timestamp', new Schema('any')
  .normalizer((value) => {
    if (!value || value === 'now') {
      return Date.now();
    }
    else if ((typeof value === 'number') || (typeof value === 'string') || value instanceof Date) {
      return value;
    }
    else {
      throw new Error(`Unsupported date format "${value}"`);
    }
  })
  .transformer((value) => {
    if (typeof value === 'number') {
      if (value < 0) {
        throw new Error(`Invalid negative timestamp value: ${value}`);
      }
      return value;
    }
    else if (typeof value === 'string') {
      const t = new Date(value).getTime();
      if (isNaN(t)) {
        throw new Error(`Invalid timestamp value: ${value}`);
      }
      return t;
    }
    else {
      throw new Error(`Invalid timestamp value: ${value}`);
    }
  })
  .validator((value) => {
    const t = new Date(value).getTime();
    if (isNaN(t)) {
      throw new Error(`Invalid timestamp value: ${value}`);
    }
    return t;
  })
  .serializer(function(value) {
    // You can provide a serializer function to convert the resolved value back to
    // a representation that can be written to a config file.  This will be
    // used if you pass the --dump option to the Configurator.
    return new Date(value).toISOString();
  })
);

// This is an example of a class instance factory schema.  The string provided is used to look up
// a provided constructor.

class Cheese { get name() { return `${this.constructor.name.toLowerCase()}` }}
class Cheddar extends Cheese { }
class Mozzarella extends Cheese { }
class Parmesan extends Cheese { }
class Provolone extends Cheese { }
class Stilton extends Cheese { }
class Gouda extends Cheese { }
class Emmental extends Cheese { }
class Brie extends Cheese { }
class Muenster extends Cheese { }
class Havarti extends Cheese { }

const cheeses = new Map([Cheddar, Mozzarella, Parmesan, Provolone, Stilton, Gouda, Emmental, Brie, Muenster, Havarti].map(c => [c.name.toLowerCase(), c]));

resolver.registerSchema('Cheese', new Schema('any')
  .values(Array.from(cheeses.keys()))
  .normalizer('$lowercase')
  .normalizer(value => {
    if (!cheeses.has(value)) {
      throw new Error(`unknown cheese ${value}`);
    }
    return value;
  })

  .transformer((value) => {
    const cheeseClass = cheeses.get(value);

    if (!isConstructor(cheeseClass)) {
      throw new Error('invalid cheese constructor');
    }

    // @ts-ignore
    if (!cheeseClass.prototype instanceof Cheese) {
      throw new Error('not a cheese!')
    }
    if (!cheeseClass.name) {
      throw new Error('cannot use unnamed cheese')
    }
    return new cheeseClass();
  })
  .validator((value) => {
    if (value instanceof Cheese) {
      return value;
    }
    throw new Error('not a cheese!')
  })
  .serializer((value) => value.name)
);

// Here is an example where we define a Printer type that will resolve to a
// singleton of a Printer type instance, selected based on the string name
// provided.  It also accepts explicit assignment of a compatible instance.

class Printer {
  toJSON() {
    // you can also use toJSON to make dump() output usable as an input config
    // instead of providing a serializer handler (this particular approach is
    // a hack just for this example)
    return this.constructor.name.toLowerCase().slice(0, 3);
  }
}
class FooPrinter extends Printer { print(message) { console.log('foo!', message) };  }
class BarPrinter extends Printer { print(message) { console.log('bar!', message) };  }
class BazPrinter extends Printer { print(message) { console.log('baz!', message) };  }

let printerSingleton = undefined;

resolver.registerSchema('Printer', new Schema('any')
  .transformer((value) => {
    if (printerSingleton) {
      // once the singleton has been set, always return it...
      return printerSingleton;
    }
    if (value instanceof Printer) {
      printerSingleton = value;
      return value;
    }
    if (value === 'foo') {
      printerSingleton = new FooPrinter();
    }
    else if (value === 'bar') {
      printerSingleton = new BarPrinter();
    }
    else if (value === 'baz') {
      printerSingleton = new BazPrinter();
    }
    else {
      throw new Error('unknown printer type');
    }
    return printerSingleton;
  })
);


// This is an example of a union.  The schema compiler automatically discovers that
// each union member has a "type" property constrained to a unique value, so it is
// able to automatically generate a discriminator function.  (For more complex unions,
// you have the option to provide your own discriminator.)

class RepoOperation {
  constructor(type) {
    this._type = type;
  }
  get type() {
    return this._type;
  }
  set type(t) {
    if (t !== this._type) {
      throw new Error('Repo operation type cannot be changed once created');
    }
  }
  execute() {
  }
}

class SeekOperation extends RepoOperation {
  constructor() { super('seek')}
  x = 0;
  y = 0;
  execute() {
    return (`seek(${this.x},${this.y})`)
  }
}
class PunchOperation extends RepoOperation {
  constructor() { super('punch')}
  punchCount = 1
  execute() {
    return (`punch(${this.punchCount})`)
  }
}
class ReadOperation extends RepoOperation {
  constructor() { super('read')}
  readLength = 1
  execute(printer) {
    return (`read(${this.readLength})`)
  }
}
class FoldOperation extends RepoOperation {
  constructor() { super('fold') }
  foldCount = 1
  execute(printer) {
    return (`folder(${this.foldCount})`)
  }
}
class SpindleOperation extends RepoOperation {
  constructor() { super('spindle') }
  x = 0;
  y = 0;
  execute(printer) {
    return (`spindle(${this.x},${this.y})`)
  }
}
class MutilateOperation extends RepoOperation {
  constructor() { super('mutilate') }
  severityPercent = 0.99
  execute(printer) {
    return (`mutilate(${Math.floor(this.severityPercent*100)}%)`)
  }
}

resolver.registerSchema('RepoOperation',
  new Schema('object')
    .property('type', new Schema('string'))
);

resolver.registerSchema('SeekOperation',
  new Schema('RepoOperation')
    .transformer(() => new SeekOperation())
    .property('type', new Schema('string').value('seek'))
    .property('x', new Schema('number'))
    .property('y', new Schema('number'))
);

resolver.registerSchema('PunchOperation',
  new Schema('RepoOperation')
    .transformer(() => new PunchOperation())
    .property('type', new Schema('string').value('punch'))
    .property('punchCount', new Schema('number').validator('$positive'))
);
resolver.registerSchema('ReadOperation',
  new Schema('RepoOperation')
    .transformer(() => new ReadOperation())
    .property('type', new Schema('string').value('read'))
    .property('readLength', new Schema('number').validator('$positive'))
);
resolver.registerSchema('FoldOperation',
  new Schema('RepoOperation')
    .transformer(() => new FoldOperation())
    .property('type', new Schema('string').value('fold'))
    .property('foldCount', new Schema('number').validator('$positive'))
);

// Note the use of Schema.literal for the type property in the next operation schemas.
// This is essentially syntactic sugar for a schema that always returns a fixed value.

resolver.registerSchema('SpindleOperation',
  new Schema('RepoOperation')
    .transformer(() => new SpindleOperation())
    .property('type', Schema.literal('spindle'))
    .property('x', new Schema('number'))
    .property('y', new Schema('number'))
);
resolver.registerSchema('MutilateOperation',
  new Schema('RepoOperation')
    .transformer(() => new MutilateOperation())
    .property('type', Schema.literal('mutilate'))
    .property('severityPercent', new Schema('number').validator({$range: {min:0.1, max: 1.0}}))
);

// Validators are used to provide constraints on top of the type system, by checking
// whether the typed value meets one or more provided criteria.  Validators may also
// perform subtle type-compliant refinements to their input, such as standardizing
// capitalization or trimming whitespace.  As mentioned above, validators are defined
// as "processor functions", simple (potentially async) functions called in a pipeline to
// process values.  You can define them inline, or register them with the schema resolver
// and reference them by name; they will be resolved when the schema is compiled.
//
// A set of commonly used processor functions are pre-registered by default.  See
// the documentation for a detailed list.  (Note that processor keywords are always
// prefixed with "$" to disambiguate checking a processor vs. comparison with a literal
// value.)  Any of the built-in processors can also be used by normalizers and transformers,
// but they are especially useful for validators.
//
// Here is an example of an asynchronous validator that checks whether the path
// value provided lives within a git repository:

resolver.registerValueProcessor('inside-git-repo', async (value) => {
  async function check(current) {
    try {
      const s = await stat(path.join(current, '.git'));
      if (s && s.isDirectory()) {
        return current;
      }
    }
    catch (err) {
      if (err.code !== 'ENOENT') {
        throw new Error(`Error checking ${current}: ${err.message}`);
      }
      // else ignore
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`No .git directory found in ${value} or any parent directory`);
    }
    return check(parent);
  }
  if (typeof value !== 'string') {
    throw new Error(`Invalid path: ${value}`);
  }
  return check(value);
}, 'path to git repo');


// SCHEMA
//
// Schema names and processor keywords will not be resolved until the configuration is being populated.

const schema = new Schema('object')
  .property('halp', Configurator.createHelpSchema().meta('flagHint', 'H'))
  .property('app', new Schema('object')
    .property('verbose', new Schema('boolean')
      .default(false)
      .meta('flagHint', 'V')
      .meta('advanced', true)
    )
    .property('devMode', new Schema('boolean')
      .meta('flagHint', 'D')
      .meta('advanced', true)
    )
    .property('fakeSecretDelay', new Schema('number')
      .default(1000)
      .meta('hidden', true)
    )
    .property('printer', new Schema('Printer')
      .validator((v => {
        if (v instanceof BazPrinter) {
          throw new Error('PC LOAD LETTER')
        }
        return v;
      }))
    )
  )
  .property('user', new Schema('object')
    .property('nickname', new Schema('string')
      .required()
      .validator({$matches: /[a-z]{3,}/i})
      .meta('description', 'user doing work')
    )
    .property('token', new Schema('string')
      .required()
      .validator({$matches: /[0-9|a-f]{12}/i})
      .meta('description', 'user credentials')
      .meta('secret', true)  // this is a private metadata value that we use in the source below
    )
    .property('cheeses', new Schema('array')
      .default(['Cheddar', 'Provolone'])
      .meta('description', 'cheeses the user will accept to do work')
      .property('*', new Schema('Cheese'))
    )
  )
  .property('work', new Schema('object')
    .property('repo', new Schema('string')
      .validator({$and: ['$directory', '$inside-git-repo']})
    )
    .property('modified', new Schema('timestamp')
      .default('now')
    )
    .property('operations', new Schema('array')
      .meta('description', 'list of operations user will perform')
      .property('*',
        new Schema('object')
          .meta('valueDescription', 'operation')
          .unionSchema('seek', new Schema('SeekOperation'))
          .unionSchema('punch', new Schema('PunchOperation'))
          .unionSchema('read', new Schema('ReadOperation'))
          .unionSchema('fold', new Schema('FoldOperation'))
          .unionSchema('spindle', new Schema('SpindleOperation'))
          .unionSchema('mutilate', new Schema('MutilateOperation'))
      )
    )
    .property('cheese', new Schema('Cheese').meta('description', 'cheese to offer the user as payment'))
  )

class FakeSecretsSource extends ConfigurationSource {
  constructor() {
    // Configuration sources specify a "sequence" that determines their processing order,
    // as assignments from higher numbered sources will override those from lower.  The ConfigurationSource
    // base class provides an enumeration of suggested sequence values that the default sources
    // use for a reasonable prioritization sequence, with some additional values (e.g. "SECRETS") that
    // are frequent points of extension.

    super({name: 'fake-secrets-source', sequence: DefaultSequence.SECRETS});

    this.secrets = {
      'APP_USER_TOKEN': 'a0b1c3d4e5f6',
    }
  }

  async load(schema, context, loadOptions) {

    const assignments = new Map();

    const appName = context.appName;
    const appPrefix = toConstantCase(appName? appName : '');

    let secretKey;

    schema.visitSchema((schema, path) => {
      // check for the existence of our custom schema option from above...
      if (!isTruthy(schema.metadata.secret)) {
        return;
      }
      const suffix = toConstantCase(path);
      if (suffix.indexOf(appPrefix) === 0) {
        secretKey = suffix;
      }
      else {
        secretKey = `${appPrefix}_${suffix}`;
      }

      // We could just do this:
      //
      // assignments.set(path, this.secrets[secretKey]);
      //
      // but in the case of an "expensive" configuration source, it's better to defer
      // the operation (in this case, our artificially slow array lookup) until we know
      // that this source assignment will be the one actually used (and wasn't
      // overridden by a higher priority assignment!)
      //
      // Value resolver functions are called late in the assignment process.

      assignments.set(path, async (_, configuration) => {
        if (typeof configuration?.app?.fakeSecretDelay !== 'number') {
          // pretend we can't resolve until we have a delay value
          // (will continue to re-resolve until success or the configuration
          // has stabilized)
          //
          // (an alternative way to get the delay into this source would have been to
          // set the "context" flag on the field, and to retrieve it from an upstream
          // source assignment during load.)
          return undefined;
        }
        // delay to fake that we're calling an external service to get the secret...
        await setTimeout(configuration.app.fakeSecretDelay);
        return this.secrets[secretKey];
      })
    })

    return assignments;
  }
}

// You can pass in your own set of ConfigurationSources.  (If you just want to add a single
// custom source to the default list, you can just call Configurator.registerConfigurationSource.
// The source's sequence number property will dictate the processing order relative to the
// existing sources.  The built-in sources allow you to override their default sequence if necessary.

const sources = [
  new FakeSecretsSource(),  // secrets will be loaded at a low priority level in case we want to override them
  new EnvironmentSource(),
  new CommandLineSource(),
  new JsonFileSource({contextName: 'profilePath'}),
  new ObjectSource({sequence: DefaultSequence.OVERRIDES, contextName: 'overrides'}),
];

// This demonstrates a Configurator being provided all custom values, even redefining the default config file field name:
schema.property('profile', Configurator.createConfigSchema()
  .option('context', 'profilePath')
  .meta('flagHint', 'P')
);

const configurator = new Configurator({ schema, resolver, sources });

// Write a demo profile file for the example... (passing operations on the command line in JSON is ugly)
await writeFile('./example-profile.json', JSON.stringify({
  user: {nickname: 'bob', cheeses: ['brie', 'stilton']},
  work: {operations: [{type: 'seek', x: 10, y: 5}, {type: 'punch', punchCount: 4}, {type: 'read', readLength: 2}, {type: 'seek', y: 6}, {type: 'punch'}]}
}));

try {
  const context = (process.env.CONFIGURATOR_TEST === 'true')?
    {
      appName: 'app',    // env var prefix, also used to make cmd line args for matching schema more concise
      // comment out these next lines if you want to use the actual environment and command line
      env: {APP_FAKE_SECRET_DELAY: '10'},
      argv: ['--work-repo=./src', '-VD', '--profile=./example-profile.json', '--printer=bar', '--work-cheese=brie', /*'--dump=./example-config.json'*/],
      overrides: { app: { printer: new FooPrinter() }}
    }
    : { appName: 'app' }
  const config = await configurator.configure(context);
  const printer = config.app?.printer;

  if (!config.work) {
    if (printer) {
      printer.print('No work to do, give me cheese and a task!');
    }
    else {
      console.error('No printer and no work!')
    }
  }
  else {

    const cheeseAccepted = config.work.cheese && config.user.cheeses.find(cheese => {
      return (cheese.name === config.work.cheese.name);
    })

    if (cheeseAccepted) {
      if (printer) {
        printer.print(
          `Cheese payment "${config.work.cheese?.name}" accepted, analyzing repo "${config.work.repo}" using timestamp ${new Date(
            config.work?.modified)}`)
        printer.print(config.work.operations?.map(o => o.execute()).join(' -> '))
      }
      else {
        console.error('No printer!');
      }
    }
    else if (!config.work?.cheese) {
      console.error(`I don't work for free!  Gimme cheese!`)
    }
    else {
      console.error(
        `Cheese payment "${config.work?.cheese?.name}" rejected!  I work for: ${config.user?.cheeses?.map(c => c.name)
                                                                                      .join(' | ')}`)
    }
  }

  // You can use the file written by --dump as the input for config (--profile,
  // in this case).  Config and dump settings are deliberately omitted from the output
  // to make round-tripping configurations less confusing.
}
catch (error) {
  if (error instanceof ConfiguratorError) {
    if (error.cause && error.cause.message) {
      console.error(`Configuration error: ${error.message} (${error.cause.message})`)
    }
    else {
      console.error(`Configuration error: ${error.message}`)
    }
    console.error(`Specify --halp to list available command line options.  (Yes, "halp".)`)  // overridden above!
  }
  else {
    console.error(error);
  }
  process.exit(1);
}
