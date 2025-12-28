
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Assignments - Value Options (default, inherit, required)', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Default option', function() {

    it('should apply default when property not assigned (shallow)', async function() {
      // Shallow defaults: populateDefaults() fills in defaults for properties
      // when the parent container exists
      const schema = new Schema('object')
        .property('port', new Schema('number', {
          default: 8080
        }))
        .property('host', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['host', 'localhost']  // This creates the root object
      ]);

      const result = await compiled.processAssignments(assignments);

      // Default applied because root object was created by 'host' assignment
      assert.deepStrictEqual(result, {
        host: 'localhost',
        port: 8080
      });
    });

    it('should not apply default when property is assigned', async function() {
      const schema = new Schema('object')
        .property('port', new Schema('number', {
          default: 8080
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['port', '3000']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.port, 3000);
    });

    it('should apply defaults for nested properties (shallow)', async function() {
      // Shallow defaults: populateDefaults() fills in defaults when parent exists
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('port', new Schema('number', {
            default: 8080
          }))
          .property('timeout', new Schema('number', {
            default: 5000
          }))
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['server.port', '3000']  // This creates the 'server' container
      ]);

      const result = await compiled.processAssignments(assignments);

      // 'timeout' default applied because 'server' container was created
      assert.deepStrictEqual(result, {
        server: {
          port: 3000,
          timeout: 5000
        }
      });
    });

    it('should NOT apply deep defaults when parent container does not exist', async function() {
      // Shallow defaults: populateDefaults() does NOT create parent containers
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
        ['otherProp', 'value']  // Does NOT create 'server' container
      ]);

      const result = await compiled.processAssignments(assignments);

      // 'server' container is NOT created, so defaults are NOT applied
      assert.deepStrictEqual(result, {
        otherProp: 'value'
        // No 'server' property
      });
      assert.strictEqual(result.server, undefined);
    });

    it('should return undefined with zero assignments (no container to populate)', async function() {
      // Zero assignments → zero output (defaults only populate existing containers)

      const schema = new Schema('object')
        .property('timestamp', new Schema('number', {
          default: () => Date.now()
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map();

      const result = await compiled.processAssignments(assignments);

      // No assignments means no object created (populateDefaults is shallow)
      assert.strictEqual(result, undefined);
    });

    it('should apply default for array elements (shallow)', async function() {
      // Shallow defaults: populateDefaults() fills in defaults when array element exists
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

      const assignments = new Map([
        ['items.0.name', 'Item 1'],        // Creates items[0]
        ['items.1.name', 'Item 2'],        // Creates items[1]
        ['items.1.status', 'inactive']
      ]);

      const result = await compiled.processAssignments(assignments);

      // 'status' defaults applied because array elements were created
      assert.deepStrictEqual(result, {
        items: [
          { name: 'Item 1', status: 'active' },
          { name: 'Item 2', status: 'inactive' }
        ]
      });
    });

    it('should NOT apply deep defaults to non-existent array elements', async function() {
      // Shallow defaults: populateDefaults() does NOT create array elements
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('status', new Schema('string', {
              default: 'active'
            }))
            .property('name', new Schema('string'))
          )
        )
        .property('otherProp', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['otherProp', 'value']  // Does NOT create 'items' array
      ]);

      const result = await compiled.processAssignments(assignments);

      // 'items' array is NOT created, so element defaults are NOT applied
      assert.deepStrictEqual(result, {
        otherProp: 'value'
        // No 'items' property
      });
      assert.strictEqual(result.items, undefined);
    });
  });


  describe('Required option', function() {

    it('should throw when required property is missing', async function() {
      const schema = new Schema('object')
        .property('trigger', new Schema('boolean'))
        .property('name', new Schema('string').required())


      const compiled = await resolver.compile(schema);

      const assignments = new Map([['trigger', true]]);

      await assert.rejects(
        () => compiled.processAssignments(assignments, {}),  // Pass {} to ensure root exists
        ValidationError
      );
    });

    it('should return undefined with zero assignments', async function() {
      // Zero assignments → zero output (no object created to validate)
      const schema = new Schema('object')
        .property('name', new Schema('string', {
          required: true
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map();

      const result = await compiled.processAssignments(assignments);

      // No assignments means no object is created
      assert.strictEqual(result, undefined);
    });

    it('should succeed when required property is provided', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string', {
          required: true
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['name', 'Test']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.name, 'Test');
    });

    it('should validate multiple required properties', async function() {
      const schema = new Schema('object')
        .property('username', new Schema('string', {
          required: true
        }))
        .property('password', new Schema('string', {
          required: true
        }))
        .property('email', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['username', 'admin']
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => {
          assert.ok(err instanceof ValidationError);
          return err.message.includes('password');
        }
      );
    });

    it('should require property even in non-strict mode', async function() {
      // required is orthogonal to strict - it always throws when missing
      const schema = new Schema('object')
        .property('trigger', new Schema('boolean'))
        .property('name', new Schema('string').required())

      const compiled = await resolver.compile(schema);

      const assignments = new Map([['trigger', true]]);

      await assert.rejects(
        () => compiled.processAssignments(assignments, {}, { strict: false }),
        ValidationError
      );
    });

    it('should validate required in nested objects', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string', {
            required: true
          }))
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['user.name', 'Alice']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        user: { name: 'Alice' }
      });
    });
  });

  describe('Interactions: default + required', function() {

    it('should satisfy required with default value when root exists', async function() {
      // When root exists, defaults are applied and satisfy required
      const schema = new Schema('object')
        .property('trigger', new Schema('boolean'))
        .property('status', new Schema('string')
          .required()
          .default('active')
        )

      const compiled = await resolver.compile(schema);

      const assignments = new Map([['trigger', true]]);

      const result = await compiled.processAssignments(assignments);

      // Default satisfies required
      assert.deepStrictEqual(result, {
        status: 'active',
        trigger: true
      });
    });

    it('should return undefined with zero assignments (even with default)', async function() {
      // Zero assignments → zero output (defaults only populate existing containers)

      const schema = new Schema('object')
        .property('status', new Schema('string', {
          required: true,
          default: 'active'
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map();

      const result = await compiled.processAssignments(assignments);

      // No assignments means no object created (defaults are shallow, not deep)
      assert.strictEqual(result, undefined);
    });

    it('should use assigned value over default for required property', async function() {
      const schema = new Schema('object')
        .property('status', new Schema('string', {
          required: true,
          default: 'active'
        }));

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['status', 'inactive']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        status: 'inactive'
      });
    });
  });



});
