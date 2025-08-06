import { stat, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import path from 'node:path';
import { Configurator, ConfigurationSchema, Types, Validators } from '../src/index.js';
import { ConfigurationSource, SchemaDefaultsSource, ObjectSource, EnvironmentSource, CommandLineSource, JsonFileSource } from '../src/configuration-sources/index.js';
import { toConstantCase } from '../src/utils.js';


// TYPES
const types = new Types();

// Type definitions are simply a name, a (potentially async) resolver function,
// and an optional type-specific options object.  Type names are internally kebab-cased for
// consistency.  (The default Types registry pre-defines common primitive types.)
//
// When an assignment to a typed configuration field is being finalized, the type's resolver
// function will be called as follows:
//
// output = await (async () => type.resolver(input, configuration, type))();
//
// Where "input" is the value being specified in the assignment, "configuration" is
// the current state of the configuration object being built, and "type" is a reference
// to the type definition itself, for the occasional case where the resolver function is
// shared or needs to access the type-specific options provided when it was defined.
//
// The resolver should either return the resolved value if it can be determined,
// return undefined if the value cannot currently be resolved, or throw an error if
// there is a fundamental incompatibility with the provided value or the current state.
// Resolution attempts that return undefined will be retried until a value is resolved
// or the configuration has stabilized.  This allows types to be defined where their value
// depends on other aspects of the configuration state.

// Here is an example of a type definition that can accept either a positive number
// or the string "now" to indicate the current time should be used:

types.defineType('timestamp', (value) => {
  if (typeof value === 'number') {
    if (value < 0) {
      throw new Error(`Invalid negative timestamp value: ${value}`);
    }
    return value;
  }
  else if (!value || value === 'now') {
    return Date.now();
  }
  else {
    throw new Error(`Invalid timestamp value: ${value}`);
  }
});

// Here is an example where we define a Printer type that will resolve to a
// singleton of a Printer type instance, selected based on the string name
// provided.  It also accepts explicit assignment of a compatible instance.

class Printer {}
class FooPrinter extends Printer { print(message) { console.log('foo!', message) };  }
class BarPrinter extends Printer { print(message) { console.log('bar!', message) };  }
class BazPrinter extends Printer { print(message) { console.log('baz!', message) };  }

let printerSingleton = undefined;

types.defineType('Printer', (value) => {
  if (printerSingleton) {
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

class Cheese {}
class Cheddar extends Cheese { }
class Mozzarella extends Cheese { }
class Parmesan extends Cheese {  }
class Stilton extends Cheese {  }
class Gouda extends Cheese {  }
class Emmental extends Cheese {  }
class Brie extends Cheese {  }

const cheeses = new Map([Cheddar, Mozzarella, Parmesan, Stilton, Gouda, Emmental, Brie].map(c => [c.name.toLowerCase(), c]));

types.defineType('Cheese', (value) => {
  if (typeof value === 'string') {
    value = value.toLowerCase();
    if (cheeses.has(value)) {
      value = cheeses.get(value);
    }
    else {
      throw new Error('unsupported cheese');
    }
  }

  try {
    class test extends value {}
  }
  catch (err) {
    throw new Error('invalid cheese constructor');
  }

  if (typeof value !== 'function' || !value.prototype instanceof Cheese) {
    throw new Error('not a cheese!')
  }

  if (value.name) {
    return value;
  }
  else {
    throw new Error('cannot use unnamed cheese')
  }
})

// VALIDATORS
const validators = new Validators();

// Validators are used to provide constraints on top of the type system, by checking
// whether the typed value meets one or more provided criteria.  Validators may also
// perform subtle type-compliant refinements to their input, such as normalizing
// capitalization or trimming whitespace.
//
// A set of commonly used validator functions are pre-registered by default.  See
// the documentation for a detailed list.  (Note that validator names are always
// prefixed with "$" to disambiguate checking a validator vs. checking for a specific
// value.)
//
// The validator function may be synchronous or asynchronous, and receives only
// the value to be checked.  It should return the (potentially refined) value if it
// is valid, or throw an error if not.
//
// Here is an example of an asynchronous validator that checks whether the path
// value provided lives within a git repository:

validators.register('inside-git-repo',
  async (value) => {
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
  }
);

// SCHEMA
//
// Type names and Validator names will not be resolved until the configuration is being populated.
//
// The order of these sources is determined by the ConfigurationSource.DefaultSequence enum.
//

const schema = new ConfigurationSchema({types, validators});

schema.child('app')
      .field('verbose', { type: 'boolean', default: false, flagHint: 'V', advanced: true })
      .field('devMode', { type: 'boolean', flagHint: 'D', advanced: true })
      .field('foo', { type: 'boolean', default: false })
      .field('printer', { type: 'Printer', validator: (v => {
        // inline validator
        if (v instanceof BazPrinter) {
          throw new Error('PC LOAD LETTER')
        }
          return v;
      })})
      .field('fakeSecretDelay', {type: 'number', default: 500, hidden: true});

schema.child('user')
      .field('nickname', { required: true, validator: /[a-z]{3,}/i })

schema.child('worker')
      .field('token', { required: true, validator: /[0-9|a-f]{12}/i, secret: true})
      .field('repo', { validator: {$and: ['$directory', '$inside-git-repo']}})
      .field('modified', { type: 'timestamp', default: 'now' })
      .field('cheese', {type: '[Cheese]', default: ['brie', Parmesan, 'cheddar']})


class FakeSecretsSource extends ConfigurationSource {
  constructor() {
    // Configuration sources specify a "sequence" that determines their processing order,
    // as assignments from higher numbered sources will override those from lower.  The ConfigurationSource
    // base class provides an enumeration of suggested sequence values that the default sources
    // use for a reasonable prioritization sequence, with some additional values (e.g. "SECRETS") that
    // are frequent points of extension.

    super({name: 'fake-secrets-source', sequence: ConfigurationSource.DefaultSequence.SECRETS});

    this.secrets = {
      'APP_WORKER_TOKEN': 'a0b1c3d4e5f6',
    }
  }

  async load(configurator, context, loadOptions) {

    const assignments = new Map();

    const appName = context.appName;
    const appPrefix = toConstantCase(appName? appName : '');
    const allFields = configurator.schema.getAllFieldPaths();

    let secretKey;
    for (const fieldData of allFields.values()) {

      // this is an arbitrary user contract between the field and this source to filter out irrelevant fields
      if (!fieldData.secret) {
        continue;
      }
      const suffix = toConstantCase(fieldData.path);
      if (suffix.indexOf(appPrefix) === 0) {
        secretKey = suffix;
      }
      else {
        secretKey = `${appPrefix}_${suffix}`;
      }

      // we could just do this:
      //
      // assignments.set(fieldData.path, this.secrets[secretKey]);
      //
      // but in the case of an "expensive" configuration source, it's better to defer
      // the secret lookup until we know that this source assignment will be the one
      // actually used  (i.e. a higher priority source might have overridden the assignment!)

      assignments.set(fieldData.path, async (configuration, type) => {
        if (typeof configuration.app?.fakeSecretDelay !== 'number') {
          // pretend we can't resolve until we have a delay value
          // (will continue to re-resolve until success or the configuration
          // has stabilized)
          return undefined;
        }
        // delay to fake that we're calling an external service to get the secret...
        await setTimeout(configuration.app.fakeSecretDelay);
        return this.secrets[secretKey];
      })
    }
    return assignments;
  }
}

// You can pass in your own set of ConfigurationSources.  (If you just want to add a single
// custom source to the default list, you can just call Configurator.registerConfigurationSource.
// The source's sequence number property will dictate the processing order relative to the
// existing sources.  The built-in sources allow you to override their default sequence if necessary.

const sources = [
  new SchemaDefaultsSource(),     // you almost always want this one, it turns default values into low-priority assignments
  new FakeSecretsSource(),  // secrets will be loaded at a low priority level in case we want to override them
  new EnvironmentSource(),
  new CommandLineSource(),
  new JsonFileSource({contextFieldName: 'profilePath'}),
  new ObjectSource({sequence: ConfigurationSource.DefaultSequence.OVERRIDES, contextFieldName: 'overrides'}),
];

// This demonstrates a Configurator being provided all custom values, even redefining the default config file field name:
const configurator = new Configurator({
  schema: schema,
  types: types,
  validators: validators,
  sources: sources,
  configEnabled: true,
  configField: 'profile',
  configContextFieldName: 'profilePath',
  configFlag: 'P',
});

// Write a demo profile file for the example...
await writeFile('./example-profile.json', JSON.stringify({user: { nickname: 'bob' }}))

try {
  const config = await configurator.configure({
    appName: 'app',    // env var prefix, also used to make cmd line args for matching schema more concise
    argv: ['--worker-repo=./src', '-VD', '--fake-secret-delay=1000', '--profile=./example-profile.json', '--printer=bar'],
    overrides: { app: { printer: new FooPrinter() }}
  })
  let printer = config.app?.printer;

  if (printer) {
    printer.print('hello!');
  }
  console.log('Configuration results: ', JSON.stringify(config, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Handle class instances
      if (value.constructor && value.constructor.name !== 'Object') {
        return {
          __className: value.constructor.name,
          ...value
        };
      }
      // Handle class constructors/functions
      return value;
    }
    else if (typeof value === 'function' && value.prototype && value.prototype.constructor === value) {
      return {
        __className: value.name,
        __type: 'class'
      };
    }

    return value;
  }, 2));
}
catch (error) {
  console.log(error.message);
}
