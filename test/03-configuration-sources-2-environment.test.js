import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { EnvironmentSource } from '../src/configuration-sources/environment-source.js';

describe('EnvironmentSource', function() {
  let source;
  let schema;

  beforeEach(function () {
    source = new EnvironmentSource();
    schema = new ConfigurationSchema();
  });

  describe('#_load()', function () {
    it('should parse environment variables with app prefix', async function () {
      schema.field('port', {type: 'number'});
      schema.field('debug', {type: 'boolean'});

      const context = {
        appName: 'APP',
        env: {
          'APP_PORT': '3000',
          'APP_DEBUG': 'true'
        }
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('port'), '3000');
      assert.equal(result.get('debug'), 'true');
    });

    it('should handle array values', async function () {
      schema.field('tags', {type: 'array'});
      schema.field('fruit', {type: '[string]'});

      const context = {
        appName: 'APP',
        env: {
          'APP_TAGS': 'tag1,tag2,tag3',
          'APP_FRUIT': 'apple,banana,orange'
        }
      }
      const result = await source._load(schema, context);
      assert.deepEqual(result.get('tags'), ['tag1', 'tag2', 'tag3']);
      assert.deepEqual(result.get('fruit'), ['apple', 'banana', 'orange']);
    })

    it('should handle nested fields with proper naming convention', async function () {
      const dbSchema = schema.child('database');
      dbSchema.field('host');
      dbSchema.field('port', {type: 'number'});

      const context = {
        appName: 'APP',
        env: {
          'APP_DATABASE_HOST': 'localhost',
          'APP_DATABASE_PORT': '5432'
        }
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('database.host'), 'localhost');
      assert.equal(result.get('database.port'), '5432');
    });

    it('should ignore environment variables that don\'t match schema fields', async function () {
      schema.field('port', {type: 'number'});

      const context = {
        appName: 'APP',
        env: {
          'APP_PORT': '3000',
          'APP_UNKNOWN': 'value'
        }
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('port'), '3000');
      assert.equal(result.has('unknown'), false);
    });
  });
});

