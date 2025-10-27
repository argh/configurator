
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

    it('should apply default when property not assigned', async function() {
      const schema = new Schema('object')
        .property('port', new Schema('number', {
          default: 8080
        }))
        .property('host', new Schema('string'));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['host', 'localhost']
      ]);

      const result = await compiled.processAssignments(assignments);

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

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['port', '3000']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.port, 3000);
    });

    it('should apply defaults for nested properties', async function() {
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('port', new Schema('number', {
            default: 8080
          }))
          .property('timeout', new Schema('number', {
            default: 5000
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['server.port', '3000']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        server: {
          port: 3000,
          timeout: 5000
        }
      });
    });

    it('should apply default with function value', async function() {
      const schema = new Schema('object')
        .property('timestamp', new Schema('number', {
          default: () => Date.now()
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map();

      const result = await compiled.processAssignments(assignments);

      assert.ok(typeof result.timestamp === 'number');
      assert.ok(result.timestamp > 0);
    });

    it('should apply default for array elements', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('status', new Schema('string', {
              default: 'active'
            }))
            .property('name', new Schema('string'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['items.0.name', 'Item 1'],
        ['items.1.name', 'Item 2'],
        ['items.1.status', 'inactive']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        items: [
          { name: 'Item 1', status: 'active' },
          { name: 'Item 2', status: 'inactive' }
        ]
      });
    });
  });


  describe('Required option', function() {

    it('should throw when required property is missing', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string', {
          required: true
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map();

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        ValidationError
      );
    });

    it('should succeed when required property is provided', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string', {
          required: true
        }));

      const compiled = resolver.compile(schema);

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

      const compiled = resolver.compile(schema);

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
        .property('name', new Schema('string', {
          required: true
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map();

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

      const compiled = resolver.compile(schema);

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

    it('should satisfy required with default value', async function() {
      // TODO: Investigate - required check happens before defaults are applied
      const schema = new Schema('object')
        .property('status', new Schema('string', {
          required: true,
          default: 'active'
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map();

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        status: 'active'
      });
    });

    it('should use assigned value over default for required property', async function() {
      const schema = new Schema('object')
        .property('status', new Schema('string', {
          required: true,
          default: 'active'
        }));

      const compiled = resolver.compile(schema);

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
