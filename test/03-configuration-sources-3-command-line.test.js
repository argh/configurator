import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { CommandLineSource } from '../src/configuration-sources/command-line-source.js';
import { Configurator } from '../src/index.js';

describe('CommandLineSource', function() {
  let source;
  let schema;
  let configurator;

  beforeEach(function() {
    source = new CommandLineSource('myapp');
    schema = new ConfigurationSchema();
    configurator = new Configurator({schema});
  });

  describe('#_load()', function() {
    it('should parse basic command line arguments', async function() {
      schema.field('hostname');
      schema.field('port', { type: 'number' });
      schema.field('verbose', { type: 'boolean' });
      schema.field('advanced', { type: 'boolean' });
      schema.field('expand', {type: 'boolean', flagHint: 'X'})
      schema.field('reduce', {type: 'boolean'})

      const context = { argv: ['--port', '3000', '--verbose', '-Xr', '--advanced=true', '--hostname=localhost'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('hostname'), 'localhost');
      assert.equal(result.get('port'), '3000');
      assert.equal(result.get('verbose'), true);
      assert.equal(result.get('advanced'), "true"); // note: in actual use, this will get resolved to boolean true during assignment
      assert.equal(result.get('expand'), true);
      assert.equal(result.get('reduce'), true);
    });

    it('should handle array values', async function() {
      schema.field('tags', { type: 'array' });
      schema.field('fruit', { type: 'array' });

      const context = { argv: ['--tags', 'tag1', 'tag2', 'tag3', '--fruit=apple,banana,orange'] };

      const result = await source._load(configurator, context);

      assert.deepEqual(result.get('tags'), ['tag1', 'tag2', 'tag3']);
      assert.deepEqual(result.get('fruit'), ['apple', 'banana', 'orange']);
    });
    it('should handle array values specified with []', async function() {
      schema.field('tags', { type: '[string]' });
      schema.field('fruit', { type: '[string]' });

      const context = { argv: ['--tags', 'tag1', 'tag2', 'tag3', '--fruit=apple,banana,orange'] };

      const result = await source._load(configurator, context);

      assert.deepEqual(result.get('tags'), ['tag1', 'tag2', 'tag3']);
      assert.deepEqual(result.get('fruit'), ['apple', 'banana', 'orange']);
    });
    it('should handle array values specified with a flag', async function() {
      schema.field('tags', { type: 'array' });
//      schema.field('fruit', { type: 'array' });

      const context = { argv: ['-t', 'tag1', 'tag2', 'tag3', /* todo ? '-f=apple,banana,orange' */] };

      const result = await source._load(configurator, context);

      assert.deepEqual(result.get('tags'), ['tag1', 'tag2', 'tag3']);
//      assert.deepEqual(result.get('fruit'), ['apple', 'banana', 'orange']);
    });
    it('should (grudgingly) handle array values specified with the last flag', async function() {
      schema.field('excitement', { type: 'boolean', flagHint: 'x'})
      schema.field('tags', { type: 'array' });

      const context = { argv: ['-xt', 'tag1', 'tag2', 'tag3', /* todo ? '-f=apple,banana,orange' */] };

      const result = await source._load(configurator, context);

      assert.deepEqual(result.get('tags'), ['tag1', 'tag2', 'tag3']);
//      assert.deepEqual(result.get('fruit'), ['apple', 'banana', 'orange']);
    });

    it('should handle general field', async function() {
      schema.field('file', { general: true });

      const context = { argv: ['filename.txt'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('file'), 'filename.txt');
    });

    it('should handle nested fields using kebab-case', async function() {
      const dbSchema = schema.child('database');
      dbSchema.field('host');
      dbSchema.field('port', { type: 'number' });

      const context = { argv: ['--database-host', 'localhost', '--database-port', '5432'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('database.host'), 'localhost');
      assert.equal(result.get('database.port'), '5432');
    });

    it('should pass arguments after -- to the general field', async function() {
      schema.field('file', { type: 'array', general: true });
      schema.field('verbose', { type: 'boolean' });

      const context = { argv: ['--verbose', '--', 'file1.txt', 'file2.txt'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('verbose'), true);
      assert.deepEqual(result.get('file'), ['file1.txt', 'file2.txt']);
    });

    it('should set the full field when using flagHint', async function() {
      schema.field('configuration', { flagHint: 'X' });
      schema.field('verbose', { flagHint: 'v' });

      const context = { argv: ['-X', 'config.json', '-v'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('configuration'), 'config.json');
      assert.equal(result.get('verbose'), true);
    });

    it('should allow single-word field to be set with initial letter', async function() {
      schema.field('port', { type: 'number' });
      schema.field('verbose', { type: 'boolean' });

      const context = { argv: ['-p', '8080', '-v'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('port'), '8080');
      assert.equal(result.get('verbose'), true);
    });

    it('should create aliases for nested kebab-case options', async function() {
      const dbSchema = schema.child('database');
      dbSchema.field('host');
      dbSchema.field('port', { type: 'number' });

      const context = { argv: ['--dp', '5432', '--database-host', 'localhost'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('database.port'), '5432');
      assert.equal(result.get('database.host'), 'localhost');
    });

    it('should remove appName from option when present in context', async function() {
      const welcomeSchema = schema.child('welcome');
      welcomeSchema.field('message');
      welcomeSchema.field('timeout', { type: 'number' });

      const context = { appName: 'welcome', argv: ['--message', 'Hello World', '--timeout', '30'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('welcome.message'), 'Hello World');
      assert.equal(result.get('welcome.timeout'), '30');
    });

    it('should handle general field with values before and after --', async function() {
      schema.field('file', { type: 'array', general: true });
      schema.field('verbose', { type: 'boolean' });

      // Have general field values both as positional arguments and after --
      const context = { argv: ['before1.txt', 'before2.txt', '--verbose', '--', 'after1.txt', 'after2.txt'] };

      const result = await source._load(configurator, context);

      assert.equal(result.get('verbose'), true);

      // This test documents the current behavior
      const files = result.get('file');
      assert(Array.isArray(files), 'Expected file to be an array');
      assert(files.includes('before1.txt'), 'Should include positional argument before1.txt');
      assert(files.includes('before2.txt'), 'Should include positional argument before2.txt');
      assert(files.includes('after1.txt'), 'Should include argument after1.txt after --');
      assert(files.includes('after2.txt'), 'Should include argument after2.txt after --');
    });

    it('should throw error for unknown options in strict mode', async function() {
      schema.field('known');
      const context = { argv: ['--unknown'] };
      await assert.rejects(async () => {
        await source._load(configurator, context, { strict: true });
      }, /Unknown option: --unknown/);
    });

    it('should throw error for array option without values', async function() {
      schema.field('tags', { type: 'array' });
      const context = { argv: ['--tags'] };
      await assert.rejects(async () => {
        await source._load(configurator, context);
      }, /Option --tags requires one or more values/);
    });

    it('should throw error for missing option value', async function() {
      schema.field('port', { type: 'number' });
      const context = { argv: ['--port'] };
      await assert.rejects(async () => {
        await source._load(configurator, context);
      }, /Option --port requires a value/);
    });
  });

  it('should throw error when config option is missing path', async function() {
    schema.field('config', {context: true});

    const context = { argv: ['--config'] };
    await assert.rejects(async () => {
      await source._load(configurator, context);
    }, /Option --config requires a value/);
  });

  it('should handle config file option correctly', async function() {
    schema.field('config', {context: true});
    const context = { argv: ['--config', 'test.json'] };
    const result = await source._load(configurator, context);
    assert.equal(context.config, 'test.json');
  });
  it('should handle empty values with allowEmpty option', async function() {
    schema.field('name', { allowEmpty: true });
    const context = { argv: ['--name'] };
    const result = await source._load(configurator, context);
    assert.equal(result.get('name'), '');
  });
  it('should format help text with categories and advanced options', async function() {
    schema.field('basic', { description: 'Basic option' });
    schema.field('advanced', { description: 'Advanced option', advanced: true });
    schema.field('required', { description: 'Required option', required: true });
    const context = { appName: 'test' };
    const helpText = source._help(configurator, context, true);
    assert(helpText.includes('Usage: test [options]'));
    assert(helpText.includes('--basic'));
    assert(helpText.includes('--advanced'));
    assert(helpText.includes('(required)'));
  });

  it('should format argument types correctly', function() {
    const tests = [
      { field: { type: 'string', valueDescription: 'custom' }, expected: '<custom>' },
      { field: { type: 'boolean' }, expected: '[true|false]' },
      { field: { type: 'number' }, expected: '<number>' },
      { field: { type: 'array' }, expected: '<value...>' },
      { field: { type: 'string', validator: '$oneof:a|b' }, expected: '<oneof:a|b>' }
    ];

    for (const test of tests) {
      const result = source._formatArgumentType(test.field);
      assert.equal(result, test.expected);
    }
  });

});
