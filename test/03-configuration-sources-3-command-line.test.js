import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { CommandLineSource } from '../src/configuration-sources/command-line-source.js';

describe('CommandLineSource', function() {
  let source;
  let schema;

  beforeEach(function() {
    source = new CommandLineSource();
    schema = new ConfigurationSchema();
  });

  describe('#_load()', function() {
    it('should parse basic command line arguments', async function() {
      schema.field('port', { type: 'number' });
      schema.field('verbose', { type: 'boolean' });

      const context = { argv: ['--port', '3000', '--verbose'] };

      const result = await source._load(schema, context);

      assert.equal(result.get('port'), '3000');
      assert.equal(result.get('verbose'), true);
    });

    it('should handle array values', async function() {
      schema.field('tags', { type: 'array' });

      const context = { argv: ['--tags', 'tag1', 'tag2', 'tag3'] };

      const result = await source._load(schema, context);

      assert.deepEqual(result.get('tags'), ['tag1', 'tag2', 'tag3']);
    });

    it('should handle main field', async function() {
      schema.field('file', { main: true });

      const context = { argv: ['filename.txt'] };

      const result = await source._load(schema, context);

      assert.equal(result.get('file'), 'filename.txt');
    });

    it('should handle nested fields using kebab-case', async function() {
      const dbSchema = schema.child('database');
      dbSchema.field('host');
      dbSchema.field('port', { type: 'number' });

      const context = { argv: ['--database-host', 'localhost', '--database-port', '5432'] };

      const result = await source._load(schema, context);

      assert.equal(result.get('database.host'), 'localhost');
      assert.equal(result.get('database.port'), '5432');
    });
  });

  describe('exclusive categories', function() {
    it('should throw an error when settings from different schemas in the same category exist', async function() {
      // Create two child schemas with the same category
      const dbSchema1 = schema.child('mysql');
      dbSchema1.exclusive('database');
      dbSchema1.field('host');
      dbSchema1.field('port', { type: 'number' });

      const dbSchema2 = schema.child('postgres');
      dbSchema2.exclusive('database');
      dbSchema2.field('host');
      dbSchema2.field('port', { type: 'number' });

      const context = { argv: ['--mysql-host', 'mysql.example.com', '--postgres-host', 'postgres.example.com'] };

      // When we load with settings from both schemas in the same exclusive category,
      // we should get an error after calling load (not _load)
      const fieldValues = await source._load(schema, context);

      // Verify both values are in the result from _load
      assert.equal(fieldValues.get('mysql.host'), 'mysql.example.com');
      assert.equal(fieldValues.get('postgres.host'), 'postgres.example.com');

      // When we call load, it should throw an error due to exclusive category conflict
      await assert.rejects(async () => {
        await source.load(schema, context);
      }, /incompatible with previous settings in database category/);
    });

    it('should allow settings from the same schema in an exclusive category', async function() {
      const dbSchema = schema.child('mysql');
      dbSchema.exclusive('database');
      dbSchema.field('host');
      dbSchema.field('port', { type: 'number' });

      const context = { argv: ['--mysql-host', 'mysql.example.com', '--mysql-port', '3306'] };

      const result = await source.load(schema, context);

      // Both settings from the same schema in the exclusive category should be allowed
      assert.equal(result.get('mysql.host'), 'mysql.example.com');
      assert.equal(result.get('mysql.port'), '3306');
    });
  });
});
