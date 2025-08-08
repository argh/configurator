import { strict as assert } from 'assert';
import { ConfigurationSchema } from '../src/configuration-schema.js';
import { ValidatorRegistry } from '../src/validator-registry.js';
import { Configurator } from '../src/configurator.js';

describe('ConfigurationSchema - Hierarchical Schemas', function() {
  let schema;
  let configurator;

  beforeEach(function() {
    schema = new ConfigurationSchema();
    configurator = new Configurator({schema});
  });

  describe('Basic hierarchy', function() {
    beforeEach(function() {
      // Root level fields
      schema
        .field('rootString', { type: 'string' })
        .field('rootNumber', { type: 'number' });

      // First level child
      schema.child('section1')
        .field('nestedBoolean', { type: 'boolean' })
        .field('nestedArray', { type: 'array' });

      // Second level child
      schema.child('section2').child('subsection')
        .field('deeplyNested', { type: 'string' });
    });

    it('should process hierarchical configuration correctly', async function() {
      const result = await configurator.validate({
        rootString: 'root string',
        rootNumber: 42,
        section1: {
          nestedBoolean: true,
          nestedArray: [1, 2, 3]
        },
        section2: {
          subsection: {
            deeplyNested: 'deep value'
          }
        }
      });

      // Root level
      assert.equal(result.rootString, 'root string');
      assert.equal(result.rootNumber, 42);

      // First level
      assert.equal(result.section1.nestedBoolean, true);
      assert.deepEqual(result.section1.nestedArray, [1, 2, 3]);

      // Second level
      assert.equal(result.section2.subsection.deeplyNested, 'deep value');
    });

    it('should handle missing sections', async function() {
      const result = await configurator.validate({
        rootString: 'root string',
        rootNumber: 42,
        // section1 is missing
        // section2 is missing
      });

      assert.equal(result.rootString, 'root string');
      assert.equal(result.rootNumber, 42);
      assert.equal(result.section1, undefined);
      assert.equal(result.section2, undefined);
    });

    it('should handle partial sections', async function() {
      const result = await configurator.validate({
        rootString: 'root string',
        section1: {
          nestedBoolean: true
          // nestedArray is missing
        },
        section2: {
          // subsection is missing
        }
      });

      assert.equal(result.rootString, 'root string');
      assert.equal(result.section1.nestedBoolean, true);
      assert.equal(result.section1.nestedArray, undefined);
      assert.equal(result.section2, undefined);
    });
  });

  describe('Validation in hierarchy', function() {
    beforeEach(function() {
      // Root level with validation
      schema.field('rootField', { 
        validator: /^[a-z]+$/ 
      });

      // Child section with validation
      schema.child('section')
        .field('nestedField', { 
          validator: /^\d+$/ 
        });
    });

    it('should validate all levels when provided validator', async function() {
      const result = await configurator.validate(
        {
          rootField: 'valid',
          section: {
            nestedField: '123'
          }
        }
      );

      assert.equal(result.rootField, 'valid');
      assert.equal(result.section.nestedField, '123');
    });

    it('should throw when validation fails at root level', async function() {
      await assert.rejects(async () => {
        await configurator.validate(
          {
            rootField: 'INVALID',
            section: {
              nestedField: '123'
            }
          }
        );
      }, /Bad value for field 'rootField'/);
    });

    it('should throw when validation fails at nested level', async function() {
      await assert.rejects(async () => {
        await configurator.validate(
          {
            rootField: 'valid',
            section: {
              nestedField: 'abc' // Should be digits only
            }
          },
        );
      }, /Bad value for field 'nestedField'/);
    });
  });

  describe('Complex hierarchy with all types and defaults', function() {
    beforeEach(function() {
      // Root configuration
      schema
        .field('appName', { type: 'string', required: true })
        .field('version', { type: 'string', default: '1.0.0' })
        .field('debug', { type: 'boolean', default: false})
        .field('tags', { type: 'array', default: [] });

      // Server configuration section
      schema.child('server')
        .field('host', { type: 'string', default: 'localhost' })
        .field('port', { type: 'number', default: 3000 })
        .field('secure', { type: 'boolean', default: false })
        .field('maxConnections', { type: 'number', default: 100 });

      // Database configuration section with subsection
      const dbSchema = schema.child('database')
        .field('type', { type: 'string', default: 'mysql' })
        .field('name', { type: 'string', required: true });

      // Connection details subsection
      dbSchema.child('connection')
        .field('host', { type: 'string', default: 'localhost' })
        .field('port', { type: 'number' })
        .field('credentials', { type: 'string' });
    });

    it('should process a complete configuration with all levels', async function() {
      const result = await configurator.validate({
        appName: 'TestApp',
        version: '2.0.0',
        debug: true,
        tags: ['test', 'example'],
        server: {
          host: 'example.com',
          port: 8080,
          secure: true
        },
        database: {
          name: 'testdb',
          connection: {
            port: 3306,
            credentials: 'secret'
          }
        }
      }, {populateDefaults: true});

      // Root level
      assert.equal(result.appName, 'TestApp');
      assert.equal(result.version, '2.0.0');
      assert.equal(result.debug, true);
      assert.deepEqual(result.tags, ['test', 'example']);

      // Server section
      assert.equal(result.server.host, 'example.com');
      assert.equal(result.server.port, 8080);
      assert.equal(result.server.secure, true);
      assert.equal(result.server.maxConnections, 100); // Using default

      // Database section
      assert.equal(result.database.type, 'mysql'); // Using default
      assert.equal(result.database.name, 'testdb');

      // Database connection subsection
      assert.equal(result.database.connection.host, 'localhost'); // Using default
      assert.equal(result.database.connection.port, 3306);
      assert.equal(result.database.connection.credentials, 'secret');
    });

    it('should use defaults for missing values', async function() {
      // Provide only required fields
      const result = await configurator.validate({
        appName: 'MinimalApp',
        database: {
          name: 'minimaldb'
        }
      }, {populateDefaults: true});

      // Root level
      assert.equal(result.appName, 'MinimalApp');
      assert.equal(result.version, '1.0.0'); // Default
      assert.equal(result.debug, false); // Default
      assert.deepEqual(result.tags, []); // Default

      // Server section (all defaults)
      assert.equal(result.server.host, 'localhost');
      assert.equal(result.server.port, 3000);
      assert.equal(result.server.secure, false);
      assert.equal(result.server.maxConnections, 100);

      // Database section
      assert.equal(result.database.type, 'mysql'); // Default
      assert.equal(result.database.name, 'minimaldb');

      // Database connection subsection has no required fields,
      // so it might not be included if all values are default
      assert.equal(result.database.connection.host, 'localhost'); // Default
    });

    it('should throw when required fields are missing', async function() {
      await assert.rejects(async () => {
        await configurator.validate({
          // appName is missing (required)
          database: {
            // name is missing (required)
            connection: {
              host: 'dbhost'
            }
          }
        });
      }, /Required field "appName" is missing/);

      await assert.rejects(async () => {
        await configurator.validate({
          appName: 'MissingDBApp',
          // database section is present but missing required field
          database: {}
        });
      }, /Required field "name" is missing/);
    });

    it('should apply validators on all levels when provided', async function() {
      // Add some simple validators
      schema.field('subversion', {
        validator: /^\d+\.\d+\.\d+$/, // Semver format
        type: 'string', 
        default: '1.0.0' 
      });

      schema.child('swerver')
        .field('port', { 
          validator: { $range: { min: 1024, max: 65535 } },
          type: 'number', 
          default: 3000 
        });

      // Valid configuration
      const validResult = await configurator.validate(
        {
          appName: 'ValidApp',
          version: '2.1.0',
          swerver: {
            port: 8080
          },
          database: {
            name: 'validdb'
          }
        }
      );

      assert.equal(validResult.version, '2.1.0');
      assert.equal(validResult.swerver.port, 8080);

      // Invalid version format
      await assert.rejects(async () => {
        await configurator.validate(
          {
            appName: 'InvalidApp',
            subversion: 'not-semver',
            database: { name: 'testdb' }
          }
        );
      }, /Bad value for field 'subversion'/);

      // Invalid port range
      await assert.rejects(async () => {
        await configurator.validate(
          {
            appName: 'InvalidApp',
            swerver: { port: 80 }, // Below min of 1024
            database: { name: 'testdb' }
          },
        );
      }, /Bad value for field 'port'/);
    });
  });
  describe('Complex hierarchy with all types and defaults (declarative)', function() {
    beforeEach(function() {
      schema.loadConfigurables([
        {
          // Root configuration
          field: 'appName',
          type: 'string',
          required: true
        },
        {
          field: 'version',
          type: 'string',
          default: '1.0.0'
        },
        {
          field: 'debug',
          type: 'boolean',
          default: false
        },
        {
          field: 'tags',
          type: 'array',
          default: []
        },
        {
          // Server configuration section
          child: 'server',
          configurables: [
            {
              field: 'host',
              type: 'string',
              default: 'localhost'
            },
            {
              field: 'port',
              type: 'number',
              default: 3000
            },
            {
              field: 'secure',
              type: 'boolean',
              default: false
            },
            {
              field: 'maxConnections',
              type: 'number',
              default: 100
            }
          ]
        },
        {
          // Database configuration section with subsection
          child: 'database',
          configurables: [
            {
              field: 'type',
              type: 'string',
              default: 'mysql'
            },
            {
              field: 'name',
              type: 'string',
              required: true
            },
            {
              child: 'connection',
              configurables: [
                {
                  field: 'host',
                  type: 'string',
                  default: 'localhost'
                },
                {
                  field: 'port',
                  type: 'number'
                },
                {
                  field: 'credentials',
                  type: 'string'
                }
              ]
            }
          ]
        }
      ]);
    });

    it('should process a complete configuration with all levels', async function() {
      const result = await configurator.validate({
        appName: 'TestApp',
        version: '2.0.0',
        debug: true,
        tags: ['test', 'example'],
        server: {
          host: 'example.com',
          port: 8080,
          secure: true
        },
        database: {
          name: 'testdb',
          connection: {
            port: 3306,
            credentials: 'secret'
          }
        }
      }, {populateDefaults: true});

      // Root level
      assert.equal(result.appName, 'TestApp');
      assert.equal(result.version, '2.0.0');
      assert.equal(result.debug, true);
      assert.deepEqual(result.tags, ['test', 'example']);

      // Server section
      assert.equal(result.server.host, 'example.com');
      assert.equal(result.server.port, 8080);
      assert.equal(result.server.secure, true);
      assert.equal(result.server.maxConnections, 100); // Using default

      // Database section
      assert.equal(result.database.type, 'mysql'); // Using default
      assert.equal(result.database.name, 'testdb');

      // Database connection subsection
      assert.equal(result.database.connection.host, 'localhost'); // Using default
      assert.equal(result.database.connection.port, 3306);
      assert.equal(result.database.connection.credentials, 'secret');
    });

    it('should use defaults for missing values', async function() {
      // Provide only required fields
      const result = await configurator.validate({
        appName: 'MinimalApp',
        database: {
          name: 'minimaldb'
        }
      }, {populateDefaults: true});

      // Root level
      assert.equal(result.appName, 'MinimalApp');
      assert.equal(result.version, '1.0.0'); // Default
      assert.equal(result.debug, false); // Default
      assert.deepEqual(result.tags, []); // Default

      // Server section (all defaults)
      assert.equal(result.server.host, 'localhost');
      assert.equal(result.server.port, 3000);
      assert.equal(result.server.secure, false);
      assert.equal(result.server.maxConnections, 100);

      // Database section
      assert.equal(result.database.type, 'mysql'); // Default
      assert.equal(result.database.name, 'minimaldb');

      // Database connection subsection has no required fields
      assert.equal(result.database.connection.host, 'localhost'); // Default
    });

    it('should throw when required fields are missing', async function() {
      await assert.rejects(async () => {
        await configurator.validate({
          // appName is missing (required)
          database: {
            // name is missing (required)
            connection: {
              host: 'dbhost'
            }
          }
        });
      }, /Required field "appName" is missing/);

      await assert.rejects(async () => {
        await configurator.validate({
          appName: 'MissingDBApp',
          // database section is present but missing required field
          database: {}
        });
      }, /Required field "name" is missing/);
    });

    it('should apply validators on all levels when provided', async function() {
      schema.loadConfigurables([
        {
          field: 'subversion',
          validator: /^\d+\.\d+\.\d+$/,
          type: 'string',
          default: '1.0.0'
        },
        {
          child: 'swerver',
          configurables: [
            {
              field: 'port',
              validator: { $range: { min: 1024, max: 65535 } },
              type: 'number',
              default: 3000
            }
          ]
        }
      ]);

      // Valid configuration
      const validResult = await configurator.validate(
        {
          appName: 'ValidApp',
          version: '2.1.0',
          swerver: {
            port: 8080
          },
          database: {
            name: 'validdb'
          }
        }
      );

      assert.equal(validResult.version, '2.1.0');
      assert.equal(validResult.swerver.port, 8080);

      // Invalid version format
      await assert.rejects(async () => {
        await configurator.validate(
          {
            appName: 'InvalidApp',
            subversion: 'not-semver',
            database: { name: 'testdb' }
          }
        );
      }, /Bad value for field 'subversion'/);

      // Invalid port range
      await assert.rejects(async () => {
        await configurator.validate(
          {
            appName: 'InvalidApp',
            swerver: { port: 80 }, // Below min of 1024
            database: { name: 'testdb' }
          },
        );
      }, /Bad value for field 'port'/);
    });
  });
});