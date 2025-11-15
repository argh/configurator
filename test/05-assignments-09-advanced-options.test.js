
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Assignments - Advanced Options', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Deep populate via manual populateDefaults()', function() {

    it('should populate deep defaults when visitUndefined: true', async function() {
      // Advanced: Manual deep populate creates containers for defaults
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('port', new Schema('number', {
            default: 8080
          }))
          .property('timeout', new Schema('number', {
            default: 5000
          }))
        )
        .property('otherProp', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['otherProp', 'value']
      ]);

      // Skip automatic populate
      const intermediate = await compiled.processAssignments(assignments, {}, {
        populateDefaults: false,
        validate: false
      });

      assert.deepStrictEqual(intermediate, {
        otherProp: 'value'
        // No server object yet
      });

      // Manually call populateDefaults with deep options
      const result = await compiled.populateDefaults(intermediate, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(result, {
        otherProp: 'value',
        server: {
          port: 8080,
          timeout: 5000
        }
      });
    });

    it('should populate deep defaults from empty object', async function() {
      // Deep populate can create entire structure from empty object
      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('host', new Schema('string', {
            default: 'localhost'
          }))
          .property('port', new Schema('number', {
            default: 5432
          }))
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.populateDefaults({}, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(result, {
        database: {
          host: 'localhost',
          port: 5432
        }
      });
    });

    it('should populate deep defaults in nested structures', async function() {
      // Deep populate works through multiple levels
      const schema = new Schema('object')
        .property('app', new Schema('object')
          .property('server', new Schema('object')
            .property('port', new Schema('number', {
              default: 3000
            }))
          )
          .property('database', new Schema('object')
            .property('pool', new Schema('number', {
              default: 10
            }))
          )
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.populateDefaults({}, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(result, {
        app: {
          server: {
            port: 3000
          },
          database: {
            pool: 10
          }
        }
      });
    });

    it('should populate deep defaults with mixed assigned/default values', async function() {
      // Deep populate fills in defaults around existing values
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('host', new Schema('string', {
            default: 'localhost'
          }))
          .property('port', new Schema('number', {
            default: 8080
          }))
        )
        .property('client', new Schema('object')
          .property('timeout', new Schema('number', {
            default: 30000
          }))
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['server.port', '3000']
      ]);

      const intermediate = await compiled.processAssignments(assignments, {}, {
        populateDefaults: false,
        validate: false
      });

      const result = await compiled.populateDefaults(intermediate, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(result, {
        server: {
          host: 'localhost',  // Deep default
          port: 3000          // Assigned value
        },
        client: {
          timeout: 30000      // Deep default
        }
      });
    });
  });

  describe('Deep required via manual validate()', function() {

    it('should enforce deep required when visitUndefinedShallow: false', async function() {
      // Advanced: Deep validation enforces required even without assignments
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('host', new Schema('string', {
            required: true
          }))
        );

      const compiled = await resolver.compile(schema);

      const result = {};

      await assert.rejects(
        () => compiled.validate(result, {
          visitUndefinedShallow: false,
          visitUndefined: true
        }),
        (err) => err instanceof ValidationError && err.message.includes('host')
      );
    });

    it('should NOT enforce deep required with default shallow behavior', async function() {
      // Shallow validation (default) doesn't check non-existent containers
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('host', new Schema('string', {
            required: true
          }))
        );

      const compiled = await resolver.compile(schema);

      const result = {};

      // No error with shallow validation
      const validated = await compiled.validate(result);

      assert.deepStrictEqual(validated, {});
    });

    it('should enforce deep required at multiple levels', async function() {
      // Deep validation checks required at all levels
      const schema = new Schema('object')
        .property('app', new Schema('object')
          .property('server', new Schema('object')
            .property('port', new Schema('number', {
              required: true
            }))
          )
        );

      const compiled = await resolver.compile(schema);

      const result = {};

      await assert.rejects(
        () => compiled.validate(result, {
          visitUndefinedShallow: false,
          visitUndefined: true
        }),
        (err) => err instanceof ValidationError && err.message.includes('port')
      );
    });

    it('should satisfy deep required with deep defaults', async function() {
      // Deep populate + deep validate work together
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('host', new Schema('string', {
            required: true,
            default: 'localhost'
          }))
        );

      const compiled = await resolver.compile(schema);

      const result = {};

      // Deep populate
      const populated = await compiled.populateDefaults(result, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      // Deep validate
      const validated = await compiled.validate(populated, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(validated, {
        server: {
          host: 'localhost'
        }
      });
    });
  });

  describe('Combined workflows', function() {

    it('should support full manual control of populate and validate', async function() {
      // Full manual control: process → deep populate → deep validate
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('required', new Schema('string', {
            required: true,
            default: 'value'
          }))
          .property('optional', new Schema('string', {
            default: 'optional-value'
          }))
        )
        .property('data', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['data', 'test']
      ]);

      // Step 1: Process assignments only
      const processed = await compiled.processAssignments(assignments, {}, {
        populateDefaults: false,
        validate: false
      });

      assert.deepStrictEqual(processed, {
        data: 'test'
      });

      // Step 2: Deep populate
      const populated = await compiled.populateDefaults(processed, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(populated, {
        data: 'test',
        config: {
          required: 'value',
          optional: 'optional-value'
        }
      });

      // Step 3: Deep validate
      const validated = await compiled.validate(populated, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(validated, {
        data: 'test',
        config: {
          required: 'value',
          optional: 'optional-value'
        }
      });
    });

    it('should support shallow populate with deep validate', async function() {
      // Mixed: shallow populate, then deep validate
      const schema = new Schema('object')
        .property('existing', new Schema('object')
          .property('host', new Schema('string'))
          .property('port', new Schema('number', {
            default: 8080
          }))
        )
        .property('missing', new Schema('object')
          .property('value', new Schema('string', {
            required: true,
            default: 'required'
          }))
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['existing.host', 'localhost']
      ]);

      const processed = await compiled.processAssignments(assignments, {}, {
        validate: false
      });

      // Shallow populate applied the default to 'existing' but not 'missing'
      assert.deepStrictEqual(processed, {
        existing: {
          host: 'localhost',
          port: 8080
        }
      });

      // Deep validate will fail because 'missing' doesn't exist
      await assert.rejects(
        () => compiled.validate(processed, {
          visitUndefinedShallow: false,
          visitUndefined: true
        }),
        (err) => err instanceof ValidationError && err.message.includes('value')
      );
    });

    it('should demonstrate default vs manual deep workflow', async function() {
      // Comparison: default behavior vs manual deep
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('port', new Schema('number', {
            default: 8080
          }))
        );

      const compiled = await resolver.compile(schema);

      // Default (shallow) workflow
      const shallowResult = await compiled.processAssignments(new Map(), {});
      assert.deepStrictEqual(shallowResult, {});

      // Manual deep workflow
      const deepIntermediate = await compiled.processAssignments(new Map(), {}, {
        populateDefaults: false,
        validate: false
      });
      const deepResult = await compiled.populateDefaults(deepIntermediate, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(deepResult, {
        server: {
          port: 8080
        }
      });
    });
  });

  describe('Array deep defaults', function() {

    it('should NOT populate deep defaults for array without elements', async function() {
      // Deep populate doesn't create array elements (no indices to populate)
      // Arrays without defaults at the array level aren't created
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('status', new Schema('string', {
              default: 'active'
            }))
          )
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.populateDefaults({}, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      // No array created because only child elements have defaults, not the array itself
      assert.deepStrictEqual(result, {});
    });

    it('should populate deep defaults within existing array elements', async function() {
      // Deep populate fills defaults in existing array elements
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('status', new Schema('string', {
              default: 'active'
            }))
            .property('name', new Schema('string'))
          )
        );

      const compiled = await resolver.compile(schema);

      const input = {
        items: [
          { name: 'item1' },
          { name: 'item2', status: 'inactive' }
        ]
      };

      const result = await compiled.populateDefaults(input, {
        visitUndefinedShallow: false,
        visitUndefined: true
      });

      assert.deepStrictEqual(result, {
        items: [
          { name: 'item1', status: 'active' },
          { name: 'item2', status: 'inactive' }
        ]
      });
    });
  });
});
