
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CompiledSchema } from '../src/schema/compiled-schema.js';
import { ValidationError } from '../src/errors.js';

describe('Schema Compilation - Property Basics', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Single-level properties on objects', function() {

    it('should compile object with one property', function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.name instanceof CompiledSchema);
      assert.strictEqual(compiled.hasChildren, true);
    });

    it('should compile object with multiple properties', function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('age', new Schema('number'))
        .property('active', new Schema('boolean'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.name);
      assert.ok(compiled.properties.age);
      assert.ok(compiled.properties.active);
      assert.strictEqual(Object.keys(compiled.properties).length, 3);
    });

    it('should compile properties independently', function() {
      const schema = new Schema('object')
        .property('email', new Schema('string').required(true))
        .property('phone', new Schema('string').required(false));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.email.required, true);
      assert.strictEqual(compiled.properties.phone.required, false);
    });
  });

  describe('Property parent/name/path tracking', function() {

    it('should set parent reference on property schemas', function() {
      const schema = new Schema('object')
        .property('child', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.child.parent, compiled);
    });

    it('should set name on property schemas', function() {
      const schema = new Schema('object')
        .property('fieldName', new Schema('number'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.fieldName.name, 'fieldName');
    });

    it('should generate correct path for properties', function() {
      const schema = new Schema('object')
        .property('user', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.path, '');
      assert.strictEqual(compiled.properties.user.path, 'user');
    });

    it('should track parent/name for multiple properties', function() {
      const schema = new Schema('object')
        .property('a', new Schema('string'))
        .property('b', new Schema('number'))
        .property('c', new Schema('boolean'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.a.name, 'a');
      assert.strictEqual(compiled.properties.b.name, 'b');
      assert.strictEqual(compiled.properties.c.name, 'c');
      assert.strictEqual(compiled.properties.a.parent, compiled);
      assert.strictEqual(compiled.properties.b.parent, compiled);
      assert.strictEqual(compiled.properties.c.parent, compiled);
    });
  });

  describe('Wildcard properties on objects', function() {

    it('should compile object with wildcard property', function() {
      const schema = new Schema('object')
        .property('*', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties['*']);
      assert.strictEqual(compiled.hasChildren, true);
    });

    it('should use wildcard as fallback for getPropertySchema', function() {
      const schema = new Schema('object')
        .property('*', new Schema('number'));

      const compiled = resolver.compile(schema);

      // Any property name should resolve to wildcard
      const prop1 = compiled.getPropertySchema('anyField');
      const prop2 = compiled.getPropertySchema('anotherField');

      assert.strictEqual(prop1, compiled.properties['*']);
      assert.strictEqual(prop2, compiled.properties['*']);
    });

    it('should prioritize named properties over wildcard', function() {
      const schema = new Schema('object')
        .property('specific', new Schema('string').required(true))
        .property('*', new Schema('string').required(false));

      const compiled = resolver.compile(schema);

      // Specific property should be returned for its name
      const specificProp = compiled.getPropertySchema('specific');
      assert.strictEqual(specificProp.required, true);

      // Wildcard should be returned for other names
      const otherProp = compiled.getPropertySchema('other');
      assert.strictEqual(otherProp.required, false);
    });

    it('should compile wildcard property with constraints', function() {
      const schema = new Schema('object')
        .property('*', new Schema('number')
          .meta('minimum', 0)
          .meta('maximum', 100));

      const compiled = resolver.compile(schema);

      const wildcardProp = compiled.properties['*'];
      assert.strictEqual(wildcardProp.metadata.minimum, 0);
      assert.strictEqual(wildcardProp.metadata.maximum, 100);
    });
  });

  describe('Array wildcard properties', function() {

    it('should compile array with wildcard element schema', function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties['*']);
      assert.strictEqual(compiled.isArray, true);
      assert.strictEqual(compiled.hasChildren, true);
    });

    it('should use wildcard for all array elements', function() {
      const schema = new Schema('array')
        .property('*', new Schema('number'));

      const compiled = resolver.compile(schema);

      // Any index should resolve to wildcard
      const elem0 = compiled.getPropertySchema('0');
      const elem5 = compiled.getPropertySchema('5');
      const elem99 = compiled.getPropertySchema('99');

      assert.strictEqual(elem0, compiled.properties['*']);
      assert.strictEqual(elem5, compiled.properties['*']);
      assert.strictEqual(elem99, compiled.properties['*']);
    });

    it('should compile wildcard with complex element type', function() {
      const schema = new Schema('array')
        .property('*', new Schema('object')
          .property('id', new Schema('number'))
          .property('name', new Schema('string')));

      const compiled = resolver.compile(schema);

      const elementSchema = compiled.properties['*'];
      assert.ok(elementSchema.properties.id);
      assert.ok(elementSchema.properties.name);
    });
  });

  describe('Tuple properties (explicit indices)', function() {

    it('should compile array with explicit index properties', function() {
      const schema = new Schema('array')
        .property('0', new Schema('string'))
        .property('1', new Schema('number'))
        .property('2', new Schema('boolean'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties['0']);
      assert.ok(compiled.properties['1']);
      assert.ok(compiled.properties['2']);
    });

    it('should resolve explicit indices before wildcard', function() {
      const schema = new Schema('array')
        .property('0', new Schema('string').required(true))
        .property('*', new Schema('string').required(false));

      const compiled = resolver.compile(schema);

      // Index 0 should get the explicit property
      const prop0 = compiled.getPropertySchema('0');
      assert.strictEqual(prop0.required, true);

      // Other indices should get wildcard
      const prop1 = compiled.getPropertySchema('1');
      assert.strictEqual(prop1.required, false);
    });

    it('should compile tuple with different types at each position', function() {
      const schema = new Schema('array')
        .property('0', new Schema('string').meta('description', 'Name'))
        .property('1', new Schema('number').meta('description', 'Age'))
        .property('2', new Schema('string').meta('description', 'Email'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties['0'].metadata.description, 'Name');
      assert.strictEqual(compiled.properties['1'].metadata.description, 'Age');
      assert.strictEqual(compiled.properties['2'].metadata.description, 'Email');
    });

    it('should allow tuple with wildcard fallback', function() {
      const schema = new Schema('array')
        .property('0', new Schema('string'))
        .property('1', new Schema('number'))
        .property('*', new Schema('boolean'));

      const compiled = resolver.compile(schema);

      // First two positions are typed
      assert.ok(compiled.getPropertySchema('0'));
      assert.ok(compiled.getPropertySchema('1'));
      // Rest fall back to wildcard
      assert.strictEqual(compiled.getPropertySchema('2'), compiled.properties['*']);
      assert.strictEqual(compiled.getPropertySchema('10'), compiled.properties['*']);
    });
  });

  describe('Property compilation independence', function() {

    it('should compile each property with its own base type', function() {
      const schema = new Schema('object')
        .property('text', new Schema('string'))
        .property('count', new Schema('number'))
        .property('items', new Schema('array'));

      const compiled = resolver.compile(schema);

      // Each property should have its own normalizer
      assert.strictEqual(compiled.properties.text.normalize(42), '42');
      assert.strictEqual(compiled.properties.count.normalize('42'), 42);
      assert.deepStrictEqual(compiled.properties.items.normalize('a,b,c'), ['a', 'b', 'c']);
    });

    it('should compile properties with independent options', function() {
      const schema = new Schema('object')
        .property('required', new Schema('string').required(true).default('req'))
        .property('optional', new Schema('string').required(false).default('opt'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.required.required, true);
      assert.strictEqual(compiled.properties.required.default, 'req');
      assert.strictEqual(compiled.properties.optional.required, false);
      assert.strictEqual(compiled.properties.optional.default, 'opt');
    });

    it('should compile properties with independent metadata', function() {
      const schema = new Schema('object')
        .property('field1', new Schema('string')
          .meta('description', 'First field')
          .meta('example', 'value1'))
        .property('field2', new Schema('string')
          .meta('description', 'Second field')
          .meta('example', 'value2'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.field1.metadata.description, 'First field');
      assert.strictEqual(compiled.properties.field1.metadata.example, 'value1');
      assert.strictEqual(compiled.properties.field2.metadata.description, 'Second field');
      assert.strictEqual(compiled.properties.field2.metadata.example, 'value2');
    });
  });

  describe('Properties on non-object/array types', function() {

    it('should allow properties on schemas without explicit object type', function () {
      const schema = new Schema()
        .property('a', new Schema('string'))
        .property('b', new Schema('number'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.a);
      assert.ok(compiled.properties.b);
    });

    it('should not allow properties on primitive types', function () {
      const schema = new Schema('string')
        .property('invalid', new Schema('number'));

      assert.throws(() => resolver.compile(schema),
        {
          name: 'ConfiguratorError',
          message: /not a container/
        })
    });
  });

  describe('Property freezing', function() {

    it('should freeze properties object', function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled.properties));
    });

    it('should freeze each property schema', function() {
      const schema = new Schema('object')
        .property('field1', new Schema('string'))
        .property('field2', new Schema('number'));

      const compiled = resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled.properties.field1));
      assert.ok(Object.isFrozen(compiled.properties.field2));
    });
  });

  describe('hasChildren helper', function() {

    it('should return true for schemas with properties', function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.hasChildren, true);
    });

    it('should return false for schemas without properties', function() {
      const schema = new Schema('string');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.hasChildren, false);
    });

    it('should return true for wildcard-only schemas', function() {
      const schema = new Schema('object')
        .property('*', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.hasChildren, true);
    });
  });

  describe('getPropertySchema helper', function() {

    it('should return specific property when it exists', function() {
      const schema = new Schema('object')
        .property('specific', new Schema('string'));

      const compiled = resolver.compile(schema);

      const prop = compiled.getPropertySchema('specific');
      assert.strictEqual(prop, compiled.properties.specific);
    });

    it('should return wildcard when specific property does not exist', function() {
      const schema = new Schema('object')
        .property('*', new Schema('number'));

      const compiled = resolver.compile(schema);

      const prop = compiled.getPropertySchema('anything');
      assert.strictEqual(prop, compiled.properties['*']);
    });

    it('should return undefined when neither specific nor wildcard exists', function() {
      const schema = new Schema('object')
        .property('onlyThis', new Schema('string'));

      const compiled = resolver.compile(schema);

      const prop = compiled.getPropertySchema('notThis');
      assert.strictEqual(prop, undefined);
    });
  });

  describe('Mixed named and wildcard properties', function() {

    it('should handle mix of named and wildcard properties on object', function() {
      const schema = new Schema('object')
        .property('id', new Schema('number').required(true))
        .property('name', new Schema('string').required(true))
        .property('*', new Schema('string').required(false));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.getPropertySchema('id').required, true);
      assert.strictEqual(compiled.getPropertySchema('name').required, true);
      assert.strictEqual(compiled.getPropertySchema('anyOther').required, false);
    });

    it('should handle mix of named and wildcard properties on array', function() {
      const schema = new Schema('array')
        .property('0', new Schema('string').meta('role', 'first'))
        .property('1', new Schema('string').meta('role', 'second'))
        .property('*', new Schema('string').meta('role', 'rest'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.getPropertySchema('0').metadata.role, 'first');
      assert.strictEqual(compiled.getPropertySchema('1').metadata.role, 'second');
      assert.strictEqual(compiled.getPropertySchema('2').metadata.role, 'rest');
      assert.strictEqual(compiled.getPropertySchema('99').metadata.role, 'rest');
    });
  });
});
