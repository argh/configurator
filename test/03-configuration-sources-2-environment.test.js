import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { EnvironmentSource } from '../src/configuration-sources/environment-source.js';

describe('EnvironmentSource', function() {
  let source;
  let schema;

  beforeEach(function() {
    source = new EnvironmentSource('APP');
    schema = new ConfigurationSchema();
  });

  describe('#_load()', function() {
    it('should parse environment variables with app prefix', async function() {
      schema.field('port', { type: 'number' });
      schema.field('debug', { type: 'boolean' });

      const context = { 
        env: { 
          'APP_PORT': '3000', 
          'APP_DEBUG': 'true' 
        } 
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('port'), '3000');
      assert.equal(result.get('debug'), 'true');
    });

    it('should handle nested fields with proper naming convention', async function() {
      const dbSchema = schema.child('database');
      dbSchema.field('host');
      dbSchema.field('port', { type: 'number' });

      const context = { 
        env: { 
          'APP_DATABASE_HOST': 'localhost', 
          'APP_DATABASE_PORT': '5432' 
        } 
      };

      const result = await source._load(schema, context);

      assert.equal(result.get('database.host'), 'localhost');
      assert.equal(result.get('database.port'), '5432');
    });

    it('should ignore environment variables that don\'t match schema fields', async function() {
      schema.field('port', { type: 'number' });

      const context = { 
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

      const context = { 
        env: { 
          'APP_MYSQL_HOST': 'mysql.example.com', 
          'APP_POSTGRES_HOST': 'postgres.example.com' 
        } 
      };

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

      const context = { 
        env: { 
          'APP_MYSQL_HOST': 'mysql.example.com', 
          'APP_MYSQL_PORT': '3306' 
        } 
      };

      const result = await source.load(schema, context);

      // Both settings from the same schema in the exclusive category should be allowed
      assert.equal(result.get('mysql.host'), 'mysql.example.com');
      assert.equal(result.get('mysql.port'), '3306');
    });
  });
});
