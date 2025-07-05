import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { ObjectSource } from '../src/configuration-sources/object-source.js';

describe('ObjectSource', function() {
  let source;
  let schema;

  beforeEach(function () {
    source = new ObjectSource();
    schema = new ConfigurationSchema();
  });

  describe('#_load()', function () {
    it('should parse basic object properties', async function () {
      schema.field('port', {type: 'number'});
      schema.field('debug', {type: 'boolean'});

      const context = {
        data: {
          port: 3000,
          debug: true
        }
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('port'), 3000);
      assert.equal(result.get('debug'), true);
    });

    it('should handle nested object properties', async function () {
      const dbSchema = schema.child('database');
      dbSchema.field('host');
      dbSchema.field('port', {type: 'number'});

      const context = {
        data: {
          database: {
            host: 'localhost',
            port: 5432
          }
        }
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('database.host'), 'localhost');
      assert.equal(result.get('database.port'), 5432);
    });

    it('should normalize property names', async function () {
      schema.field('serverPort', {type: 'number'});

      // Use snake_case in the object, should be normalized to camelCase
      const context = {
        data: {
          server_port: 3000
        }
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('serverPort'), 3000);
    });

    it('should ignore object properties that don\'t match schema fields', async function () {
      schema.field('port', {type: 'number'});

      const context = {
        data: {
          port: 3000,
          unknown: 'value'
        }
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('port'), 3000);
      assert.equal(result.has('unknown'), false);
    });
  });
})