
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Assignments - Conditional Processing', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Basic conditional assignments', function() {

    it('should suppress assignment when condition fails', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'))
        .property('value', new Schema('string')
          .condition((value, configuration) => configuration.enabled === true)
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['enabled', 'false'],
        ['value', 'should-be-suppressed']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        enabled: false
        // value should not be present
      });
    });

    it('should process assignment when condition passes', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'))
        .property('value', new Schema('string')
          .condition((value, configuration) => configuration.enabled === true)
        );


      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['enabled', 'true'],
        ['value', 'should-be-included']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        enabled: true,
        value: 'should-be-included'
      });
    });

    it('should handle multiple conditional properties', async function() {
      const schema = new Schema('object')
        .property('mode', new Schema('string'))
        .property('devOption', new Schema('string')
          .condition((value, configuration) => configuration.mode === 'development')
        )
        .property('prodOption', new Schema('string')
          .condition((value, configuration) => configuration.mode === 'production')
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['mode', 'development'],
        ['devOption', 'dev-value'],
        ['prodOption', 'prod-value']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        mode: 'development',
        devOption: 'dev-value'
        // prodOption should be suppressed
      });
    });
  });

  describe('Nested conditional assignments', function() {

    it('should suppress nested properties based on parent condition', async function() {
      const schema = new Schema('object')
        .property('useRemote', new Schema('boolean'))
        .property('remote', new Schema('object')
          .condition((value, configuration) => configuration.useRemote === true)
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );


      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['useRemote', 'false'],
        ['remote.host', 'example.com'],
        ['remote.port', '8080']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        useRemote: false
        // remote object and its properties should be suppressed
      });
    });

    it('should process nested properties when parent condition passes', async function() {
      const schema = new Schema('object')
        .property('useRemote', new Schema('boolean'))
        .property('remote', new Schema('object')
          .condition((value, configuration) => configuration.useRemote === true)
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['useRemote', 'true'],
        ['remote.host', 'example.com'],
        ['remote.port', '8080']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        useRemote: true,
        remote: {
          host: 'example.com',
          port: 8080
        }
      });
    });

    it('should handle conditions on deeply nested properties', async function() {
      const schema = new Schema('object')
        .property('logger', new Schema('object')
          .property('type', new Schema('string'))
          .property('remote', new Schema('object')
            .condition((value, configuration) => configuration.logger?.type === 'remote')
            .property('url', new Schema('string'))
          )
          .property('local', new Schema('object')
            .condition((value, configuration) => configuration.logger?.type === 'local')
            .property('path', new Schema('string'))
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['logger.type', 'remote'],
        ['logger.remote.url', 'http://logger.example.com'],
        ['logger.local.path', '/var/log/app.log']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        logger: {
          type: 'remote',
          remote: {
            url: 'http://logger.example.com'
          }
          // local should be suppressed
        }
      });
    });
  });

  describe('Multi-pass assignment resolution', function() {

    it('should resolve assignments in multiple passes when dependencies exist', async function() {
      // This tests the scenario where assignment B depends on assignment A
      // being processed first
      const schema = new Schema('object')
        .property('step1', new Schema('string'))
        .property('step2', new Schema('string')
          .condition((value, configuration) => configuration.step1 !== undefined)
        )
        .property('step3', new Schema('string')
          .condition((value, configuration) => configuration.step2 !== undefined)
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['step1', 'first'],
        ['step2', 'second'],
        ['step3', 'third']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        step1: 'first',
        step2: 'second',
        step3: 'third'
      });
    });

    it('should resolve assignments in multiple passes when dependencies exist even when property sequence is backwards', async function() {
      // This tests the scenario where assignment B depends on assignment A
      // being processed first
      const schema = new Schema('object')
        .property('step1', new Schema('string'))
        .property('step2', new Schema('string')
          .condition((value, configuration) => {
            return (configuration.step3 !== undefined)
          })
        )
        .property('step3', new Schema('string')
          .condition((value, configuration) => {
            return (configuration.step1 !== undefined)
          })
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['step2', 'second'],
        ['step3', 'third'],
        ['step1', 'first'],
      ]);

      const result = await compiled.processAssignments(assignments, {});

      assert.deepStrictEqual(result, {
        step1: 'first',
        step2: 'second',
        step3: 'third'
      });
    });

    it('should handle circular condition dependencies gracefully', async function() {
      // Assignment A depends on B, B depends on A - both should fail
      const schema = new Schema('object')
        .property('a', new Schema('string')
          .condition((value, configuration) => configuration.b !== undefined)
        )
        .property('b', new Schema('string')
          .condition((value, configuration) => configuration.a !== undefined)
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['a', 'valueA'],
        ['b', 'valueB']
      ]);

      const result = (await compiled.processAssignments(assignments, {})) ?? {};

      // Both should be suppressed due to circular dependency
      assert.deepStrictEqual(result, {});
    });
  });

  describe('Conditional arrays', function() {

    it('should suppress array elements based on conditions', async function() {
      const schema = new Schema('object')
        .property('includeOptional', new Schema('boolean'))
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('name', new Schema('string'))
            .property('optional', new Schema('string')
              .condition((value, configuration) =>
                {
                  return configuration.includeOptional === true
                }
              )
            )
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['includeOptional', 'false'],
        ['items.0.name', 'Item 1'],
        ['items.0.optional', 'Should be suppressed'],
        ['items.1.name', 'Item 2'],
        ['items.1.optional', 'Also suppressed']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        includeOptional: false,
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' }
        ]
      });
    });

    it('should handle conditions that reference array element context', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('enabled', new Schema('boolean'))
            .property('value', new Schema('string')
              .condition((value, configuration, location) => {
                // Get the parent object from the configuration using the path
                const pathParts = location.path.split('.');
                const index = pathParts[pathParts.length - 2]; // Get array index
                return configuration?.items?.[index]?.enabled === true;
              })
            )
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['items.0.enabled', 'true'],
        ['items.0.value', 'should-appear'],
        ['items.1.enabled', 'false'],
        ['items.1.value', 'should-be-suppressed']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        items: [
          { enabled: true, value: 'should-appear' },
          { enabled: false }
        ]
      });
    });
  });

  describe('Conditions with defaults', function() {

    it('should apply defaults when condition passes but assignment missing', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'))
        .property('value', new Schema('string')
          .condition((value, configuration) => configuration.enabled === true)
          .default('default-value')
        )

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['enabled', 'true']
        // value not assigned, should use default
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        enabled: true,
        value: 'default-value'
      });
    });

    it('should not apply defaults when condition fails', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'))
        .property('value', new Schema('string', {
          condition: (value, configuration) => configuration.enabled === true,
          default: 'default-value'
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['enabled', 'false']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        enabled: false
        // value should not have default applied
      });
    });
  });

  describe('Conditions with required', function() {

    it('should not require property when condition fails', async function() {
      // TODO: Appears to be a bug - required check doesn't verify condition first
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'))
        .property('value', new Schema('string', {
          condition: (value, configuration) => configuration.enabled === true,
          required: true
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['enabled', 'false']
        // value not provided, but condition fails so not required
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        enabled: false
      });
    });

    it('should require property when condition passes', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'))
        .property('value', new Schema('string', {
          condition: (value, configuration) => configuration.enabled === true,
          required: true
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['enabled', 'true']
        // value not provided, condition passes, should fail required check
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        ValidationError
      );
    });
  });

  describe('Real-world scenario: Logger configuration', function() {

    it('should suppress remote logger config when local is selected', async function() {
      const schema = new Schema('object')
        .property('loggerType', new Schema('string'))
        .property('remoteLogger', new Schema('object', {
          condition: (value, configuration) => configuration.loggerType === 'remote'
        })
          .property('url', new Schema('string'))
          .property('apiKey', new Schema('string'))
          .property('level', new Schema('string', {
            default: 'info'
          }))
        )
        .property('localLogger', new Schema('object', {
          condition: (value, configuration) => configuration.loggerType === 'local'
        })
          .property('path', new Schema('string'))
          .property('level', new Schema('string', {
            default: 'debug'
          }))
        );

      const compiled = await resolver.compile(schema);

      // Environment variables specify remote logger config
      // but command line overrides to local
      const assignments = new Map([
        ['loggerType', 'local'],
        ['remoteLogger.url', 'http://remote.example.com'],
        ['remoteLogger.apiKey', 'secret-key'],
        ['localLogger.path', '/var/log/app.log']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        loggerType: 'local',
        localLogger: {
          path: '/var/log/app.log',
          level: 'debug'
        }
        // remoteLogger should be completely suppressed
      });
    });
  });
});
