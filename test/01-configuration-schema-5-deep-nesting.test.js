import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { Validators } from '../src/validators.js';

describe('ConfigurationSchema - Deep Nesting', function() {
  let schema;
  let validator;

  beforeEach(function() {
    schema = new ConfigurationSchema();
    validator = new Validators();
  });

  describe('Three-level deep schema', function() {
    beforeEach(function() {
      // Root level
      schema
        .field('appName', { type: 'string', required: true })
        .field('version', { type: 'string', default: '1.0.0' });

      // First level - Server config
      const serverSchema = schema.child('server')
        .field('host', { type: 'string', default: 'localhost' })
        .field('port', { type: 'number', default: 8080 });

      // Second level - Server SSL config
      const sslSchema = serverSchema.child('ssl')
        .field('enabled', { type: 'boolean', default: false })
        .field('certificate', { type: 'string' });

      // Third level - Certificate details
      sslSchema.child('details')
        .field('issuer', { type: 'string' })
        .field('validDays', { type: 'number', default: 365 })
        .field('keySize', { type: 'number', default: 2048 });

      // First level - Database config
      const dbSchema = schema.child('database')
        .field('type', { type: 'string', default: 'postgres' })
        .field('name', { type: 'string', required: true });

      // Second level - Database connection
      const connSchema = dbSchema.child('connection')
        .field('host', { type: 'string', default: 'localhost' })
        .field('port', { type: 'number', default: 5432 });

      // Third level - Connection pool
      connSchema.child('pool')
        .field('min', { type: 'number', default: 2 })
        .field('max', { type: 'number', default: 10 })
        .field('idleTimeout', { type: 'number', default: 30000 });
    });

    it('should process a complete deeply nested configuration', async function() {
      const result = await schema.validate({
        appName: 'DeepApp',
        version: '3.0.0',
        server: {
          host: 'api.example.com',
          port: 443,
          ssl: {
            enabled: true,
            certificate: '/path/to/cert.pem',
            details: {
              issuer: 'LetsEncrypt',
              validDays: 90,
              keySize: 4096
            }
          }
        },
        database: {
          type: 'mysql',
          name: 'deepdb',
          connection: {
            host: 'db.example.com',
            port: 3306,
            pool: {
              min: 5,
              max: 20,
              idleTimeout: 60000
            }
          }
        }
      });

      // Root level
      assert.equal(result.appName, 'DeepApp');
      assert.equal(result.version, '3.0.0');

      // Server config
      assert.equal(result.server.host, 'api.example.com');
      assert.equal(result.server.port, 443);

      // Server SSL config
      assert.equal(result.server.ssl.enabled, true);
      assert.equal(result.server.ssl.certificate, '/path/to/cert.pem');

      // SSL certificate details
      assert.equal(result.server.ssl.details.issuer, 'LetsEncrypt');
      assert.equal(result.server.ssl.details.validDays, 90);
      assert.equal(result.server.ssl.details.keySize, 4096);

      // Database config
      assert.equal(result.database.type, 'mysql');
      assert.equal(result.database.name, 'deepdb');

      // Database connection
      assert.equal(result.database.connection.host, 'db.example.com');
      assert.equal(result.database.connection.port, 3306);

      // Connection pool
      assert.equal(result.database.connection.pool.min, 5);
      assert.equal(result.database.connection.pool.max, 20);
      assert.equal(result.database.connection.pool.idleTimeout, 60000);
    });

    it('should use defaults for missing deep properties', async function() {
      // Provide only required fields and a few customizations
      const result = await schema.validate({
        appName: 'MinimalDeepApp',
        server: {
          ssl: {
            enabled: true
            // All other SSL settings use defaults
          }
        },
        database: {
          name: 'minimaldb'
          // All other DB settings use defaults
        }
      }, {populateDefaults: true});

      // Root level
      assert.equal(result.appName, 'MinimalDeepApp');
      assert.equal(result.version, '1.0.0'); // Default

      // Server config
      assert.equal(result.server.host, 'localhost'); // Default
      assert.equal(result.server.port, 8080); // Default

      // Server SSL config
      assert.equal(result.server.ssl.enabled, true); // Overridden
      assert.equal(result.server.ssl.certificate, undefined); // No default

      // SSL certificate details
      assert.equal(result.server.ssl.details.issuer, undefined); // No default
      assert.equal(result.server.ssl.details.validDays, 365); // Default
      assert.equal(result.server.ssl.details.keySize, 2048); // Default

      // Database config
      assert.equal(result.database.type, 'postgres'); // Default
      assert.equal(result.database.name, 'minimaldb'); // Provided

      // Database connection
      assert.equal(result.database.connection.host, 'localhost'); // Default
      assert.equal(result.database.connection.port, 5432); // Default

      // Connection pool
      assert.equal(result.database.connection.pool.min, 2); // Default
      assert.equal(result.database.connection.pool.max, 10); // Default
      assert.equal(result.database.connection.pool.idleTimeout, 30000); // Default
    });

    it('should handle completely empty sections', async function() {
      const result = await schema.validate({
        appName: 'EmptySectionsApp',
        server: {},
        database: {
          name: 'emptydb', // Required field
          connection: {}
        }
      }, {populateDefaults: true});

      // Server section should be populated with defaults
      assert.equal(result.server.host, 'localhost');
      assert.equal(result.server.port, 8080);

      // SSL section should not exist since no properties were defined or defaulted
      assert.equal(result.server.ssl.enabled, false); // Default
      assert.equal(result.server.ssl.certificate, undefined); // No default

      // Database connection section should exist with defaults
      assert.equal(result.database.connection.host, 'localhost');
      assert.equal(result.database.connection.port, 5432);

      // Pool section should exist with defaults
      assert.equal(result.database.connection.pool.min, 2);
      assert.equal(result.database.connection.pool.max, 10);
    });
  });

  describe('Field path resolution in deep structures', function() {
    beforeEach(function() {
      // Create a deep structure
      schema.field('rootField');

      const level1 = schema.child('level1');
      level1.field('field1');

      const level2 = level1.child('level2');
      level2.field('field2');

      const level3 = level2.child('level3');
      level3.field('field3');
    });

    it('should correctly resolve all field paths', function() {
      const paths = schema.getAllFieldPaths();

      // Check that we have all the expected paths
      assert.equal(paths.has('rootField'), true);
      assert.equal(paths.has('level1.field1'), true);
      assert.equal(paths.has('level1.level2.field2'), true);
      assert.equal(paths.has('level1.level2.level3.field3'), true);

      // Check the path information for the deepest field
      const deepField = paths.get('level1.level2.level3.field3');
      assert.equal(deepField.path, 'level1.level2.level3.field3');
    });
  });

  describe('Validation and strict mode in deep structures', function() {
    beforeEach(function() {
      // Root level
      schema.field('rootField', { validator: /^[a-z]+$/ });

      // First level
      const level1 = schema.child('level1');
      level1.field('field1', { validator: /^\d+$/ });

      // Second level
      const level2 = level1.child('level2');
      level2.field('field2', { validator: '$email' });

      // Third level
      const level3 = level2.child('level3');
      level3.field('field3', { validator: { $length: { min: 5, max: 10 } } });
    });

    it('should validate fields at all levels', async function() {
      // All valid values
      const result = await schema.validate(
        {
          rootField: 'valid',
          level1: {
            field1: '12345',
            level2: {
              field2: 'test@example.com',
              level3: {
                field3: 'validlen'
              }
            }
          }
        },
        { validator }
      );

      assert.equal(result.rootField, 'valid');
      assert.equal(result.level1.field1, '12345');
      assert.equal(result.level1.level2.field2, 'test@example.com');
      assert.equal(result.level1.level2.level3.field3, 'validlen');
    });

    it('should detect validation errors at the deepest level', async function() {
      await assert.rejects(async () => {
        await schema.validate(
          {
            rootField: 'valid',
            level1: {
              field1: '12345',
              level2: {
                field2: 'test@example.com',
                level3: {
                  field3: 'toolong12345' // Too long for $length validator
                }
              }
            }
          },
          { validator }
        );
      }, /Bad value for field 'field3'/);
    });

    it('should detect unknown fields in strict mode at any level', async function() {
      await assert.rejects(async () => {
        await schema.validate(
          {
            rootField: 'valid',
            level1: {
              field1: '12345',
              level2: {
                field2: 'test@example.com',
                level3: {
                  field3: 'validlen',
                  unknownField: 'should fail in strict mode'
                }
              }
            }
          },
          { validator, strict: true }
        );
      }, /Field 'unknownField' is unknown/);
    });
  });
});
