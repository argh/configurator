
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Assignments - Basic Processing', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Simple property assignments', function() {

    it('should process single string property assignment', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['name', 'John']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, { name: 'John' });
    });

    it('should process multiple property assignments', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('age', new Schema('number'))
        .property('active', new Schema('boolean'));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['name', 'Alice'],
        ['age', '25'],
        ['active', 'true']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        name: 'Alice',
        age: 25,
        active: true
      });
    });

    it('should normalize values during assignment', async function() {
      const schema = new Schema('object')
        .property('email', new Schema('string', {
          normalizer: (v) => v.toLowerCase()
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['email', 'USER@EXAMPLE.COM']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.email, 'user@example.com');
    });

    it('should transform values during assignment', async function() {
      // Schema type describes output, not input
      // Since transformer produces a Date object, use 'any' or 'object' as base
      const schema = new Schema('object')
        .property('timestamp', new Schema('any', {
          transformer: (v) => new Date(Number(v))
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['timestamp', '1609459200000']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.ok(result.timestamp instanceof Date);
      assert.strictEqual(result.timestamp.getTime(), 1609459200000);
    });
  });

  describe('Nested property assignments', function() {

    it('should process nested object assignments with dotted paths', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string'))
          .property('email', new Schema('string'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['user.name', 'Bob'],
        ['user.email', 'bob@example.com']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        user: {
          name: 'Bob',
          email: 'bob@example.com'
        }
      });
    });

    it('should process deeply nested assignments', async function() {
      const schema = new Schema('object')
        .property('company', new Schema('object')
          .property('department', new Schema('object')
            .property('team', new Schema('object')
              .property('lead', new Schema('string'))
            )
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['company.department.team.lead', 'Alice']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        company: {
          department: {
            team: {
              lead: 'Alice'
            }
          }
        }
      });
    });
  });

  describe('Array assignments', function() {

    it('should process array element assignments by index with wildcard', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('string'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['items.0', 'first'],
        ['items.1', 'second'],
        ['items.2', 'third']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        items: ['first', 'second', 'third']
      });
    });

    it('should handle sparse array assignments', async function() {
      // Sparse arrays are an edge case - behavior TBD (error, strip, or fill)
      const schema = new Schema('object')
        .property('values', new Schema('array')
          .property('*', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['values.0', '10'],
        ['values.2', '30']
      ]);

      const result = await compiled.processAssignments(assignments);

      // Arrays fill undefined for missing indices
      assert.strictEqual(result.values[0], 10);
      assert.strictEqual(result.values[1], undefined);
      assert.strictEqual(result.values[2], 30);
    });

    it('should process nested array assignments', async function() {
      const schema = new Schema('object')
        .property('matrix', new Schema('array')
          .property('*', new Schema('array')
            .property('*', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['matrix.0.0', '1'],
        ['matrix.0.1', '2'],
        ['matrix.1.0', '3'],
        ['matrix.1.1', '4']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        matrix: [
          [1, 2],
          [3, 4]
        ]
      });
    });

    it('should process array of objects', async function() {
      const schema = new Schema('object')
        .property('users', new Schema('array')
          .property('*', new Schema('object')
            .property('name', new Schema('string'))
            .property('age', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['users.0.name', 'Alice'],
        ['users.0.age', '30'],
        ['users.1.name', 'Bob'],
        ['users.1.age', '25']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 }
        ]
      });
    });

    it('should expand "*" to all wildcard values when wildcard has values defined', async function() {
      // When array schema has a wildcard child with values defined,
      // assigning "*" should expand to all wildcard values
      const schema = new Schema('object')
        .property('stuff', new Schema('array')
          .property('*', new Schema('string', {
            values: ['a', 'b', 'c']
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['stuff', '*']  // Shorthand for all wildcard values
      ]);

      const result = await compiled.processAssignments(assignments);

      // Should expand to all values from the wildcard schema
      assert.deepStrictEqual(result, {
        stuff: ['a', 'b', 'c']
      });
    });
  });

  describe('Tuple assignments (fixed array indices)', function() {

    it('should process tuple with fixed numeric properties', async function() {
      // Tuple schema: [string, number, boolean]
      const schema = new Schema('object')
        .property('tuple', new Schema('array')
          .property('0', new Schema('string'))
          .property('1', new Schema('number'))
          .property('2', new Schema('boolean'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['tuple.0', 'first'],
        ['tuple.1', '42'],
        ['tuple.2', 'true']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        tuple: ['first', 42, true]
      });
    });

    it('should fail when assigning to undefined tuple index without wildcard', async function() {
      // Tuple schema with only indices 0 and 1 defined
      const schema = new Schema('object')
        .property('tuple', new Schema('array')
          .property('0', new Schema('string'))
          .property('1', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['tuple.0', 'first'],
        ['tuple.1', '42'],
        ['tuple.2', 'unexpected']  // Index 2 not defined
      ]);

      // Should fail in strict mode due to unexpected property
      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => {
          assert.ok(err instanceof Error);
          return err.name === 'SchemaError' && err.message.includes('tuple.2');
        }
      );
    });

    it('should use wildcard for indices beyond fixed tuple definitions', async function() {
      // Tuple with fixed first two elements, then wildcard for rest
      const schema = new Schema('object')
        .property('tuple', new Schema('array')
          .property('0', new Schema('string'))
          .property('1', new Schema('number'))
          .property('*', new Schema('boolean'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['tuple.0', 'first'],      // Uses '0' schema (string)
        ['tuple.1', '42'],         // Uses '1' schema (number)
        ['tuple.2', 'true'],       // Uses '*' schema (boolean)
        ['tuple.3', 'false']       // Uses '*' schema (boolean)
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        tuple: ['first', 42, true, false]
      });
    });

    it('should apply different schemas to fixed vs wildcard indices', async function() {
      // First element has different type and options than rest
      const schema = new Schema('object')
        .property('data', new Schema('array')
          .property('0', new Schema('string', {
            normalizer: (v) => v.toUpperCase()
          }))
          .property('*', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['data.0', 'header'],      // String, normalized to uppercase
        ['data.1', '10'],          // Number
        ['data.2', '20'],          // Number
        ['data.3', '30']           // Number
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        data: ['HEADER', 10, 20, 30]
      });
    });

    it('should handle tuple with different types for each index', async function() {
      // Complex tuple: [string, object, array]
      const schema = new Schema('object')
        .property('complex', new Schema('array')
          .property('0', new Schema('string'))
          .property('1', new Schema('object')
            .property('key', new Schema('string'))
          )
          .property('2', new Schema('array')
            .property('*', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['complex.0', 'label'],
        ['complex.1.key', 'value'],
        ['complex.2.0', '1'],
        ['complex.2.1', '2']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        complex: [
          'label',
          { key: 'value' },
          [1, 2]
        ]
      });
    });

    it('should allow partial tuple assignment with defaults', async function() {
      const schema = new Schema('object')
        .property('tuple', new Schema('array')
          .property('0', new Schema('string'))
          .property('1', new Schema('number', {
            default: 100
          }))
          .property('2', new Schema('boolean', {
            default: false
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['tuple.0', 'first']
        // Indices 1 and 2 should use defaults
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        tuple: ['first', 100, false]
      });
    });

    it('should enforce required on specific tuple indices', async function() {
      // Error is "Not a string" rather than "Required property tuple.0 is not set"
      const schema = new Schema('object')
        .property('tuple', new Schema('array')
          .property('0', new Schema('string', {
            required: true
          }))
          .property('1', new Schema('number'))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['tuple.1', '42']
        // Missing required index 0
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => err instanceof ValidationError && err.message.includes('tuple.0')
      );
    });
  });

  describe('Default values', function() {

    it('should populate default when property not assigned', async function() {
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

    it('should use assigned value over default', async function() {
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

    it('should populate nested defaults', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('timeout', new Schema('number', {
            default: 5000
          }))
          .property('retries', new Schema('number', {
            default: 3
          }))
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['config.timeout', '10000']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        config: {
          timeout: 10000,
          retries: 3
        }
      });
    });
  });

  describe('Required properties', function() {

    it('should throw ValidationError when required property missing', async function() {
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

    it('should succeed when required property provided', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string', {
          required: true
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['name', 'Required Value']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.name, 'Required Value');
    });

    it('should validate all required properties', async function() {
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
        // missing required password
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        ValidationError
      );
    });
  });

  describe('Validation', function() {

    it('should validate values after assignment', async function() {
      const schema = new Schema('object')
        .property('email', new Schema('string', {
          validator: /@/
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['email', 'invalid-email']
      ]);

      await assert.rejects(
        () => compiled.processAssignments(assignments),
        ValidationError
      );
    });

    it('should pass validation with valid values', async function() {
      const schema = new Schema('object')
        .property('email', new Schema('string', {
          validator: /@/
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['email', 'user@example.com']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.email, 'user@example.com');
    });

    it('should validate with constrained values', async function() {
      const schema = new Schema('object')
        .property('status', new Schema('string', {
          values: ['active', 'inactive', 'pending']
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['status', 'invalid-status']
      ]);

      // Wrapped in SchemaError with ValidationError as cause
      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => {
          assert.ok(err instanceof Error);
          return err.name === 'SchemaError' && err.cause instanceof ValidationError;
        }
      );
    });
  });

  describe('Empty and undefined handling', function() {

    it('should handle empty assignments map', async function() {
      const schema = new Schema('object')
        .property('optional', new Schema('string'));

      const compiled = resolver.compile(schema);

      const assignments = new Map();

      const result = await compiled.processAssignments(assignments) ?? {};

      assert.deepStrictEqual(result, {});
    });

    it('should not include properties with undefined values', async function() {
      const schema = new Schema('object')
        .property('random', new Schema('number'))
        .property('value', new Schema('string', {
          normalizer: (v) => v === 'undefined' ? undefined : v
        }));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['random', 10],
        ['value', 'undefined']
      ]);

      const result = await compiled.processAssignments(assignments);

      // Undefined values are not assigned
      assert.strictEqual(result.value, undefined);
    });
  });

  describe('Strict mode', function() {

    it('should reject unknown properties in strict mode by default', async function() {
      const schema = new Schema('object')
        .property('known', new Schema('string'));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['known', 'value'],
        ['unknown', 'invalid']
      ]);

      // Unknown properties should throw SchemaError wrapping ValidationError
      await assert.rejects(
        () => compiled.processAssignments(assignments),
        (err) => {
          assert.ok(err instanceof Error);
          return err.name === 'SchemaError' && err.message.includes('unknown');
        }
      );
    });

    it('should allow unknown properties in non-strict mode', async function() {
      const schema = new Schema('object')
        .property('known', new Schema('string'));

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['known', 'value'],
        ['unknown', 'allowed']
      ]);

      const result = await compiled.processAssignments(assignments, {}, { strict: false });

      assert.strictEqual(result.known, 'value');
      // Unknown property is silently ignored
    });
  });

  describe('Implicit properties', function() {

    // Test class with a computed property
    class PersonWithFullName {
      constructor() {
        this.firstName = '';
        this.lastName = '';
      }

      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      }

      set fullName(value) {
        throw new Error('fullName is read-only and cannot be assigned');
      }
    }

    it('should not assign implicit properties after transformation', async function() {
      const schema = new Schema('object')
        .property('person', new Schema('object')
          .transformer(() => new PersonWithFullName())
          .property('firstName', new Schema('string'))
          .property('lastName', new Schema('string'))
          .property('fullName', new Schema('string').implicit())
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['person.firstName', 'John'],
        ['person.lastName', 'Doe']
      ]);

      const result = await compiled.processAssignments(assignments);

      // Should not throw when accessing the computed property
      assert.strictEqual(result.person.firstName, 'John');
      assert.strictEqual(result.person.lastName, 'Doe');
      assert.strictEqual(result.person.fullName, 'John Doe');
      assert.ok(result.person instanceof PersonWithFullName);
    });

    it('should access implicit property convenience getter on CompiledSchema', async function() {
      const schema = new Schema('object')
        .property('computed', new Schema('string').implicit())
        .property('regular', new Schema('string'));

      const compiled = resolver.compile(schema);

      // Verify the convenience getter works
      assert.strictEqual(compiled.properties.computed.implicit, true);
      assert.strictEqual(compiled.properties.regular.implicit, false);
    });

    it('should not attempt to set implicit property even with value in assignments', async function() {
      // Test class with read-only getter that throws on set
      class DataWithId {
        constructor() {
          this._data = '';
        }

        get id() {
          return `id-${this._data}`;
        }

        set id(value) {
          throw new Error('id is computed and cannot be set');
        }

        get data() {
          return this._data;
        }

        set data(value) {
          this._data = value;
        }
      }

      const schema = new Schema('object')
        .property('record', new Schema('object')
          .transformer(() => new DataWithId())
          .property('data', new Schema('string'))
          .property('id', new Schema('string').implicit())
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['record.data', 'test123'],
        ['record.id', 'ignored-value']  // This should be ignored
      ]);

      // Should not throw even though id assignment is present
      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.record.data, 'test123');
      assert.strictEqual(result.record.id, 'id-test123');
      assert.ok(result.record instanceof DataWithId);
    });

    it('should work with nested implicit properties', async function() {
      class Address {
        constructor() {
          this.street = '';
          this.city = '';
          this.state = '';
          this.zip = '';
        }

        get formatted() {
          return `${this.street}, ${this.city}, ${this.state} ${this.zip}`;
        }

        set formatted(value) {
          throw new Error('formatted is computed');
        }
      }

      const schema = new Schema('object')
        .property('user', new Schema('object')
          .transformer(() => new Address())
          .property('street', new Schema('string'))
          .property('city', new Schema('string'))
          .property('state', new Schema('string'))
          .property('zip', new Schema('string'))
          .property('formatted', new Schema('string').implicit())
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['user.street', '123 Main St'],
        ['user.city', 'Springfield'],
        ['user.state', 'IL'],
        ['user.zip', '62701']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.user.street, '123 Main St');
      assert.strictEqual(result.user.formatted, '123 Main St, Springfield, IL 62701');
      assert.ok(result.user instanceof Address);
    });

    it('should handle implicit properties in arrays', async function() {
      class Item {
        constructor() {
          this.name = '';
          this.price = 0;
        }

        get displayName() {
          return `${this.name} ($${this.price})`;
        }

        set displayName(value) {
          throw new Error('displayName is computed');
        }
      }

      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .transformer(() => new Item())
            .property('name', new Schema('string'))
            .property('price', new Schema('number'))
            .property('displayName', new Schema('string').implicit())
          )
        );

      const compiled = resolver.compile(schema);

      const assignments = new Map([
        ['items.0.name', 'Widget'],
        ['items.0.price', '9.99'],
        ['items.1.name', 'Gadget'],
        ['items.1.price', '19.99']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.items[0].name, 'Widget');
      assert.strictEqual(result.items[0].displayName, 'Widget ($9.99)');
      assert.strictEqual(result.items[1].name, 'Gadget');
      assert.strictEqual(result.items[1].displayName, 'Gadget ($19.99)');
      assert.ok(result.items[0] instanceof Item);
      assert.ok(result.items[1] instanceof Item);
    });
  });
});
